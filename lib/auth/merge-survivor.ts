// lib/auth/merge-survivor.ts — which of a member's two accounts survives a merge
// (mumate-login-identity-001 slice 4).
//
// §WHY THIS IS A PURE FUNCTION WITH NO DATABASE. DoD 4's first acceptance item is
// that the same pair driven from BOTH directions yields the same survivor. That is
// a property of the rule, not of the storage, and proving it against a database
// would prove the adapter instead. Same split slice 1 and slice 3 used.
//
// §THE RULE, DERIVED FROM OWNER DECISION 8 RATHER THAN RESTATED. Decision 8 says a
// paying account may never be the side that loses. Turned around, that is a rule
// about the LOSER and not about the winner, which is the only form that can be
// written as code:
//
//     the losing side must be one we KNOW has not paid.
//
// lib/v2/subscription.ts answers `isPaid` as true, false, or **null** — null being
// a v2 row whose tier_code the resolver refuses to understand, which fails closed
// and does not unlock. Only `false` is knowledge that a member has not paid. `true`
// and `null` are both "may have paid", so neither may lose, and a pair where
// neither side may lose is REFUSED rather than guessed. Owner decision 9 already
// names manual support as the fallback for whatever this flow refuses.
//
// The verdict is passed IN. This module must never read a subscription table: the
// selection rule for who has paid lives in lib/v2/subscription.ts and a second copy
// of it is the bug #369 B2 closed once already.
//
// §WHY THE LOSER'S IDENTITY COUNT IS PART OF THE DECISION. DoD 4 promises two
// things at once: exactly one `user_provider` row changes `user_id`, and the losing
// account is left with no login method. When the losing side holds MORE than one
// identity that can still authenticate, those two promises contradict each other —
// moving one row leaves that account reachable, so the member still holds two
// accounts and was told otherwise. Refusing is the only outcome that keeps both
// promises, so the count is an input here rather than a check bolted on later.
//
// §THE TIEBREAK IS A PROXY AND SAYS SO. Owner decision 5 breaks a tie by "whoever
// holds more, ties broken deterministically". Counting holdings means reading the
// roughly thirty engine tables keyed per member, which slice 4's scope excludes. So
// when both sides may lose, the OLDER account survives — a member's older account
// is the likelier home of their history — and `user_id` order settles an exact tie.
// This is a stand-in for "holds more", not an implementation of it, and it only
// ever runs when NEITHER side has paid, which owner decision 6 already classes as
// an acceptable cost handled case by case.

/** The paid verdict exactly as lib/v2/subscription.ts reports it. `null` means the
 *  resolver refused to infer membership and failed closed; it is NOT "not paid". */
export type PaidVerdict = boolean | null

export interface MergeSide {
  userId: string
  /** from lib/v2/subscription.ts. Never re-derived in this module. */
  isPaid: PaidVerdict
  /** How many of this side's provider rows could still authenticate. Counted
   *  conservatively by the caller: a row of unknown shape counts as live, so this
   *  number is never lower than the truth. See isDeadIdentityShape. */
  liveIdentities: number
  /** `user.create_at` as stored. Only ever used to break a tie. */
  createdAt: string
}

export type SurvivorRefusal =
  /** Neither side is known to be unpaid, so taking a login method from either
   *  could take it from someone who paid. */
  | 'no-side-may-lose'
  /** The losing side holds several identities that still work; moving one would
   *  leave it reachable and make the member's confirmation a lie. */
  | 'loser-holds-several-identities'
  /** The losing side holds nothing that can authenticate, so there is no
   *  credential to move and joining these two accounts is not what the member
   *  needs. */
  | 'loser-holds-no-identity'

export type SurvivorReason =
  /** exactly one side was known-unpaid */
  | 'only-one-may-lose'
  /** both sides were known-unpaid; the older account was kept */
  | 'older-account-survives'
  /** both sides were known-unpaid and created at the same recorded moment */
  | 'user-id-order'

export type SurvivorDecision =
  | {
      status: 'decided'
      survivorUserId: string
      loserUserId: string
      reason: SurvivorReason
    }
  | { status: 'refused'; reason: SurvivorRefusal }

/** The default protective predicate: only a KNOWN not-paid side may lose.
 *
 *  Injected rather than inlined because one question was still open when slice 4
 *  was authorized — whether a member whose subscription has LAPSED counts as
 *  someone we protect. Under this default a lapsed member reports `false` and may
 *  lose. If the owner reverses that, the replacement predicate is the only thing
 *  that changes. */
