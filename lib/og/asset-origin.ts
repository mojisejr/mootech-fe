// Where an edge route fetches this app's OWN static files (images under /public) from.
//
// On Vercel `new URL(req.url).origin` is the public host. Self-hosted (`next start` in the mumate-infra container,
// since 2026-10-09) Next 14.2 builds an edge route's req.url from the address the server LISTENS on plus the proxy's
// X-Forwarded-Proto (next-server.js attachRequestMeta): behind Caddy that is `https://0.0.0.0:3000`. Fetching it
// speaks TLS to a plain-HTTP port (ERR_SSL_WRONG_VERSION_NUMBER), Satori cannot size the background image, and the
// response dies - every LINE link preview timed out. A listen address is local by definition, so fetch it over
// plain HTTP on loopback; a real host is returned unchanged.
const LISTEN_HOSTS = new Set(["0.0.0.0", "localhost", "127.0.0.1", "[::]", "[::1]"])

export function assetOrigin(requestUrl: string): string {
  const url = new URL(requestUrl)
  if (!LISTEN_HOSTS.has(url.hostname)) return url.origin
  return `http://127.0.0.1${url.port ? `:${url.port}` : ""}`
}
