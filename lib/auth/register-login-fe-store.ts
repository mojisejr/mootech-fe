import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import type {
  LoginProvider,
  MemberIdentity,
  NewMemberIdentity,
  ProviderMapping,
  RegisterLoginStore,
  RegisterLoginTransaction,
} from './register-login-fe'

type SqlExecutor = { execute(query: unknown): Promise<unknown> }
type TransactionDatabase = {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>
}

const rowsOf = <T>(result: unknown): T[] =>
  (Array.isArray(result) ? result : ((result as { rows?: T[] })?.rows ?? [])) as T[]

function txAdapter(tx: SqlExecutor): RegisterLoginTransaction {
  return {
    async lockProviderIdentity(provider: LoginProvider, providerSubject: string) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(lower(${provider}) || chr(31) || ${providerSubject}, 0))`,
      )
    },

    async findProviderMappings(provider: LoginProvider, providerSubject: string) {
      const rows = rowsOf<{ id?: unknown; user_id?: unknown }>(
        await tx.execute(sql`
          SELECT id, user_id
          FROM user_provider
          WHERE id_token = ${providerSubject} AND lower(provider) = lower(${provider})
          FOR UPDATE
        `),
      )
      return rows
        .filter((row) => typeof row.id === 'string' && typeof row.user_id === 'string')
        .map((row) => ({ id: row.id as string, userId: row.user_id as string } satisfies ProviderMapping))
    },

    async findMember(userId: string) {
      const rows = rowsOf<{
        user_id?: unknown
        name?: unknown
        email?: unknown
        picture_url?: unknown
        refer_code?: unknown
        is_refresh?: unknown
        result_code?: unknown
      }>(
        await tx.execute(sql`
          SELECT user_id, name, email, picture_url, refer_code, is_refresh, result_code
          FROM "user"
          WHERE user_id = ${userId}
          LIMIT 1
          FOR UPDATE
        `),
      )
      const row = rows[0]
      if (!row || typeof row.user_id !== 'string') return null
      return {
        userId: row.user_id,
        name: typeof row.name === 'string' ? row.name : null,
        email: typeof row.email === 'string' ? row.email : null,
        pictureUrl: typeof row.picture_url === 'string' ? row.picture_url : null,
        referCode: typeof row.refer_code === 'string' ? row.refer_code : null,
        isRefresh: row.is_refresh === true,
        resultCode: typeof row.result_code === 'string' ? row.result_code : '',
      } satisfies MemberIdentity
    },

    async updateLoginProfile(input) {
      // An empty incoming value means "the session did not carry one", never
      // "erase the stored one". COALESCE(NULLIF(...)) keeps the stored value in
      // that case - it matters most for email, the column checkUserWithLine
      // branches on, which every LINE login would otherwise blank.
      await tx.execute(sql`
        UPDATE user_provider
        SET name = COALESCE(NULLIF(${input.name}, ''), name),
            picture_url = COALESCE(NULLIF(${input.pictureUrl}, ''), picture_url),
            email = COALESCE(NULLIF(${input.email}, ''), email),
            update_at = ${input.updatedAt}
        WHERE id_token = ${input.providerSubject} AND lower(provider) = lower(${input.provider})
      `)
      // Compared case-insensitively on purpose. An exact match here would be
      // coupled to PROVIDER_SPELLING's value, and a future spelling change would
      // silently stop Google members' email from ever updating - no error, no
      // failing test. The proof file covers this write directly.
      if (input.provider.toLowerCase() === 'google' && input.email) {
        await tx.execute(sql`
          UPDATE "user"
          SET email = ${input.email}, login_at = ${input.updatedAt}, update_at = ${input.updatedAt}
          WHERE user_id = ${input.userId}
        `)
      } else {
        await tx.execute(sql`
          UPDATE "user"
          SET login_at = ${input.updatedAt}, update_at = ${input.updatedAt}
          WHERE user_id = ${input.userId}
        `)
      }
    },

    async setReferCode(userId: string, referCode: string, updatedAt: string) {
      await tx.execute(sql`
        UPDATE "user" SET refer_code = ${referCode}, update_at = ${updatedAt} WHERE user_id = ${userId}
      `)
    },

    async createMember(member: NewMemberIdentity) {
      await tx.execute(sql`
        INSERT INTO "user" (
          user_id, name, picture_url, email, create_at, update_at, refer_code, login_at,
          dob, time, is_remember_time, result_code, place_name, used_point, total_point,
          is_refresh, share_img_profile_url
        ) VALUES (
          ${member.userId}, ${member.name}, ${member.pictureUrl}, ${member.email ?? ''},
          ${member.createdAt}, ${member.createdAt}, ${member.referCode}, ${member.createdAt},
          '', '', false, '', '', 0, 20, false, ''
        )
      `)
    },

    async createProviderMapping(input) {
      await tx.execute(sql`
        INSERT INTO user_provider (
          id, user_id, provider, name, picture_url, email, id_token, create_at, update_at
        ) VALUES (
          ${input.id}, ${input.userId}, ${input.provider}, ${input.name}, ${input.pictureUrl},
          ${input.email}, ${input.providerSubject}, ${input.createdAt}, ${input.createdAt}
        )
      `)
    },

    async recordSignupActivity(userId: string, createdAt: string) {
      await tx.execute(sql`
        INSERT INTO log_activity ("createAt", activity_id, point, user_id)
        VALUES (${createdAt}, 1, 20, ${userId})
      `)
    },
  }
}

export function createPostgresRegisterLoginStore(database: TransactionDatabase): RegisterLoginStore {
  return {
    transaction<T>(work: (tx: RegisterLoginTransaction) => Promise<T>) {
      return database.transaction((tx) => work(txAdapter(tx)))
    },
  }
}

export const postgresRegisterLoginStore = createPostgresRegisterLoginStore(
  db as unknown as TransactionDatabase,
)
