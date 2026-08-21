// #354 — teeth for the v2 membership READ seam (lib/v2/subscription.ts + lib/v2/tier.ts additions).
// PURE half only (no DB): the deterministic row-selection rule and the v2→legacy→free fallback. The DB
// half (migration idempotency, 24-member parity, determinism on real pg, delete→fallback) lives in
// scripts/member-subscription-db.test.ts, gated by TEST_DATABASE_URL.
//
// Registered in vitest.config.mts `include` (APPEND-only). Named .test.ts (no JSX here) — the binding
// condition is "the name is in `include`", not the extension (#353 / debt #212).
//
// 🔴 MUTANT CONTRACT — each must go RED on its own:
//   MA  selection drops the id tiebreak (ORDER BY expire_at,created_at only) → the identical-timestamp
//       determinism test reddens (two rows with equal expire_at AND created_at → order-dependent pick)
//   MB  selection stops excluding past-expire rows (removes expire_at >= today)  → the expired test reddens
//   MC  selection stops excluding non-ACTIVE rows                                → the REPLACED test reddens
//   MD  fallback returns free when there is no v2 row instead of the legacy verdict → the legacy-paid test reddens
//   ME  a FREE-tier v2 row is treated as paid                                    → the FREE-tier test reddens
import { describe, it, expect } from 'vitest'
import {
  pickActiveSubscriptionRow,
  resolveTierFromSources,
  type SubRow,
} from '@/lib/v2/subscription'
import { tierIsPaid } from '@/lib/v2/tier'

const TODAY = '2026-08-21'
const row = (o: Partial<SubRow> & { id: string }): SubRow => ({
  tierCode: 'PLUS',
  status: 'ACTIVE',
  expireAt: '2026-12-31',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...o,
})

describe('pickActiveSubscriptionRow — deterministic, expiry-at-read selection', () => {
  it('no rows ⇒ null', () => {
    expect(pickActiveSubscriptionRow([], TODAY)).toBeNull()
  })

  it('one ACTIVE row still valid today ⇒ that row', () => {
    const r = row({ id: 'a' })
    expect(pickActiveSubscriptionRow([r], TODAY)?.id).toBe('a')
  })

  it('expire_at === today is still valid (boundary is inclusive)', () => {
    expect(pickActiveSubscriptionRow([row({ id: 'a', expireAt: TODAY })], TODAY)?.id).toBe('a')
  })

  it('MB — a row past expire_at is NOT selectable even if status is still ACTIVE', () => {
    const expired = row({ id: 'a', expireAt: '2026-08-20', status: 'ACTIVE' })
    expect(pickActiveSubscriptionRow([expired], TODAY)).toBeNull()
  })

  it('MC — non-ACTIVE rows (EXPIRED / REPLACED) are excluded', () => {
    const rows = [
      row({ id: 'a', status: 'REPLACED' }),
      row({ id: 'b', status: 'EXPIRED' }),
    ]
    expect(pickActiveSubscriptionRow(rows, TODAY)).toBeNull()
  })

  it('picks the latest expire_at among live rows', () => {
    const rows = [
      row({ id: 'a', expireAt: '2026-10-01' }),
      row({ id: 'b', expireAt: '2027-01-01' }),
      row({ id: 'c', expireAt: '2026-12-01' }),
    ]
    expect(pickActiveSubscriptionRow(rows, TODAY)?.id).toBe('b')
  })

  it('ties on expire_at ⇒ the newer created_at wins', () => {
    const rows = [
      row({ id: 'a', expireAt: '2027-01-01', createdAt: '2026-08-01T00:00:00.000Z' }),
      row({ id: 'b', expireAt: '2027-01-01', createdAt: '2026-08-15T00:00:00.000Z' }),
    ]
    expect(pickActiveSubscriptionRow(rows, TODAY)?.id).toBe('b')
  })

  it('MA — ties on expire_at AND created_at ⇒ still ONE answer, INDEPENDENT of input order (id tiebreak)', () => {
    const base = { expireAt: '2027-01-01', createdAt: '2026-08-15T00:00:00.000Z' }
    const rows = [row({ id: 'r1', ...base }), row({ id: 'r2', ...base }), row({ id: 'r3', ...base })]
    // every permutation must resolve to the same row (DoD: 10× identical, order-independent)
    const perms = [
      [rows[0], rows[1], rows[2]],
      [rows[2], rows[1], rows[0]],
      [rows[1], rows[2], rows[0]],
      [rows[2], rows[0], rows[1]],
      [rows[1], rows[0], rows[2]],
    ]
    const picks = perms.map((p) => pickActiveSubscriptionRow(p, TODAY)?.id)
    expect(new Set(picks).size).toBe(1)
    expect(picks[0]).toBe('r3') // highest id under DESC — the deterministic winner
  })

  it('a live row is chosen over expired/replaced siblings', () => {
    const rows = [
      row({ id: 'old', expireAt: '2026-08-01' }), // expired
      row({ id: 'repl', status: 'REPLACED', expireAt: '2027-01-01' }),
      row({ id: 'live', expireAt: '2026-09-01' }),
    ]
    expect(pickActiveSubscriptionRow(rows, TODAY)?.id).toBe('live')
  })
})

