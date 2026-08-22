// Unit gate for the v2 paid-tier seam — now on vitest (issue #213: the override needs a hook/env test, and
// #210 made vitest the repo's real framework). Registered in vitest.config.mts `include` and skipped by the
// tsx loop in ci.yml — keep BOTH in sync (that two-place sync is the tracked debt #212).
//
// ANCHOR: scripts/v2-tier.test.ts#v2-tier-gate-both-directions
// Bug-class this owns: a paid-gate that GUESSES when the tier is not known. An unknown tier is wrong BOTH
// ways — reading it as free hides a paying user's content; reading it as paid leaks paid content to free.
// So computeTier must return `null` (not false) while loading AND on a fetch error, and must NEVER report
// isPaid=true without a strict `payment.is_not_expired === true`.
//
// SECOND bug-class (issue #213 → #225): the URL tier override must only act for a request that passed the
// v2 team gate, and must never turn a `null` (unknown) tier into a known value. #225 replaced the old
// `NODE_ENV !== 'production'` guard with a server-verified `teamPreview` flag (so it works on prod for team
// members). The closing criterion is a call-site mutant: delete the `if (teamPreview)` guard in useV2Tier →
// case ② below (flag FALSE + ?tier=paid must not move) goes RED. That the PAGES actually send the flag is a
// separate call-site concern, proven against the real getServerSideProps in scripts/tier-prod-pages.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { computeTier, isPaidMember, resolveDisplayTier } from '../lib/v2/tier' // #v2-tier-gate-both-directions
import { resolveTierOverride } from '../lib/v2/tier-override'

// ── isPaidMember — strict === true, never truthy ──
describe('isPaidMember — strict === true, never truthy', () => {
  it('paid when is_not_expired === true', () => expect(isPaidMember({ payment: { is_not_expired: true } })).toBe(true))
  it('not paid when false', () => expect(isPaidMember({ payment: { is_not_expired: false } })).toBe(false))
  it('not paid when null field', () => expect(isPaidMember({ payment: { is_not_expired: null } })).toBe(false))
  it('not paid when no payment row', () => expect(isPaidMember({})).toBe(false))
  it('not paid when null user', () => expect(isPaidMember(null)).toBe(false))
  it('strict: string "true" is NOT paid (mutant: truthy)', () => expect(isPaidMember({ payment: { is_not_expired: 'true' as unknown as boolean } })).toBe(false))
  it('strict: 1 is NOT paid (mutant: truthy)', () => expect(isPaidMember({ payment: { is_not_expired: 1 as unknown as boolean } })).toBe(false))
})

// ── computeTier — the full state-table ──
describe('computeTier — free/paid state-table', () => {
  const PAID = { payment: { is_not_expired: true } }
  const FREE = { payment: { is_not_expired: false } }

  it('anon (no session, no cookie) → KNOWN free (isPaid=false, not loading)', () => {
    expect(computeTier({ status: 'anon', userId: '', done: false, errored: false, user: null })).toEqual({ isPaid: false, tier: null, loading: false })
  })
  // #246 — identity limbo (authed session, MEMBER_ID not resolved) is NOT anon. It may be a paying member,
  // so it must read null (unknown, do not gate) — never KNOWN-free (that is the paid-user-sees-upsell bug).
  // 🔴 Closing-criterion mutant: change the `status === 'loading'` branch back to `{ isPaid: false }` → RED.
  it('🔴 limbo (status loading, empty userId) → isPaid=null (NOT false — a paid user must not see the upsell)', () => {
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null })).toEqual({ isPaid: null, tier: null, loading: true })
  })
  it('limbo is NEVER false (forbidden direction — the #246 regression)', () => {
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null }).isPaid).not.toBe(false)
  })
  it('authed + fetch in flight → isPaid=null (NOT false — no free flash), loading=true', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: false, errored: false, user: null })).toEqual({ isPaid: null, tier: null, loading: true })
  })
  it('authed + fetch error → isPaid=null (NOT false — do not hide paid content)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: true, user: null })).toEqual({ isPaid: null, tier: null, loading: false })
  })
  it('authed + settled but no user row → isPaid=null (unknown)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: null })).toEqual({ isPaid: null, tier: null, loading: false })
  })
  it('authed + resolved paid → isPaid=true', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: PAID })).toEqual({ isPaid: true, tier: null, loading: false })
  })
  it('authed + resolved free → isPaid=false', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: FREE })).toEqual({ isPaid: false, tier: null, loading: false })
  })
  it('NEVER false while loading / on error / in limbo (the forbidden directions)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: false, errored: false, user: null }).isPaid).not.toBe(false)
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: true, user: null }).isPaid).not.toBe(false)
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null }).isPaid).not.toBe(false)
  })
})

