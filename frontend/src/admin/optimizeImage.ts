// Compare PNG/JPEG candidates without resizing. JPEG quality is an encoder
// setting, not a guarantee of perceptual fidelity.
const jpegQuality = 0.95;
const maxCanvasPixels = 40_000_000;
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

async function recompressPng(original: File, signal: AbortSignal): Promise<Blob | null> {
  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') return null;
  const bytes = new Uint8Array(await original.arrayBuffer());
  signal.throwIfAborted();
  if (!pngSignature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer);
  const imageData: BlobPart[] = [];
  let start = -1, end = -1, ended = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    signal.throwIfAborted();
    const length = view.getUint32(offset), next = offset + 12 + length;
    if (next > bytes.length) return null;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    // Keep animated images intact. All other chunks (EXIF, color, text, etc.)
    // are preserved byte for byte, including 16-bit and palette information.
    if (type === 'acTL') return null;
    if (type === 'IDAT') {
      if (end !== -1 && offset !== end) return null;
      if (start === -1) start = offset;
      end = next;
      imageData.push(bytes.slice(offset + 8, offset + 8 + length));
    }
    if (type === 'IEND') { ended = next === bytes.length && length === 0; break; }
    offset = next;
  }
  if (!ended || start === -1) return null;

  const compressed: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  await new Blob(imageData).stream()
    .pipeThrough(new DecompressionStream('deflate'))
    .pipeThrough(new CompressionStream('deflate'))
    .pipeTo(new WritableStream<Uint8Array>({ write(chunk) {
      size += chunk.byteLength;
      // Stop if even the compressed image data exceeds the whole original.
      if (size >= original.size) throw new Error('PNG não ficou menor.');
      compressed.push(Uint8Array.from(chunk));
    } }), { signal });
  signal.throwIfAborted();
  const data = new Uint8Array(size + 12);
  const outputView = new DataView(data.buffer);
  outputView.setUint32(0, size);
  data.set([73, 68, 65, 84], 4); // IDAT
  let offset = 8;
  for (const chunk of compressed) { data.set(chunk, offset); offset += chunk.byteLength; }
  outputView.setUint32(size + 8, crc32(data.subarray(4, size + 8)));
  return new Blob([bytes.slice(0, start), data, bytes.slice(end)], { type: original.type });
}

function pngAllowsCanvas(bytes: Uint8Array) {
  if (!pngSignature.every((byte, index) => bytes[index] === byte) || bytes.length < 33 || bytes[24] !== 8) return false;
  const view = new DataView(bytes.buffer);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset), next = offset + 12 + length;
    if (next > bytes.length) return false;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    // Keep animations, high bit depths and extended color information intact.
    if (['acTL', 'cICP', 'mDCV', 'cLLI', 'iCCP'].includes(type)) return false;
    if (type === 'IEND') return length === 0 && next === bytes.length;
    offset = next;
  }
  return false;
}

async function canvasCandidates(original: File, signal: AbortSignal): Promise<Blob[]> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return [];
  if (original.type === 'image/png') {
    const bytes = new Uint8Array(await original.arrayBuffer());
    signal.throwIfAborted();
    if (!pngAllowsCanvas(bytes)) return [];
  }
  // Multi-picture JPEGs can include HDR gain maps; canvas would discard them.
  const header = new Uint8Array(await original.slice(0, 256 * 1024).arrayBuffer());
  const text = new TextDecoder('latin1').decode(header);
  if (original.type === 'image/jpeg' && (text.includes('MPF\0') || text.includes('hdrgm:') || text.includes('hdr-gain-map'))) return [];
  signal.throwIfAborted();
  const bitmap = await createImageBitmap(original, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  try {
    signal.throwIfAborted();
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > maxCanvasPixels) return [];
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) return [];
    context.drawImage(bitmap, 0, 0);
    if (original.type === 'image/png') {
      // An alpha channel can be entirely opaque. Check the actual pixels in
      // strips to avoid allocating a second full-resolution image buffer.
      for (let y = 0; y < bitmap.height; y += 64) {
        signal.throwIfAborted();
        const pixels = context.getImageData(0, y, bitmap.width, Math.min(64, bitmap.height - y)).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) return [];
      }
    }
    const candidates: Blob[] = [];
    // PNG inputs already have a lossless candidate from the original IDAT.
    const types = original.type === 'image/jpeg' ? ['image/jpeg', 'image/png'] : ['image/jpeg'];
    for (const type of types) {
      try {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, jpegQuality));
        signal.throwIfAborted();
        if (blob?.type === type) candidates.push(blob);
      } catch {
        signal.throwIfAborted();
      }
    }
    return candidates;
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
}

export async function optimizeImage(original: File, signal = new AbortController().signal,
  progress: (value: number) => void = () => {}) {
  signal.throwIfAborted();
  progress(0);
  try {
    if (!['image/jpeg', 'image/png'].includes(original.type)) return original;
    const candidates: Blob[] = [];
    if (original.type === 'image/png') {
      try {
        const lossless = await recompressPng(original, signal);
        if (lossless) candidates.push(lossless);
      } catch { signal.throwIfAborted(); }
    }
    try { candidates.push(...await canvasCandidates(original, signal)); }
    catch { signal.throwIfAborted(); }
    const blob = candidates.filter(candidate => candidate.size > 0).sort((a, b) => a.size - b.size)[0];
    signal.throwIfAborted();
    // A meaningful saving avoids replacing files that are already compressed.
    if (!blob?.size || blob.size > original.size * 0.95) return original;
    const name = blob.type === original.type ? original.name
      : (original.name.replace(/\.[^.]+$/, '') || original.name) + (blob.type === 'image/jpeg' ? '.jpg' : '.png');
    return new File([blob], name, { type: blob.type, lastModified: original.lastModified });
  } catch (error) {
    if (signal.aborted) throw error;
    // Optimization is optional: unsupported or malformed images use the source.
    return original;
  } finally {
    progress(100);
  }
}
