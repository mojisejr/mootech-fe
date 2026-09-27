// v1 is retired by redirect — CIEL mumate-be-retirement-001 slice 2a (plan rev 0.4, decision R1).
//
// The owner, 2026-09-27: "ไม่ต้องลบ code แต่ทำให้ใช้ไม่ได้" — keep the v1 code, make it unusable. This table is
// the WHOLE of that rule. middleware.ts sends every request whose path matches a row here to the row's v2
// target, so no v1 page renders and none of v1's mootech-be calls can run. The v1 pages, components and
// constants/api wrappers stay in the tree, unreachable.
//
// §HOW TO TURN IT OFF. Delete the call to `redirectRetiredV1` in middleware.ts (or empty this table). Nothing
// else changes: the v1 pages are still there and render again on the next deploy. The redirect is a 307 with
// `Cache-Control: no-store`, so no browser or CDN keeps it after the rule is gone — which is why it is not a
// 308. A 308 is cached by browsers with no expiry, and a revert would not reach anyone who had already
// followed it once.
//
// §WHAT IS KEPT, AND WHY — every page under pages/ that is NOT in this table is kept on purpose, and
// scripts/v1-retired-routes.test.ts fails if a page appears that is neither redirected nor listed as kept:
//   /v2/*                   the app.
//   /auth/after/[provider]  the NextAuth landing v2 signs in through (features/auth/hooks/useV2Login.ts).
//   /auth/error             NextAuth's error page (authOptions.pages.error).
//   /invite/[code]          the v2 referral link (lib/v2/share-invite.ts builds it; /v2/qi/referral shares it).
//   /p/[id]                 the public share page of a v2 sacred-map place.
//   /privacy/*              legal pages linked from v2 (ConsentScreen, PackageCard).
//   /maintenance            the maintenance gate's own page.
//   /ops/*, /launch, /glass-box, /what-if   internal consoles, each behind its own key in middleware.ts.
//   /pwa-check, /design-system, /dev-login, /dev-access/*   team/dev tools; none reaches mootech-be.
//
// §QUERY STRINGS ARE KEPT. `/register?ref=X` lands on `/v2/register?ref=X`, which reads `ref`; UTM and LIFF
// parameters on an old link survive the hop. No v2 target reads a v1-only parameter.
//
// §MATCHING. A row matches its own path and anything under it (`/profile` matches `/profile/activity`), except
// `/`, which matches only itself. The most specific row wins, so the order below does not matter.

export type RetiredV1Route = {
  /** the v1 path (and, except `/`, everything under it) */
  from: string
  /** where it goes now — an existing v2 page */
  to: string
  /** why this target, in one line */
  why: string
}

export const RETIRED_V1_ROUTES: readonly RetiredV1Route[] = [
  { from: '/', to: '/v2', why: 'v1 home; pages/index.tsx already sent it to /v2 after launch, now in the one rule' },
  { from: '/calculator', to: '/v2/element-finder', why: 'the public bazi calculator became the element finder' },
  { from: '/chinese-calendar', to: '/v2/calendar', why: 'Chinese calendar' },
  { from: '/fortune-stick', to: '/v2/fortune/sage', why: 'เซียมซี — v2 เซียมซีเสี่ยงทาย' },
  { from: '/friend', to: '/v2/service/compatibility/love', why: 'friends are added and edited in the compatibility picker' },
  { from: '/login', to: '/v2/login', why: 'sign-in' },
  { from: '/login-with', to: '/v2/login', why: 'v1 OTP / provider sign-in' },
  { from: '/matching', to: '/v2/service/compatibility/love', why: 'ดวงสมพงศ์ (love / friendship)' },
  { from: '/matching/recent', to: '/v2/service/compatibility/recent', why: 'recent compatibility results' },
  { from: '/matching/result', to: '/v2/service/compatibility/recent', why: 'a v1 result id does not exist in v2; the recent list does' },
  { from: '/my-destiny', to: '/v2/destiny', why: 'ดวงของฉัน' },
  { from: '/package-horoscope', to: '/v2/shop', why: 'package catalogue' },
  { from: '/package-price', to: '/v2/shop', why: 'package prices' },
  { from: '/payment', to: '/v2', why: 'v1 checkout and its Omise return pages; a v1 charge has no v2 state to resume' },
  { from: '/profile', to: '/v2/settings', why: 'profile hub' },
  { from: '/profile/edit', to: '/v2/settings/edit-profile', why: 'edit profile' },
  { from: '/profile/how-to-earn', to: '/v2/qi/missions', why: 'how to earn — v2 QI missions' },
  { from: '/register', to: '/v2/register', why: 'birth-data registration' },
  { from: '/share', to: '/v2', why: 'v1 share cards (image / profile / type); v2 shares through /invite' },
  { from: '/survey', to: '/v2', why: 'v1 personality survey; no v2 counterpart' },
  { from: '/welcome', to: '/v2', why: 'v1 post-login birth entry; /v2 sends an unregistered member to /v2/register' },
]

function matches(from: string, pathname: string): boolean {
  if (from === '/') return pathname === '/'
  return pathname === from || pathname.startsWith(`${from}/`)
}

/** The v2 target for a retired v1 path, or null when the path is not v1. Most specific row wins. */
export function retiredV1Target(pathname: string): string | null {
  let best: RetiredV1Route | null = null
  for (const row of RETIRED_V1_ROUTES) {
    if (matches(row.from, pathname) && (!best || row.from.length > best.from.length)) best = row
  }
  return best ? best.to : null
}
