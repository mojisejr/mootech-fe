-- 0035 · consent + the first-run gate columns — mootech-fe owns this DDL now
--        (CIEL mumate-be-retirement-001 slice 1, part 1d)
--
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). ADDITIVE ONLY.
--
-- ทำไม: POST /api/v2/onboarding used to forward to mootech-be POST /consent, and the ONLY DDL for what
-- that call writes lived in the BE repository (mootech-be migrations/2026-08-09_onboarding-consent.sql).
-- The route now writes those rows itself (lib/v2/consent-store.ts), so the day the BE repository is
-- archived the schema must still be described somewhere the FE owns. This file is that description.
--
-- WHAT IT IS: a mirror of the BE file, column for column — same names, same types, same nullability,
-- same default, same index name. It is NOT a redesign: accepted_at stays `text` (the BE wrote a
-- Bangkok 'YYYY-MM-DD HH:mm:ss' string into it, and so does the FE now), user_id stays `text`.
--
-- 🟢 ON PRODUCTION THIS IS A NO-OP. The table, the index and both columns were created there by the BE
--    file on 2026-08-09. Every statement below is conditional, so running it on prod changes nothing.
--
-- ⚠️ ONE DELIBERATE DIFFERENCE FROM THE BE FILE, and it is about locks, not about the schema.
--    The BE file runs `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS …` unconditionally. Its own header
--    measured the cost: an ALTER must first acquire ACCESS EXCLUSIVE on "user" even when the column
--    already exists, and while it waits every plain SELECT on "user" queues behind it ("an all-no-op
--    re-run still waited 7s"). Here the ALTERs sit inside a DO block that looks at information_schema
--    first, so on a database that already has the columns — production — "user" is never locked at all.
--    `SET lock_timeout` is kept for the one case that does ALTER (a fresh database), with the BE's value.
--
-- HOW TO RUN (identical everywhere):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/0035_consent.sql
-- Verified on the testenv pg (:5433, a restored copy that already has the BE's objects): runs clean,
-- changes nothing, and re-runs clean.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1 + 2 · user: the first-login gate + the chosen goal (both nullable text, exactly as the BE made them).
-- NULL onboarded_at = has not finished v2 first-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'user' AND column_name = 'onboarded_at'
  ) THEN
    ALTER TABLE "user" ADD COLUMN "onboarded_at" text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'user' AND column_name = 'onboarding_goal'
  ) THEN
    ALTER TABLE "user" ADD COLUMN "onboarding_goal" text;
  END IF;
END
$$;

-- 3 · consent: one row per PDPA acceptance (history, not a flag). No PII beyond the user_id.
CREATE TABLE IF NOT EXISTS "consent" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        text NOT NULL,
  "accepted_at"    text NOT NULL,
  "policy_version" text NOT NULL
);

-- lookup by user (testenv reset-user.sh deletes by user_id; readers take the latest row by user_id)
CREATE INDEX IF NOT EXISTS "idx_consent_user_id" ON "consent" ("user_id");

COMMIT;
