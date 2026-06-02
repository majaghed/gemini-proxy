export const config = { runtime: 'edge' };

// Заголовки, которые нельзя пробрасывать в апстрим
const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailer', 'transfer-encoding',
  'upgrade', 'content-length', 'accept-encoding',
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const upstreamPath = url.pathname.replace(/^\/api\/proxy/, '') || '/';
  const target = 'https://generativelanguage.googleapis.com' + upstreamPath + url.search;

  const headers = new Headers();
  for (const [k, v] of req.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
  }

  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  // В Edge runtime req.body — ReadableStream. Безопаснее прочитать целиком.
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'proxy_fetch_failed', message: String(e) }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  // Чистим ответные заголовки тоже
  const outHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) outHeaders.set(k, v);
  }
  outHeaders.set('access-control-allow-origin', '*');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
