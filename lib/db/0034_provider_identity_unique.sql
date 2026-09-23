-- 0034 · user_provider: normalise provider spelling, remove dead credential rows,
--        and make one provider identity map to one member (mumate-login-identity-001 slice 2)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND.
-- NEVER run blind / via drizzle push.
--
-- 🔴 Applying any of this to PRODUCTION requires ฟีม (CLAUDE.md). ฟีม runs each statement.
-- 🔴 NOT ADDITIVE. Steps 2 and 3 DELETE rows. Step 0 dumps every row they touch and
--    MUST be run and its output kept before either of them. Nothing here deletes a
--    member: only rows in user_provider, which are login credentials.
-- 🔴 RUN ONE STEP AT A TIME and read the output. Step 5 refuses to run while any
--    cross-user collision survives, by design — do not work around it.
--
-- ทำไม: วันนี้ provider ตัวเดียวกันสะกดได้หลายแบบ (GOOGLE/google) และ identity เดียว
-- ยังผูกกับสมาชิกได้หลายคน ทำให้ login ซ้ำสร้างบัญชีใหม่เงียบ ๆ. slice 1 กันด้วย advisory
-- lock ซึ่งเป็นการร่วมมือกัน ไม่ใช่โครงสร้าง — index ตัวนี้คือของจริง.
--
-- Numbers quoted in the plan are the 2026-09-23 planning checkpoint. RE-MEASURE with
-- step 1 before trusting any of them; they WILL have drifted.

-- ============================================================================
-- STEP 0 — dump everything the later steps delete. Keep the output.
-- ============================================================================
-- 0a. dead credential rows (blank provider holding a Google ACCESS token as identity)
SELECT * FROM user_provider WHERE provider = '' AND id_token LIKE 'ya29%';

-- 0b. same-user duplicate credential rows that step 3 will collapse
SELECT * FROM user_provider up
WHERE EXISTS (
  SELECT 1 FROM user_provider other
  WHERE other.user_id = up.user_id
    AND lower(other.provider) = lower(up.provider)
    AND other.id_token = up.id_token
    AND other.id <> up.id
);

-- ============================================================================
-- STEP 1 — inventory. Read-only. Run before and after; keep both.
-- ============================================================================
SELECT provider, count(*) AS rows, count(DISTINCT user_id) AS members
FROM user_provider GROUP BY provider ORDER BY rows DESC;

-- rows whose identity is unusable: no token at all. The unique index would collapse
-- them into one. Expected zero; if not, STOP and decide what they are.
SELECT count(*) AS empty_id_token FROM user_provider WHERE id_token = '';

-- identities claimed by more than one member. Step 5 will not run while this is > 0.
SELECT lower(provider) AS provider, id_token, count(DISTINCT user_id) AS members
FROM user_provider
GROUP BY 1, 2 HAVING count(DISTINCT user_id) > 1
ORDER BY members DESC;

-- ============================================================================
-- STEP 2 — delete dead credential rows (owner decision 3, 2026-09-23).
-- These hold a short-lived `ya29...` Google ACCESS token where the stable subject
-- belongs, so they can never match again under any implementation. The members
-- behind them are NOT deleted; recovery for them is routed to support.
-- ============================================================================
DELETE FROM user_provider WHERE provider = '' AND id_token LIKE 'ya29%';

-- Any OTHER blank-provider row is not the known class. Report, do not delete.
SELECT * FROM user_provider WHERE provider = '';

-- ============================================================================
-- STEP 3 — collapse same-user duplicates. Keeps the oldest row per identity,
-- tie-broken by id so the result is deterministic. Same member on both sides, so
-- nothing has to be chosen about who owns the account.
-- ============================================================================
DELETE FROM user_provider up
USING user_provider keep
WHERE keep.user_id = up.user_id
  AND lower(keep.provider) = lower(up.provider)
  AND keep.id_token = up.id_token
  AND (keep.create_at, keep.id) < (up.create_at, up.id);

-- ============================================================================
-- STEP 4 — normalise spelling to what the live writers already store:
-- Google lower case, LINE upper case. NOT one case for both — four backend
-- queries match a stored 'LINE' exactly and would silently return zero rows.
-- update_at is deliberately NOT touched: this is a data-shape repair, and
-- restamping it would make every member's credential look freshly modified.
-- ============================================================================
UPDATE user_provider SET provider = 'google' WHERE lower(provider) = 'google' AND provider <> 'google';
UPDATE user_provider SET provider = 'LINE'   WHERE lower(provider) = 'line'   AND provider <> 'LINE';

-- Whatever is left that is neither (today: one 'dev' row) is reported, never guessed at.
SELECT * FROM user_provider WHERE provider NOT IN ('google', 'LINE');

-- ============================================================================
-- STEP 5 — the structural guarantee. Refuses to run while any identity is still
-- claimed by more than one member; those are the cases the owner resolves by hand.
-- Indexed on lower(provider) so the asymmetric spelling cannot reintroduce a
-- duplicate pair if some future writer ever sends the other case.
-- ============================================================================
DO $$
DECLARE collisions bigint;
BEGIN
  SELECT count(*) INTO collisions FROM (
    SELECT 1 FROM user_provider
    GROUP BY lower(provider), id_token
    HAVING count(DISTINCT user_id) > 1
  ) x;
  IF collisions > 0 THEN
    RAISE EXCEPTION 'refusing to build the unique index: % provider identities are still claimed by more than one member', collisions;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_provider_identity_unique
  ON user_provider (lower(provider), id_token);

-- ============================================================================
-- STEP 6 — stop the dead-credential class regrowing. provider is already NOT NULL;
-- the rows step 2 removed were empty strings, which NOT NULL does not catch.
-- ============================================================================
ALTER TABLE user_provider DROP CONSTRAINT IF EXISTS user_provider_provider_not_blank;
ALTER TABLE user_provider ADD CONSTRAINT user_provider_provider_not_blank
  CHECK (btrim(provider) <> '') NOT VALID;
ALTER TABLE user_provider VALIDATE CONSTRAINT user_provider_provider_not_blank;
