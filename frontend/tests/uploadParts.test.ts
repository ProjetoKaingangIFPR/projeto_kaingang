import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadParts, type UploadedPart } from '../src/admin/uploadParts';

test('envia partes em paralelo e retoma sem repetir partes confirmadas ou alterar os bytes', async t => {
  const original = Uint8Array.from({ length: 109 }, (_, i) => i);
  const file = new File([original], 'teste.mov');
  const confirmed = new Map<number, UploadedPart>();
  const received = new Map<number, Uint8Array>();
  let active = 0, peak = 0, interrupt = true;
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    const number = Number(url.split('/').pop());
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, number === 1 ? 10 : 1));
    active--;
    if (interrupt && number === 2) return Response.json({ error: 'Interrompido' }, { status: 409 });
    assert.equal(received.has(number), false);
    received.set(number, new Uint8Array(await (init.body as Blob).arrayBuffer()));
    return Response.json({ partNumber: number, etag: String(number) });
  });
  let progress = 0;
  const send = () => uploadParts(file, '/teste', 20, confirmed, new AbortController().signal, size => { progress += size; });
  await assert.rejects(send, /Interrompido/);
  assert.equal(active, 0);
  assert.ok(confirmed.size > 0);
  interrupt = false;
  progress = 0;
  const ordered = await send();
  assert.equal(peak, 3);
  assert.equal(progress, file.size);
  const reconstructed = await new Blob(ordered.map(part => Uint8Array.from(received.get(part.partNumber)!))).arrayBuffer();
  assert.deepEqual(new Uint8Array(reconstructed), original);
});
