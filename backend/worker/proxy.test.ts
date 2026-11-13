import { test } from 'node:test';
import assert from 'node:assert/strict';
import app from './index';
import type { Env } from './env';

test('API aceita a origem configurada e bloqueia gravações de outra origem', async () => {
  const env = { FRONTEND_ORIGIN: 'https://site.example.com', DB: { prepare: () => ({ first: async () => null }) } } as unknown as Env;
  const request = (origin: string) => new Request('https://api.example.com/api/admin/login', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal((await app.fetch(request('https://evil.example.com'), env)).status, 403);
  // Sem credenciais administrativas, a requisição autorizada chega à validação de configuração.
  assert.equal((await app.fetch(request('https://site.example.com'), env)).status, 503);
  assert.equal((await app.fetch(new Request('https://api.example.com/'), env)).status, 404);
});

 test('API aceita varias origens separadas por virgula com espacos', async () => {
  const env = { FRONTEND_ORIGIN: 'https://site.example.com, https://outro.example.com, ', DB: { prepare: () => ({ first: async () => null }) } } as unknown as Env;
  for (const [origin, status] of [
    ['https://site.example.com', 503],
    ['https://outro.example.com', 503],
    ['https://api.example.com', 503],
    ['https://outro.example.com.evil.com', 403],
    ['https://evil.example.com', 403],
  ] as const) {
    const response = await app.fetch(new Request('https://api.example.com/api/admin/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
    }), env);
    assert.equal(response.status, status, origin);
  }
});
