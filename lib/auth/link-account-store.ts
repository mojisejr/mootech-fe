// lib/auth/link-account-store.ts — the SQL half of linking (slice 3).
// Mirrors lib/auth/register-login-fe-store.ts deliberately: same transaction
// shape, same advisory-lock key, same rowsOf shim, so a reader who knows one
// knows the other and the two cannot drift into different locking rules.
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { resolveStandingFromRows } from '@/lib/v2/subscription'
import type { LinkStore, LinkTransaction, ProviderRow } from './link-account'

type SqlExecutor = { execute(query: unknown): Promise<unknown> }
type TransactionDatabase = {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>
}

// db.execute returns an array or { rows } depending on the driver path. Repeated
// in three places in this repo rather than centralised; copied here to match.
const rowsOf = <T>(result: unknown): T[] =>
  (Array.isArray(result) ? result : ((result as { rows?: T[] })?.rows ?? [])) as T[]

function txAdapter(tx: SqlExecutor): LinkTransaction {
  return {
    async lockIdentity(provider: string, subject: string) {
      // IDENTICAL key to register-login-fe-store: lower(provider), chr(31), the
      // subject. It must hash the same in both writers or the lock protects
      // nothing — a link and a first login for one identity would take two
      // different locks and both proceed.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(lower(${provider}) || chr(31) || ${subject}, 0))`,
      )
    },

    async findIdentityOwner(provider: string, subject: string): Promise<ProviderRow | null> {
      const rows = rowsOf<{ id?: unknown; user_id?: unknown; provider?: unknown }>(
        await tx.execute(sql`
          SELECT id, user_id, provider
          FROM user_provider
          WHERE id_token = ${subject} AND lower(provider) = lower(${provider})
          FOR UPDATE
        `),
      )
      const usable = rows
        .filter((r) => typeof r.id === 'string' && typeof r.user_id === 'string')
        .map((r) => ({
          id: r.id as string,
          userId: r.user_id as string,
          provider: typeof r.provider === 'string' ? r.provider : provider,
        }))
      if (usable.length === 0) return null
      // The unique index makes two rows impossible, but the index is one day old
      // and this is a credential write. If the impossible happens, refuse loudly
      // rather than pick whichever row the planner returned first — the same rule
      // resolveUserFromRows applies for the same reason.
      const owners = new Set(usable.map((r) => r.userId.trim().toLowerCase()))
      if (owners.size > 1) {
        throw new Error('user_provider holds one identity under several members; refusing to choose')
      }
      return usable[0]
    },

    async memberExists(userId: string) {
      const rows = rowsOf<{ user_id?: unknown }>(
        await tx.execute(sql`SELECT user_id FROM "user" WHERE user_id = ${userId} LIMIT 1`),
      )
      return rows.length > 0
    },

    async insertProviderRow(row) {
      // create_at and update_at are varchar in this pgloader'd table, written as
      // 'YYYY-MM-DD HH:mm:ss' Asia/Bangkok by formatLegacyTimestamp. An ISO string
      // here would sort and compare differently from every other row.
      await tx.execute(sql`
        INSERT INTO user_provider (id, user_id, provider, id_token, email, name, picture_url, create_at, update_at)
        VALUES (
          ${row.id}, ${row.userId}, ${row.provider}, ${row.subject},
          ${row.email}, ${row.name}, ${row.pictureUrl},
          ${row.timestamp}, ${row.timestamp}
        )
      `)
    },

    async listMemberProviders(userId: string): Promise<ProviderRow[]> {
      const rows = rowsOf<{ id?: unknown; user_id?: unknown; provider?: unknown }>(
        await tx.execute(sql`
          SELECT id, user_id, provider FROM user_provider WHERE user_id = ${userId} FOR UPDATE
        `),
      )
      return rows
        .filter((r) => typeof r.id === 'string' && typeof r.user_id === 'string')
        .map((r) => ({
          id: r.id as string,
          userId: r.user_id as string,
          provider: typeof r.provider === 'string' ? r.provider : '',
        }))
    },

    async deleteProviderRows(userId: string, provider: string) {
      // Scoped by user_id AND provider, never by id alone: a row id arriving from
      // anywhere near a request must not be able to delete another member's
      // credential. Same rule as pages/api/v2/push/subscribe.ts's deletes.
      const rows = rowsOf<{ id?: unknown }>(
        await tx.execute(sql`
          DELETE FROM user_provider
          WHERE user_id = ${userId} AND lower(provider) = lower(${provider})
          RETURNING id
        `),
      )
      return rows.length
    },

    async listMemberIdentityShapes(userId: string) {
      // length(id_token) and NOT id_token. The dead class this has to recognise is
      // a `ya29...` Google ACCESS token that was stored as an identity; it is
      // expired and useless, and it is still a credential. Nothing is gained by
      // carrying one into application memory where a stray console.error or an
      // error-reporting hook could copy it out, and the only property the caller
      // needs is how long it is.
      const rows = rowsOf<{ id?: unknown; provider?: unknown; len?: unknown }>(
        await tx.execute(sql`
          SELECT id, provider, length(id_token) AS len
          FROM user_provider
          WHERE user_id = ${userId}
        `),
      )
      return rows
        .filter((r) => typeof r.id === 'string')
        .map((r) => ({
          id: r.id as string,
          provider: typeof r.provider === 'string' ? r.provider : '',
          identityLength: Number(r.len ?? 0),
        }))
    },

    async moveProviderRow(rowId: string, toUserId: string, timestamp: string) {
      // Addressed by primary key, which is the opposite choice from
      // deleteProviderRows above and is deliberate: a merge must move exactly the
      // row the survivor rule decided on. The row id never comes from the request —
      // it is read inside this transaction, under the same advisory lock.
      const rows = rowsOf<{ id?: unknown }>(
        await tx.execute(sql`
          UPDATE user_provider
          SET user_id = ${toUserId}, update_at = ${timestamp}
          WHERE id = ${rowId}
          RETURNING id
        `),
      )
      return rows.length
    },

    async recordIdentityMerge(entry) {
      // ops_audit_log (migration 0022) already carries exactly this shape and is
      // indexed on (target_user_id, created_at), so support can find a member's
      // merges without a new table or a migration. admin_user_id is NULL because no
      // admin did this: the member did, which is the point of slice 4. The payload
      // holds no subject and no token — ops can read this table.
      await tx.execute(sql`
        INSERT INTO ops_audit_log (id, admin_user_id, action, target_user_id, payload)
        VALUES (
          ${entry.id},
          NULL,
          'member_identity_merge',
          ${entry.toUserId},
          ${JSON.stringify({
            row_id: entry.rowId,
            provider: entry.provider,
            from_user_id: entry.fromUserId,
            to_user_id: entry.toUserId,
            reason: entry.reason,
            reverse_with:
              'UPDATE user_provider SET user_id = <from_user_id> WHERE id = <row_id>',
          })}::jsonb
        )
      `)
    },

    async memberCreatedAt(userId: string) {
      const rows = rowsOf<{ create_at?: unknown }>(
        await tx.execute(sql`SELECT create_at FROM "user" WHERE user_id = ${userId} LIMIT 1`),
      )
      const value = rows[0]?.create_at
      return typeof value === 'string' ? value : ''
    },

    async memberStanding(userId: string) {
      // 🔴 BOTH READS GO THROUGH `tx`, NEVER THROUGH `db`. This method exists because
      // the merge used to ask lib/v2/subscription.ts for this verdict by userId, and
      // that module reads through the shared client — a second connection request from
      // inside a transaction already holding the only one (lib/db/index.ts max 1),
      // which wedged the shadow twice on 2026-09-25. Anything added here must use `tx`.
      //
      // The SQL does ONLY the user narrowing. Selection, expiry and the legacy
      // fall-through are the pure rule's, exactly as resolveSubscription leaves them —
      // filtering here would put half the rule in SQL where only a database suite
      // could watch it (ตู๋ #369 B2).
      const subs = rowsOf<{
        id?: unknown
        tier_code?: unknown
        status?: unknown
        expire_at?: unknown
        created_at?: unknown
      }>(
        await tx.execute(sql`
          SELECT id, tier_code, status, expire_at, created_at
          FROM member_subscription
          WHERE user_id = ${userId}
        `),
      )
      // member_payment.user_id is the primary key, so this is one deterministic row —
      // the same single-row read resolveMembership performs.
      const pays = rowsOf<{ plan_code?: unknown; expire_at?: unknown }>(
        await tx.execute(sql`
          SELECT plan_code, expire_at FROM member_payment WHERE user_id = ${userId} LIMIT 1
        `),
      )
      const payment = pays[0]
      return resolveStandingFromRows({
        subscriptionRows: subs.map((r) => ({
          id: String(r.id ?? ''),
          tierCode: String(r.tier_code ?? ''),
          status: String(r.status ?? ''),
          expireAt: r.expire_at,
          createdAt: r.created_at,
        })),
        memberPaymentRow: payment
          ? {
              planCode: typeof payment.plan_code === 'string' ? payment.plan_code : null,
              expireAt: typeof payment.expire_at === 'string' ? payment.expire_at : null,
            }
          : null,
      })
    },
  }
}

export function createPostgresLinkStore(database: TransactionDatabase): LinkStore {
  return {
    transaction<T>(work: (tx: LinkTransaction) => Promise<T>) {
      return database.transaction((tx) => work(txAdapter(tx)))
    },
  }
}

/** Read-only: the caller's own provider rows. Outside a transaction on purpose —
 *  this is a page read, not part of a write decision, and holding FOR UPDATE for
 *  a settings screen would serialise members against each other for no gain. */
export async function readMemberProviders(userId: string): Promise<ProviderRow[]> {
  const rows = rowsOf<{ id?: unknown; user_id?: unknown; provider?: unknown }>(
    await (db as unknown as SqlExecutor).execute(
      sql`SELECT id, user_id, provider FROM user_provider WHERE user_id = ${userId}`,
    ),
  )
  return rows
    .filter((r) => typeof r.id === 'string' && typeof r.user_id === 'string')
    .map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      provider: typeof r.provider === 'string' ? r.provider : '',
    }))
}

export const postgresLinkStore = createPostgresLinkStore(db as unknown as TransactionDatabase)