// ── #383 · the NAMED tier ────────────────────────────────────────────────────────────────────────────
// Bug-class this owns: a screen showing a LEVEL it does not actually know — either by guessing FREE before
// the fetch settles, or by printing a name that contradicts the paid verdict it is printed next to.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   M1  computeTier's not-determined branches return a name instead of null       → the 3 "no name before
//                                                                                   determined" cases red
//   M2  resolveDisplayTier drops the agreement check (`return tier`)              → ①② red
//   M3  resolveDisplayTier stops guarding isPaid === null                         → ③ red
//   M4  the wire value is cast instead of parsed (allow-list removed)             → ④ red
describe('#383 resolveDisplayTier — the name may never contradict the paid verdict', () => {
  // ① The pair μุน asked about by name: a paid member whose row somehow says FREE. The name is dropped
  // (→ "สมาชิก"), the access is NOT — punishing a paying user for a broken NAME is the wrong direction.
  it('① isPaid=true + raw FREE → null (never the pair true+FREE)', () => {
    expect(resolveDisplayTier(true, 'FREE')).toBe(null)
  })
  // ② The mirror: a non-paying user must not be handed a paid level to display.
  it('② isPaid=false + raw PRO → null', () => {
    expect(resolveDisplayTier(false, 'PRO')).toBe(null)
  })
  it('③ isPaid=null (not determined) → null even with a perfectly good name', () => {
    expect(resolveDisplayTier(null, 'PRO')).toBe(null)
  })
  it('④ unknown wire value → null, never coerced (allow-list, not a cast)', () => {
    expect(resolveDisplayTier(true, 'PLATINUM')).toBe(null)
    expect(resolveDisplayTier(true, '')).toBe(null)
    expect(resolveDisplayTier(true, undefined)).toBe(null)
  })
  it('agreeing pairs pass through unchanged', () => {
    expect(resolveDisplayTier(true, 'PLUS')).toBe('PLUS')
    expect(resolveDisplayTier(true, 'PRO')).toBe('PRO')
    expect(resolveDisplayTier(false, 'FREE')).toBe('FREE')
  })
})

describe('#383 computeTier — the name rides the SAME determinism as isPaid', () => {
  const PAID_PRO = { payment: { is_not_expired: true }, membership: { tier: 'PRO' } }
  const PAID_LEGACY = { payment: { is_not_expired: true } } // no membership key at all (pre-#383 response)
  const PAID_UNKNOWN_NAME = { payment: { is_not_expired: true }, membership: { tier: 'WAT' } }

  it('paid + PRO → tier PRO', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: PAID_PRO })).toEqual({ isPaid: true, tier: 'PRO', loading: false })
  })
  // The state EVERY paying member is in today: paid, no name. It must not read as free anywhere.
  it('🔴 legacy member (paid, no membership key) → isPaid TRUE + tier null (never FREE)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: PAID_LEGACY })).toEqual({ isPaid: true, tier: null, loading: false })
  })
  it('paid + unrecognised tier_code → isPaid stays TRUE, tier null (the name is lost, not the access)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: PAID_UNKNOWN_NAME })).toEqual({ isPaid: true, tier: null, loading: false })
  })
  // M1: a name must never appear before the row is determined — this is the "guess FREE" direction μุน
  // warned about, in its new clothes.
  it('🔴 no name while loading / on error / in limbo, even if a membership object is present', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: false, errored: false, user: PAID_PRO }).tier).toBe(null)
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: true, user: PAID_PRO }).tier).toBe(null)
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: PAID_PRO }).tier).toBe(null)
  })
  it('anon → no name (a free visitor is not "tier FREE", they have no subscription)', () => {
    expect(computeTier({ status: 'anon', userId: '', done: false, errored: false, user: null }).tier).toBe(null)
  })
})

