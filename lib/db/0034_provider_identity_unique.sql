-- 0034 · user_provider: one provider identity maps to one member
--        (mumate-login-identity-001 slice 2)
--
-- APPLIED TO PRODUCTION BY THE OWNER ON 2026-09-23. This file is the record of
-- what actually ran, not a proposal. It replaces the earlier step-by-step draft,
-- which was rewritten for two reasons found while running it - see AS RUN below.
--
-- 🔴 Any future application requires ฟีม (CLAUDE.md). ฟีม runs it.
-- 🔴 NOT ADDITIVE. Rows are deleted. The dumps are not optional: nothing here
--    restores a deleted row, and the rollback file says so plainly.
--
-- ทำไม: provider ตัวเดียวกันสะกดได้หลายแบบ (GOOGLE/google) และ identity เดียว
-- ผูกกับสมาชิกได้หลายคน ทำให้ login ซ้ำสร้างบัญชีใหม่เงียบ ๆ. slice 1 กันด้วย
-- advisory lock ซึ่งเป็นการร่วมมือกัน ไม่ใช่โครงสร้าง — index ตัวนี้คือของจริง.
--
-- ============================================================================
-- AS RUN — two things the first draft got wrong, both caught before any write
-- ============================================================================
-- 1. A TEMP TABLE cannot carry the decision list. The Supabase SQL editor opens
--    a new session per run, so the temp table was gone by the next statement.
--    The list is an inline VALUES CTE instead, and each part is self-contained.
--
-- 2. THE EXPECTED COUNTS WERE ORDER-DEPENDENT AND ONE WAS WRONG. The inventory
--    found exactly one same-user duplicate pair, so PART B expected to collapse
--    one row. That pair was itself inside the dead-credential class, so step 1
--    had already deleted both rows and step 2 found nothing. The guard raised,
--    the whole transaction rolled back, and NOTHING was written - which is the
--    entire reason the counts are asserted rather than written in a comment.
--    Expectation corrected to 0. The lesson is in the ciel-os closeout.
--
-- Every count below is asserted, not assumed. A DO block is its own transaction:
-- if any assertion fails, every statement before it is rolled back.

-- ============================================================================
-- BEFORE ANYTHING — dump what will be deleted, and KEEP the output
-- ============================================================================
-- 0a. the 20 losing rows of the cross-user collisions (PART A deletes these):
--     run PART A's decision list as a SELECT first; see the restore file.
-- 0b. the dead credential class (PART B step 1 deletes these):
SELECT * FROM user_provider WHERE provider = '' AND id_token LIKE 'ya29%';

-- ============================================================================
-- PART A — resolve the cross-user collisions (20 identities, 40 members)
-- ============================================================================
-- Decided by the owner's rule, in this order: whoever PAID wins; otherwise
-- whoever holds more (chart, calculations, QI, friends); a genuine tie is broken
-- deterministically, never at random. Payment resolved two cases that no other
-- signal could separate - both sides created in the same second with nothing
-- else to tell them apart. One case had nothing on either side and was decided
-- by user_id order.
--
-- Only the LOSING side's colliding row is deleted. No member row, no member
-- data, and no OTHER credential of the same member is touched - the join to the
-- kept member's own row is what makes that precise.
--
-- The keep/drop pairs are member identifiers and are deliberately NOT committed
-- to this repository. They live in the run record and the restore file.
--
--   DO $$ ... WITH resolution(keep_id, drop_id) AS (VALUES (...20 pairs...)),
--   del AS (DELETE FROM user_provider losing
--           USING resolution r, user_provider keeping
--           WHERE losing.user_id = r.drop_id
--             AND keeping.user_id = r.keep_id
--             AND lower(keeping.provider) = lower(losing.provider)
--             AND keeping.id_token = losing.id_token
--           RETURNING 1)
--   SELECT count(*) INTO deleted FROM del;
--   IF deleted <> 20 THEN RAISE EXCEPTION ... END IF;
--   ... then assert zero collisions remain ...
--
-- Result on 2026-09-23: 20 rows deleted, 0 collisions remaining, 5957 -> 5937.

