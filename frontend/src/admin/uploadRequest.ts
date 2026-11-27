import { api, ApiError } from './api';

// Only use for upload operations that can safely be repeated with the same ID.
export async function uploadRequest<T>(url: string, options: RequestInit & { signal: AbortSignal }): Promise<T> {
  const { signal } = options;
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await api<T>(url, options);
    } catch (error) {
      signal.throwIfAborted();
      const transient = error instanceof ApiError
        ? error.status === 408 || error.status === 429 || error.status >= 500
        : error instanceof TypeError;
      if (!transient || attempt >= 3) throw error;
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve();
        }, 1200 * 2 ** attempt);
        signal.addEventListener('abort', abort, { once: true });
      });
    }
  }
}
