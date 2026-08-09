// Call-site teeth for the #225 tier-on-prod wiring: the 3 real /v2 pages that read the tier
// (calendar · service · calendar/[date]) must actually SEND the `teamPreview` flag from their
// getServerSideProps — otherwise the hook's `if (teamPreview)` guard (scripts/v2-tier.test.ts case ②)
// is green while `?tier=` never works, because no page ever hands the flag down. bong #225: "เคส (page)
// ต้องยิง getServerSideProps ของหน้าจริง" — so we invoke the REAL exported getServerSideProps, not a hook.
//
// Named `.tsx` on purpose: ci.yml's legacy tsx lane globs `scripts/*.test.ts`, so a `.tsx` spec is invisible
// to it by extension — no ci.yml skip-list edit (the ใบ forbids touching .github/workflows/), no #212 sync.
//
// Mutant (closing criterion): revert any page to `return { props: {} }` → its `props.teamPreview === true`
// assertion goes RED. Hardcode `teamPreview: false` → also RED. The flag must be the gate's real verdict.
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Importing a real page module pulls its whole graph (→ useV2User → constants/api/endpoint.ts), which calls
// next/config's getConfig() at module load — undefined under vitest. We only exercise getServerSideProps
// (which never touches runtime config), so stub next/config to a benign shape to let the module load.
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
import { V2_COOKIE } from '../lib/v2/gate'
import { getServerSideProps as calendarGSSP } from '../pages/v2/calendar'
import { getServerSideProps as serviceGSSP } from '../pages/v2/service'
import { getServerSideProps as dayGSSP } from '../pages/v2/calendar/[date]'

const KEY = 'test-passkey'
const REDIRECT_TO_GATE = { redirect: { destination: '/v2', permanent: false } }

// Minimal GetServerSidePropsContext — these pages read ctx.req.cookies and call ctx.res.setHeader.
function ctx(cookies: Record<string, string>) {
  return { req: { cookies }, res: { setHeader: () => {} }, query: {}, params: {} } as never
}

const PAGES: Array<{ name: string; gssp: typeof calendarGSSP }> = [
  { name: 'calendar', gssp: calendarGSSP },
  { name: 'service', gssp: serviceGSSP },
  { name: 'calendar/[date]', gssp: dayGSSP },
]

describe.each(PAGES)('pages/v2/$name — SENDS teamPreview from the gate (#225 call-site teeth)', ({ gssp }) => {
  beforeEach(() => vi.unstubAllEnvs())

  it('authed (v2_access cookie) → { props: { teamPreview: true } } (the flag the ?tier= override needs)', async () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({ [V2_COOKIE]: KEY }))).toEqual({ props: { teamPreview: true } })
  })
  it('🔴 no cookie → redirect to /v2 (?tier= can never reach the hook without the gate)', async () => {
    vi.stubEnv('V2_PREVIEW_KEY', KEY)
    expect(await gssp(ctx({}))).toEqual(REDIRECT_TO_GATE)
  })
  // fail-closed: unconfigured passkey ⇒ nobody is a team member ⇒ redirect, so ?tier= dies at launch.
  it('fail-closed: V2_PREVIEW_KEY unset + cookie present → redirect (self-death at launch)', async () => {
    vi.stubEnv('V2_PREVIEW_KEY', undefined)
    expect(await gssp(ctx({ [V2_COOKIE]: KEY }))).toEqual(REDIRECT_TO_GATE)
  })
})
