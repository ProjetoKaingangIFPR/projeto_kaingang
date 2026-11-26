import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Env } from './env';
import { jpegPreview } from './jpeg-preview';

export const stories = new Hono<{ Bindings: Env }>();
const chunkSize = 8 * 1024 * 1024;
const formats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/webm'] as const;
const selection = z.object({
  title: z.string().trim().min(1).max(180),
  files: z.array(z.object({
    name: z.string().trim().min(1).max(255),
    type: z.enum(formats),
    size: z.number().int().positive().max(chunkSize * 10000),
    author: z.string().trim().max(180).nullable().optional(),
    recorded_on: z.iso.date().nullable().optional(),
  })).min(1),
});
type Item = { id: string; size: number; type: string; upload_id: string | null; status: string };
const item = (env: Env, id: string) => env.DB.prepare('SELECT * FROM story_files WHERE id=?').bind(id).first<Item>();
const key = (id: string) => 'stories/' + id;
const fields = 'id, collection, title, name, type, size, status, author, recorded_on';
const ordering = ' ORDER BY recorded_on IS NULL, recorded_on ASC, created ASC, collection, position, id';

stories.patch('/admin/story-collections/:id', bodyLimit({ maxSize: 4096 }), async c => {
  const parsed = z.object({ title: z.string().trim().min(1).max(180) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Informe um título entre 1 e 180 caracteres.' }, 400);
  const saved = await c.env.DB.prepare("UPDATE story_files SET title=? WHERE collection=?")
    .bind(parsed.data.title, c.req.param('id')).run();
  if (!saved.meta.changes) return c.json({ error: 'História não encontrada.' }, 404);
  return c.json({ saved: true });
});

stories.patch('/admin/stories/:id', bodyLimit({ maxSize: 4096 }), async c => {
  const parsed = z.object({
    author: z.string().trim().max(180).nullable(),
    recorded_on: z.iso.date().nullable(),
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Informe autor e data válidos ou deixe os campos vazios.' }, 400);
  const saved = await c.env.DB.prepare("UPDATE story_files SET author=?, recorded_on=? WHERE id=? AND status!='deleting'")
    .bind(parsed.data.author || null, parsed.data.recorded_on, c.req.param('id')).run();
  if (!saved.meta.changes) return c.json({ error: 'Registro não encontrado.' }, 404);
  return c.json({ saved: true });
});

stories.get('/stories', async c => {
  const { results } = await c.env.DB.prepare('SELECT ' + fields + " FROM story_files WHERE status='ready'" + ordering).all();
  return c.json(results);
});
stories.get('/admin/stories', async c => {
  const { results } = await c.env.DB.prepare('SELECT ' + fields + ' FROM story_files' + ordering).all();
  const capacity = await c.env.DB.prepare('SELECT capacity FROM story_storage WHERE id=1').first<number>('capacity');
  return c.json({ files: results, capacity });
});
stories.put('/admin/stories/quota', bodyLimit({ maxSize: 1024 }), async c => {
  const parsed = z.object({ capacity: z.number().int().positive() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Informe uma cota válida.' }, 400);
  const capacity = parsed.data.capacity;
  const saved = await c.env.DB.prepare('UPDATE story_storage SET capacity=? WHERE id=1 AND ? >= (SELECT COALESCE(SUM(size),0) FROM story_files)')
    .bind(capacity, capacity).run();
  if (!saved.meta.changes) return c.json({ error: 'A cota deve cobrir os arquivos publicados e reservados.' }, 409);
  return c.json({ capacity });
});
stories.post('/admin/stories', bodyLimit({ maxSize: 1024 * 1024 }), async c => {
  if (!c.env.MEDIA) return c.json({ error: 'Configure o bucket R2.' }, 503);
  const parsed = selection.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Confira o título, o formato e o tamanho dos arquivos.' }, 400);
  const { title, files } = parsed.data;
  const group = crypto.randomUUID();
  const entries = files.map(file => ({ ...file, id: crypto.randomUUID() }));
  const total = files.reduce((sum, file) => sum + file.size, 0);
  // Uma única escrita reserva o lote inteiro, inclusive com administradores simultâneos.
  const inserted = await c.env.DB.prepare(`INSERT INTO story_files
    (id, collection, title, name, type, size, created, position, author, recorded_on)
    SELECT value->>'id', ?, ?, value->>'name', value->>'type', value->>'size', ?, key, NULLIF(value->>'author',''), value->>'recorded_on'
    FROM json_each(?) WHERE (SELECT COALESCE(SUM(size),0) FROM story_files) + ? <= (SELECT capacity FROM story_storage WHERE id=1)`)
    .bind(group, title, Date.now(), JSON.stringify(entries), total).run();
  if (!inserted.meta.changes) return c.json({ error: 'Espaço insuficiente para esta seleção.' }, 409);
  return c.json({ ids: entries.map(entry => entry.id), chunkSize }, 201);
});

stories.post('/admin/stories/:id/start', async c => {
  const id = c.req.param('id');
  const file = await item(c.env, id);
  if (file?.status === 'ready') return c.json({ published: true });
  if (file?.status !== 'pending') return c.json({ error: 'Envio indisponível.' }, 409);
  if (file.upload_id && (await c.env.MEDIA.head(key(id)))?.size === file.size) {
    const saved = await c.env.DB.prepare("UPDATE story_files SET status='ready',upload_id=NULL WHERE id=? AND status='pending'").bind(id).run();
    if (saved.meta.changes) return c.json({ published: true });
    return c.json({ error: 'O arquivo foi alterado durante o envio.' }, 409);
  }
  if (!file.upload_id) {
    const upload = await c.env.MEDIA.createMultipartUpload(key(id), { httpMetadata: { contentType: file.type } });
    const result = await c.env.DB.prepare("UPDATE story_files SET upload_id=? WHERE id=? AND status='pending' AND upload_id IS NULL")
      .bind(upload.uploadId, id).run();
    if (!result.meta.changes) await upload.abort();
  }
  return c.json({ started: true });
});

stories.put('/admin/stories/:id/parts/:number', bodyLimit({ maxSize: chunkSize }), async c => {
  const file = await item(c.env, c.req.param('id'));
  if (file?.status !== 'pending' || !file.upload_id) return c.json({ error: 'Envio indisponível.' }, 409);
  const number = Number(c.req.param('number'));
  if (!Number.isInteger(number) || number < 1 || number > Math.ceil(file.size / chunkSize))
    return c.json({ error: 'Parte inválida.' }, 400);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength !== Math.min(chunkSize, file.size - (number - 1) * chunkSize))
    return c.json({ error: 'Parte incompleta.' }, 400);
  const upload = c.env.MEDIA.resumeMultipartUpload(key(file.id), file.upload_id);
  return c.json(await upload.uploadPart(number, bytes));
});

stories.post('/admin/stories/:id/finish', bodyLimit({ maxSize: 1024 * 1024 }), async c => {
  const file = await item(c.env, c.req.param('id'));
  if (file?.status === 'ready') return c.json({ published: true });
  if (file?.status !== 'pending' || !file.upload_id) return c.json({ error: 'Envio indisponível.' }, 409);
  const parts = z.array(z.object({ partNumber: z.number().int(), etag: z.string() })).safeParse(await c.req.json().catch(() => null));
  if (!parts.success || parts.data.length !== Math.ceil(file.size / chunkSize) ||
      parts.data.some((part, index) => part.partNumber !== index + 1)) return c.json({ error: 'Faltam partes do arquivo.' }, 400);
  // Uma repetição após falha no D1 pode encontrar o objeto já concluído no R2.
  const object = await c.env.MEDIA.head(key(file.id)) ??
    await c.env.MEDIA.resumeMultipartUpload(key(file.id), file.upload_id).complete(parts.data);
  if (object.size !== file.size) return c.json({ error: 'Tamanho final incorreto.' }, 409);
  const saved = await c.env.DB.prepare("UPDATE story_files SET status='ready',upload_id=NULL WHERE id=? AND status='pending'").bind(file.id).run();
  if (!saved.meta.changes && (await item(c.env,file.id))?.status !== 'ready') return c.json({ error: 'Envio removido.' }, 409);
  return c.json({ published: true });
});

stories.delete('/admin/stories/:id', async c => {
  const id = c.req.param('id');
  const pendingOnly = c.req.query('pendingOnly') === '1';
  await c.env.DB.prepare("UPDATE story_files SET status='deleting' WHERE id=? AND (?=0 OR status!='ready')")
    .bind(id, pendingOnly ? 1 : 0).run();
  const file = await item(c.env, id);
  if (file?.status === 'deleting') {
    if (file.upload_id) {
      try { await c.env.MEDIA.resumeMultipartUpload(key(id), file.upload_id).abort(); }
      catch (error) {
        if (!/NoSuchUpload|does not exist|10024/i.test(String(error))) throw error;
      }
    }
    await c.env.MEDIA.delete(key(id));
    await c.env.DB.prepare('DELETE FROM story_files WHERE id=?').bind(id).run();
  }
  return c.json({ removed: true });
});

stories.get('/stories/:id/media', async c => {
  const file = await item(c.env, c.req.param('id'));
  if (file?.status !== 'ready') return c.notFound();
  const headers = new Headers({ 'Content-Type': file.type, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' });
  const preview = c.req.query('preview') === '1' && file.type === 'image/jpeg' && file.size > 128 * 1024;
  const range = preview ? undefined : c.req.header('Range');
  if (preview) headers.set('Accept-Ranges', 'none');
  const etag = '"' + file.id + (preview ? '-preview' : '') + '"';
  // IDs are unique. Revalidate visibility after deletion, then reuse the stored bytes.
  headers.set('Cache-Control', 'private, no-cache');
  headers.set('ETag', etag);
  if (!range && c.req.header('If-None-Match') === etag) return new Response(null, { status: 304, headers });
  if (preview) {
    const prefix = await c.env.MEDIA.get(key(file.id), { range: { offset: 0, length: 128 * 1024 } });
    if (!prefix) return c.notFound();
    const thumbnail = jpegPreview(await prefix.arrayBuffer());
    if (thumbnail) {
      headers.set('Content-Length', String(thumbnail.byteLength));
      return new Response(thumbnail, { headers });
    }
    // Reuse the same browser cache entry as the full-screen viewer.
    return new Response(null, { status: 302, headers: { Location: new URL(c.req.url).pathname, 'Cache-Control': 'private, max-age=300' } });
  }
  let start = 0, end = file.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
    } else start = file.size;
    if (start > end) {
      headers.set('Content-Range', 'bytes */' + file.size);
      return new Response(null, { status: 416, headers });
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${file.size}`);
  }
  const length = end - start + 1;
  const object = await c.env.MEDIA.get(key(file.id), range ? { range: { offset: start, length } } : {});
  if (!object) return c.notFound();
  headers.set('Content-Length', String(length));
  return new Response(object.body, { status: range ? 206 : 200, headers });
});

