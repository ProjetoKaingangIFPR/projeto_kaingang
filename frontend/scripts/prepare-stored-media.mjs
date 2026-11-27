import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const runIndex = process.argv.indexOf('--run-dir');
const directory = runIndex === -1 ? path.resolve(frontend, '../backend/build/stored-media') : path.resolve(frontend, process.argv[runIndex + 1]);
if (!directory.startsWith(path.resolve(frontend, '../backend/build') + path.sep)) throw new Error('Execução fora de backend/build.');
const videosOnly = process.argv.includes('--videos-only');
const externalIndex = process.argv.indexOf('--external-report');
const externalReport = externalIndex === -1 ? null : process.argv[externalIndex + 1];
if (externalReport && !/^[\w.-]+\.json$/.test(externalReport)) throw new Error('Relatório externo inválido.');
const vbr = process.argv.includes('--vbr');
const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex === -1 ? Infinity : Number(process.argv[limitIndex + 1]);
if (!(limit > 0)) throw new Error('Limite inválido.');
const reportIndex = process.argv.indexOf('--report-name');
const reportName = reportIndex === -1 ? 'comparison.json' : process.argv[reportIndex + 1];
if (!/^[\w.-]+\.json$/.test(reportName)) throw new Error('Nome de relatório inválido.');
const review = process.argv.includes('--review');
const qualityIndex = process.argv.indexOf('--vbr-quality');
const vbrQuality = qualityIndex === -1 ? 'high' : Number(process.argv[qualityIndex + 1]);
if (vbrQuality !== 'high' && !(vbrQuality >= .5 && vbrQuality <= 1)) throw new Error('Qualidade inválida.');
const reportPath = path.join(directory, reportName);
await mkdir(path.join(directory, 'candidates'), { recursive: true });
let report;
try { report = JSON.parse(await readFile(reportPath, 'utf8')); }
catch { report = { at: new Date().toISOString(), results: [] }; }
const inventory = JSON.parse(await readFile(path.join(directory, 'inventory.json'), 'utf8'));
const total = Math.min(limit, videosOnly ? inventory.stories.filter(file => file.status === 'ready' && file.type.startsWith('video/')).length
  : inventory.stories.filter(file => file.status === 'ready' && /^(image|video)\//.test(file.type)).length + inventory.media.length);
const token = randomUUID();
let finish;
const completed = new Promise(resolve => { finish = resolve; });
const server = await createServer({ root: frontend, configFile: false, appType: 'custom', server: {
  host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/build/**'] },
}, plugins: vbr ? [{ name: 'diagnostic-vbr', transform(code, id) {
  if (id.replaceAll('\\', '/').endsWith('/src/admin/optimizeVideo.ts')) {
    const replacement = code.replace(/new Quality\(0?\.6(?:0)?\)/, `new Quality({ quality: ${JSON.stringify(vbrQuality)}, preferBitrate: true })`);
    if (replacement === code) throw new Error('Preset de teste não aplicado.');
    return replacement;
  }
} }] : [] });
async function backups() {
  try {
    const files = JSON.parse(await readFile(path.join(directory, 'backups.json'), 'utf8'));
    return (videosOnly ? files.filter(file => file.type.startsWith('video/')) : files).slice(0, limit);
  }
  catch { return []; }
}
async function persist() {
  const temporary = reportPath + '.tmp';
  await writeFile(temporary, JSON.stringify(report, null, 2));
  await rename(temporary, reportPath);
}
server.middlewares.use(async (req, res, next) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith('/__stored/')) return next();
    if (url.searchParams.get('token') !== token) { res.statusCode = 403; return res.end(); }
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/__stored/page') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<script type="module">(${prepare.toString()})(${JSON.stringify(token)},${review}).catch(error => fetch('/__stored/fatal?token=${token}', {method:'POST',body:String(error)}))</script>`);
    }
    if (url.pathname === '/__stored/next') {
      const ready = await backups();
      let external = [];
      if (externalReport) { try { external = JSON.parse(await readFile(path.join(directory, externalReport), 'utf8')).results; } catch {} }
      const job = ready.find(file => !report.results.some(result => result.id === file.id) && (!externalReport || external.some(result => result.id === file.id)));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ job: job && { id: job.id, kind: job.kind, name: job.name, type: job.type, size: job.size,
        sha256: job.sha256, external: external.find(result => result.id === job.id) }, done: report.results.length === total }));
    }
    if (url.pathname === '/__stored/external') {
      const results = JSON.parse(await readFile(path.join(directory, externalReport), 'utf8')).results;
      const result = results.find(result => result.id === url.searchParams.get('id'));
      if (!result?.candidatePath || !path.resolve(result.candidatePath).startsWith(path.join(directory, 'candidates') + path.sep)) throw new Error('Candidato externo inválido.');
      res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Content-Length', result.outputBytes);
      return await pipeline(createReadStream(result.candidatePath), res);
    }
    if (url.pathname === '/__stored/source') {
      const job = (await backups()).find(file => file.id === url.searchParams.get('id'));
      if (!job || (await stat(job.backupPath)).size !== job.size) throw new Error('Backup incompleto.');
      res.setHeader('Content-Type', job.type);
      res.setHeader('Content-Length', job.size);
      return await pipeline(createReadStream(job.backupPath), res);
    }
    if (url.pathname === '/__stored/candidate') {
      const id = url.searchParams.get('id');
      if (!(await backups()).some(file => file.id === id)) throw new Error('Arquivo desconhecido.');
      const destination = path.join(directory, 'candidates', id);
      await pipeline(req, createWriteStream(destination + '.tmp'));
      await rename(destination + '.tmp', destination);
      return res.end('ok');
    }
    if (url.pathname === '/__stored/result') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const result = JSON.parse(Buffer.concat(chunks).toString());
      const job = (await backups()).find(file => file.id === result.id);
      if (!job) throw new Error('Resultado desconhecido.');
      if (result.quality?.reviewImage) {
        const reviewPath = path.join(directory, reportName.replace(/\.json$/, '') + '-' + job.id + '.jpg');
        await writeFile(reviewPath, Buffer.from(result.quality.reviewImage.split(',')[1], 'base64'));
        delete result.quality.reviewImage; result.quality.reviewPath = reviewPath;
      }
      const candidatePath = result.candidatePath ?? path.join(directory, 'candidates', job.id);
      if (!path.resolve(candidatePath).startsWith(path.join(directory, 'candidates') + path.sep)) throw new Error('Caminho de candidato inválido.');
      if (result.status === 'accepted' && (await stat(candidatePath)).size !== result.outputBytes)
        throw new Error('Candidato incompleto.');
      report.results = report.results.filter(previous => previous.id !== job.id);
      report.results.push({ ...result, sourceSha256: job.sha256 });
      await persist();
      console.log(`${report.results.length}/${total} ${result.status} ${job.type} ${result.savedPercent?.toFixed(1) ?? 0}% ${result.reason ?? ''}`);
      return res.end('ok');
    }
    if (url.pathname === '/__stored/done') {
      res.end('ok'); finish(); return;
    }
    if (url.pathname === '/__stored/fatal') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      console.error(Buffer.concat(chunks).toString()); process.exitCode = 1;
      res.end('ok'); finish(); return;
    }
    res.statusCode = 404; res.end();
  } catch (error) { console.error(String(error)); res.statusCode = 500; res.end(String(error)); }
});
await server.listen();
const browser = spawn('C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe', [
  '--headless', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  '--disable-background-networking', '--autoplay-policy=no-user-gesture-required',
  '--user-data-dir=' + path.join(directory, 'browser-profile-' + Date.now()),
  `http://127.0.0.1:${server.httpServer.address().port}/__stored/page?token=${token}`,
], { windowsHide: true, stdio: 'ignore' });
browser.on('error', error => { console.error(error); finish(); });
const timeout = setTimeout(() => { console.error('Tempo limite: os resultados foram preservados para retomar.'); finish(); }, 3_600_000);
try { await completed; console.log('Resultados salvos:', report.results.length); }
finally { clearTimeout(timeout); browser.kill(); await server.close(); }

async function prepare(token, review) {
  const { optimizeImage } = await import('/src/admin/optimizeImage.ts');
  const { optimizeVideo } = await import('/src/admin/optimizeVideo.ts');
  const { Input, BlobSource, ALL_FORMATS, VideoSampleSink, EncodedPacketSink } = await import('/scripts/stored-media-codecs.ts');
  const route = (name, id) => `/__stored/${name}?token=${token}${id ? '&id=' + id : ''}`;
  function assert(ok, message) { if (!ok) throw new Error(message); }
  async function compare(original, candidate, video) {
    const canvases = [0, 1].map(() => document.createElement('canvas'));
    const contexts = canvases.map(canvas => canvas.getContext('2d', { willReadFrequently: true }));
    let sources = [], urls = [], duration = 0, frameRates = null, inputs = [], videoSinks = [], timestamps = [], audioIdentical = null;
    try {
      if (video) {
        for (const file of [original, candidate]) {
          const element = document.createElement('video'); element.muted = true; element.preload = 'auto';
          const url = URL.createObjectURL(file); urls.push(url); element.src = url;
          await new Promise((resolve, reject) => { element.onloadeddata = resolve; element.onerror = () => reject(new Error('Vídeo não reproduz.')); });
          sources.push(element);
        }
        duration = sources[0].duration;
        assert(Math.abs(duration - sources[1].duration) <= 0.05, 'Duração alterada.');
        inputs = [original, candidate].map(file => new Input({ source: new BlobSource(file), formats: ALL_FORMATS }));
          const tracks = await Promise.all(inputs.map(input => input.getPrimaryVideoTrack()));
          const statistics = await Promise.all(tracks.map(track => track.computePacketStats()));
          assert(statistics[0].packetCount === statistics[1].packetCount, 'Quantidade de quadros alterada.');
          frameRates = statistics.map(stats => stats.averagePacketRate);
          const audio = await Promise.all(inputs.map(input => input.getAudioTracks()));
          assert(audio[0].length === audio[1].length, 'Quantidade de faixas de áudio alterada.');
          for (let track = 0; track < audio[0].length; track++) {
            assert(await audio[0][track].getCodec() === await audio[1][track].getCodec(), 'Codec de áudio alterado.');
            assert(await audio[0][track].getSampleRate() === await audio[1][track].getSampleRate(), 'Frequência de áudio alterada.');
            assert(await audio[0][track].getNumberOfChannels() === await audio[1][track].getNumberOfChannels(), 'Canais de áudio alterados.');
            const offsets = await Promise.all(audio.map(async (side, i) => await side[track].getFirstTimestamp() - await tracks[i].getFirstTimestamp()));
            assert(Math.abs(offsets[0] - offsets[1]) < .05, 'Sincronização entre áudio e vídeo alterada.');
            const readers = audio.map(side => new EncodedPacketSink(side[track]).packets()[Symbol.asyncIterator]());
            while (true) {
              const [a, b] = await Promise.all(readers.map(reader => reader.next()));
              assert(a.done === b.done, 'Quantidade de pacotes de áudio alterada.');
              if (a.done) break;
              assert(a.value.data.length === b.value.data.length && a.value.data.every((value, i) => value === b.value.data[i]), 'Áudio recodificado ou alterado.');
            }
          }
          audioIdentical = true;
          videoSinks = tracks.map(track => new VideoSampleSink(track));
          timestamps = await Promise.all(tracks.map(async track => {
            const times = [];
            for await (const packet of new EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) times.push(packet.timestamp);
            return times.sort((a, b) => a - b);
          }));
          assert(timestamps[0].length === timestamps[1].length, 'Quantidade de quadros divergente.');
          assert(timestamps[0].every((time, i) => Math.abs(time - timestamps[0][0] - (timestamps[1][i] - timestamps[1][0])) < .002), 'Temporização dos quadros alterada.');
      } else sources = await Promise.all([original, candidate].map(file => createImageBitmap(file)));
      const width = video ? sources[0].videoWidth : sources[0].width;
      const height = video ? sources[0].videoHeight : sources[0].height;
      assert(width === (video ? sources[1].videoWidth : sources[1].width) && height === (video ? sources[1].videoHeight : sources[1].height), 'Resolução alterada.');
      canvases.forEach(canvas => { canvas.width = width; canvas.height = height; });
      const scores = [];
      const count = video ? Math.min(30, Math.max(12, Math.ceil(duration / 10))) : 1;
      const sheet = review ? document.createElement('canvas') : null;
      if (sheet) { sheet.width = 720; sheet.height = 2004; }
      const sheetContext = sheet?.getContext('2d');
      let sheetRow = 0;
      for (let sample = 0; sample < count; sample++) {
        const time = video ? duration * (sample + 0.5) / count : 0;
        let pixels;
        if (video) {
          const index = Math.floor(timestamps[0].length * (sample + .5) / count);
          const frames = await Promise.all(videoSinks.map((sink, i) => sink.getSample(timestamps[i][index] + .00001)));
          try {
            assert(frames.every(Boolean), 'Quadro não decodificado.');
            pixels = frames.map((frame, i) => {
              assert(Math.abs(frame.timestamp - timestamps[i][index]) < .001, 'Quadros da comparação não correspondem.');
              frame.draw(contexts[i], 0, 0, width, height);
              return contexts[i].getImageData(0, 0, width, height).data;
            });
          } finally { frames.forEach(frame => frame?.close()); }
        } else pixels = sources.map((source, i) => {
            contexts[i].drawImage(source, 0, 0, width, height);
            return contexts[i].getImageData(0, 0, width, height).data;
          });
        if (sheetContext && [0, Math.floor(count / 2), count - 1].includes(sample)) {
          canvases.forEach((canvas, side) => {
            const y = sheetRow * 668;
            sheetContext.fillStyle = '#fff'; sheetContext.fillRect(side * 360, y, 360, 28);
            sheetContext.fillStyle = '#000'; sheetContext.font = '16px sans-serif';
            sheetContext.fillText(`${side ? 'Candidato' : 'R2 atual'} - ${time.toFixed(1)}s`, side * 360 + 8, y + 20);
            sheetContext.drawImage(canvas, side * 360, y + 28, 360, 640);
          });
          sheetRow++;
        }
        let ssim = 0, blocks = 0;
        for (let y = 0; y < height; y += 8) for (let x = 0; x < width; x += 8) {
          let a = 0, b = 0, aa = 0, bb = 0, ab = 0, n = 0;
          for (let dy = 0; dy < Math.min(8, height - y); dy++) for (let dx = 0; dx < Math.min(8, width - x); dx++) {
            const index = ((y + dy) * width + x + dx) * 4;
            assert(pixels[0][index + 3] === pixels[1][index + 3], 'Transparência alterada.');
            const va = .2126 * pixels[0][index] + .7152 * pixels[0][index + 1] + .0722 * pixels[0][index + 2];
            const vb = .2126 * pixels[1][index] + .7152 * pixels[1][index + 1] + .0722 * pixels[1][index + 2];
            a += va; b += vb; aa += va * va; bb += vb * vb; ab += va * vb; n++;
          }
          const ma = a / n, mb = b / n;
          ssim += ((2 * ma * mb + 6.5025) * (2 * (ab / n - ma * mb) + 58.5225)) /
            ((ma * ma + mb * mb + 6.5025) * (aa / n - ma * ma + bb / n - mb * mb + 58.5225));
          blocks++;
        }
        scores.push({ time, ssim: ssim / blocks });
      }
      const mean = scores.reduce((sum, item) => sum + item.ssim, 0) / scores.length;
      const minimum = Math.min(...scores.map(item => item.ssim));
      return { width, height, duration, frameRates, scores, mean, minimum, audioIdentical,
        reviewImage: sheet?.toDataURL('image/jpeg', .95), comparison: video ? 'corresponding-presentation-frames' : 'image',
        acceptable: video ? mean >= .98 && minimum >= .975 : minimum >= .99 };
    } finally {
      if (video) sources.forEach(source => { source.removeAttribute('src'); source.load(); });
      else sources.forEach(source => source.close());
      urls.forEach(url => URL.revokeObjectURL(url));
      inputs.forEach(input => input.dispose());
      canvases.forEach(canvas => { canvas.width = canvas.height = 0; });
    }
  }
  while (true) {
    const { job, done } = await (await fetch(route('next'))).json();
    if (done) break;
    if (!job) { await new Promise(resolve => setTimeout(resolve, 2000)); continue; }
    let result = { id: job.id, status: 'skipped', sourceBytes: job.size, sourceType: job.type };
    try {
      if (job.external?.status === 'skipped') throw new Error(job.external.reason);
      const sourceResponse = await fetch(route('source', job.id));
      assert(sourceResponse.ok, 'Falha ao ler backup.');
      const original = new File([await sourceResponse.blob()], job.name, { type: job.type });
      assert(original.size === job.size, 'Backup incompleto.');
      const isVideo = original.type.startsWith('video/');
      const candidate = job.external
        ? new File([await (await fetch(route('external', job.id))).blob()], job.name, { type: 'video/mp4' })
        : isVideo ? await optimizeVideo(original, new AbortController().signal, () => {}) : await optimizeImage(original);
      const savedPercent = (1 - candidate.size / original.size) * 100;
      result = { ...result, outputBytes: candidate.size, outputType: candidate.type, outputName: isVideo ? job.name : candidate.name, savedPercent };
      if (job.external) { result.method = job.external.method; result.candidatePath = job.external.candidatePath; }
      if (candidate === original || savedPercent < 5) result.reason = 'Economia inferior a 5% ou formato preservado.';
      else {
        const quality = await compare(original, candidate, isVideo);
        result.quality = quality;
        if (!quality.acceptable) result.reason = 'Comparação de qualidade abaixo do limite conservador.';
        else {
          if (!job.external) {
            const response = await fetch(route('candidate', job.id), { method: 'PUT', body: candidate });
            assert(response.ok, 'Falha ao salvar candidato.');
          }
          result.status = 'accepted';
        }
      }
    } catch (error) { result.reason = String(error); }
    const saved = await fetch(route('result'), { method: 'POST', body: JSON.stringify(result) });
    assert(saved.ok, 'Falha ao salvar resultado.');
  }
  await fetch(route('done'), { method: 'POST' });
}
