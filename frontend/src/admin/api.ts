export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json().catch(() => null) as {error?: string} | null;
  if (!response.ok) throw new ApiError(data?.error || 'Não foi possível acessar o servidor.', response.status);
  return data as T;
}
