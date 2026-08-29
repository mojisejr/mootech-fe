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
//       (#358 Phase 1 added ML1–ML4 for the legacy tier + date — the contract is at the bottom of this file)
//   ME  a FREE-tier v2 row is treated as paid                                    → the FREE-tier test reddens
//   MF  parseTierCode goes back to a raw cast (B1)                               → an unknown tier_code reads
//       as paid and the "unknown ⇒ isPaid null" test reddens
import { describe, it, expect, vi, beforeEach } from 'vitest'

// #358 Phase 1 — the LAZY caller (resolveSubscription) is wired to the DB, so without these two mocks its
// only coverage is scripts/member-subscription-db.test.ts, which self-skips without TEST_DATABASE_URL.
// Measured: cutting resolveSubscription's `expireAt:` hand-off left the ENTIRE `npm test` lane green
// before this was added. The mocks stand in for the two reads the function makes and nothing else — the
// selection and fallback rules under test are the real ones.
const dbState = vi.hoisted(() => ({
  subRows: [] as any[],
  legacy: { isFree: true, reason: 'NO_PLAN', memberPayment: null } as any,
  legacyReads: 0, // counts the member_payment read — the ONLY way to see "was it read at all?"
}))
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => ({ where: async () => dbState.subRows }) }) },
}))
vi.mock('@/lib/usage', () => ({
  resolveMembership: async () => {
    dbState.legacyReads += 1
    return dbState.legacy
  },
}))

