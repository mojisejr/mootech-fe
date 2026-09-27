import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { dbPoolMax } from './pool-size'

// Runtime: Supabase TRANSACTION pooler (:6543) for serverless API routes.
// `prepare: false` is REQUIRED for the transaction pooler (no prepared statements).
// ssl 'require' = use SSL without strict CA verify (Supabase self-signed chain).
//
// 🔴 THE SINGLETON IS NOW UNCONDITIONAL, AND THAT IS THE FIRST FIX, NOT A TIDY-UP.
// The old line read `if (process.env.NODE_ENV !== 'production') globalForDb._pg = client`, so the one
// environment that matters got no singleton at all. The built module is present in TWO server chunks of
// the shipped image — .next/server/chunks/7864.js and 1752.js each construct a client — so a container
// could hold more than one pool and nobody could say how many. Until that is settled every number below
// is unknowable, because `max` is a budget PER CLIENT and an unknown client count multiplies it against
// a pooler shared with PRODUCTION. Caching everywhere makes the count one, and knowable.
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> }
const client =
  globalForDb._pg ??
  postgres(process.env.DATABASE_URL as string, {
    prepare: false, // transaction pooler: removing this breaks every route at once
    ssl: 'require',
    // 🔴 max is 1 unless DB_POOL_MAX says otherwise (lib/db/pool-size.ts). The two facts this comment used to
    // say were missing are now known: the pooler's pool size is 15 (owner, 2026-09-28) and the client count per
    // container is one (the unconditional singleton below). 1 stays the default so Vercel does not change;
    // the container sets DB_POOL_MAX after the nested-acquire audit (mumate-vercel-to-do-001 slice 2).
    max: dbPoolMax(),
    // 🔴 THE DIRECT REPAIR FOR THE OBSERVED FAULT (shadow, 2026-09-24): pages answered in 17 ms while every
    // database route hung — TCP to the pooler completed in 25 ms, established sockets were ZERO, and queued
    // queries were neither dispatched nor rejected, with an empty log. With no idle_timeout WE never close
    // an idle connection, so the pooler may drop one on its own schedule while the driver keeps queueing
    // against a handle that will never dispatch. connect_timeout does not save us — it bounds opening a
    // socket, never a query already in the queue. Closing our own idle connections turns that silent
    // unbounded wait into an ordinary reconnect.
    idle_timeout: 30,
  })
globalForDb._pg = client

export const db = drizzle(client, { schema })
export { schema }
