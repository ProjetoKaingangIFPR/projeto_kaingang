import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
import { optimizeImage } from '../src/admin/optimizeImage';

function stubGlobal(t: TestContext, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  });
}

function chunk(type: string, data: Uint8Array) {
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length);
  output.write(type, 4);
  output.set(data, 8);
  output.writeUInt32BE(crc32(output.subarray(4, -4)), output.length - 4);
  return output;
}

function pngParts(buffer: Uint8Array) {
  const bytes = Buffer.from(buffer);
  const result: { type: string; data: Buffer; bytes: Buffer }[] = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), end = offset + length + 12;
    assert.equal(bytes.readUInt32BE(end - 4), crc32(bytes.subarray(offset + 4, end - 4)));
    result.push({ type: bytes.toString('ascii', offset + 4, offset + 8),
      data: bytes.subarray(offset + 8, end - 4), bytes: bytes.subarray(offset, end) });
    offset = end;
  }
  return result;
}

function fixture(depth = 8, animated = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(32, 0); header.writeUInt32BE(32, 4);
  header[8] = depth; header[9] = 6; // RGBA, including transparent pixels
  const scanlines = Buffer.alloc(32 * (1 + 32 * 4 * depth / 8));
  const compressed = deflateSync(scanlines, { level: 0 });
  return new File([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('tEXt', Buffer.from('Author\0Autor de teste')), chunk('gAMA', Buffer.from([0, 0, 177, 143])),
    ...(animated ? [chunk('acTL', Buffer.from([0, 0, 0, 2, 0, 0, 0, 0]))] : []),
    chunk('IDAT', compressed.subarray(0, 100)), chunk('IDAT', compressed.subarray(100)),
    chunk('eXIf', Buffer.from('metadados preservados')), chunk('IEND', Buffer.alloc(0)),
  ], 'foto.png', { type: 'image/png', lastModified: 12345 });
}

for (const depth of [8, 16]) test(`PNG ${depth} bits mantém dados de pixels, alpha e metadados com CRC válido`, async () => {
  const original = fixture(depth);
  const candidate = await optimizeImage(original);
  assert.notEqual(candidate, original);
  assert.ok(candidate.size < original.size * 0.95);
  assert.equal(candidate.type, original.type);
  assert.equal(candidate.name, original.name);
  assert.equal(candidate.lastModified, original.lastModified);
  const before = pngParts(new Uint8Array(await original.arrayBuffer()));
  const after = pngParts(new Uint8Array(await candidate.arrayBuffer()));
  const data = (parts: typeof before) => inflateSync(Buffer.concat(parts.filter(p => p.type === 'IDAT').map(p => p.data)));
  assert.deepEqual(data(after), data(before));
  assert.deepEqual(after.filter(p => p.type !== 'IDAT'), before.filter(p => p.type !== 'IDAT'));
  // Already compressed input should not be replaced just to save a few bytes.
  assert.equal(await optimizeImage(candidate), candidate);
});

test('mantém PNG animado, outros formatos e arquivos inválidos intactos', async () => {
  const animated = fixture(8, true);
  const truncated = new File([(await fixture().arrayBuffer()).slice(0, -5)], 'incompleta.png', { type: 'image/png' });
  for (const file of [animated, truncated, ...['image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/bmp']
    .map(type => new File(['original'], 'imagem', { type }))]) {
    assert.equal(await optimizeImage(file), file);
  }
});

test('respeita cancelamento antes e durante a leitura sem devolver uma cópia parcial', async t => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(optimizeImage(fixture(), controller.signal), { name: 'AbortError' });
  const duringRead = new AbortController(), file = fixture();
  const read = file.arrayBuffer.bind(file);
  t.mock.method(file, 'arrayBuffer', async () => { duringRead.abort(); return read(); });
  await assert.rejects(optimizeImage(file, duringRead.signal), { name: 'AbortError' });
});

test('usa o PNG original se a compressão não estiver disponível', async t => {
  t.mock.property(globalThis, 'CompressionStream', undefined);
  const file = fixture();
  assert.equal(await optimizeImage(file), file);
});