import {
  pickActiveSubscriptionRow,
  resolveTierFromSources,
  resolveMembershipFromRows,
  resolveSubscription,
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

  it('MD — no v2 row + a legacy MEMBER ⇒ paid (NOT free), tier PRO, source legacy', () => {
    // #358 Phase 1 — the 17 still-valid member_payment members carry no tier column, and #352's closing
    // criterion says they keep their access AS PRO. Before this they read `tier: null`.
    expect(resolveTierFromSources({ subRow: null, legacy: legacyMember })).toEqual({
      isPaid: true,
      tier: 'PRO',
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
  // #358 Phase 1 — the legacy input now carries the member_payment row's expire_at, supplied by whichever
  // caller already holds that row (resolveSubscription via resolveMembership, /api/user via its batch).
  const LEGACY_MEMBER = { isFree: false, reason: 'MEMBER' as const, expireAt: '2027-03-31' }
  const LEGACY_NONE = { isFree: true, reason: 'NO_PLAN' as const, expireAt: null }

  it('a live row wins and names the tier', () => {
    // #365 — expireAt is the WINNING ROW's date, not a copy of anything the caller passed in.
    expect(resolveMembershipFromRows([live], TODAY, LEGACY_NONE)).toEqual({ isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2099-12-31' })
  })
  // 🔴 MS2 — the direction that costs a paying member their access.
  it('🔴 no live row + a paid legacy verdict → paid, PRO, source legacy (NEVER free)', () => {
    // #358 Phase 1 — the tier is now named (PRO) and the date rides along from the member_payment row the
    // caller hands in. `expireAt: null` here would only mean the caller passed no row.
    expect(resolveMembershipFromRows([dead], TODAY, LEGACY_MEMBER)).toEqual({ isPaid: true, tier: 'PRO', source: 'legacy', expireAt: '2027-03-31' })
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

// ── #358 Phase 1 — a valid legacy member IS a PRO member, and their date travels ─────────────────────
//
// The measurement this exists for: 25 rows in member_payment carry plan_code='MEMBER', 17 of them still
// valid today. member_payment has NO tier column, so before this they resolved to `tier: null` and
// `expireAt: null` — a named-tier screen showed them nothing, and "ใช้ได้ถึง …" printed blank. #352's
// closing criterion (product owner's, already decided) is that they must not lose access and are PRO.
//
// 🔴 MUTANT CONTRACT — each must go RED on its own:
//   ML1  the legacy branch of resolveTierFromSources goes back to `tier: null`
//        → 'a valid legacy member is PRO' and the v2-precedence test's negative half redden
//   ML2  resolveMembershipFromRows drops the legacy arm of the expireAt expression (back to `: null`)
//        → 'the legacy expiry rides along' reddens
//   ML3  the legacy arm stops checking `verdict.isPaid === true` (any 'legacy' source reports the date)
//        → 'an EXPIRED legacy member gets no tier AND no date' reddens
//   ML4  the legacy arm reports `legacy.expireAt` raw instead of the sliced/validated day
//        → 'the shape matches the v2 path' reddens on the timestamp row
describe('#358 Phase 1 — a valid legacy member resolves to PRO, with their member_payment expiry', () => {
  const TODAY = '2026-08-28'
  const proRow = { id: 'v2', tierCode: 'PRO', status: 'ACTIVE', expireAt: '2030-01-31', createdAt: '2026-08-01T00:00:00.000Z' }
  // the shape resolveSubscription/api-user hand in: classifyMembership's verdict + member_payment.expire_at
  const LEGACY_VALID = { isFree: false, reason: 'MEMBER' as const, expireAt: '2027-03-31' }
  const LEGACY_EXPIRED = { isFree: true, reason: 'EXPIRED' as const, expireAt: '2024-01-01' }
  const LEGACY_NONE_358 = { isFree: true, reason: 'NO_PLAN' as const, expireAt: null }

  // 🔴 ML1 — the whole point of Phase 1. 17 people are in exactly this state on production today.
  it('🔴 a VALID legacy member (no v2 row) → tier PRO · isPaid true · source legacy', () => {
    const r = resolveMembershipFromRows([], TODAY, LEGACY_VALID)
    expect(r.tier).toBe('PRO')
    expect(r.isPaid).toBe(true)
    expect(r.source).toBe('legacy')
  })

  // 🔴 ML2 — without this the screen prints "ใช้ได้ถึง" followed by nothing for every legacy member.
  it('🔴 their expireAt comes from the member_payment row, in the v2 path\'s exact string shape', () => {
    expect(resolveMembershipFromRows([], TODAY, LEGACY_VALID).expireAt).toBe('2027-03-31')
    // it is the CALLER'S row, not a constant: a different row gives a different date.
    expect(resolveMembershipFromRows([], TODAY, { ...LEGACY_VALID, expireAt: '2026-11-09' }).expireAt).toBe('2026-11-09')
  })

  // 🔴 ML4 — member_payment.expire_at is a varchar, so a timestamp-shaped value is possible. It must come
  // back as the same 'YYYY-MM-DD' the v2 path reports (toSubRows slices its column identically), never a
  // half-parsed string a screen would print verbatim.
  it('🔴 the shape matches the v2 path: a timestamp-shaped expire_at is sliced to YYYY-MM-DD', () => {
    const legacyDate = resolveMembershipFromRows([], TODAY, { ...LEGACY_VALID, expireAt: '2027-03-31T00:00:00.000Z' }).expireAt
    const v2Date = resolveMembershipFromRows([proRow], TODAY, LEGACY_NONE_358).expireAt
    expect(legacyDate).toBe('2027-03-31')
    expect(legacyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(v2Date).toMatch(/^\d{4}-\d{2}-\d{2}$/) // the reference shape, asserted rather than assumed
    // garbage in that column is not a date at all → no date printed (and isPaid still answers access)
    expect(resolveMembershipFromRows([], TODAY, { ...LEGACY_VALID, expireAt: 'forever' }).expireAt).toBeNull()
  })

  // 🔴 ML3 — UNCHANGED behaviour, pinned because the new legacy arm runs closest to it.
  it('🔴 an EXPIRED legacy member is still NOT paid, gets no tier, and gets no date', () => {
    expect(resolveMembershipFromRows([], TODAY, LEGACY_EXPIRED)).toEqual({
      isPaid: false,
      tier: null,
      source: 'legacy',
      expireAt: null,
    })
  })

  // UNCHANGED — precedence. The negative halves are the teeth: PLUS must not be overwritten by PRO, and
  // the v2 row's date must not be replaced by member_payment's.
  it('a live v2 row still WINS over a legacy row (tier and date both come from v2)', () => {
    const plus = { ...proRow, tierCode: 'PLUS', expireAt: '2029-05-05' }
    const r = resolveMembershipFromRows([plus], TODAY, LEGACY_VALID)
    expect(r).toEqual({ isPaid: true, tier: 'PLUS', source: 'v2', expireAt: '2029-05-05' })
    expect(r.tier).not.toBe('PRO') // ← would pass by accident if the v2 row were PRO
    expect(r.expireAt).not.toBe(LEGACY_VALID.expireAt)
  })

  // UNCHANGED — the fail-closed path. A legacy row sitting behind it must NOT rescue it into PRO.
  it('a v2 row with an UNKNOWN tier_code still returns isPaid null, even with a paid legacy row behind it', () => {
    const junk = { ...proRow, tierCode: 'PLATINUM' }
    expect(resolveMembershipFromRows([junk], TODAY, LEGACY_VALID)).toEqual({
      isPaid: null,
      tier: null,
      source: 'v2',
      expireAt: null,
    })
  })

  // UNCHANGED — no rows anywhere.
  it('a user with no rows at all is still free/none with no date', () => {
    expect(resolveMembershipFromRows([], TODAY, LEGACY_NONE_358)).toEqual({
      isPaid: false,
      tier: null,
      source: 'none',
      expireAt: null,
    })
  })
})


// ── #358 Phase 1 · the LAZY caller — resolveSubscription must hand the legacy date through ───────────
//
// resolveMembershipFromRows cannot invent the member_payment date; whoever holds that row has to pass it.
// This suite watches the wiring in resolveSubscription (lib/v2/subscription.ts), against mocked reads.
// The route's copy of the same wiring is watched by scripts/user-membership-route.test.ts cases ① and ③c.
//
// 🔴 MUTANT CONTRACT:
//   ML6  resolveSubscription passes `expireAt: null` instead of m.memberPayment?.expireAt
//        → 'the legacy date reaches the answer' reddens (before this suite existed, npm test stayed GREEN)
//   ML7  it reads member_payment even when a live v2 row already decided the verdict
//        → 'the legacy read is skipped when a v2 row wins' reddens. 🔴 The RETURN VALUE cannot see this
//        (a v2 row wins whatever legacy says), so the test counts the read instead — asserting only the
//        returned membership left this mutant GREEN when it was first tried.
describe('#358 Phase 1 — resolveSubscription threads the legacy expiry from its own member_payment read', () => {
  const NOW = new Date('2026-08-28T05:00:00Z') // 12:00 in Bangkok, so bkkDateStr(NOW) === '2026-08-28'

  beforeEach(() => {
    dbState.subRows = []
    dbState.legacy = { isFree: true, reason: 'NO_PLAN', memberPayment: null }
    dbState.legacyReads = 0
  })

  // 🔴 ML6
  it('🔴 a valid legacy member → PRO with the date off the member_payment row resolveMembership returned', async () => {
    dbState.legacy = {
      isFree: false,
      reason: 'MEMBER',
      memberPayment: { userId: 'u1', planCode: 'MEMBER', expireAt: '2027-03-31' },
    }
    expect(await resolveSubscription('u1', NOW)).toEqual({
      isPaid: true,
      tier: 'PRO',
      source: 'legacy',
      expireAt: '2027-03-31',
    })
  })

  // 🔴 ML7 — a live v2 row wins AND the member_payment read is skipped entirely (that skip is the reason
  // the date has to be threaded rather than fetched here). Counted, not inferred: see the note above.
  it('🔴 a live v2 row wins and the member_payment read is never issued', async () => {
    dbState.subRows = [
      { id: 'v2', tierCode: 'PLUS', status: 'ACTIVE', expireAt: '2030-06-30', createdAt: new Date('2026-08-01T00:00:00Z') },
    ]
    dbState.legacy = {
      isFree: false,
      reason: 'MEMBER',
      memberPayment: { userId: 'u1', planCode: 'MEMBER', expireAt: '2027-03-31' },
    }
    expect(await resolveSubscription('u1', NOW)).toEqual({
      isPaid: true,
      tier: 'PLUS',
      source: 'v2',
      expireAt: '2030-06-30',
    })
    expect(dbState.legacyReads).toBe(0)
  })

  it('no rows anywhere → free/none, no date · and the read counter CAN move (control for ML7)', async () => {
    expect(await resolveSubscription('u1', NOW)).toEqual({ isPaid: false, tier: null, source: 'none', expireAt: null })
    // without this, ML7's `toBe(0)` would also pass against a counter that never increments at all.
    expect(dbState.legacyReads).toBe(1)
  })
})
