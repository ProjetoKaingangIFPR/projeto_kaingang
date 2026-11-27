interface Env {
  API_URL: string;
}

// Encaminha somente /api/* ao Worker; o Pages publica o frontend separadamente.
export const onRequest: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  let upstream: URL;
  try {
    upstream = new URL(env.API_URL);
    if (upstream.protocol !== 'https:' || upstream.username || upstream.password) throw new Error();
  } catch {
    return Response.json({ error: 'Configure API_URL no Cloudflare Pages.' }, { status: 503 });
  }
  const incoming = new URL(request.url);
  if (upstream.origin === incoming.origin) {
    return Response.json({ error: 'API_URL deve apontar para o Worker da API.' }, { status: 503 });
  }
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;
  const headers = new Headers(request.headers);
  // The runtime must generate these headers for the upstream host and body.
  headers.delete('Host');
  headers.delete('Connection');
  headers.delete('Transfer-Encoding');
  headers.delete('Content-Length');
  const uploadPart = request.method === 'PUT' && /^\/api\/admin\/stories\/[^/]+\/parts\/\d+$/.test(incoming.pathname);
  let body: BodyInit | null = request.body;
  if (uploadPart && request.body) {
    const declaredLength = request.headers.get('Content-Length');
    const expectedLength = declaredLength !== null && /^\d+$/.test(declaredLength) ? Number(declaredLength) : null;
    if (expectedLength !== null && (!Number.isSafeInteger(expectedLength) || expectedLength > 8 * 1024 * 1024)) {
      return Response.json({ error: 'A parte enviada ultrapassa 8 MB.' }, { status: 413 });
    }
    if (expectedLength !== null && typeof FixedLengthStream !== 'undefined') {
      // Preserve a runtime-generated Content-Length without buffering/copying the
      // whole part in the Pages isolate (several parts can arrive concurrently).
      const stream = new FixedLengthStream(expectedLength);
      waitUntil(request.body.pipeTo(stream.writable).catch(error => {
        console.error('Story part stream failed', incoming.pathname, String(error));
      }));
      body = stream.readable;
    } else {
      // Clients without Content-Length still get a bounded upload.
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > 8 * 1024 * 1024) {
          await reader.cancel();
          return Response.json({ error: 'A parte enviada ultrapassa 8 MB.' }, { status: 413 });
        }
        chunks.push(result.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      body = bytes;
    }
  }
  const outgoing = uploadPart
    ? new Request(upstream, { method: request.method, headers, body, redirect: 'manual' })
    : new Request(new Request(upstream, request), { headers, redirect: 'manual' });
  const response = await fetch(outgoing, { redirect: 'manual' });
  if (!response.ok && !response.headers.get('Content-Type')?.includes('application/json')) {
    console.error('API request rejected by upstream', request.method, incoming.pathname, response.status, response.headers.get('CF-Ray'));
    return Response.json({ error: `O servidor recusou a requisição (HTTP ${response.status}). Tente novamente.`, requestId: response.headers.get('CF-Ray') },
      { status: response.status, headers: { 'Cache-Control': 'no-store', 'X-Upload-Error-Source': 'upstream' } });
  }
  return response;
};
