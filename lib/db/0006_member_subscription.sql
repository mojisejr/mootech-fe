-- 0006 · v2 membership store: member_subscription (mootech-fe#354, Phase 2 of #352)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). goo does NOT run
-- this on prod. ADDITIVE ONLY — one brand-new table, no ALTER/DROP on any existing (pgloader'd) table.
-- Idempotent (IF NOT EXISTS) so a re-run on dev is safe.
--
-- WHY a new table instead of extending member_payment (#354, two measured reasons):
--   ① member_payment.user_id is the PRIMARY KEY → 1 row per human forever; the v1 writer save()s onto it
--      = UPDATE-in-place, so there can be no history. This table has a plain (non-PK) user_id → many rows.
--   ② the v1 writer computes expire from createAt=today (not from the remaining expire_at), so buying again
--      while still subscribed BURNS the remaining days — a bug live on prod today. A fresh store lets the
--      v2 writer (Phase 3, #355) stack correctly without touching the service v1 still takes money through.
--
-- Column-shape fixes vs the pgloader'd v1 tables (deliberate, per #354):
--   • amount_satang  integer  — money as integer สตางค์, NOT doublePrecision (no float baht rounding)
--   • start_at/expire_at  date  — real DATE, NOT varchar(255); read path compares date >= today directly
--
-- Nobody flips status ACTIVE→EXPIRED in Phase 2 (there is no cron and no writer here). Expiry is decided
-- AT READ TIME by comparing expire_at to today(Asia/Bangkok) — see lib/v2/subscription.ts. `status` still
-- exists for the Phase-3 writer to mark REPLACED rows; the reader excludes anything not 'ACTIVE'.
--
-- CHECK + FK (ตู๋ #369 B1/T1) — added NOW while the table is empty and unapplied on prod, the cheapest
-- moment. #361 named "the money lane has no references() at all" as a reason for a fresh table, so this one
-- must not repeat that. CHECKs keep an unknown tier_code / status out at write time (the reader also fails
-- closed on a bad tier_code, but a wrong `status` would make a PAID row invisible — a silent lost membership
-- in the OPPOSITE direction, so the DB refuses it too). FKs make an orphan user_id / payment_id impossible.

CREATE TABLE IF NOT EXISTS member_subscription (
  id             varchar(36) PRIMARY KEY,   -- app-supplied uuid (writer = Phase 3), same convention as other v1 tables
  user_id        text        NOT NULL REFERENCES "user"(user_id),  -- NOT a PK ⇒ many rows / history per human
  tier_code      text        NOT NULL CHECK (tier_code IN ('FREE','PLUS','PRO')),  -- names pending marketing
  package_code   text        NOT NULL,      -- points at payment_package.package_code
  amount_satang  integer     NOT NULL,      -- money in whole สตางค์ (not float baht)
  start_at       date        NOT NULL,
  expire_at      date        NOT NULL,
  payment_id     text        REFERENCES payment(id),  -- nullable: comp/manual grants have no payment row
  status         text        NOT NULL CHECK (status IN ('ACTIVE','EXPIRED','REPLACED')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The read path filters by user_id then narrows to ACTIVE + not-yet-expired; user_id is the selective key.
CREATE INDEX IF NOT EXISTS idx_member_subscription_user_id
  ON member_subscription (user_id);
