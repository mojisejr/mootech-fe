-- Hand-edited from drizzle-kit's generated output per this repo's Drizzle workflow contract
-- (schema.ts header): never apply plain CREATE INDEX to live tables, review before running.
--
-- Statement 1 is a no-op in production: `member_pay_as_use.balance` already exists (created by
-- mootech-be's own migration, member-pay-as-use/migrations/2026-06-26-wallet-balance.sql — this
-- repo's schema.ts just never knew about it until now, see lib/ops/ai-usage.ts). Kept here as
-- IF NOT EXISTS so it's a safe no-op AND keeps drizzle-kit's snapshot bookkeeping consistent for
-- future `generate` diffs, instead of re-proposing the same phantom ADD COLUMN forever.
ALTER TABLE "member_pay_as_use" ADD COLUMN IF NOT EXISTS "balance" integer DEFAULT 0 NOT NULL;

-- Statement 2 is the real change: log_ai has zero indexes beyond its primary key (801 rows
-- today, cheap now — same growth risk as the 4 date columns indexed in PR#55).
-- CONCURRENTLY cannot run inside a transaction block; applied as its own standalone statement.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ops_log_ai_createat" ON "log_ai" USING btree ("create_at" text_ops);
