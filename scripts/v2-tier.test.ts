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
import { computeTier, isPaidMember } from '../lib/v2/tier' // #v2-tier-gate-both-directions
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
    expect(computeTier({ status: 'anon', userId: '', done: false, errored: false, user: null })).toEqual({ isPaid: false, loading: false })
  })
  // #246 — identity limbo (authed session, MEMBER_ID not resolved) is NOT anon. It may be a paying member,
  // so it must read null (unknown, do not gate) — never KNOWN-free (that is the paid-user-sees-upsell bug).
  // 🔴 Closing-criterion mutant: change the `status === 'loading'` branch back to `{ isPaid: false }` → RED.
  it('🔴 limbo (status loading, empty userId) → isPaid=null (NOT false — a paid user must not see the upsell)', () => {
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null })).toEqual({ isPaid: null, loading: true })
  })
  it('limbo is NEVER false (forbidden direction — the #246 regression)', () => {
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null }).isPaid).not.toBe(false)
  })
  it('authed + fetch in flight → isPaid=null (NOT false — no free flash), loading=true', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: false, errored: false, user: null })).toEqual({ isPaid: null, loading: true })
  })
  it('authed + fetch error → isPaid=null (NOT false — do not hide paid content)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: true, user: null })).toEqual({ isPaid: null, loading: false })
  })
  it('authed + settled but no user row → isPaid=null (unknown)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: null })).toEqual({ isPaid: null, loading: false })
  })
  it('authed + resolved paid → isPaid=true', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: PAID })).toEqual({ isPaid: true, loading: false })
  })
  it('authed + resolved free → isPaid=false', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: false, user: FREE })).toEqual({ isPaid: false, loading: false })
  })
  it('NEVER false while loading / on error / in limbo (the forbidden directions)', () => {
    expect(computeTier({ status: 'authed', userId: 'u1', done: false, errored: false, user: null }).isPaid).not.toBe(false)
    expect(computeTier({ status: 'authed', userId: 'u1', done: true, errored: true, user: null }).isPaid).not.toBe(false)
    expect(computeTier({ status: 'loading', userId: '', done: false, errored: false, user: null }).isPaid).not.toBe(false)
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
})