export const defaultMayLose = (verdict: PaidVerdict): boolean => verdict === false

/**
 * Google's dead-credential shape, reused rather than re-derived.
 *
 * Revision 0.3 of the plan measured production and drew the line at 32 characters:
 * Google rows whose `id_token` is longer can never match a subject again, because
 * they hold a `ya29...` ACCESS token that a login will never present as an
 * identity. Re-measured 2026-09-25, those rows are 253 and 333-342 characters long
 * while every real Google `sub` is 21. LINE was never affected — the legacy path's
 * email-discovery branch excluded it — and every LINE row is 33 characters.
 *
 * §THE POLARITY IS DELIBERATE AND IS THE WHOLE SAFETY ARGUMENT. This answers "is
 * this row KNOWN dead", so anything unfamiliar is treated as LIVE. A heuristic that
 * called a working credential dead would let the flow move a row and tell the
 * member they had lost nothing. Being wrong in this direction only ever makes the
 * flow refuse more.
 *
 * §AND WHY IT IS USED HERE WHEN unlinkProvider REFUSED TO USE IT. The known limit
 * recorded at lib/auth/link-account.ts declines to make this inference a live
 * GUARD, because there it would block an unlink a member legitimately asked for. A
 * false positive there denies a member an action; a false positive here only makes
 * slice 4 hand the pair to support. The inference may narrow what this flow does
 * and must never widen it.
 */
export function isDeadIdentityShape(provider: string, identityLength: number): boolean {
  return String(provider ?? '').trim().toLowerCase() === 'google' && identityLength > 32
}

/** Count rows that could still authenticate, erring upward. */
export function countLiveIdentities(
  shapes: Array<{ provider: string; identityLength: number }>,
): number {
  return shapes.filter((s) => !isDeadIdentityShape(s.provider, s.identityLength)).length
}

export function decideSurvivor(
  a: MergeSide,
  b: MergeSide,
  opts: { mayLose?: (verdict: PaidVerdict) => boolean } = {},
): SurvivorDecision {
  const mayLose = opts.mayLose ?? defaultMayLose

  // Programmer errors, not member-facing outcomes. A merge between one account and
  // itself is a caller bug and must not be papered over with a refusal that reads
  // like a policy decision.
  if (!a.userId?.trim() || !b.userId?.trim()) {
    throw new Error('decideSurvivor requires two user ids')
  }
  if (a.userId.trim().toLowerCase() === b.userId.trim().toLowerCase()) {
    throw new Error('decideSurvivor requires two DIFFERENT user ids')
  }

  const aMayLose = mayLose(a.isPaid)
  const bMayLose = mayLose(b.isPaid)

  let loser: MergeSide
  let survivor: MergeSide
  let reason: SurvivorReason

  if (!aMayLose && !bMayLose) {
    // Includes paid-against-paid, null-against-anything-protected, and
    // null-against-null. All of them may be a paying member on the losing end.
    return { status: 'refused', reason: 'no-side-may-lose' }
  }

  if (aMayLose !== bMayLose) {
    loser = aMayLose ? a : b
    survivor = aMayLose ? b : a
    reason = 'only-one-may-lose'
  } else {
    // Both known-unpaid. Nothing about payment can separate them, so fall to the
    // documented proxy. Note this is decided WITHOUT reference to which side holds
    // the session, which is what owner decision 8 forbids.
    const cmp = String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    if (cmp === 0) {
      const older = a.userId.localeCompare(b.userId) <= 0 ? a : b
      survivor = older
      loser = older === a ? b : a
      reason = 'user-id-order'
    } else {
      survivor = cmp < 0 ? a : b
      loser = cmp < 0 ? b : a
      reason = 'older-account-survives'
    }
  }

  // Checked AFTER the direction is settled, because the promise DoD 4 makes is
  // about the account that loses and not about either account in the abstract.
  if (loser.liveIdentities <= 0) {
    return { status: 'refused', reason: 'loser-holds-no-identity' }
  }
  if (loser.liveIdentities > 1) {
    return { status: 'refused', reason: 'loser-holds-several-identities' }
  }

  return {
    status: 'decided',
    survivorUserId: survivor.userId,
    loserUserId: loser.userId,
    reason,
  }
}
