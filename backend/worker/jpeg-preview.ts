// Read the camera-generated JPEG in the first EXIF thumbnail directory (IFD1).
// All offsets are relative to the TIFF header and must stay inside this segment.
function exifPreview(tiff: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.length);
  if (tiff.length < 8) return null;
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const short = (pos: number) => view.getUint16(pos, little);
  const long = (pos: number) => view.getUint32(pos, little);
  if (short(2) !== 42) return null;
  const first = long(4);
  if (first < 8 || first + 2 > tiff.length) return null;
  const next = first + 2 + 12 * short(first);
  if (next + 4 > tiff.length) return null;
  const directory = long(next);
  if (!directory || directory + 2 > tiff.length) return null;
  const end = directory + 2 + short(directory) * 12;
  if (end > tiff.length) return null;
  let offset = 0, length = 0;
  for (let pos = directory + 2; pos < end; pos += 12) {
    if (short(pos + 2) !== 4 || long(pos + 4) !== 1) continue;
    if (short(pos) === 0x201) offset = long(pos + 8);
    if (short(pos) === 0x202) length = long(pos + 8);
  }
  if (length < 4 || offset + length > tiff.length || tiff[offset] !== 255 || tiff[offset + 1] !== 216) return null;
  // Preserve the original for rotated captures when the preview's orientation is ambiguous.
  for (let pos = first + 2; pos < next; pos += 12) {
    if (short(pos) === 0x112 && short(pos + 8) > 1) return null;
  }
  return tiff.slice(offset, offset + length);
}

export function jpegPreview(header: ArrayBuffer) {
  const bytes = new Uint8Array(header);
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  for (let pos = 2; pos + 4 <= bytes.length && bytes[pos] === 255;) {
    const marker = bytes[pos + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes[pos + 2] * 256 + bytes[pos + 3];
    const end = pos + 2 + length;
    if (length < 2 || end > bytes.length) break;
    if (marker === 0xe1 && length >= 8 && String.fromCharCode(...bytes.subarray(pos + 4, pos + 10)) === 'Exif\0\0') {
      return exifPreview(bytes.subarray(pos + 10, end));
    }
    pos = end;
  }
  return null;
}
