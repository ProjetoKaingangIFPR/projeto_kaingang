import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { transform } from 'esbuild';

test('Pages transmite partes concorrentes no runtime Cloudflare com tamanho conhecido e bytes intactos', async t => {
  const source = await readFile(new URL('../functions/api/[[path]].ts', import.meta.url), 'utf8');
  const { code: script } = await transform(source + `
    export default { fetch(request, env, ctx) {
      return onRequest({ request, env, waitUntil: promise => ctx.waitUntil(promise) });
    } };
  `, { loader: 'ts', format: 'esm', target: 'es2022' });
  const bytes = Uint8Array.from({ length: 8 * 1024 * 1024 }, (_, i) => i % 251);
  let received = 0;
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script, compatibilityDate: '2026-11-02',
    bindings: { API_URL: 'https://api.example.com' },
    outboundService: async request => {
      assert.equal(request.headers.get('Content-Length'), String(bytes.byteLength));
      assert.equal(request.headers.get('Cookie'), 'kaingang_admin=test');
      assert.equal(request.headers.get('Origin'), 'https://site.example.com');
      assert.deepEqual(new Uint8Array(await request.arrayBuffer()), bytes);
      received++;
      return Response.json({ partNumber: 1, etag: 'ok' });
    },
  }));
  t.after(() => runtime.dispose());
  const send = (id: number) => runtime.dispatchFetch('https://site.example.com/api/admin/stories/test' + id + '/parts/1', {
    method: 'PUT', body: bytes,
    headers: { Cookie: 'kaingang_admin=test', Origin: 'https://site.example.com', 'Content-Type': 'application/octet-stream' },
  });
  const responses = await Promise.all([send(1), send(2), send(3)]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { partNumber: 1, etag: 'ok' });
  }
  assert.equal(received, 3);
});
