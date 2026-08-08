// Unit gate for the v2 *-preview page guards (issue #220). The 3 preview pages used to 404 on prod
// (`if (NODE_ENV === 'production') return { notFound: true }`) so ฟีม/ตู๋ could not open them on a
// Vercel/prod deploy. #220 swaps that for the SAME page-level guard the 10 real /v2 pages use —
// `v2RedirectIfUnauthed(ctx.req)` — so visibility is owned by the V2_PREVIEW_KEY gate, not NODE_ENV.
//
// Registered in vitest.config.mts `include`. Named `.test.tsx` on purpose: ci.yml's legacy tsx lane
// globs `scripts/*.test.ts`, so a `.tsx` spec is invisible to it by extension — no skip-list entry to
// hand-sync, sidestepping the #212 two-place-sync trap (and the ticket's "don't touch .github/workflows/").
//
// ANCHOR: scripts/preview-gate.test.ts#v2-preview-page-guard
// Bug-class this owns: a /v2 preview page that decides its OWN visibility instead of deferring to the
// gate. Two failure directions — (a) leaking a page to anyone unauthenticated (guard dropped), and
// (b) 404'ing an authenticated teammate on prod (the old notFound behaviour). Both are wrong.
//
// ⚠️ CALL-SITE TEETH (ตู๋ lens: "ถ้าไม่มี cookie แล้วหน้ายังเรนเดอร์ได้ เทสต์นี้จะแดงจริงไหม"):
// the helper tests below prove v2RedirectIfUnauthed is correct, but a green there does NOT prove a
// PAGE actually calls it. So each page's REAL exported getServerSideProps is invoked directly:
//   • remove/neuter the guard in any one page  → that page's "no cookie → redirect" test goes RED.
//   • revert a page to the old `notFound` guard → its "authed on prod → props" test goes RED.
// That is the closing criterion — the guard must live at the call site, not just in the helper.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isV2Authenticated, v2RedirectIfUnauthed, V2_COOKIE } from '../lib/v2/gate'

// The 3 pages under test — invoke the ACTUAL exported getServerSideProps (call-site teeth).
import { getServerSideProps as firstRunGSSP } from '../pages/v2/first-run-preview'
import { getServerSideProps as homeGSSP } from '../pages/v2/home-preview'
import { getServerSideProps as menuGSSP } from '../pages/v2/menu-preview'

const KEY = 'test-passkey'
const REDIRECT_TO_GATE = { redirect: { destination: '/v2', permanent: false } }

// Minimal GetServerSidePropsContext — the guard only reads ctx.req.cookies.
function ctx(cookies: Record<string, string>) {
  return { req: { cookies } } as never
}

// ── the gate helper — issue #220 is its FIRST test ever (grep: 0 hits before this) ──
describe('lib/v2/gate — isV2Authenticated / v2RedirectIfUnauthed', () => {
  beforeEach(() => vi.unstubAllEnvs())

  it('authed: key set + matching cookie → true', () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(isV2Authenticated({ cookies: { [V2_COOKIE]: KEY } })).toBe(true)
  })
  it('wrong cookie value → false', () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(isV2Authenticated({ cookies: { [V2_COOKIE]: 'nope' } })).toBe(false)
  })
  it('no cookie → false', () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(isV2Authenticated({ cookies: {} })).toBe(false)
  })
  it('fail-closed: V2_PREVIEW_KEY unset → false even WITH a cookie', () => {
    vi.stubEnv('V2_PREVIEW_KEY', '')
    expect(isV2Authenticated({ cookies: { [V2_COOKIE]: KEY } })).toBe(false)
  })
  it('v2RedirectIfUnauthed: authed → null (no redirect)', () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(v2RedirectIfUnauthed({ cookies: { [V2_COOKIE]: KEY } })).toBe(null)
  })
  it('v2RedirectIfUnauthed: unauthed → redirect to /v2', () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(v2RedirectIfUnauthed({ cookies: {} })).toEqual(REDIRECT_TO_GATE)
  })
})

// ── each preview PAGE actually defers to the gate (call-site teeth, issue #220) ──
const PAGES: Array<{ name: string; gssp: typeof firstRunGSSP }> = [
  { name: 'first-run-preview', gssp: firstRunGSSP },
  { name: 'home-preview', gssp: homeGSSP },
  { name: 'menu-preview', gssp: menuGSSP },
]

describe.each(PAGES)('pages/v2/$name — visibility owned by the gate, not NODE_ENV', ({ gssp }) => {
  beforeEach(() => vi.unstubAllEnvs())

  it('no cookie → redirect to /v2 (NOT a rendered page, NOT 404)', async () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({}))).toEqual(REDIRECT_TO_GATE)
  })
  it('wrong cookie → redirect to /v2', async () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({ [V2_COOKIE]: 'nope' }))).toEqual(REDIRECT_TO_GATE)
  })
  it('correct cookie → { props: {} } (the page renders — no more notFound)', async () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({ [V2_COOKIE]: KEY }))).toEqual({ props: {} })
  })

  // The behaviour is env-INDEPENDENT now (the whole point of #220): the door is the gate, not NODE_ENV.
  it('🔴 prod + correct cookie → renders (was 404 before #220 — reverting to notFound turns this RED)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({ [V2_COOKIE]: KEY }))).toEqual({ props: {} })
  })
  it('🔴 prod + no cookie → still redirect, never leaks (dropping the guard turns this RED)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({}))).toEqual(REDIRECT_TO_GATE)
  })
})