// ── resolveTierOverride — pure param parser (issue #213). Prod-death is the caller's job (hook tests). ──
describe('resolveTierOverride — param parser', () => {
  it('?tier=paid → true', () => expect(resolveTierOverride('paid')).toBe(true))
  it('?tier=free → false', () => expect(resolveTierOverride('free')).toBe(false))
  it('③ no param → null (no-op)', () => expect(resolveTierOverride(undefined)).toBe(null))
  it('④ junk ?tier=lol → null, no throw', () => expect(resolveTierOverride('lol')).toBe(null))
  it('④ array value (?tier=a&tier=b) → null', () => expect(resolveTierOverride(['paid', 'free'])).toBe(null))
  it('empty string → null', () => expect(resolveTierOverride('')).toBe(null))
})

// ── useV2Tier — the override flows through the REAL seam (mock the fetch + auth verdict + router) ──
vi.mock('../features/auth/hooks/useV2User', () => ({ useV2User: vi.fn() }))
vi.mock('../lib/auth/use-current-user', () => ({ useCurrentUser: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: vi.fn() }))
import { useV2Tier } from '../features/auth/hooks/useV2Tier'
import { useV2User } from '../features/auth/hooks/useV2User'
import { useCurrentUser } from '../lib/auth/use-current-user'
import { useRouter } from 'next/router'
import type { AuthStatus } from '../lib/auth/resolve-auth'

// status = resolveAuth verdict (drives anon-vs-limbo, #246); the rest = the /api/user fetch state.
type UserState = { status: AuthStatus; userId: string; done: boolean; errored: boolean; user: unknown }
const ANON: UserState = { status: 'anon', userId: '', done: false, errored: false, user: null } // → KNOWN free
const LOADING: UserState = { status: 'authed', userId: 'u1', done: false, errored: false, user: null } // authed, fetch in flight → null
const LIMBO: UserState = { status: 'loading', userId: '', done: false, errored: false, user: null } // #246 authed session, no MEMBER_ID → null (NOT free)

// The override is now gated by the `teamPreview` flag (issue #225), NOT NODE_ENV — so the tests pass the
// flag directly, exactly the way a real page threads getServerSideProps' verdict into the hook.
function renderTier(opts: { tier?: string | string[]; teamPreview: boolean; user?: UserState }) {
  const u = opts.user ?? ANON
  vi.mocked(useV2User).mockReturnValue({ userId: u.userId, done: u.done, errored: u.errored, user: u.user } as ReturnType<typeof useV2User>)
  vi.mocked(useCurrentUser).mockReturnValue({ userId: u.userId, status: u.status } as ReturnType<typeof useCurrentUser>)
  vi.mocked(useRouter).mockReturnValue({ query: opts.tier === undefined ? {} : { tier: opts.tier } } as unknown as ReturnType<typeof useRouter>)
  return renderHook(() => useV2Tier(opts.teamPreview)).result.current
}

