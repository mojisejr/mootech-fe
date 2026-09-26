// lib/auth/link-account.ts — attaching and detaching a login credential
// (mumate-login-identity-001 slice 3).
//
// Pure logic over a narrow transaction interface, the same split slice 1 used for
// register-login: the rules are testable with no database, and the adapter that
// speaks SQL is proven separately against a real Postgres. The point of the split
// is that the interesting cases — a collision, a last-method unlink — can be
// exercised exhaustively without a server.
//
// §THE CONTRACT, from PLAN.md's identity section. One normalized
// (provider, subject) maps to exactly ONE canonical user_id. A user_id may hold
// several provider rows on purpose. Email is not part of the key and never binds.
// When a signed-in member links a provider:
//   1. no row exists            → attach it to the current user_id
//   2. it already points here   → report already linked, change nothing
//   3. it points somewhere else → STOP. Do not relink, merge, delete, transfer
//      value, or pick a winner. That collision is slice 4 and is owner-gated.
import { randomUUID } from 'node:crypto'

import { formatLegacyTimestamp, isProviderIdentityConflict } from './register-login-fe'
import { LINKABLE, PROVIDER_SPELLING, type LinkableProvider } from './link-providers'
import {
  countLiveIdentities,
  decideSurvivor,
  isDeadIdentityShape,
  type PaidVerdict,
  type SurvivorReason,
  type SurvivorRefusal,
} from './merge-survivor'

export interface ProviderRow {
  id: string
  userId: string
  provider: string
}

export interface LinkTransaction {
  /** Serialise everyone contending for the same identity BEFORE reading it, so
   *  two simultaneous links of one provider account cannot both see "no row". */
  lockIdentity(provider: string, subject: string): Promise<void>
  /** The single row owning this identity, or null. The unique index guarantees
   *  at most one; the adapter still refuses to guess if it somehow sees more. */
  findIdentityOwner(provider: string, subject: string): Promise<ProviderRow | null>
  memberExists(userId: string): Promise<boolean>
  insertProviderRow(row: {
    id: string
    userId: string
    provider: string
    subject: string
    email: string
    name: string
    pictureUrl: string
    timestamp: string
  }): Promise<void>
  /** Every provider row this member holds, used by unlink to count what is left. */
  listMemberProviders(userId: string): Promise<ProviderRow[]>
  deleteProviderRows(userId: string, provider: string): Promise<number>

  /** Slice 4. The member's rows with the LENGTH of each stored identity and never
   *  the identity itself. Length is enough to recognise the dead `ya29` class and
   *  keeps an old access token — still a credential, expired or not — from reaching
   *  application memory, a log line, or an error trace. */
  listMemberIdentityShapes(
    userId: string,
  ): Promise<Array<{ id: string; provider: string; identityLength: number }>>

  /** Slice 4. Move ONE row to another member. Addressed by row id, so it cannot
   *  widen into "every row of this provider" the way unlink deliberately does. */
  moveProviderRow(rowId: string, toUserId: string, timestamp: string): Promise<number>

  /** Slice 4. The trail support reads, and the one statement that reverses the move.
   *  Never given the subject: ops can read this table. */
  recordIdentityMerge(entry: {
    id: string
    rowId: string
    provider: string
    fromUserId: string
    toUserId: string
    reason: string
  }): Promise<void>

  /** Slice 4. `user.create_at`, used only to break a tie between two accounts that
   *  have both been determined NOT to have paid. */
  memberCreatedAt(userId: string): Promise<string>

  /** Slice 4, phase 8b-fix. Where this member stands: paid NOW (three-valued) and
   *  paid EVER.
   *
   *  §WHY IT IS ON THE TRANSACTION AND NOT INJECTED. It used to arrive through
   *  MergeDeps, wired at every call site to lib/v2/subscription.ts resolveSubscription
   *  and hasEverPaid — and both of those read through the shared `db` client. Called
   *  from inside store.transaction, which holds the application's ONLY connection
   *  (lib/db/index.ts max 1), that asked the pool for a second connection while the
   *  enclosing transaction held the only one: the transaction waited for the query,
   *  the query waited for the connection, and the container took every other request
   *  down with it. Observed twice on the shadow, 2026-09-25, with no load at all.
   *  Reading through the transaction's own executor makes that shape unrepresentable
   *  instead of merely forbidden.
   *
   *  §THE RULE IS STILL NOT DUPLICATED. The adapter only fetches rows; the verdict is
   *  resolveStandingFromRows', in the module that owns the question of who has paid. */
  memberStanding(userId: string): Promise<{ isPaid: PaidVerdict; everPaid: boolean }>
}

