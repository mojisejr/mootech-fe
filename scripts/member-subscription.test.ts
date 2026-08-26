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
//   MB  selection stops excluding past-expire rows (removes expire_at >= today)  → the expired test reddens.
//       This is B2's main-lane guard: the whole date filter lives in the picker now (not split into SQL),
//       so flipping the compare (>= → <=) reddens HERE in `npm test`, never only in the DB suite.
//   MC  selection stops excluding non-ACTIVE rows                                → the REPLACED test reddens
//   MD  fallback returns free when there is no v2 row instead of the legacy verdict → the legacy-paid test reddens
//   ME  a FREE-tier v2 row is treated as paid                                    → the FREE-tier test reddens
//   MF  parseTierCode goes back to a raw cast (B1)                               → an unknown tier_code reads
//       as paid and the "unknown ⇒ isPaid null" test reddens
import { describe, it, expect } from 'vitest'
import {
  pickActiveSubscriptionRow,
  resolveTierFromSources,
  resolveMembershipFromRows,
  toSubRows,
  type SubRow,
} from '@/lib/v2/subscription'
import { tierIsPaid, parseTierCode } from '@/lib/v2/tier'

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

  it('MF — a v2 row with an UNKNOWN tier_code fails CLOSED: isPaid null (NOT true), never inferred paid', () => {
    // tier_code is the ONLY membership signal on the v2 path, so garbage = we know nothing. A raw cast would
    // make anything-but-FREE read as paid; the allow-list returns null and we fail closed (tier-lock locks).
    for (const bad of ['free', 'PLUSS', 'ACTIVE', '', 'plus', 'Pro']) {
      const r = resolveTierFromSources({ subRow: { tierCode: bad }, legacy: legacyMember })
      expect(r.isPaid).not.toBe(true)
      expect(r).toEqual({ isPaid: null, tier: null, source: 'v2' })
    }
  })
})

