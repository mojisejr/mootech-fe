-- 0001 — add user_id indexes on fortune_telling_log + member_with_friend
-- (#mootech-latency-user-fold)
--
-- WHY: pages/api/user.ts runs `count(*) WHERE user_id = $1` on BOTH tables on every
-- user load (header on each page + profile + my-destiny). Neither table had a user_id
-- index (only the PRIMARY KEY), so each count was a FULL TABLE SCAN — measured ~2.2-2.7s
-- per /api/user call in prod DevTools. Adding these indexes makes the count an index scan.
--
-- SAFETY:
--   * CREATE INDEX never reads/writes/deletes row data — it only builds a lookup structure.
--     There is NO data-loss path here.
--   * CONCURRENTLY = does NOT take a write lock; INSERT/UPDATE/DELETE keep working during
--     the build. (Reads were never blocked either way.)
--   * IF NOT EXISTS = idempotent; safe to re-run, safe if a previous run already created it.
--   * CONCURRENTLY cannot run inside a transaction block — apply these statements directly
--     (psql / Supabase SQL editor / the controlled apply script), NOT wrapped in BEGIN/COMMIT.
--   * If a CONCURRENTLY build is interrupted it leaves an INVALID index (still no data loss):
--       DROP INDEX IF EXISTS <name>;  -- then re-run the CREATE.
--
-- APPLY ORDER: dev (jgxsjhbdhttfoiyvptvy) first → verify → prod (soxsccdlsycaevusndro)
-- during the operator-gated deploy. Mirrors the existing user_id indexes already present on
-- member_payment / payment / user_matching / log_* tables.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_fortune_telling_log_user_id"
  ON "fortune_telling_log" USING btree ("user_id" text_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_member_with_friend_user_id"
  ON "member_with_friend" USING btree ("user_id" text_ops);
