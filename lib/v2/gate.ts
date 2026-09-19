// MuMate v2 preview gate — shared helpers used by pages/api/v2/login and pages/v2 SSR (Node
// runtime). middleware.ts must NOT import this: it runs in the Edge Runtime and checks the cookie
// value against V2_PREVIEW_KEY directly (same discipline as lib/ops/gate.ts).
//
// This is the ops-gate pattern (env key → POST login → httpOnly cookie → edge guard, fail-closed)
// but DELIBERATELY SIMPLER: the v2 preview is a single team-wide passkey, so there is no per-user
// dropdown / DB lookup / Discord ping like /ops has. If per-user tracking is wanted later, it can be
// layered on without changing the gate's shape.
import type { NextApiRequest } from 'next'
import { safeEqual } from '@/lib/security/constant-time'

export const V2_COOKIE = 'v2_access'

// #606 launch cutover: this is the ACCESS gate (may this request see /v2 at all).
//   V2_PREVIEW_KEY SET   -> pre-launch: team-only (cookie must match). Behaviour unchanged.
//   V2_PREVIEW_KEY UNSET -> launched: OPEN to everyone. This is the one-variable go-live.
// ⚠️ This deliberately reverses the old "fail closed when unset" default — that was the pre-launch
// safety while Omise was in test mode (#605). Owner confirmed 2026-09-13 payments run LIVE and are
// proven, so unset now means "gate removed = public", matching guardV2 in middleware.ts (which already
// returns null when the key is unset). ACCESS opening does NOT grant the team-tier override — that is a
// SEPARATE privilege in isV2TeamPreview below, which stays closed for the public at launch.
export function isV2Authenticated(
  req: NextApiRequest | { cookies: Partial<Record<string, string>> },
): boolean {
  const key = process.env.V2_PREVIEW_KEY
  if (!key) return true // launched: gate removed -> open to everyone
  return safeEqual(req.cookies?.[V2_COOKIE], key)
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

// getServerSideProps helper (issue #225): is this request an authenticated team-preview session? Same
// check as isV2Authenticated, named for its caller — a page hands the result down as the `teamPreview`
// prop so the client-side `?tier=` override (features/auth/hooks/useV2Tier) can key off the GATE, not
// NODE_ENV, and therefore work on prod. Server-authoritative: the flag comes from the httpOnly v2_access
// cookie which client JS cannot read or forge. And it self-destructs at launch — remove V2_PREVIEW_KEY
// and isV2Authenticated → false → the page's v2RedirectIfUnauthed redirects before render, so no request
// ever reaches the hook with teamPreview=true. Nothing to remember to strip.
// The team-tier OVERRIDE privilege (may this request use `?tier=` to preview paid/free). This is NOT
// the same as access: it must stay a real team session and MUST NOT open to the public at launch, or
// every visitor could preview paid features for free (#605). So it checks the cookie DIRECTLY and, when
// the key is unset (launched), returns false for everyone — self-destructing exactly as designed, while
// isV2Authenticated (access) opens. Splitting these two is the whole point of the launch fix.
export function isV2TeamPreview(
  req: NextApiRequest | { cookies: Partial<Record<string, string>> },
): boolean {
  const key = process.env.V2_PREVIEW_KEY
  if (!key) return false // launched: nobody gets the team-tier override
  return safeEqual(req.cookies?.[V2_COOKIE], key)
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
