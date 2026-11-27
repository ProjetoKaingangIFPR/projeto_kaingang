import { getPlatformProxy } from 'wrangler';
import { readFile, writeFile, mkdir, stat, rename, open } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runIndex = process.argv.indexOf('--run-dir');
const directory = runIndex === -1 ? path.join(root, 'build/stored-media') : path.resolve(root, process.argv[runIndex + 1]);
if (!directory.startsWith(path.join(root, 'build') + path.sep)) throw new Error('A execução deve ficar em backend/build.');
await mkdir(directory, { recursive: true });
const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
const remoteConfig = path.join(directory, 'remote.json');
await writeFile(remoteConfig, JSON.stringify({ name: config.name, compatibility_date: config.compatibility_date,
  r2_buckets: config.r2_buckets.map(binding => ({ ...binding, remote: true })),
  d1_databases: config.d1_databases.map(({ migrations_dir, ...binding }) => ({ ...binding, remote: true })),
}));
const platform = await getPlatformProxy({ configPath: remoteConfig, envFiles: [], persist: false, remoteBindings: true });
try {
  const { DB, MEDIA } = platform.env;
  const command = process.argv[2] ?? 'inventory';
  if (!['inventory', 'download', 'plan', 'apply', 'verify'].includes(command)) throw new Error('Use inventory, download, plan, apply ou verify.');
  const [stories, media] = await Promise.all([
    DB.prepare('SELECT * FROM story_files ORDER BY created, position, id').all(),
    DB.prepare('SELECT * FROM media ORDER BY created_at, id').all(),
  ]);
  const objects = [];
  let cursor;
  do {
    const page = await MEDIA.list({ cursor, limit: 1000, include: ['httpMetadata', 'customMetadata'] });
    objects.push(...page.objects.map(object => ({ key: object.key, size: object.size, etag: object.etag,
      uploaded: object.uploaded, httpMetadata: object.httpMetadata, customMetadata: object.customMetadata })));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const snapshot = { at: new Date().toISOString(), bucket: config.r2_buckets[0].bucket_name,
    databaseId: config.d1_databases[0].database_id, stories: stories.results, media: media.results, objects };
  const inventoryPath = path.join(directory, 'inventory.json');
  // A fixed snapshot is the source for backup, comparison and eventual replacement.
  if (command === 'inventory') await writeFile(inventoryPath, JSON.stringify(snapshot, null, 2));
  const references = [...snapshot.stories.map(file => ({ kind: 'story', ...file, key: file.object_key ?? 'stories/' + file.id })),
    ...snapshot.media.map(file => ({ kind: 'tour', ...file, name: file.id, type: file.content_type, key: file.object_key }))];
  console.log(JSON.stringify({ files: references.length, objects: objects.length, bytes: objects.reduce((sum, file) => sum + file.size, 0),
    videos: references.filter(file => file.type.startsWith('video/')).length,
    images: references.filter(file => file.type.startsWith('image/')).length,
    unreferencedObjects: objects.filter(object => !references.some(file => file.key === object.key)).length }));
  if (command === 'plan') {
    const originals = JSON.parse(await readFile(path.join(directory, 'backups.json'), 'utf8'));
    const comparison = JSON.parse(await readFile(path.join(directory, 'comparison.json'), 'utf8'));
    const lossless = JSON.parse(await readFile(path.join(directory, 'lossless-comparison.json'), 'utf8'));
    if (comparison.results.length !== originals.length || lossless.results.length !== originals.filter(file => file.type === 'image/jpeg').length)
      throw new Error('As comparações ainda não terminaram.');
    const entries = [];
    for (const source of originals) {
      // Prefer a pixel-identical JPEG over another lossy generation.
      const result = lossless.results.find(result => result.id === source.id && result.status === 'accepted')
        ?? comparison.results.find(result => result.id === source.id && result.status === 'accepted');
      if (!result) continue;
      if (result.sourceSha256 !== source.sha256 || result.sourceBytes !== source.size) throw new Error('Fonte da comparação alterada.');
      const candidatePath = result.candidatePath ?? path.join(directory, 'candidates', source.id);
      if (!path.resolve(candidatePath).startsWith(path.join(directory, 'candidates') + path.sep)) throw new Error('Candidato fora da pasta autorizada.');
      if ((await stat(candidatePath)).size !== result.outputBytes || result.outputBytes > source.size * 0.95) throw new Error('Candidato inválido.');
      const sha256 = await hashFile(candidatePath);
      entries.push({ source, result, candidatePath, sha256, newKey: `optimized/${new Date().toISOString().slice(0, 10)}/${source.kind}/${source.id}-${sha256.slice(0, 16)}` });
    }
    const plan = { at: new Date().toISOString(), entries, savedBytes: entries.reduce((sum, entry) => sum + entry.source.size - entry.result.outputBytes, 0) };
    await saveJson(path.join(directory, 'plan.json'), plan);
    console.log(JSON.stringify({ planned: entries.length, savedBytes: plan.savedBytes, methods: entries.reduce((counts, entry) => {
      const method = entry.result.method ?? 'browser'; counts[method] = (counts[method] ?? 0) + 1; return counts;
    }, {}) }));
  }
  if (command === 'apply' || command === 'verify') {
    const plan = JSON.parse(await readFile(path.join(directory, 'plan.json'), 'utf8'));
    const journalPath = path.join(directory, 'applied.json');
    let journal;
    try { journal = JSON.parse(await readFile(journalPath, 'utf8')); } catch { journal = { entries: [] }; }
    const limitIndex = process.argv.indexOf('--limit');
    const limit = limitIndex === -1 ? plan.entries.length : Number(process.argv[limitIndex + 1]);
    if (!Number.isInteger(limit) || limit < 0) throw new Error('Limite inválido.');
    for (const [index, entry] of plan.entries.slice(0, limit).entries()) {
      const { source, result, newKey } = entry;
      if (!['story', 'culture', 'tour'].includes(source.kind)) throw new Error('Acervo desconhecido.');
      const isStory = source.kind !== 'tour';
      const record = command === 'verify'
        ? (isStory ? snapshot.stories : snapshot.media).find(record => record.id === source.id)
        : await DB.prepare(isStory ? 'SELECT * FROM story_files WHERE id=?' : 'SELECT * FROM media WHERE id=?').bind(source.id).first();
      const currentType = isStory ? record?.type : record?.content_type;
      let state = journal.entries.find(state => state.id === source.id);
      if (!state) { state = { id: source.id, newKey, sourceKey: source.key, stage: 'planned' }; journal.entries.push(state); }
      if (command === 'verify') {
        if (record?.object_key !== newKey || record.size !== result.outputBytes || currentType !== result.outputType)
          throw new Error('Catálogo divergente: ' + source.id);
        const object = snapshot.objects.find(object => object.key === newKey);
        if (!object || object.size !== result.outputBytes || object.customMetadata?.optimizedSha256 !== entry.sha256)
          throw new Error('Objeto divergente: ' + source.id);
        const apiIndex = process.argv.indexOf('--api-origin');
        if (apiIndex !== -1 && (index === 0 || source.kind === 'tour')) {
          const origin = new URL(process.argv[apiIndex + 1]);
          if (origin.protocol !== 'https:') throw new Error('A API deve usar HTTPS.');
          const url = new URL(isStory ? '/api/stories/' + source.id + '/media' : '/api/media/' + source.id, origin);
          const response = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
          if (!response.ok || response.headers.get('Content-Type') !== result.outputType) throw new Error('Resposta pública divergente.');
          const etag = response.headers.get('ETag');
          await response.body?.cancel();
          if (!etag) throw new Error('ETag público ausente.');
          const cached = await fetch(url, { headers: { 'If-None-Match': etag } });
          if (cached.status !== 304) { await cached.body?.cancel(); throw new Error('Revalidação do cache reprovada.'); }
        }
        if (index % 25 === 0 || index === plan.entries.length - 1) console.log(`${index + 1}/${plan.entries.length} verificado`);
        continue;
      }
      if (state.stage === 'committed') continue;
      if (!record || record.object_key !== newKey && (record.object_key !== source.object_key || record.size !== source.size || currentType !== source.type || isStory && record.status !== 'ready'))
        throw new Error('Arquivo alterado por outra operação: ' + source.id);
      if (await hashFile(source.backupPath) !== source.sha256 || await hashFile(entry.candidatePath) !== entry.sha256)
        throw new Error('Backup ou candidato alterado: ' + source.id);
      const original = await MEDIA.head(source.key);
      if (record.object_key !== newKey && (!original || original.etag !== source.etag)) throw new Error('Objeto de origem alterado: ' + source.id);
      const metadata = snapshot.objects.find(object => object.key === source.key)
        ?? JSON.parse(await readFile(inventoryPath, 'utf8')).objects.find(object => object.key === source.key);
      let uploaded = await MEDIA.head(newKey);
      if (uploaded && uploaded.customMetadata?.optimizedSha256 !== entry.sha256) throw new Error('Chave de destino em uso.');
      if (!uploaded) {
        const httpMetadata = { ...metadata.httpMetadata, contentType: result.outputType };
        if (httpMetadata.cacheExpiry) httpMetadata.cacheExpiry = new Date(httpMetadata.cacheExpiry);
        const upload = await MEDIA.createMultipartUpload(newKey, { httpMetadata, customMetadata: {
          ...metadata.customMetadata, optimizedSha256: entry.sha256, sourceSha256: source.sha256,
          optimizationVersion: plan.at.slice(0, 10), optimizationMethod: result.method ?? 'browser',
        } });
        const handle = await open(entry.candidatePath, 'r');
        try {
          const parts = []; let offset = 0;
          while (offset < result.outputBytes) {
            const buffer = new Uint8Array(Math.min(8 * 1024 * 1024, result.outputBytes - offset));
            let filled = 0;
            while (filled < buffer.length) {
              const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, offset + filled);
              if (!bytesRead) throw new Error('Candidato truncado.'); filled += bytesRead;
            }
            parts.push(await upload.uploadPart(parts.length + 1, buffer)); offset += filled;
          }
          uploaded = await upload.complete(parts);
        } catch (error) { await upload.abort().catch(() => {}); throw error; }
        finally { await handle.close(); }
      }
      if (uploaded.size !== result.outputBytes) throw new Error('Tamanho enviado divergente.');
      // Verify the bytes read back from R2 before switching any public reference.
      const remote = await MEDIA.get(newKey);
      if (!remote?.body) throw new Error('Candidato enviado não encontrado.');
      const remoteHash = createHash('sha256');
      for await (const chunk of remote.body) remoteHash.update(chunk);
      if (remoteHash.digest('hex') !== entry.sha256) throw new Error('Integridade do envio reprovada.');
      state.stage = 'uploaded'; await saveJson(journalPath, journal);
      if (record.object_key !== newKey) {
        const changed = isStory
          ? await DB.prepare("UPDATE story_files SET object_key=?,size=?,type=?,name=? WHERE id=? AND status='ready' AND object_key IS ? AND size=? AND type=?")
            .bind(newKey, result.outputBytes, result.outputType, result.outputName, source.id, source.object_key, source.size, source.type).run()
          : await DB.prepare('UPDATE media SET object_key=?,size=?,content_type=? WHERE id=? AND object_key=? AND size=? AND content_type=?')
            .bind(newKey, result.outputBytes, result.outputType, source.id, source.object_key, source.size, source.type).run();
        if (changed.meta.changes !== 1) throw new Error('Catálogo alterado durante a atualização.');
      }
      state.stage = 'switched'; await saveJson(journalPath, journal);
      const active = await DB.prepare(isStory ? 'SELECT object_key,size,type FROM story_files WHERE id=?' : 'SELECT object_key,size,content_type AS type FROM media WHERE id=?').bind(source.id).first();
      if (active?.object_key !== newKey || active.size !== result.outputBytes || active.type !== result.outputType) throw new Error('Validação do catálogo reprovada.');
      const referencesToOld = await DB.prepare("SELECT (SELECT COUNT(*) FROM story_files WHERE COALESCE(object_key,'stories/'||id)=?) + (SELECT COUNT(*) FROM media WHERE object_key=?) AS count")
        .bind(source.key, source.key).first('count');
      const oldObject = await MEDIA.head(source.key);
      if (referencesToOld || oldObject && oldObject.etag !== source.etag) throw new Error('Origem ainda referenciada ou alterada; foi preservada.');
      if (oldObject) await MEDIA.delete(source.key);
      state.stage = 'committed'; state.at = new Date().toISOString(); state.savedBytes = source.size - result.outputBytes;
      await saveJson(journalPath, journal);
      console.log(`${index + 1}/${plan.entries.length} aplicado, economia ${state.savedBytes} bytes`);
    }
    if (command === 'verify' && limit === plan.entries.length) {
      const before = JSON.parse(await readFile(inventoryPath, 'utf8'));
      const allowed = { story: new Set(['object_key', 'size', 'type', 'name']), tour: new Set(['object_key', 'size', 'content_type']) };
      for (const group of ['stories', 'media']) for (const original of before[group]) {
        const current = snapshot[group].find(file => file.id === original.id);
        const changed = plan.entries.some(entry => entry.source.id === original.id);
        const permitted = group === 'stories' ? allowed.story : allowed.tour;
        if (!current) throw new Error('Registro original ausente.');
        for (const key of Object.keys(original)) {
          if (changed && permitted.has(key)) continue;
          if (current[key] !== original[key]) throw new Error('Metadado alterado: ' + original.id + ' ' + key);
        }
        if (!changed) {
          const key = original.object_key ?? 'stories/' + original.id;
          if (before.objects.find(object => object.key === key)?.etag !== snapshot.objects.find(object => object.key === key)?.etag)
            throw new Error('Objeto que deveria ser preservado foi alterado.');
        }
      }
      const originalBackups = JSON.parse(await readFile(path.join(directory, 'backups.json'), 'utf8'));
      for (const original of originalBackups) if (await hashFile(original.backupPath) !== original.sha256) throw new Error('Backup original alterado.');
      const beforeBytes = before.objects.reduce((sum, file) => sum + file.size, 0);
      const afterBytes = snapshot.objects.reduce((sum, file) => sum + file.size, 0);
      const unreferenced = snapshot.objects.filter(object => !references.some(file => file.key === object.key));
      if (unreferenced.length || before.objects.length !== snapshot.objects.length || beforeBytes - afterBytes !== plan.savedBytes)
        throw new Error('Totais finais do bucket não conferem com o plano.');
      const verification = { at: new Date().toISOString(), modified: plan.entries.length, beforeBytes, afterBytes,
        savedBytes: beforeBytes - afterBytes, objects: snapshot.objects.length, verifiedOriginalBackups: originalBackups.length,
        originalVideosUnchanged: before.stories.filter(file => file.type.startsWith('video/') && !plan.entries.some(entry => entry.source.id === file.id)).length,
        videosModified: before.stories.filter(file => file.type.startsWith('video/') && plan.entries.some(entry => entry.source.id === file.id)).length,
        originalAudioUnchanged: before.stories.filter(file => file.type.startsWith('audio/')).length,
        metadataPreserved: true, unreferencedObjects: unreferenced.length };
      await saveJson(path.join(directory, 'verification.json'), verification);
      console.log(JSON.stringify(verification));
    }
  }
  if (command === 'download') {
    const source = JSON.parse(await readFile(inventoryPath, 'utf8'));
    const eligible = [...source.stories.filter(file => file.status === 'ready').map(file => ({ kind: 'story', ...file, key: file.object_key ?? 'stories/' + file.id })),
      ...source.media.map(file => ({ kind: 'tour', ...file, name: file.id, type: file.content_type, key: file.object_key }))]
      .filter(file => /^(image|video)\//.test(file.type));
    await mkdir(path.join(directory, 'originals'), { recursive: true });
    const backups = [];
    for (const [index, file] of eligible.entries()) {
      const object = source.objects.find(object => object.key === file.key);
      if (!object || object.size !== file.size) throw new Error('Tamanho inconsistente: ' + file.id);
      const destination = path.join(directory, 'originals', file.id);
      let downloaded = false;
      try { downloaded = (await stat(destination)).size === file.size; } catch {}
      if (!downloaded) {
        const remote = await MEDIA.get(file.key, { onlyIf: { etagMatches: object.etag } });
        if (!remote?.body || remote.etag !== object.etag) throw new Error('Arquivo alterado durante backup: ' + file.id);
        const hash = createHash('sha256');
        await pipeline(remote.body, async function* (chunks) { for await (const chunk of chunks) { hash.update(chunk); yield chunk; } }, createWriteStream(destination));
        const sha256 = hash.digest('hex');
        if ((await stat(destination)).size !== object.size) throw new Error('Backup incompleto: ' + file.id);
        await writeFile(destination + '.sha256', sha256);
      }
      backups.push({ ...file, etag: object.etag, backupPath: destination, sha256: await readFile(destination + '.sha256', 'utf8') });
      await writeFile(path.join(directory, 'backups.json'), JSON.stringify(backups, null, 2));
      console.log(`${index + 1}/${eligible.length} backup ${file.type} ${file.size} bytes`);
    }
  }
} finally { await platform.dispose(); }

async function hashFile(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
async function saveJson(filename, data) {
  await writeFile(filename + '.tmp', JSON.stringify(data, null, 2));
  await rename(filename + '.tmp', filename);
}
