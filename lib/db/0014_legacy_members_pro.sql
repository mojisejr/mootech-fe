-- 0014 · give every LIVE legacy member a real member_subscription row at tier PRO
-- (mojisejr/mootech-fe#358 Phase 6 · ฟีมเคาะ 2026-08-30, ทาง A)
--
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 Applying this to PRODUCTION requires ฟีม (CLAUDE.md). The production project ref is named once, in
-- lib/db/0006_member_subscription.sql:5 — deliberately not copied here. A value copied into every file
-- that mentions it is a value that goes stale in all of them at once, and this repo already has a machine
-- guard that refuses any command carrying it, which a copy in a comment trips for no benefit.
--
-- ADDITIVE ONLY — INSERT into one table. No UPDATE, no DELETE, no ALTER, no DROP anywhere in this file.
-- Idempotent: the NOT EXISTS guard means a second run inserts nothing.
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────────────────
-- Phase 6 turns ดวงสมพงษ์ from "members are unlimited" into a table keyed by LEVEL: FREE 2, PLUS 20,
-- PRO unlimited (lib/v2/entitlement.ts). Legacy members — people who paid through the v1 door — resolve
-- with `tier: null` (lib/v2/subscription.ts:79), and a level table has no row for null.
--
-- lib/v2/entitlement.ts:121 already reads paid-with-no-name as PRO, so nobody loses access the moment
-- Phase 6 ships. That line is a SAFETY NET, not the plan: it is a guess about a state that means "we do
-- not know", and lib/v2/tier.ts:5-8 forbids exactly that kind of guess ("an unknown tier is wrong BOTH
-- ways … There is NO safe default"). This migration removes the need for the guess by making the state
-- KNOWN — after it runs, those members have a real row that says PRO.
--
-- ⚠️ WHY PRO AND NOT PLUS (ฟีมเคาะ, Q14, recorded in #358). Today a member is UNLIMITED for ดวงสมพงษ์
-- (lib/usage.ts:115 limitMember: null). Mumate + is 20/month. Handing legacy members PLUS would take
-- something away from people who have already paid; #352's closing criterion says they must not lose
-- access. PRO is the only level that keeps every one of them whole.
--
-- ── WHO IS "A LIVE LEGACY MEMBER" ──────────────────────────────────────────────────────────────────
-- The predicate below is lib/usage-core.ts classifyMembership + isNotExpired, transcribed:
--   plan_code = 'MEMBER'                          (MEMBER_PLAN, usage-core.ts:20)
--   expire_at's first 10 chars are a real date    (isNotExpired refuses a malformed one)
--   that date >= today in Asia/Bangkok            (isNotExpired compares date-only strings, inclusive)
-- The string comparison is deliberate and matches the code exactly: on 'YYYY-MM-DD', lexicographic order
-- IS chronological order, and that is the comparison the running system makes today.
--
-- ⚠️ It does NOT validate the day-of-month the way isNotExpired does (that function rejects 2026-02-31).
-- A row like that would be granted here and refused by the app. The preflight below counts them, so the
-- operator sees a non-zero before it can matter.
--
-- ── STEP 1 · PREFLIGHT. Run this ALONE and READ THE NUMBERS BEFORE running step 2 ──────────────────
-- 🔴 The counts are deliberately NOT written into this file. A number measured on one database at one
-- moment is not a fact about another database later, and #358 has already been bitten twice by a count
-- that travelled. The operator applying this must see the number from the database they are applying to,
-- at the moment they apply it.
--
--   SELECT
--     count(*) FILTER (WHERE live AND NOT already_has_v2)  AS will_be_granted,
--     count(*) FILTER (WHERE NOT live)                     AS skipped_expired,
--     count(*) FILTER (WHERE live AND already_has_v2)      AS skipped_already_have_a_row,
--     count(*) FILTER (WHERE live AND bad_date)            AS bad_date_granted_but_app_refuses
--   FROM (
--     SELECT
--       mp.plan_code = 'MEMBER'
--         AND substring(mp.expire_at from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
--         AND substring(mp.expire_at from 1 for 10) >= to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD')
--                                                                                              AS live,
--       EXISTS (SELECT 1 FROM member_subscription ms WHERE ms.user_id = mp.user_id)   AS already_has_v2,
--       substring(mp.expire_at from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
--         AND to_date(substring(mp.expire_at from 1 for 10),'YYYY-MM-DD')::text
--             <> substring(mp.expire_at from 1 for 10)                                     AS bad_date
--     FROM member_payment mp
--   ) t;
--
-- Measured on testenv (mumate_testenv_pg, 2026-08-30 ~23:00 +07): 30 granted · 8 expired · 0 already had
-- a row · 0 bad dates. PRODUCTION WILL BE DIFFERENT — read your own.
--
-- ── STEP 2 · THE GRANT ─────────────────────────────────────────────────────────────────────────────
INSERT INTO member_subscription
  (id, user_id, tier_code, package_code, amount_satang, start_at, expire_at, payment_id, status)
SELECT
  gen_random_uuid()::text,
  mp.user_id,
  'PRO',
  -- ⚠️ NOT a package_code anyone can buy. The column's comment says it points at payment_package, and
  -- nothing enforces that (no FK) — checked before choosing this value: the read path never looks at it
  -- (lib/v2/subscription.ts toSubRows carries id / tierCode / status / expireAt / createdAt only), and no
  -- query joins member_subscription to payment_package. A real package code here would claim these people
  -- bought a plan they never bought; this value says what actually happened and greps cleanly.
  'LEGACY_GRANT',
  0,                                    -- no money moved through THIS row; theirs is in member_payment
  (now() AT TIME ZONE 'Asia/Bangkok')::date,
  -- 🔴 their OWN expiry, never a new one. This grant must not extend or shorten what they bought.
  to_date(substring(mp.expire_at from 1 for 10), 'YYYY-MM-DD'),
  NULL,                                 -- 0006 allows this: "nullable: comp/manual grants have no payment row"
  'ACTIVE'
FROM member_payment mp
WHERE mp.plan_code = 'MEMBER'
  AND substring(mp.expire_at from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND substring(mp.expire_at from 1 for 10) >= to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD')
  -- never touch anyone who already has a v2 row: theirs is the newer store and it wins outright
  -- (lib/v2/subscription.ts resolveTierFromSources).
  AND NOT EXISTS (SELECT 1 FROM member_subscription ms WHERE ms.user_id = mp.user_id);

-- ── STEP 3 · VERIFY. Both numbers must match what the preflight said ───────────────────────────────
--   SELECT count(*) AS granted_rows FROM member_subscription WHERE package_code = 'LEGACY_GRANT';
--   SELECT count(*) AS still_without_a_row FROM member_payment mp
--    WHERE mp.plan_code = 'MEMBER'
--      AND substring(mp.expire_at from 1 for 10) >= to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD')
--      AND NOT EXISTS (SELECT 1 FROM member_subscription ms WHERE ms.user_id = mp.user_id);
--   -- the second must be 0.
--
-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────────
-- Every row this file writes is identifiable and was created by it:
--   DELETE FROM member_subscription WHERE package_code = 'LEGACY_GRANT';
-- Nothing else changed, so that restores the previous state exactly. Undoing it puts those members back
-- on the entitlement.ts:121 safety net rather than on nothing — they do not lose access either way.
