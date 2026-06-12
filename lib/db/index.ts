import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Runtime: Supabase TRANSACTION pooler (:6543) for serverless API routes.
// `prepare: false` is REQUIRED for the transaction pooler (no prepared statements).
// ssl 'require' = use SSL without strict CA verify (Supabase self-signed chain).
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> }
const client =
  globalForDb._pg ??
  postgres(process.env.DATABASE_URL as string, { prepare: false, ssl: 'require', max: 1 })
if (process.env.NODE_ENV !== 'production') globalForDb._pg = client

export const db = drizzle(client, { schema })
export { schema }
