import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]]';

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

