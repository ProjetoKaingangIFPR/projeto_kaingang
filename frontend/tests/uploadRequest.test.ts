import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadRequest } from '../src/admin/uploadRequest';
import { ApiError } from '../src/admin/api';
import { uploadFile, type UploadedPart } from '../src/admin/uploadParts';

test('conclui vários arquivos apesar de falhas transitórias ao iniciar, enviar e finalizar', async t => {
  const timeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback: () => void) => timeout(callback, 0));
  const attempts = new Map<string, number>();
  const completed: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    const attempt = (attempts.get(url) ?? 0) + 1;
    attempts.set(url, attempt);
    // The second file hits failures in every stage, including two failed part attempts.
    if (url.startsWith('/second/')) {
      if (url.endsWith('/start') && attempt === 1) return new Response('Unavailable', { status: 502 });
      if (url.endsWith('/parts/1') && attempt <= 2) throw new TypeError('Failed to fetch');
      if (url.endsWith('/finish') && attempt === 1) return new Response(null, { status: 503 });
    }
    if (url.includes('/parts/')) {
      assert.equal(await (options.body as Blob).text(), 'conteúdo');
      return Response.json({ partNumber: 1, etag: 'receipt' });
    }
    if (url.endsWith('/finish')) {
      assert.deepEqual(JSON.parse(options.body as string), [{ partNumber: 1, etag: 'receipt' }]);
      completed.push(url);
    }
    return Response.json({});
  });
  const file = new File(['conteúdo'], 'teste.mp3');
  let progress = 0;
  for (const id of ['first', 'second', 'third']) {
    await uploadFile(file, '/' + id, 20, new Map(), new AbortController().signal, size => { progress += size; });
  }
  assert.deepEqual(completed, ['/first/finish', '/second/finish', '/third/finish']);
  assert.equal(progress, file.size * 3);
  assert.equal(attempts.get('/second/start'), 2);
  assert.equal(attempts.get('/second/parts/1'), 3);
  assert.equal(attempts.get('/second/finish'), 2);
});

test('limita tentativas em falhas persistentes e usa pausas progressivas', async t => {
  const timeout = globalThis.setTimeout;
  const delays: number[] = [];
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
    delays.push(delay);
    return timeout(callback, 0);
  });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }));
  await assert.rejects(uploadRequest('/part', { signal: new AbortController().signal }),
    (error: unknown) => error instanceof ApiError && error.status === 429);
  assert.equal(fetch.mock.callCount(), 4);
  assert.deepEqual(delays, [1200, 2400, 4800]);
});

test('não repete erros de validação, autenticação ou conflito', async t => {
  for (const status of [400, 401, 403, 409, 413]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Rejeitado' }, { status }));
    await assert.rejects(uploadRequest('/part', { signal: new AbortController().signal }), /Rejeitado/);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('cancelar durante a pausa interrompe imediatamente sem enviar de novo', async t => {
  const controller = new AbortController();
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 408 }));
  const timeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
    const timer = timeout(callback, delay);
    queueMicrotask(() => controller.abort());
    return timer;
  });
  await assert.rejects(uploadRequest('/part', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 1);
});

test('retomar um arquivo já publicado não reenvia partes nem finaliza novamente', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ published: true }));
  const file = new File(['conteúdo'], 'teste.mp3');
  let progress = 0;
  await uploadFile(file, '/published', 20, new Map<number, UploadedPart>(), new AbortController().signal,
    size => { progress += size; });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(progress, file.size);
});