export interface LinkStore {
  transaction<T>(work: (tx: LinkTransaction) => Promise<T>): Promise<T>
}

export interface LinkInput {
  userId: string
  provider: LinkableProvider
  /** the provider's STABLE subject — Google's `sub`, LINE's userId. Never an
   *  access token: storing one of those as an identity is the historical bug
   *  that left 1,443 members unmatchable. */
  subject: string
  email?: string
  name?: string
  pictureUrl?: string
}

export type LinkOutcome =
  | { status: 'linked'; rowId: string }
  | { status: 'already-linked' }
  | { status: 'owned-by-another' }
  | { status: 'member-missing' }

export type UnlinkOutcome =
  | { status: 'unlinked'; removed: number }
  | { status: 'not-linked' }
  | { status: 'last-method' }
  /** The member is signed in THROUGH this method right now. Removing it strands
   *  their own session: they are still logged in, but the credential that got
   *  them here is gone, so the next sign-in must use the other method. Recorded
   *  as a hazard on 2026-09-25 with no guard; this is the guard. */
  | { status: 'current-method' }

/** Empty is written as '' and never as SQL NULL. Slice 1 defect 4: callers put
 *  the value straight into a cookie, so a null arrives in the UI as the literal
 *  string "null" and the member's name becomes the word null. */
