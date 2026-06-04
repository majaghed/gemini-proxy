export const config = { runtime: 'edge' };

const HOP_BY_HOP = new Set([
  'host','connection','keep-alive','proxy-authenticate','proxy-authorization',
  'te','trailer','transfer-encoding','upgrade','content-length','accept-encoding',
]);

export default async function handler(req) {
  const url = new URL(req.url);
  const upstreamPath = url.pathname.replace(/^\/api\/proxy/, '') || '/';
  const target = 'https://generativelanguage.googleapis.com' + upstreamPath + url.search;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,x-goog-api-key',
        'access-control-max-age': '86400',
      },
    });
  }

  const headers = new Headers();
  for (const [k, v] of req.headers) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v);
  }

  const hasBody = !['GET','HEAD','OPTIONS'].includes(req.method);

  // 50s таймаут — Gemini иногда отвечает дольше
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 50_000);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      // СТРИМИМ тело, а не буферизируем
      body: hasBody ? req.body : undefined,
      duplex: 'half',
      signal: ctrl.signal,
      redirect: 'manual',
    });
  } catch (e) {
    clearTimeout(t);
    const aborted = e?.name === 'AbortError';
    return new Response(
      JSON.stringify({ error: aborted ? 'proxy_timeout' : 'proxy_fetch_failed', message: String(e) }),
      { status: aborted ? 504 : 502, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } },
    );
  } finally {
    clearTimeout(t);
  }

  const outHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk) || lk === 'content-encoding') continue;
    outHeaders.set(k, v);
  }
  outHeaders.set('access-control-allow-origin', '*');

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}
