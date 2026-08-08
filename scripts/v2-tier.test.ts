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
// SECOND bug-class (issue #213): the dev-only URL tier override must DIE on production and must never turn a
// `null` (unknown) tier into a known value. The prod-death is the control — the closing criterion is a
// call-site mutant: delete the `process.env.NODE_ENV !== 'production'` guard in useV2Tier → the production
// hook test below goes RED. (resolveTierOverride is a pure param parser; prod-death lives at the caller so a
// prod build can dead-code-eliminate the whole branch — see useV2Tier.)
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

  it('no account → KNOWN free (isPaid=false, not loading)', () => {
    expect(computeTier({ userId: '', done: false, errored: false, user: null })).toEqual({ isPaid: false, loading: false })
  })
  it('loading → isPaid=null (NOT false — no free flash), loading=true', () => {
    expect(computeTier({ userId: 'u1', done: false, errored: false, user: null })).toEqual({ isPaid: null, loading: true })
  })
  it('fetch error → isPaid=null (NOT false — do not hide paid content)', () => {
    expect(computeTier({ userId: 'u1', done: true, errored: true, user: null })).toEqual({ isPaid: null, loading: false })
  })
  it('settled but no user row → isPaid=null (unknown)', () => {
    expect(computeTier({ userId: 'u1', done: true, errored: false, user: null })).toEqual({ isPaid: null, loading: false })
  })
  it('resolved paid → isPaid=true', () => {
    expect(computeTier({ userId: 'u1', done: true, errored: false, user: PAID })).toEqual({ isPaid: true, loading: false })
  })
  it('resolved free → isPaid=false', () => {
    expect(computeTier({ userId: 'u1', done: true, errored: false, user: FREE })).toEqual({ isPaid: false, loading: false })
  })
  it('NEVER false while loading / on error (the two forbidden directions)', () => {
    expect(computeTier({ userId: 'u1', done: false, errored: false, user: null }).isPaid).not.toBe(false)
    expect(computeTier({ userId: 'u1', done: true, errored: true, user: null }).isPaid).not.toBe(false)
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

// ── useV2Tier — the override flows through the REAL seam (mock only the fetch + router) ──
vi.mock('../features/auth/hooks/useV2User', () => ({ useV2User: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: vi.fn() }))
import { useV2Tier } from '../features/auth/hooks/useV2Tier'
import { useV2User } from '../features/auth/hooks/useV2User'
import { useRouter } from 'next/router'

type UserState = { userId: string; done: boolean; errored: boolean; user: unknown }
const ANON: UserState = { userId: '', done: false, errored: false, user: null } // → computeTier KNOWN free
const LOADING: UserState = { userId: 'u1', done: false, errored: false, user: null } // → computeTier null

function renderTier(opts: { tier?: string | string[]; env: string; user?: UserState }) {
  vi.mocked(useV2User).mockReturnValue(opts.user ?? ANON)
  vi.mocked(useRouter).mockReturnValue({ query: opts.tier === undefined ? {} : { tier: opts.tier } } as unknown as ReturnType<typeof useRouter>)
  vi.stubEnv('NODE_ENV', opts.env)
  return renderHook(() => useV2Tier()).result.current
}

describe('useV2Tier — override wired through the seam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('① dev + ?tier=paid + anon(free) → isPaid=true (override reaches the seam)', () => {
    expect(renderTier({ tier: 'paid', env: 'development', user: ANON }).isPaid).toBe(true)
  })
  it('dev + ?tier=free while base is paid → isPaid=false', () => {
    const paidUser: UserState = { userId: 'u1', done: true, errored: false, user: { payment: { is_not_expired: true } } }
    expect(renderTier({ tier: 'free', env: 'development', user: paidUser }).isPaid).toBe(false)
  })
  // ② prod-leak control at the seam level (review focus): param present but production → unchanged.
  it('② production + ?tier=paid + anon(free) → isPaid stays false (no leak)', () => {
    expect(renderTier({ tier: 'paid', env: 'production', user: ANON }).isPaid).toBe(false)
  })
  it('③ dev + no param + anon → unchanged (isPaid=false)', () => {
    expect(renderTier({ env: 'development', user: ANON }).isPaid).toBe(false)
  })
  // 🔴 override must NOT manufacture certainty: a loading/unknown tier stays null even with ?tier=paid.
  it('🔴 dev + ?tier=paid while tier is loading(null) → stays null (no fabricated certainty)', () => {
    expect(renderTier({ tier: 'paid', env: 'development', user: LOADING }).isPaid).toBe(null)
  })
  it('④ dev + junk ?tier=lol + anon → unchanged (isPaid=false), no throw', () => {
    expect(renderTier({ tier: 'lol', env: 'development', user: ANON }).isPaid).toBe(false)
  })
})
