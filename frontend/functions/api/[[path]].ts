interface Env {
  API_URL: string;
}

// Encaminha somente /api/* ao Worker; o Pages publica o frontend separadamente.
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
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
  return fetch(new Request(upstream, request), { redirect: 'manual' });
};
