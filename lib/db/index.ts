import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { dbPoolMax } from './pool-size'
import { createResilientSql } from './resilient-sql'

// Supabase transaction pooler: prepared statements must stay disabled. Keep one
// guarded facade per process in production too: Next can load DB code from more
// than one server chunk. Drizzle keeps this facade while it rotates stalled pools.
// A separate key avoids reusing an older unguarded client during dev hot reload.
const globalForDb = globalThis as unknown as { _pgResilient?: ReturnType<typeof postgres> }
const client = globalForDb._pgResilient ?? createResilientSql(() => postgres(
  process.env.DATABASE_URL as string,
  {
    prepare: false,
    ssl: 'require',
    max: dbPoolMax(),
    // Retain existing idle policy. The driver's connect timeout and max lifetime
    // already have defaults; none bounds an in-flight/queued statement. The
    // facade supplies that bound, retires a stalled pool, and never replays writes.
    idle_timeout: 30,
  },
))
globalForDb._pgResilient = client

export const db = drizzle(client, { schema })
export { schema }
