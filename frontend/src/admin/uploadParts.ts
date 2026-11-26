import { api, ApiError } from './api';

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
          const put = () => api<UploadedPart>(path + '/parts/' + number, {
            method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: part, signal,
          });
          let receipt: UploadedPart;
          try {
            receipt = await put();
          } catch (err) {
            if (signal.aborted || failed || (err instanceof ApiError && err.status < 500 && err.status !== 429)) throw err;
            await new Promise(resolve => setTimeout(resolve, 1200));
            signal.throwIfAborted();
            if (failed) throw err;
            receipt = await put();
          }
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