-- ============================================================================
-- PART B — cleanup, spelling, and the structural guarantee
-- ============================================================================
DO $$
DECLARE n int; m bigint;
BEGIN
  -- 1. dead credential rows: blank provider holding a short-lived `ya29...`
  --    Google ACCESS token where the stable subject belongs. They can never
  --    match again under any implementation. Owner decision 3 deletes them and
  --    routes the members behind them to support. Member rows are NOT touched.
  WITH d AS (DELETE FROM user_provider WHERE provider = '' AND id_token LIKE 'ya29%' RETURNING 1)
  SELECT count(*) INTO n FROM d;
  IF n <> 657 THEN RAISE EXCEPTION 'step 1: expected 657 dead rows, got % - nothing changed', n; END IF;

  -- A blank-provider row that is NOT of that class would be something we have
  -- never seen. Refuse rather than guess.
  SELECT count(*) INTO m FROM user_provider WHERE btrim(provider) = '';
  IF m <> 0 THEN RAISE EXCEPTION 'step 1: % blank-provider rows are not the known dead class - nothing changed', m; END IF;

  -- 2. same-user duplicates. The only pair was itself inside the dead class
  --    above, so step 1 already removed it and nothing survives to collapse.
  --    Kept as an assertion because a NEW pair appearing here would matter.
  WITH d AS (
    DELETE FROM user_provider up USING user_provider keep
    WHERE keep.user_id = up.user_id
      AND lower(keep.provider) = lower(up.provider)
      AND keep.id_token = up.id_token
      AND (keep.create_at, keep.id) < (up.create_at, up.id)
    RETURNING 1)
  SELECT count(*) INTO n FROM d;
  IF n <> 0 THEN RAISE EXCEPTION 'step 2: expected 0 duplicate rows to survive step 1, got % - nothing changed', n; END IF;

  -- 3. Spelling normalised PER PROVIDER, to whatever the live writer already
  --    stores: Google lower case, LINE upper case. NOT one case for both - four
  --    backend queries match a stored 'LINE' exactly and would silently return
  --    zero rows. update_at is deliberately not restamped: this is a data-shape
  --    repair, not a change to anybody's profile.
  WITH u AS (UPDATE user_provider SET provider = 'google'
             WHERE lower(provider) = 'google' AND provider <> 'google' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  IF n <> 1787 THEN RAISE EXCEPTION 'step 3: expected 1787 Google rows, got % - nothing changed', n; END IF;

  WITH u AS (UPDATE user_provider SET provider = 'LINE'
             WHERE lower(provider) = 'line' AND provider <> 'LINE' RETURNING 1)
  SELECT count(*) INTO n FROM u;
  IF n <> 0 THEN RAISE EXCEPTION 'step 3: expected 0 LINE rows, got % - nothing changed', n; END IF;

  -- One `dev` row is expected and deliberately left alone. Anything else here
  -- is a provider class nobody has decided about.
  SELECT count(*) INTO m FROM user_provider WHERE provider NOT IN ('google', 'LINE');
  IF m <> 1 THEN RAISE EXCEPTION 'step 3: expected 1 row outside google/LINE, found % - nothing changed', m; END IF;

  -- 4. The structural guarantee. Indexed on lower(provider) so the asymmetric
  --    spelling cannot reintroduce a duplicate pair if a future writer ever
  --    sends the other case.
  SELECT count(*) INTO m FROM (
    SELECT 1 FROM user_provider GROUP BY lower(provider), id_token
    HAVING count(DISTINCT user_id) > 1) x;
  IF m <> 0 THEN RAISE EXCEPTION 'step 4: % identities are still claimed by two members - nothing changed', m; END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS user_provider_identity_unique
    ON user_provider (lower(provider), id_token);

  -- 5. Stop the dead class regrowing. provider is already NOT NULL, which never
  --    caught the empty string. Validated immediately: the NOT VALID + VALIDATE
  --    dance exists to avoid a long lock on a large table and is pointless here.
  ALTER TABLE user_provider DROP CONSTRAINT IF EXISTS user_provider_provider_not_blank;
  ALTER TABLE user_provider ADD CONSTRAINT user_provider_provider_not_blank
    CHECK (btrim(provider) <> '');

  -- Reported, not enforced: new logins between the measurement and the run move it.
  SELECT count(*) INTO m FROM user_provider;

  RAISE NOTICE 'OK - % rows, index built, blank providers blocked', m;
END $$;

-- Result on 2026-09-23: 657 deleted, 0 collapsed, 1787 respelled, index built,
-- CHECK added. 5937 -> 5280.
