import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getPlatformProxy } from 'wrangler';
import { stories } from './stories';
import app from './index';
import type { Env } from './env';

test('reserva concorrente, alteração da cota e publicação multipart no D1 e R2 locais', async t => {
  const platform = await getPlatformProxy<Env>({ persist: false, remoteBindings: false });
  t.after(() => platform.dispose());
  const env = platform.env;
  const migration = await readFile(new URL('../migrations/0003_story_files.sql', import.meta.url), 'utf8');
  await env.DB.batch(migration.split(';').filter(sql => sql.trim()).map(sql => env.DB.prepare(sql)));
  const metadataMigration = await readFile(new URL('../migrations/0004_story_metadata.sql', import.meta.url), 'utf8');
  await env.DB.batch(metadataMigration.split(';').filter(sql => sql.trim()).map(sql => env.DB.prepare(sql)));
  const cultureMigration = await readFile(new URL('../migrations/0005_cultural_weeks.sql', import.meta.url), 'utf8');
  await env.DB.batch(cultureMigration.split(';').filter(sql => sql.trim()).map(sql => env.DB.prepare(sql)));
  const keysMigration = await readFile(new URL('../migrations/0006_media_object_keys.sql', import.meta.url), 'utf8');
  await env.DB.batch(keysMigration.split(';').filter(sql => sql.trim()).map(sql => env.DB.prepare(sql)));
  const request = (path: string, method = 'GET', data?: unknown) => stories.request(path, {
    method, body: data === undefined ? undefined : JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  }, env);
  const admin = '/admin/stories';
  assert.equal((await app.request('/api' + admin, {}, env)).status, 401);
  await env.DB.prepare("INSERT INTO story_files(id,collection,title,position,name,type,size,created,status) VALUES('legacy','legacy','Legado',0,'audio.mp3','audio/mpeg',1,0,'ready')").run();
  await env.MEDIA.put('stories/legacy', new Uint8Array([42]));
  const legacy = await request('/stories/legacy/media');
  assert.equal(legacy.status, 200);
  assert.deepEqual(new Uint8Array(await legacy.arrayBuffer()), new Uint8Array([42]));
  await request(admin + '/legacy', 'DELETE');
  const culture = await request('/admin/cultural-weeks', 'POST', { title: 'Semana cultural', year: 2024,
    files: [{ name: 'foto.jpg', type: 'image/jpeg', size: 1 }] });
  assert.equal(culture.status, 201);
  const cultureId = (await culture.json() as { ids: string[] }).ids[0];
  const cultureKey = await env.DB.prepare('SELECT object_key FROM story_files WHERE id=?').bind(cultureId).first<string>('object_key');
  assert.match(cultureKey!, /^memorias-escola\/2024\//);
  await env.DB.prepare("UPDATE story_files SET status='ready' WHERE id=?").bind(cultureId).run();
  assert.deepEqual(await (await request('/stories')).json(), []);
  const albums = await (await request('/cultural-weeks')).json() as { year: number; photos: { src: string; type: string }[] }[];
  assert.equal(albums[0].year, 2024);
  assert.equal(albums[0].photos[0].src, '/api/stories/' + cultureId + '/media');
  const cultures = await (await request('/admin/cultural-weeks')).json() as { files: { id: string }[] };
  assert.equal(cultures.files[0].id, cultureId);
  assert.equal((await request(admin, 'POST', { title: 'Inválido', kind: 'culture', files: [{ name: 'audio.mp3', type: 'audio/mpeg', size: 1 }] })).status, 400);
  const mixed = await request(admin, 'POST', { title: 'Outros registros', kind: 'culture', year: 2024, files: [
    { name: 'audio.mp3', type: 'audio/mpeg', size: 1 }, { name: 'video.mp4', type: 'video/mp4', size: 1 },
  ] });
  assert.equal(mixed.status, 201);
  const mixedIds = (await mixed.json() as { ids: string[] }).ids;
  for (const id of mixedIds) await env.DB.prepare("UPDATE story_files SET status='ready' WHERE id=?").bind(id).run();
  const combined = await (await request('/cultural-weeks')).json() as typeof albums;
  assert.equal(combined.length, 2);
  assert.deepEqual(combined.flatMap(album => album.photos.map(file => file.type)).sort(), ['audio/mpeg', 'image/jpeg', 'video/mp4']);
  assert.deepEqual(await (await request('/stories')).json(), []);
  for (const id of mixedIds) await request(admin + '/' + id, 'DELETE');
  await request(admin + '/' + cultureId, 'DELETE');
  const dated = await request(admin, 'POST', { title: 'Registros', files: [
    { name: 'sem-data.mp3', type: 'audio/mpeg', size: 1 },
    { name: 'recente.mp3', type: 'audio/mpeg', size: 1, recorded_on: '2024-01-01' },
    { name: 'antigo.mp3', type: 'audio/mpeg', size: 1, recorded_on: '2010-01-01' },
  ] });
  assert.equal(dated.status, 201);
  const datedIds = (await dated.json() as { ids: string[] }).ids;
  await env.DB.prepare("UPDATE story_files SET status='ready'").run();
  const chronological = await (await request('/stories')).json() as { name: string }[];
  assert.deepEqual(chronological.map(file => file.name), ['antigo.mp3', 'recente.mp3', 'sem-data.mp3']);
  for (const id of datedIds) await request(admin + '/' + id, 'DELETE');
  const big = { title: 'Grande', files: [{ name: 'filme.mp4', type: 'video/mp4', size: 6e9 }] };
  const results = await Promise.all([request(admin, 'POST', big), request(admin, 'POST', big)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const first = await results.find(r => r.status === 201)!.json() as { ids: string[] };
  assert.equal((await request(admin + '/quota', 'PUT', { capacity: 5e9 })).status, 409);
  assert.equal((await request(admin + '/quota', 'PUT', { capacity: 12e9 })).status, 200);
  const second = await request(admin, 'POST', big);
  assert.equal(second.status, 201);
  for (const id of [...first.ids, ...(await second.json() as { ids: string[] }).ids]) {
    assert.equal((await request(admin + '/' + id, 'DELETE')).status, 200);
  }
  const partSize = 8 * 1024 * 1024;
  const media = { title: 'Memória', files: [{ name: 'fala.mp4', type: 'video/mp4', size: partSize + 2 }] };
  const created = await request(admin, 'POST', media);
  const { ids: [id] } = await created.json() as { ids: string[] };
  const storedKey = await env.DB.prepare('SELECT object_key FROM story_files WHERE id=?').bind(id).first<string>('object_key');
  assert.match(storedKey!, /^historias\//);
  const collection = await env.DB.prepare('SELECT collection FROM story_files WHERE id=?').bind(id).first<string>('collection');
  assert.equal((await request('/admin/story-collections/' + collection, 'PATCH', { title: ' ' })).status, 400);
  assert.equal((await request('/admin/story-collections/' + collection, 'PATCH', { title: ' Novo título ' })).status, 200);
  const path = admin + '/' + id;
  assert.equal((await request(path, 'PATCH', { author: 'Maria', recorded_on: '2020-02-30' })).status, 400);
  assert.equal((await request(path, 'PATCH', { author: ' Maria ', recorded_on: '2020-03-15' })).status, 200);
  assert.deepEqual(await (await request('/stories')).json(), []);
  assert.equal((await request(path + '/start', 'POST')).status, 200);
  const put = (number: number, body: Uint8Array<ArrayBuffer>) => stories.request(path + '/parts/' + number, { method: 'PUT', body }, env);
  assert.equal((await put(1, new Uint8Array(2))).status, 400);
  const parts = [];
  for (const [index, data] of [new Uint8Array(partSize), new Uint8Array([42, 43])].entries()) {
    const response = await put(index + 1, data);
    assert.equal(response.status, 200);
    parts.push(await response.json());
  }
  assert.equal((await request(path + '/finish', 'POST', parts)).status, 200);
  assert.equal((await request(path + '/finish', 'POST', parts)).status, 200);
  assert.equal((await (await request('/stories')).json() as unknown[]).length, 1);
  const published = await (await request('/stories')).json() as { author: string; recorded_on: string }[];
  assert.equal(published[0].author, 'Maria');
  assert.equal(published[0].recorded_on, '2020-03-15');
  assert.equal((published[0] as unknown as { title: string }).title, 'Novo título');
  const stream = await stories.request('/stories/' + id + '/media', { headers: { Range: 'bytes=-2' } }, env);
  assert.equal(stream.status, 206);
  assert.deepEqual(new Uint8Array(await stream.arrayBuffer()), new Uint8Array([42, 43]));
  const etag = stream.headers.get('ETag');
  assert.ok(etag);
  const revalidate = () => app.request('/api/stories/' + id + '/media', { headers: { 'If-None-Match': etag } }, env);
  const cached = await revalidate();
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.get('Cache-Control'), 'private, no-cache');
  assert.equal((await request(path, 'DELETE')).status, 200);
  assert.equal((await revalidate()).status, 404);
  assert.equal(await env.MEDIA.head(storedKey!), null);
  assert.deepEqual(await (await request('/stories')).json(), []);
});

