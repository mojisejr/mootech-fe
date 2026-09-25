// mumate-login-identity-001 slice 4 — the survivor rule, proven without a database.
//
// ANCHOR: scripts/merge-survivor.test.ts#direction-cannot-decide-the-survivor
// Bug-class this owns: a merge that keeps whichever account the member happened to
// be signed into, which owner decision 8 forbids outright, and a merge that takes
// the last login method from an account that may have PAID. Both are silent: the
// member confirms, the row moves, and nothing reports that the wrong side lost.
//
// The `null` cases are here because lib/v2/subscription.ts answers isPaid as
// true/false/null and DoD 4 was originally written for a pair. A null verdict is a
// member whose membership could not be determined, so it must be protected exactly
// as a paying member is.
import { describe, it, expect } from 'vitest'

import {
  countLiveIdentities,
  decideSurvivor,
  defaultMayLose,
  isDeadIdentityShape,
  type MergeSide,
  type PaidVerdict,
} from '@/lib/auth/merge-survivor'

function side(userId: string, isPaid: PaidVerdict, over: Partial<MergeSide> = {}): MergeSide {
  return { userId, isPaid, liveIdentities: 1, createdAt: '2026-01-01 00:00:00', ...over }
}

describe('decideSurvivor — who is allowed to lose', () => {
  it('lets only the KNOWN unpaid side lose, and gives the same answer from both directions', () => {
    const paid = side('paid-user', true)
    const free = side('free-user', false)

    const forward = decideSurvivor(paid, free)
    const backward = decideSurvivor(free, paid)

    expect(forward).toEqual({
      status: 'decided',
      survivorUserId: 'paid-user',
      loserUserId: 'free-user',
      reason: 'only-one-may-lose',
    })
    // The property DoD 4 actually asks for: argument order is not a tiebreak.
    expect(backward).toEqual(forward)
  })

  it('moves the credential TO the paying side even when the free side holds the session — decision 8 by example', () => {
    // Decision 8's own wording: if the LINE account paid and the Google account did
    // not, the Google credential moves to the LINE account, not the reverse. The
    // session is not an input to this function at all, which is the point.
    const linePaid = side('line-account', true)
    const googleFree = side('google-account', false)

    const decision = decideSurvivor(googleFree, linePaid)

    expect(decision).toMatchObject({ survivorUserId: 'line-account', loserUserId: 'google-account' })
  })

  it('refuses when NEITHER side is known unpaid, rather than guessing', () => {
    const cases: Array<[PaidVerdict, PaidVerdict, string]> = [
      [true, true, 'both paid'],
      [true, null, 'paid against undeterminable'],
      [null, true, 'undeterminable against paid'],
      [null, null, 'neither determinable'],
    ]
    for (const [left, right, label] of cases) {
      expect(decideSurvivor(side('a', left), side('b', right)), label).toEqual({
        status: 'refused',
        reason: 'no-side-may-lose',
      })
    }
  })

  it('protects a null verdict exactly as it protects a paying member', () => {
    // null is "we could not determine membership and failed closed", never "free".
    const undeterminable = side('unknown-user', null)
    const free = side('free-user', false)

    expect(decideSurvivor(undeterminable, free)).toMatchObject({
      survivorUserId: 'unknown-user',
      loserUserId: 'free-user',
    })
  })
})

describe('decideSurvivor — when neither side has paid', () => {
  it('keeps the OLDER account and is stable in both directions', () => {
    const older = side('older', false, { createdAt: '2025-03-04 10:00:00' })
    const newer = side('newer', false, { createdAt: '2026-09-01 10:00:00' })

    const forward = decideSurvivor(older, newer)
    expect(forward).toEqual({
      status: 'decided',
      survivorUserId: 'older',
      loserUserId: 'newer',
      reason: 'older-account-survives',
    })
    expect(decideSurvivor(newer, older)).toEqual(forward)
  })

  it('falls to user_id order only when the recorded creation moment is identical', () => {
    const a = side('aaa', false, { createdAt: '2026-05-05 05:05:05' })
    const b = side('bbb', false, { createdAt: '2026-05-05 05:05:05' })

    const forward = decideSurvivor(a, b)
    expect(forward).toEqual({
      status: 'decided',
      survivorUserId: 'aaa',
      loserUserId: 'bbb',
      reason: 'user-id-order',
    })
    expect(decideSurvivor(b, a)).toEqual(forward)
  })
})

