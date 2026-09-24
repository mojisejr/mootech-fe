// lib/auth/link-account-store.ts — the SQL half of linking (slice 3).
// Mirrors lib/auth/register-login-fe-store.ts deliberately: same transaction
// shape, same advisory-lock key, same rowsOf shim, so a reader who knows one
// knows the other and the two cannot drift into different locking rules.
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
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
  }
}

export function createPostgresLinkStore(database: TransactionDatabase): LinkStore {
  return {
    transaction<T>(work: (tx: LinkTransaction) => Promise<T>) {
      return database.transaction((tx) => work(txAdapter(tx)))
    },
  }
}

export const postgresLinkStore = createPostgresLinkStore(db as unknown as TransactionDatabase)
