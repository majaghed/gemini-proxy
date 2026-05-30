export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const target = 'https://generativelanguage.googleapis.com' + url.pathname.replace('/api/proxy', '') + url.search;
  
  const headers = new Headers(req.headers);
  headers.delete('host');
  
  const resp = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET','HEAD'].includes(req.method) ? undefined : req.body,
  });
  
  return new Response(resp.body, { status: resp.status, headers: resp.headers });
}