describe('decideSurvivor — what the losing account is left holding', () => {
  it('refuses when the loser still holds several working identities, so the promise it makes stays true', () => {
    // DoD 4 promises both "exactly one row moves" and "the losing account is left
    // with no login method". With two working identities on the losing side those
    // promises contradict each other, so the flow must refuse instead of telling
    // the member something untrue.
    const paid = side('paid-user', true)
    const free = side('free-user', false, { liveIdentities: 2 })

    expect(decideSurvivor(paid, free)).toEqual({
      status: 'refused',
      reason: 'loser-holds-several-identities',
    })
  })

  it('refuses when the loser holds nothing that can authenticate — there is no credential to move', () => {
    const paid = side('paid-user', true)
    const free = side('free-user', false, { liveIdentities: 0 })

    expect(decideSurvivor(paid, free)).toEqual({
      status: 'refused',
      reason: 'loser-holds-no-identity',
    })
  })

  it('judges the identity count on the LOSER and never on the survivor', () => {
    // A paying member with a pile of working credentials is not a reason to refuse;
    // only the side about to be emptied matters.
    const paid = side('paid-user', true, { liveIdentities: 5 })
    const free = side('free-user', false, { liveIdentities: 1 })

    expect(decideSurvivor(paid, free)).toMatchObject({ status: 'decided', loserUserId: 'free-user' })
  })
})

describe('the protective predicate is injected so a lapsed payer can be reclassified', () => {
  it('lets a lapsed member lose under the default', () => {
    // Slice 4 was authorized with this question still open. The default is the
    // narrow reading: an expired subscription reports false and may lose.
    expect(defaultMayLose(false)).toBe(true)
    expect(defaultMayLose(true)).toBe(false)
    expect(defaultMayLose(null)).toBe(false)
  })

  it('protects everyone once the owner supplies a wider predicate, with no other change', () => {
    const everPaid = new Set(['lapsed-user'])
    const mayLose = (v: PaidVerdict) => v === false && !everPaid.has('lapsed-user')

    const decision = decideSurvivor(side('lapsed-user', false), side('other-user', false), { mayLose })

    expect(decision).toEqual({ status: 'refused', reason: 'no-side-may-lose' })
  })
})

describe('isDeadIdentityShape — the inference may only ever refuse more', () => {
  it('knows the Google ya29 rows measured on production and nothing else', () => {
    // Revision 0.3 drew the line at 32 characters; re-measured 2026-09-25 the dead
    // rows are 253 and 333-342 long and a real Google sub is 21.
    expect(isDeadIdentityShape('google', 253)).toBe(true)
    expect(isDeadIdentityShape('google', 337)).toBe(true)
    expect(isDeadIdentityShape('google', 21)).toBe(false)
    expect(isDeadIdentityShape('GOOGLE', 253)).toBe(true)
  })

  it('never calls a LINE row dead — LINE was untouched by that bug and every row is 33', () => {
    expect(isDeadIdentityShape('line', 33)).toBe(false)
    expect(isDeadIdentityShape('LINE', 33)).toBe(false)
  })

  it('treats an unfamiliar shape as LIVE, which is the direction that cannot harm anyone', () => {
    // A future Google subject of a different length, or a provider this lane has
    // never seen, must not be written off as dead: that would let the flow move a
    // row and tell the member they lost nothing.
    expect(isDeadIdentityShape('google', 22)).toBe(false)
    expect(isDeadIdentityShape('apple', 999)).toBe(false)
    expect(isDeadIdentityShape('', 999)).toBe(false)
  })

  it('counts live identities erring upward', () => {
    expect(
      countLiveIdentities([
        { provider: 'google', identityLength: 253 },
        { provider: 'google', identityLength: 337 },
        { provider: 'google', identityLength: 21 },
        { provider: 'LINE', identityLength: 33 },
      ]),
    ).toBe(2)
    expect(countLiveIdentities([])).toBe(0)
  })
})

describe('decideSurvivor — caller mistakes are errors, not refusals', () => {
  it('throws when handed one account twice, rather than returning a policy-looking refusal', () => {
    expect(() => decideSurvivor(side('same-user', true), side('SAME-USER', false))).toThrow(
      /DIFFERENT user ids/,
    )
  })

  it('throws on a missing user id', () => {
    expect(() => decideSurvivor(side('', true), side('b', false))).toThrow(/two user ids/)
  })
})
