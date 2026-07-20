// MuMate v2 preview gate — shared helpers used by pages/api/v2/login and pages/v2 SSR (Node
// runtime). middleware.ts must NOT import this: it runs in the Edge Runtime and checks the cookie
// value against V2_PREVIEW_KEY directly (same discipline as lib/ops/gate.ts).
//
// This is the ops-gate pattern (env key → POST login → httpOnly cookie → edge guard, fail-closed)
// but DELIBERATELY SIMPLER: the v2 preview is a single team-wide passkey, so there is no per-user
// dropdown / DB lookup / Discord ping like /ops has. If per-user tracking is wanted later, it can be
// layered on without changing the gate's shape.
import type { NextApiRequest } from 'next'

export const V2_COOKIE = 'v2_access'

export function isV2Authenticated(
  req: NextApiRequest | { cookies: Partial<Record<string, string>> },
): boolean {
  const key = process.env.V2_PREVIEW_KEY
  if (!key) return false // fail closed: unconfigured = preview does not exist
  return req.cookies?.[V2_COOKIE] === key
}

// getServerSideProps guard for v2 pages OTHER than /v2 itself: redirect to the gate when the cookie
// is missing. Defense in depth — middleware already redirects unauthenticated /v2/* to /v2, but each
// page re-checking (per the ops-gate review discipline) means the gate holds even if the matcher or
// middleware order ever changes. Returns a redirect object, or null when authenticated.
export function v2RedirectIfUnauthed(
  req: NextApiRequest | { cookies: Partial<Record<string, string>> },
): { redirect: { destination: string; permanent: false } } | null {
  if (isV2Authenticated(req)) return null
  return { redirect: { destination: '/v2', permanent: false } }
}

export function v2CookieHeader(key: string): string {
  const parts = [
    `${V2_COOKIE}=${key}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${60 * 60 * 24 * 7}`, // 7 days — a preview session, longer than ops' 24h
  ]
  return parts.join('; ')
}
