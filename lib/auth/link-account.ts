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
  return LINKABLE.map((provider) => ({
    provider,
    linked: linked.has(provider),
    current: current === provider,
    // The same rule unlinkProvider enforces, mirrored here so the button is
    // disabled rather than offered and then refused. Both read the same source,
    // so they cannot disagree about which method is the last one.
    canUnlink: linked.has(provider) && linked.size > 1,
  }))
}