function text(v: string | undefined | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function sameId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export async function linkProvider(
  store: LinkStore,
  input: LinkInput,
  now: Date = new Date(),
): Promise<LinkOutcome> {
  const subject = text(input.subject)
  if (!subject) throw new Error('linkProvider requires a provider subject')
  if (!text(input.userId)) throw new Error('linkProvider requires a userId')

  const key = String(input.provider).toLowerCase()
  const stored = PROVIDER_SPELLING[input.provider]

  const attempt = async (): Promise<LinkOutcome> =>
    store.transaction(async (tx) => {
      await tx.lockIdentity(key, subject)

      const owner = await tx.findIdentityOwner(key, subject)
      if (owner) {
        // Cases 2 and 3. Note the ORDER: "already linked" is checked first, so a
        // member who taps twice gets a calm answer rather than being told their
        // own account belongs to someone else.
        return sameId(owner.userId, input.userId)
          ? { status: 'already-linked' as const }
          : { status: 'owned-by-another' as const }
      }

      // A signed session whose member row has since been deleted must not create
      // a provider row pointing at nothing — that is the orphan the legacy path
      // had to grow a null-guard for.
      if (!(await tx.memberExists(input.userId))) return { status: 'member-missing' as const }

      const id = randomUUID()
      await tx.insertProviderRow({
        id,
        userId: input.userId,
        provider: stored,
        subject,
        // LINE carries no email (the channel's email permission is still the
        // team's), and an empty one must never be written as if it were real.
        email: input.provider === 'line' ? '' : text(input.email),
        name: text(input.name),
        pictureUrl: text(input.pictureUrl),
        timestamp: formatLegacyTimestamp(now),
      })
      return { status: 'linked' as const, rowId: id }
    })

  try {
    return await attempt()
  } catch (error) {
    // The advisory lock serialises our own writers, but the legacy backend can
    // insert the same identity from outside this transaction. The unique index
    // then raises 23505, and the honest reading of that is "someone else owns it
    // now" — so re-read once rather than reporting a database error to a member
    // who did nothing wrong. Exactly one retry: a second conflict means the row
    // is genuinely there.
    if (!isProviderIdentityConflict(error)) throw error
    return attempt()
  }
}

export interface UnlinkInput {
  userId: string
  provider: LinkableProvider
  /** The provider this session is signed in WITH, from the session and never from
   *  the client. Optional so a caller that genuinely has no session context (a
   *  support path, a test) is not forced to invent one. */
  sessionProvider?: string | null
}

/**
 * Remove a login method.
 *
 * §THE LAST-METHOD RULE (owner decision, 2026-09-24). Removing a member's only
 * remaining provider locks them out permanently: this workstream refuses to join
 * accounts by email, so there is no recovery path and no support action short of
 * a manual database write. The refusal counts OTHER PROVIDERS, not rows — a
 * member with several rows for one provider still has one way in.
 *
 * §WHY UNLINK EXISTS AT ALL, since it looks like a convenience. The unique index
 * added in slice 2 means one identity belongs to one member forever. A member who
 * links the wrong account — a work LINE, a shared Google — has occupied that
 * identity against everyone including its real owner, and without unlink the only
 * fix is a hand-written DELETE in production. Unlink is the escape hatch for a
 * mistake the index otherwise makes permanent.
 *
 * §KNOWN LIMIT, recorded rather than silently handled. The count asks whether
 * another PROVIDER remains, not whether that provider's stored rows can still
 * authenticate. A member whose other rows hold a dead access token (the class
 * measured at 1,443 members on 2026-09-24) would pass this check and still be
 * locked out. Detecting that would mean encoding this lane's "unusable id_token"
 * heuristic into a live guard, which is an inference, not a fact the schema
 * carries. The pre-existing condition is not made worse by unlink; it is not
 * fixed by it either.
 */
export async function unlinkProvider(store: LinkStore, input: UnlinkInput): Promise<UnlinkOutcome> {
  const key = String(input.provider).toLowerCase()

  return store.transaction(async (tx) => {
    const rows = await tx.listMemberProviders(input.userId)
    const mine = rows.filter((r) => r.provider.trim().toLowerCase() === key)
    if (mine.length === 0) return { status: 'not-linked' }

    const others = new Set(
      rows
        .map((r) => r.provider.trim().toLowerCase())
        .filter((p) => p !== '' && p !== key),
    )
    if (others.size === 0) return { status: 'last-method' }

    // AFTER last-method, and the order is the rule rather than a preference: with one
    // method a member is signed in through it, so both refusals fire, and answering
    // with the recoverable one tells them to sign in a way that does not exist. The
    // same precedence is in summariseConnections, so the button and the route cannot
    // give a member two different reasons for the same refusal.
    //
    // Checked INSIDE the transaction beside the rule above, on the same rows, so a
    // second tab cannot slip between two reads.
    if (String(input.sessionProvider ?? '').trim().toLowerCase() === key) {
      return { status: 'current-method' }
    }

    const removed = await tx.deleteProviderRows(input.userId, key)
    return { status: 'unlinked', removed }
  })
}

export interface ConnectionSummary {
  provider: LinkableProvider
  linked: boolean
  /** the provider this session is signed in with */
  current: boolean
  /** false for the last remaining method — removing it would lock the member out */
  canUnlink: boolean
  /** Why `canUnlink` is false, because the two reasons are NOT the same sentence:
   *  'last-method' is permanent and has no recovery, 'current-method' is a door the
   *  member opens by signing in the other way. A screen that renders one reason for
   *  both tells half of them something untrue. */
  unlinkBlockedBy: 'last-method' | 'current-method' | null
}

/**
 * What the Connected Accounts screen needs, derived from the member's real rows.
 *
 * §THIS EXISTS BECAUSE THE SCREEN CURRENTLY GUESSES. ConnectedScreen decides
 * "connected" with `b.key === session.provider` — string equality against the
 * provider the member happens to be signed in with. So a second linked provider
 * renders as "ยังไม่ได้เชื่อม" however well the backend works, and no endpoint
 * anywhere returns the caller's provider rows: /api/profile does not, and nothing
 * else does either. The screen cannot be made truthful without this.
 *
 * Provider comparison is lower() on both sides throughout, because the session
 * says `line` and the database says `LINE`.
 */
export function summariseConnections(
  rows: Array<{ provider: string }>,
  sessionProvider: string | null | undefined,
): ConnectionSummary[] {
  const linked = new Set(
    rows.map((r) => r.provider.trim().toLowerCase()).filter((p) => p !== ''),
  )
  const current = String(sessionProvider ?? '').trim().toLowerCase()
  return LINKABLE.map((provider) => {
    const isLinked = linked.has(provider)
    // The same two rules unlinkProvider enforces, mirrored here so a button is
    // disabled rather than offered and then refused. Both read the same source, so
    // they cannot disagree about the same member. Last-method is reported FIRST:
    // it is the permanent one, and when a member has exactly one method it is also
    // the one they are signed in with, so the weaker reason would mask it.
    const blocked: 'last-method' | 'current-method' | null = !isLinked
      ? null
      : linked.size <= 1
        ? 'last-method'
        : current === provider
          ? 'current-method'
          : null
    return {
      provider,
      linked: isLinked,
      current: current === provider,
      canUnlink: isLinked && blocked === null,
      unlinkBlockedBy: blocked,
    }
  })
}

export interface MergeInput {
  /** The member driving this, captured from the SIGNED session. Never from the
   *  client-settable cookie fallback — this attaches a login credential, so the
   *  same rule the start and unlink routes follow applies here. */
  signedInUserId: string
  provider: LinkableProvider
  /** The stable subject just proven at the provider in this same session. */
  subject: string
}

/** What a caller may still override. Standing is NOT here: it is read inside the
 *  transaction (LinkTransaction.memberStanding) because injecting it is what produced
 *  the nested-acquire deadlock of 2026-09-25. Every field is optional, so a route that
 *  wants the ordinary rules passes nothing. */
export interface MergeDeps {
  /** Overrides which sides are allowed to lose. See defaultMayLose. */
  mayLose?: (side: { isPaid: PaidVerdict; everPaid: boolean }) => boolean
}

/** Everything the decision produced, with nothing written yet. */
export interface MergePlanned {
  status: 'planned'
  survivorUserId: string
  loserUserId: string
  /** The one row that would change hands, chosen by primary key. */
  rowId: string
  /** That row's provider AS STORED, so a caller can name it without re-reading. */
  provider: string
  reason: SurvivorReason
  /** How many working credentials the losing account holds now. The survivor rule
   *  only plans a merge when this is exactly 1, so a caller can tell the member
   *  truthfully that the losing account is left with no way in. */
  loserLiveIdentities: number
}

export type MergeRefusal =
  /** The identity already belongs to the signed-in member. Nothing to join. */
  | { status: 'not-a-collision' }
  /** Nobody owns this identity, so this is slice 3's plain link and not a merge. */
  | { status: 'identity-unknown' }
  | { status: 'member-missing' }
  | { status: 'refused'; reason: SurvivorRefusal }

export type MergePlan = MergePlanned | MergeRefusal

export type MergeOutcome =
  | {
      status: 'merged'
      rowId: string
      fromUserId: string
      toUserId: string
      reason: SurvivorReason
    }
  | MergeRefusal

/**
 * Decide a merge without performing it.
 *
 * §WHY THIS IS SEPARATE FROM THE WRITE. DoD 4 requires the member to be told what
 * they are about to lose and to confirm it in a step of its own, so the decision has
 * to be reachable twice: once to describe the offer, and once again at the moment of
 * writing. Sharing one function is what stops the description and the action from
 * disagreeing — the alternative is two copies of owner decision 8, which is exactly
 * the mistake #369 B2 closed for the paid-membership rule.
 *
 * §THE PLAN IS NOT AN AUTHORISATION. It is recomputed by mergeIdentity before
 * anything moves. A payment landing between the offer and the confirmation changes
 * who is allowed to lose, and a cached verdict must never be the thing that decides.
 */
async function planWithin(
  tx: LinkTransaction,
  input: MergeInput,
  deps: MergeDeps,
): Promise<MergePlan> {
  const key = String(input.provider).toLowerCase()
  const subject = text(input.subject)

  await tx.lockIdentity(key, subject)

  const owner = await tx.findIdentityOwner(key, subject)
  // Slice 3 would have linked an unowned identity outright. Reaching here with no
  // owner means the collision evaporated between the offer and the confirmation —
  // report it rather than inventing a merge with one side missing.
  if (!owner) return { status: 'identity-unknown' }
  if (sameId(owner.userId, input.signedInUserId)) return { status: 'not-a-collision' }

  // Both accounts must still exist. user_provider.user_id carries no foreign key, so
  // a row can outlive its member, and moving a credential onto a deleted member
  // would strand it where no session can ever reach it.
  if (!(await tx.memberExists(input.signedInUserId))) return { status: 'member-missing' }
  if (!(await tx.memberExists(owner.userId))) return { status: 'member-missing' }

  const [mineShapes, theirShapes] = await Promise.all([
    tx.listMemberIdentityShapes(input.signedInUserId),
    tx.listMemberIdentityShapes(owner.userId),
  ])
  // 🔴 EVERY READ HERE IS THE TRANSACTION'S OWN. There is one connection for the whole
  // application and this transaction is holding it, so a read that goes anywhere else
  // deadlocks against itself. Promise.all is safe precisely because these all queue on
  // the same executor; it is not concurrency.
  const [mineStanding, theirStanding, mineCreated, theirCreated] = await Promise.all([
    tx.memberStanding(input.signedInUserId),
    tx.memberStanding(owner.userId),
    tx.memberCreatedAt(input.signedInUserId),
    tx.memberCreatedAt(owner.userId),
  ])

  const mineLive = countLiveIdentities(mineShapes)
  const theirLive = countLiveIdentities(theirShapes)

  const decision = decideSurvivor(
    {
      userId: input.signedInUserId,
      isPaid: mineStanding.isPaid,
      everPaid: mineStanding.everPaid,
      liveIdentities: mineLive,
      createdAt: mineCreated,
    },
    {
      userId: owner.userId,
      isPaid: theirStanding.isPaid,
      everPaid: theirStanding.everPaid,
      liveIdentities: theirLive,
      createdAt: theirCreated,
    },
    { mayLose: deps.mayLose },
  )
  if (decision.status === 'refused') return { status: 'refused', reason: decision.reason }

  const loserIsTheOwner = sameId(decision.loserUserId, owner.userId)
  let rowId: string
  let provider: string
  if (loserIsTheOwner) {
    rowId = owner.id
    provider = owner.provider
  } else {
    // The signed-in side lost, so ITS working credential moves. decideSurvivor has
    // already refused unless exactly one of its rows can still authenticate, so this
    // cannot be ambiguous — but it is asserted rather than assumed, because a
    // silently wrong row here moves the wrong credential.
    const live = mineShapes.filter((s) => !isDeadIdentityShape(s.provider, s.identityLength))
    if (live.length !== 1) {
      throw new Error(
        `merge expected exactly one live identity on the losing side, found ${live.length}`,
      )
    }
    rowId = live[0]!.id
    provider = live[0]!.provider
  }

  return {
    status: 'planned',
    survivorUserId: decision.survivorUserId,
    loserUserId: decision.loserUserId,
    rowId,
    provider,
    reason: decision.reason,
    loserLiveIdentities: loserIsTheOwner ? theirLive : mineLive,
  }
}

/** Read-only: what a merge WOULD do. Used to describe the offer to the member. */
export async function planIdentityMerge(
  store: LinkStore,
  input: MergeInput,
  deps: MergeDeps = {},
): Promise<MergePlan> {
  if (!text(input.subject)) throw new Error('planIdentityMerge requires a provider subject')
  if (!text(input.signedInUserId)) throw new Error('planIdentityMerge requires a signedInUserId')
  return store.transaction((tx) => planWithin(tx, input, deps))
}

/**
 * Join two accounts one member has proven they hold (slice 4).
 *
 * §WHAT COUNTS AS PROOF, AND WHY IT IS ENOUGH. Two things are true at the moment
 * this runs: the caller holds a signed session for one account, and the provider has
 * just attested the subject that belongs to the other. Owner decision 9 is that this
 * is stronger evidence of ownership than a support ticket, which is why the member
 * performs the merge instead of asking a human to.
 *
 * §WHY IT REUSES SLICE 3'S LOCK RATHER THAN TAKING ITS OWN. linkProvider serialises
 * on (provider, subject) before reading the owner. A merge that took a different
 * lock could interleave with a link of the same identity and both could believe they
 * know who owns it. Same lock, same order.
 *
 * §THE ROW IS ADDRESSED BY ID, NEVER BY PROVIDER. unlinkProvider deletes every row
 * of a provider on purpose; this moves exactly one, chosen by primary key. DoD 4's
 * row-count assertion depends on that distinction, and so does the one-statement
 * reversal recorded in ops_audit_log.
 */
export async function mergeIdentity(
  store: LinkStore,
  input: MergeInput,
  deps: MergeDeps = {},
  now: Date = new Date(),
): Promise<MergeOutcome> {
  if (!text(input.subject)) throw new Error('mergeIdentity requires a provider subject')
  if (!text(input.signedInUserId)) throw new Error('mergeIdentity requires a signedInUserId')

  return store.transaction(async (tx) => {
    // Decided again here, inside the transaction that writes, rather than trusting
    // whatever was decided when the offer was made.
    const plan = await planWithin(tx, input, deps)
    if (plan.status !== 'planned') return plan

    const moved = await tx.moveProviderRow(plan.rowId, plan.survivorUserId, formatLegacyTimestamp(now))
    // A zero means the row went away under the lock. Abandon the transaction rather
    // than write an audit entry for a move that did not happen.
    if (moved !== 1) throw new Error(`mergeIdentity expected to move exactly 1 row, moved ${moved}`)

    await tx.recordIdentityMerge({
      id: randomUUID(),
      rowId: plan.rowId,
      provider: plan.provider,
      fromUserId: plan.loserUserId,
      toUserId: plan.survivorUserId,
      reason: plan.reason,
    })

    return {
      status: 'merged' as const,
      rowId: plan.rowId,
      fromUserId: plan.loserUserId,
      toUserId: plan.survivorUserId,
      reason: plan.reason,
    }
  })
}