describe('resolveTierFromSources — v2 first, then legacy member_payment, then free', () => {
  const legacyMember = { isFree: false, reason: 'MEMBER' as const }
  const legacyExpired = { isFree: true, reason: 'EXPIRED' as const }
  const legacyNone = { isFree: true, reason: 'NO_PLAN' as const }

  it('v2 PLUS row ⇒ paid, tier PLUS, source v2', () => {
    expect(resolveTierFromSources({ subRow: { tierCode: 'PLUS' }, legacy: legacyNone })).toEqual({
      isPaid: true,
      tier: 'PLUS',
      source: 'v2',
    })
  })

  it('v2 PRO row ⇒ paid, tier PRO', () => {
    expect(resolveTierFromSources({ subRow: { tierCode: 'PRO' }, legacy: legacyNone }).tier).toBe('PRO')
  })

  it('ME — a v2 FREE-tier row is NOT paid (only a named non-free tier unlocks)', () => {
    expect(resolveTierFromSources({ subRow: { tierCode: 'FREE' }, legacy: legacyMember })).toEqual({
      isPaid: false,
      tier: 'FREE',
      source: 'v2',
    })
  })

  it('MD — no v2 row + a legacy MEMBER ⇒ paid (NOT free), tier null, source legacy', () => {
    expect(resolveTierFromSources({ subRow: null, legacy: legacyMember })).toEqual({
      isPaid: true,
      tier: null,
      source: 'legacy',
    })
  })

  it('no v2 row + an EXPIRED legacy row ⇒ free, but source is legacy (a row existed)', () => {
    expect(resolveTierFromSources({ subRow: null, legacy: legacyExpired })).toEqual({
      isPaid: false,
      tier: null,
      source: 'legacy',
    })
  })

  it('no v2 row + no legacy row ⇒ free, source none', () => {
    expect(resolveTierFromSources({ subRow: null, legacy: legacyNone })).toEqual({
      isPaid: false,
      tier: null,
      source: 'none',
    })
  })
})

describe('tierIsPaid — the named-tier paid rule, unknown stays unknown', () => {
  it('null ⇒ null (do not gate on an undetermined tier)', () => {
    expect(tierIsPaid(null)).toBeNull()
  })
  it('FREE ⇒ false', () => {
    expect(tierIsPaid('FREE')).toBe(false)
  })
  it('PLUS / PRO ⇒ true', () => {
    expect(tierIsPaid('PLUS')).toBe(true)
    expect(tierIsPaid('PRO')).toBe(true)
  })
})