test('JPEG conserva nome e formato, aceita só economia relevante e libera o bitmap', async t => {
  let closed = 0;
  let output: Blob | null = new Blob([new Uint8Array(70)], { type: 'image/jpeg' });
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
    toBlob: (callback: BlobCallback, type: string, quality: number) => {
      assert.ok(['image/jpeg', 'image/png'].includes(type)); assert.equal(quality, 0.95); callback(output);
    } };
  stubGlobal(t, 'document', { createElement: () => canvas });
  stubGlobal(t, 'createImageBitmap', async (_file: File, options: ImageBitmapOptions) => {
    assert.equal(options.imageOrientation, 'from-image');
    return { width: 300, height: 500, close() { closed++; } };
  });
  const original = new File([new Uint8Array(100)], 'retrato.JPG', { type: 'image/jpeg', lastModified: 1000 });
  const candidate = await optimizeImage(original);
  assert.equal(candidate.type, original.type);
  assert.equal(candidate.name, original.name);
  assert.equal(candidate.lastModified, original.lastModified);
  assert.equal(candidate.size, 70);
  for (output of [null, new Blob([new Uint8Array(99)], { type: 'image/jpeg' }),
    new Blob([new Uint8Array(40)], { type: 'image/webp' })]) {
    assert.equal(await optimizeImage(original), original);
  }
  assert.equal(closed, 4);
  assert.equal(canvas.width * canvas.height, 0);
});

test('escolhe PNG para JPEG quando for menor e atualiza a extensão e o MIME', async t => {
  stubGlobal(t, 'document', { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob: (callback: BlobCallback, type: string) => callback(new Blob([new Uint8Array(type === 'image/png' ? 20 : 70)], { type })),
  }) });
  stubGlobal(t, 'createImageBitmap', async () => ({ width: 10, height: 10, close() {} }));
  const original = new File([new Uint8Array(100)], 'foto.original.jpg', { type: 'image/jpeg', lastModified: 123 });
  const candidate = await optimizeImage(original);
  assert.equal(candidate.type, 'image/png');
  assert.equal(candidate.name, 'foto.original.png');
  assert.equal(candidate.size, 20);
  assert.equal(candidate.lastModified, 123);
});

test('converte PNG opaco para JPEG menor e mantém transparência e PNG 16 bits', async t => {
  let transparent = false, decoded = 0;
  stubGlobal(t, 'document', { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ drawImage() {}, getImageData: () => ({ data: Uint8ClampedArray.from([255, 0, 0, transparent ? 128 : 255]) }) }),
    toBlob: (callback: BlobCallback, type: string) => callback(new Blob([new Uint8Array(20)], { type })),
  }) });
  stubGlobal(t, 'createImageBitmap', async () => { decoded++; return { width: 32, height: 32, close() {} }; });
  const original = fixture();
  const jpeg = await optimizeImage(original);
  assert.equal(jpeg.type, 'image/jpeg');
  assert.equal(jpeg.name, 'foto.jpg');
  assert.equal(jpeg.lastModified, original.lastModified);
  transparent = true;
  const png = await optimizeImage(original);
  assert.equal(png.type, 'image/png');
  assert.equal(png.name, 'foto.png');
  assert.equal((await optimizeImage(fixture(16))).type, 'image/png');
  assert.equal((await optimizeImage(fixture(8, true))).type, 'image/png');
  assert.equal(decoded, 2);
});

test('uma falha na conversão não descarta o candidato PNG sem perdas', async t => {
  stubGlobal(t, 'document', {});
  stubGlobal(t, 'createImageBitmap', async () => { throw new Error('Navegador sem suporte.'); });
  const original = fixture();
  const candidate = await optimizeImage(original);
  assert.equal(candidate.type, 'image/png');
  assert.ok(candidate.size < original.size);
});

test('cancelamento durante decode JPEG libera o bitmap e não continua a conversão', async t => {
  const controller = new AbortController();
  let closed = false;
  stubGlobal(t, 'document', { createElement: () => ({ width: 0, height: 0 }) });
  stubGlobal(t, 'createImageBitmap', async () => {
    controller.abort();
    return { width: 100, height: 100, close() { closed = true; } };
  });
  await assert.rejects(optimizeImage(new File(['jpeg'], 'a.jpg', { type: 'image/jpeg' }), controller.signal), { name: 'AbortError' });
  assert.equal(closed, true);
});

test('JPEG com gain map ou múltiplas imagens não é recodificado', async t => {
  let decoded = 0;
  stubGlobal(t, 'document', {});
  stubGlobal(t, 'createImageBitmap', () => { decoded++; throw new Error('Não deve decodificar.'); });
  for (const marker of ['MPF\0', 'hdrgm:', 'hdr-gain-map']) {
    const original = new File([marker], 'hdr.jpg', { type: 'image/jpeg' });
    assert.equal(await optimizeImage(original), original);
  }
  assert.equal(decoded, 0);
});
