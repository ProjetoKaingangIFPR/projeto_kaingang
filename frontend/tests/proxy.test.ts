import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]]';

test('Pages encaminha a parte binária inteira sem Host do site e identifica rejeição fora da API', async t => {
  const bytes = Uint8Array.from({ length: 5782758 }, (_, i) => i % 251);
  let reject = false;
  t.mock.method(globalThis, 'fetch', async (request: Request) => {
    assert.equal(request.url, 'https://api.example.com/api/admin/stories/test/parts/1');
    assert.equal(request.headers.get('Host'), null);
    assert.equal(request.headers.get('Connection'), null);
    assert.equal(request.headers.get('Cookie'), 'kaingang_admin=test');
    assert.equal(request.headers.get('Content-Type'), 'application/octet-stream');
    assert.deepEqual(new Uint8Array(await request.arrayBuffer()), bytes);
    return reject ? new Response(null, { status: 400 }) : Response.json({ partNumber: 1, etag: 'ok' });
  });
  const send = () => onRequest({
    request: new Request('https://site.example.com/api/admin/stories/test/parts/1', {
      method: 'PUT', headers: { Host: 'site.example.com', Connection: 'keep-alive',
        'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.byteLength), Cookie: 'kaingang_admin=test' },
      body: bytes,
    }), env: { API_URL: 'https://api.example.com' },
  } as Parameters<typeof onRequest>[0]);
  assert.equal((await send()).status, 200);
  reject = true;
  const rejected = await send();
  assert.equal(rejected.status, 400);
  assert.equal(rejected.headers.get('X-Upload-Error-Source'), 'upstream');
  assert.match((await rejected.json() as { error: string }).error, /HTTP 400/);
});

test('Pages encaminha corpo, cookie e origem e preserva Set-Cookie', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (request: Request) => {
    assert.equal(request.url, 'https://api.example.com/api/admin/login?test=1');
    assert.equal(request.headers.get('Origin'), 'https://site.example.com');
    assert.equal(request.headers.get('Cookie'), 'kaingang_admin=session');
    assert.equal(await request.text(), '{"username":"admin"}');
    return new Response('{}', { headers: { 'Set-Cookie': 'kaingang_admin=new; HttpOnly; Path=/; Secure; SameSite=Strict' } });
  }) as typeof fetch;
  try {
    const response = await onRequest({
      request: new Request('https://site.example.com/api/admin/login?test=1', {
        method: 'POST', headers: { Origin: 'https://site.example.com', Cookie: 'kaingang_admin=session' }, body: '{"username":"admin"}',
      }), env: { API_URL: 'https://api.example.com' },
    } as Parameters<typeof onRequest>[0]);
    assert.match(response.headers.get('Set-Cookie')!, /HttpOnly/);
  } finally { globalThis.fetch = original; }
});

test('Pages rejeita partes acima do limite antes de ler o corpo ou chamar a API', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Não deveria encaminhar'); });
  const response = await onRequest({
    request: new Request('https://site.example.com/api/admin/stories/test/parts/1', {
      method: 'PUT', headers: { 'Content-Length': String(8 * 1024 * 1024 + 1) }, body: new Uint8Array([1]),
    }), env: { API_URL: 'https://api.example.com' },
  } as Parameters<typeof onRequest>[0]);
  assert.equal(response.status, 413);
  assert.equal(fetch.mock.callCount(), 0);
});

test('Pages identifica rejeições externas também ao iniciar e finalizar um arquivo', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('upstream error', { status: 502, headers: { 'CF-Ray': 'test-ray' } }));
  for (const stage of ['start', 'finish']) {
    const response = await onRequest({
      request: new Request('https://site.example.com/api/admin/stories/test/' + stage, { method: 'POST' }),
      env: { API_URL: 'https://api.example.com' },
    } as Parameters<typeof onRequest>[0]);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('X-Upload-Error-Source'), 'upstream');
    assert.deepEqual(await response.json(), { error: 'O servidor recusou a requisição (HTTP 502). Tente novamente.', requestId: 'test-ray' });
  }
});

