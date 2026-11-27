import { uploadRequest } from './uploadRequest';

export type UploadedPart = { partNumber: number; etag: string };

export async function uploadParts(file: File, path: string, chunkSize: number, confirmed: Map<number, UploadedPart>,
  signal: AbortSignal, onAccepted: (bytes: number) => void) {
  const count = Math.ceil(file.size / chunkSize);
  let next = 1;
  let failed = false;

  async function send() {
    try {
      while (!failed && next <= count) {
        signal.throwIfAborted();
        const number = next++;
        const offset = (number - 1) * chunkSize;
        const part = file.slice(offset, offset + chunkSize);
        if (!confirmed.has(number)) {
          const receipt = await uploadRequest<UploadedPart>(path + '/parts/' + number, {
            method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: part, signal,
          });
          confirmed.set(number, receipt);
        }
        onAccepted(part.size);
      }
    } catch (err) {
      failed = true;
      throw err;
    }
  }

  const workers = Array.from({ length: Math.min(3, count) }, send);
  const results = await Promise.allSettled(workers);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  signal.throwIfAborted();
  return Array.from(confirmed.values()).sort((a, b) => a.partNumber - b.partNumber);
}

export async function uploadFile(file: File, path: string, chunkSize: number, confirmed: Map<number, UploadedPart>,
  signal: AbortSignal, onAccepted: (bytes: number) => void) {
  const { published } = await uploadRequest<{ published?: boolean }>(path + '/start', { method: 'POST', signal });
  if (published) {
    onAccepted(file.size);
    return;
  }
  const parts = await uploadParts(file, path, chunkSize, confirmed, signal, onAccepted);
  await uploadRequest(path + '/finish', { method: 'POST', body: JSON.stringify(parts), signal });
}
