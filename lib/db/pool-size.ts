// How many connections this process's single postgres.js client may open (mumate-vercel-to-do-001 slice 2).
//
// DEFAULT 1, EXACTLY AS BEFORE. On Vercel every instance is its own process with its own client, so concurrency
// comes from the instance count and 1 is right; it is also what turned a nested acquire inside a transaction
// (link-account, 2026-09-26) from a latent intermittent hang into an immediate, reproducible one.
// In ONE long-lived container, 1 serialises every database route in the site behind a single connection, so the
// container sets DB_POOL_MAX. The ceiling is the Supabase transaction pooler's pool size (15, owner 2026-09-28),
// which the FE shares with bazi (postgres.js max 10) and the nightly backup; a value outside 1..15 falls back to 1.
// Raise it only after the nested-acquire audit, because a larger pool hides that class of bug instead of fixing it.
export const POOLER_POOL_SIZE = 15

export function dbPoolMax(env: Partial<NodeJS.ProcessEnv> = process.env): number {
  const n = Number(env.DB_POOL_MAX?.trim())
  return Number.isInteger(n) && n >= 1 && n <= POOLER_POOL_SIZE ? n : 1
}
