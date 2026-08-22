-- 0009 · payment_package gains a TIER and a SALEABLE flag, + the four v2 packages (mootech-fe#377)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). goo does NOT run this
-- on prod. ADDITIVE ONLY — two ADD COLUMN + one backfill + four INSERTs. No DROP, no DELETE, and NOT ONE
-- existing row is removed (25 members reference them).
--
-- 🔴 IF-YOU-ARE-RUNNING-THIS-SQL: idempotent (IF NOT EXISTS / ON CONFLICT) so re-running is safe — but
-- IF NOT EXISTS only guards creation, it does NOT reconcile an older shape. If this file changes after a
-- first apply, reconcile by hand.
--
-- ═══ 🔴 THE COUNTER-INTUITIVE TRAP THIS MIGRATION IS SHAPED AROUND ═══════════════════════════════════
-- `CHECK (col IN ('FREE','PLUS','PRO'))` DOES NOT REJECT NULL. `NULL IN (…)` evaluates to UNKNOWN (not
-- FALSE), and a CHECK constraint PASSES on UNKNOWN. Verified on this very database:
--     create temp table t (code text CHECK (code IN ('FREE','PLUS','PRO')));
--     insert into t values (NULL);   -- ✅ accepted
-- And `ALTER TABLE … ADD COLUMN` hands every EXISTING row exactly that NULL. So a CHECK alone would leave
-- every legacy package with a tier the reader cannot map — the #354 B1 disease (an unknown value that must
-- never read as "paid") re-entered through the DDL.
-- ⇒ The order below is load-bearing: ADD (nullable) → BACKFILL → SET NOT NULL. Doing SET NOT NULL before
--   the backfill fails; skipping it leaves the hole open.
-- ⚠️ The ticket said "7 legacy rows"; the table actually holds 21 (MEMBER 15 · HOROSCOPE 4 · PAYASUSE 2),
--   so the backfill is written to cover EVERY row, not a hand-counted subset.

-- ── 1. add the columns (nullable for now) ────────────────────────────────────────────────────────────
ALTER TABLE payment_package ADD COLUMN IF NOT EXISTS tier_code text;

-- 🔴 The CHECK is added as its OWN idempotent statement, NOT inline on the ADD COLUMN. Inline, the
-- constraint is part of the column creation — so on a re-run where the column already exists, ADD COLUMN
-- IF NOT EXISTS skips, and a constraint that went missing in between is NEVER restored. (Found the hard
-- way: dropping the constraint to test the teeth left the table permanently unguarded, because re-running
-- this migration could not put it back.) This form reconciles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_package_tier_code_check'
  ) THEN
    ALTER TABLE payment_package
      ADD CONSTRAINT payment_package_tier_code_check CHECK (tier_code IN ('FREE','PLUS','PRO'));
  END IF;
END $$;

-- is_active decides whether a package may be SOLD. Defaults false so anything that appears without an
-- explicit decision is unsellable rather than accidentally on sale (fail closed).
ALTER TABLE payment_package
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- ── 2. backfill EVERY existing row (this is what closes the NULL hole) ───────────────────────────────
-- MEMBER packages granted membership, so they are PLUS. HOROSCOPE / PAYASUSE are one-off purchases, not
-- membership tiers — FREE marks them "not a paid membership level", which makes quotePackage refuse them
-- (v2 does not sell them; PAYASUSE is a separate ticket).
UPDATE payment_package SET tier_code = 'PLUS' WHERE tier_code IS NULL AND plan_code = 'MEMBER';
UPDATE payment_package SET tier_code = 'FREE' WHERE tier_code IS NULL;

-- 🔴 THERE IS DELIBERATELY NO `UPDATE … SET is_active = false` HERE (ตู๋/บอง #379 T1).
-- Legacy packages do stop being sold (#376) — but `ADD COLUMN … NOT NULL DEFAULT false` above already
-- gave every pre-existing row `false` on the FIRST run, so an UPDATE would add nothing. What it WOULD add
-- is damage on a SECOND run: it would overwrite whatever an operator had since set from /ops — the very
-- screen this ticket adds for exactly that decision — while the header of this file invites re-running.
-- The safest guard for a statement that is not needed is not to write the statement.
-- (The tier backfill above is safe to repeat because it is guarded by `IS NULL`: once filled, it matches
--  nothing. Same principle, different shape.)

-- ── 3. close the door (only valid AFTER the backfill) ────────────────────────────────────────────────
ALTER TABLE payment_package ALTER COLUMN tier_code SET NOT NULL;

-- ── 4. the four v2 packages ──────────────────────────────────────────────────────────────────────────
-- ฟีม 2026-08-22: PLUS/PRO × yearly/monthly. Only the YEARLY pair goes on sale; the monthly pair exists so
-- turning it on later needs no code change. 🔴 Monthly prices are amount = 0 ON PURPOSE — the design never
-- stated a Mumate+ monthly price, and inventing one is not ours to do (/ops fills it in). They are
-- is_active = false, so a 0-baht package can never be charged.
-- 🔴 Re-run guard WITHOUT a DELETE (this migration is ADDITIVE ONLY — no DROP, no DELETE anywhere):
-- payment_package has no unique index on package_code (v1 never added one), so ON CONFLICT cannot key on
-- it. INSERT … SELECT … WHERE NOT EXISTS inserts each row only when that package_code is absent, which
-- makes a second run a no-op instead of a duplicate.
INSERT INTO payment_package (plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
SELECT v.plan_code, v.package_code, v.description, v.buffer_day, v.amount, v.expire, v.max_user, v.tier_code, v.is_active
  FROM (VALUES
    ('MEMBER', 'V2_PLUS_YEARLY',  'Mumate + (รายปี)',      0::bigint,  790::double precision, '1Y', 1::bigint, 'PLUS', true),
    ('MEMBER', 'V2_PRO_YEARLY',   'Mumate Pro (รายปี)',    0::bigint, 1590::double precision, '1Y', 1::bigint, 'PRO',  true),
    ('MEMBER', 'V2_PLUS_MONTHLY', 'Mumate + (รายเดือน)',   0::bigint,    0::double precision, '1M', 1::bigint, 'PLUS', false),
    ('MEMBER', 'V2_PRO_MONTHLY',  'Mumate Pro (รายเดือน)', 0::bigint,    0::double precision, '1M', 1::bigint, 'PRO',  false)
  ) AS v(plan_code, package_code, description, buffer_day, amount, expire, max_user, tier_code, is_active)
 WHERE NOT EXISTS (
   SELECT 1 FROM payment_package p WHERE p.package_code = v.package_code
 );
