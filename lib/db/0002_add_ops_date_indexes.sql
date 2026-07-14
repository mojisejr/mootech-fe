-- Hand-edited from drizzle-kit's generated output (CONCURRENTLY + IF NOT EXISTS) per this
-- repo's Drizzle workflow contract at the top of schema.ts: never apply plain CREATE INDEX to
-- live tables. log_calculate alone has ~19k rows and is written by mootech-be continuously, so
-- a non-concurrent index would take a table lock for the duration of the build.
-- CONCURRENTLY cannot run inside a transaction block; each statement is applied standalone.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ops_log_activity_createat" ON "log_activity" USING btree ("createAt" text_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ops_log_calculate_createat" ON "log_calculate" USING btree ("createAt" text_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ops_log_survey_createat" ON "log_survey" USING btree ("createAt" text_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ops_payment_submit_at" ON "payment" USING btree ("submit_at" text_ops);
