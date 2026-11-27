import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from './index';
import type { Env } from './env';

test('upload autenticado grava no R2 e a URL pública devolve os mesmos bytes', async () => {
  const objects = new Map<string, Uint8Array>();
  const rows = new Map<string, { object_key: string; content_type: string }>();
  const env = {
    ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'test-password',
    DB: { prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...args: unknown[]) { values = args; return this; },
        async first() {
          if (sql.includes('admin_sessions')) return { user_id: 1 };
          return rows.get(String(values[0])) ?? null;
        },
        async run() {
          rows.set(String(values[0]), { object_key: String(values[1]), content_type: String(values[2]) });
        },
      };
    } },
    MEDIA: {
      async put(key: string, bytes: ArrayBuffer) { objects.set(key, new Uint8Array(bytes)); },
      async get(key: string) {
        const bytes = objects.get(key);
        return bytes ? { body: new Blob([new Uint8Array(bytes)]).stream() } : null;
      },
    },
  } as unknown as Env;
  const bytes = new Uint8Array([255, 216, 255, 224]);
  const request = () => new Request('https://example.com/api/admin/media', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg', Cookie: 'kaingang_admin=test' }, body: bytes,
  });
  const uploaded = await app.fetch(request(), env);
  assert.equal(uploaded.status, 201);
  const { url } = await uploaded.json() as { url: string };
  const image = await app.fetch(new Request(`https://example.com${url}`), env);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/jpeg');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()), bytes);
  assert.equal(image.headers.get('Cache-Control'), 'private, no-cache');
  const previousEtag = image.headers.get('ETag')!;
  assert.equal((await app.fetch(new Request(`https://example.com${url}`, { headers: { 'If-None-Match': previousEtag } }), env)).status, 304);
  const id = url.split('/').pop()!;
  const replacement = new Uint8Array([137, 80, 78, 71]);
  objects.set('optimized/' + id, replacement);
  rows.set(id, { object_key: 'optimized/' + id, content_type: 'image/png' });
  const changed = await app.fetch(new Request(`https://example.com${url}`, { headers: { 'If-None-Match': previousEtag } }), env);
  assert.equal(changed.status, 200);
  assert.notEqual(changed.headers.get('ETag'), previousEtag);
  assert.equal(changed.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(new Uint8Array(await changed.arrayBuffer()), replacement);
  objects.clear();
  assert.equal((await app.fetch(new Request(`https://example.com${url}`), env)).status, 404);
  const unauthenticated = new Request('https://example.com/api/admin/media', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: bytes,
  });
  assert.equal((await app.fetch(unauthenticated, env)).status, 401);
  assert.equal(objects.size, 0);
  assert.equal((await app.fetch(request(), { ...env, MEDIA: undefined })).status, 503);
});