describe('useV2Tier — override wired through the seam (gated by teamPreview, #225)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('① team + ?tier=paid + anon(free) → isPaid=true (override reaches the seam on prod too)', () => {
    expect(renderTier({ tier: 'paid', teamPreview: true, user: ANON }).isPaid).toBe(true)
  })
  it('team + ?tier=free while base is paid → isPaid=false', () => {
    const paidUser: UserState = { userId: 'u1', done: true, errored: false, user: { payment: { is_not_expired: true } } }
    expect(renderTier({ tier: 'free', teamPreview: true, user: paidUser }).isPaid).toBe(false)
  })
  // ② the guard case (replaces #213's prod-leak case): flag FALSE ⇒ ?tier= is inert, regardless of env.
  // 🔴 Closing-criterion mutant: remove `if (teamPreview)` in useV2Tier → this goes RED.
  it('② NOT team (flag false) + ?tier=paid + anon(free) → isPaid stays false (no override without the gate)', () => {
    expect(renderTier({ tier: 'paid', teamPreview: false, user: ANON }).isPaid).toBe(false)
  })
  it('③ team + no param + anon → unchanged (isPaid=false)', () => {
    expect(renderTier({ teamPreview: true, user: ANON }).isPaid).toBe(false)
  })
  // 🔴 override must NOT manufacture certainty: a loading/unknown tier stays null even with ?tier=paid.
  it('🔴 team + ?tier=paid while tier is loading(null) → stays null (no fabricated certainty)', () => {
    expect(renderTier({ tier: 'paid', teamPreview: true, user: LOADING }).isPaid).toBe(null)
  })
  it('④ team + junk ?tier=lol + anon → unchanged (isPaid=false), no throw', () => {
    expect(renderTier({ tier: 'lol', teamPreview: true, user: ANON }).isPaid).toBe(false)
  })
  // #246 — identity limbo through the real seam: authed session but no MEMBER_ID. Must read null (unknown,
  // do not gate) so a paying member is never shown the upsell / gated. 🔴 revert computeTier's limbo branch
  // to `{ isPaid: false }` → this goes RED (the exact prod regression this ใบ fixes).
  it('🔴 #246 limbo (authed session, no MEMBER_ID) → isPaid=null, NOT free', () => {
    expect(renderTier({ teamPreview: false, user: LIMBO }).isPaid).toBe(null)
  })
  // #383 — the preview override moves the FLAG, so the NAME must move with it or the previewer sees a
  // self-contradicting header ("อัพเกรด" next to "PRO"). Mutant: drop `tier: override ? base.tier : null`
  // in useV2Tier → this goes RED.
  it('🔴 #383 team + ?tier=free on a PRO member → isPaid=false AND tier drops to null', () => {
    const proUser: UserState = { status: 'authed', userId: 'u1', done: true, errored: false, user: { payment: { is_not_expired: true }, membership: { tier: 'PRO' } } }
    const r = renderTier({ tier: 'free', teamPreview: true, user: proUser })
    expect(r.isPaid).toBe(false)
    expect(r.tier).toBe(null)
  })
  it('#383 team + ?tier=paid keeps the real name (a legacy member previews as paid-with-no-name)', () => {
    const legacyPaid: UserState = { status: 'authed', userId: 'u1', done: true, errored: false, user: { payment: { is_not_expired: true } } }
    expect(renderTier({ tier: 'paid', teamPreview: true, user: legacyPaid }).tier).toBe(null)
  })

  // 🔴 ตู๋ B1 (#387) — the hole in the FIRST version of this: it hand-wrote `override ? base.tier : null`,
  // which only reasoned about the free direction. A user whose v2 row says FREE has base.tier === 'FREE'
  // (a legal row — the 0006 CHECK allows it), so forcing "paid" produced { isPaid: true, tier: 'FREE' } —
  // the one pair lib/v2/tier.ts declares unreachable, produced by the file that declares it.
  // Mutant: put `tier: override ? base.tier : null` back → this goes RED.
  it('🔴 team + ?tier=paid on a user whose v2 row says FREE → tier drops to null, NEVER "FREE"', () => {
    const freeRow: UserState = { status: 'authed', userId: 'u1', done: true, errored: false, user: { payment: { is_not_expired: false }, membership: { tier: 'FREE' } } }
    // base really is the contradictory-looking-but-legal pair, else this test proves nothing
    expect(renderTier({ teamPreview: false, user: freeRow }).tier).toBe('FREE')
    const r = renderTier({ tier: 'paid', teamPreview: true, user: freeRow })
    expect(r.isPaid).toBe(true)
    expect(r.tier).toBe(null)
  })

  // The contract as a sweep, not as one lucky case: no reachable combination of (real row × override) may
  // leave the hook holding a pair that lib/v2/tier.ts says cannot exist.
  it('🔴 contract sweep: the override can never emit isPaid=true with tier="FREE"', () => {
    const rows = [
      { payment: { is_not_expired: false }, membership: { tier: 'FREE' } },
      { payment: { is_not_expired: true }, membership: { tier: 'PRO' } },
      { payment: { is_not_expired: true }, membership: { tier: 'PLUS' } },
      { payment: { is_not_expired: true } },
      { payment: { is_not_expired: false } },
    ]
    for (const user of rows) {
      for (const tier of ['paid', 'free', 'lol', undefined] as const) {
        const r = renderTier({ tier, teamPreview: true, user: { status: 'authed', userId: 'u1', done: true, errored: false, user } })
        if (r.isPaid === true) expect(['PLUS', 'PRO', null]).toContain(r.tier)
        if (r.isPaid === false) expect(['FREE', null]).toContain(r.tier)
        if (r.isPaid === null) expect(r.tier).toBe(null)
      }
    }
  })
})