describe('parseTierCode — allow-list, not a cast (B1)', () => {
  it('the three known codes parse to themselves', () => {
    expect(parseTierCode('FREE')).toBe('FREE')
    expect(parseTierCode('PLUS')).toBe('PLUS')
    expect(parseTierCode('PRO')).toBe('PRO')
  })
  it('unknown / wrong-case / empty / null / undefined ⇒ null', () => {
    for (const bad of ['free', 'PLUSS', 'ACTIVE', '', 'Pro', null, undefined]) {
      expect(parseTierCode(bad as string | null | undefined)).toBeNull()
    }
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

// ── #383 — the two pure pieces the /api/user composite reuses ────────────────────────────────────────
// They exist so the selection + fallback rule has ONE copy across both callers (resolveSubscription, which
// reads member_payment lazily, and the route, which already holds that row).
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MS1  toSubRows stops slicing expire_at to 10 chars  → the timestamp case red (a DATE that arrives as
//        '2099-12-31T00:00:00.000Z' would never compare equal to a 'YYYY-MM-DD' today)
//   MS2  resolveMembershipFromRows ignores `legacy`      → the fallback cases red (a member drops to free)
describe('#383 toSubRows — the row mapping IS part of the rule', () => {
  // The shape the driver actually hands us today: expire_at as 'YYYY-MM-DD', created_at as a Date.
  // (Proven end-to-end against real rows in scripts/user-membership-db.test.ts case ②.)
  it('the REAL row shape maps through unchanged', () => {
    const [r] = toSubRows([
      { id: 'b', tierCode: 'PLUS', status: 'ACTIVE', expireAt: '2027-01-31', createdAt: new Date('2026-08-01T00:00:00Z') },
    ])
    expect(r.expireAt).toBe('2027-01-31')
    expect(r.createdAt).toBe('2026-08-01T00:00:00.000Z')
  })
  it('a non-Date created_at is stringified, not dropped', () => {
    const [r] = toSubRows([
      { id: 'c', tierCode: 'PLUS', status: 'ACTIVE', expireAt: '2027-01-31', createdAt: '2026-08-01 07:00:00' },
    ])
    expect(r.createdAt).toBe('2026-08-01 07:00:00')
  })
  // 🟠 NOT ASSERTED HERE ON PURPOSE — a Date-valued expire_at maps to garbage ('Fri Jan 01', from
  // String(Date).slice(0,10)), which would read as long-expired and drop a paying v2 member to their
  // legacy verdict. Pre-existing since #354; unreachable today because the driver returns a string for
  // this column. Recorded as its own ticket rather than fixed here (it is not needed to prove #383's DoD,
  // and #352's rule is: found-on-the-way ⇒ open a ticket, do not detour). Pinning the broken output in a
  // test would bless it, so this comment is the marker instead.
})

describe('#383 resolveMembershipFromRows — same verdict as the lazy path, without the second read', () => {
  const TODAY = '2026-08-22'
  const live = { id: 'x', tierCode: 'PRO' as const, status: 'ACTIVE', expireAt: '2099-12-31', createdAt: '2026-08-01T00:00:00.000Z' }
  const dead = { ...live, id: 'y', expireAt: '2020-01-01' }
  const LEGACY_MEMBER = { isFree: false, reason: 'MEMBER' as const }
  const LEGACY_NONE = { isFree: true, reason: 'NO_PLAN' as const }

  it('a live row wins and names the tier', () => {
    // #365 — expireAt is the WINNING ROW's date, not a copy of anything the caller passed in.
    expect(resolveMembershipFromRows([live], TODAY, LEGACY_NONE)).toEqual({ isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2099-12-31' })
  })
  // 🔴 MS2 — the direction that costs a paying member their access.
  it('🔴 no live row + a paid legacy verdict → paid, unnamed, source legacy (NEVER free)', () => {
    // #365 — expireAt null on the legacy path. The member DOES have an expiry; it lives in member_payment,
    // which is not this seam's table. 🔴 null here must never be read as "expired": isPaid says true.
    expect(resolveMembershipFromRows([dead], TODAY, LEGACY_MEMBER)).toEqual({ isPaid: true, tier: null, source: 'legacy', expireAt: null })
  })
  it('no rows at all + no legacy → free/none', () => {
    expect(resolveMembershipFromRows([], TODAY, LEGACY_NONE)).toEqual({ isPaid: false, tier: null, source: 'none', expireAt: null })
  })

  // #365 — the date must come from the row the ONE selection rule PICKED, not from "a row this user has".
  // This is the unit-level half of the ticket's 2-row probe; the DB half lives in member-subscription-db.
  // 🔴 MUTANT: make resolveMembershipFromRows report rows[0].expireAt instead of the picked row's → red.
  it('🔴 #365 two live rows → expireAt follows the WINNER (expire_at DESC), not the array order', () => {
    const loser = { ...live, id: 'a', expireAt: '2027-01-01' }
    const winner = { ...live, id: 'b', expireAt: '2030-06-30' }
    // loser first on purpose: an implementation that reads rows[0] passes only if the array is sorted for it.
    expect(resolveMembershipFromRows([loser, winner], TODAY, LEGACY_NONE).expireAt).toBe('2030-06-30')
    expect(resolveMembershipFromRows([winner, loser], TODAY, LEGACY_NONE).expireAt).toBe('2030-06-30')
  })

  // #365 — a row whose tier_code we refuse to understand grants nothing, so it must not print a date either.
  // 🔴 MUTANT: drop the `verdict.isPaid !== null` guard → this goes red (a declined membership shows an expiry).
  it('🔴 #365 unknown tier_code → isPaid null AND expireAt null (a declined membership prints no date)', () => {
    const junk = { ...live, id: 'j', tierCode: 'PLATINUM' }
    const r = resolveMembershipFromRows([junk], TODAY, LEGACY_NONE)
    expect(r.isPaid).toBeNull()
    expect(r.expireAt).toBeNull()
  })
})
