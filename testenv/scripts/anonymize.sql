-- anonymize.sql — scrub user PII IN THE DB (deterministic UPDATEs, run AFTER restore of full.sql).
-- WHY in-DB not sed-on-.sql: editing a pg_dump is brittle (COPY blocks, escaping, Thai, multiline);
-- UPDATE is reliable + verifiable with SQL (golden queries C).
--
-- KEEP (the fortune engine needs these — NEVER touch): user_id/anon_id, dob, time/birth_time,
--   is_remember_time, gender, place_name/province, result_code, points. And ALL reference/engine tables
--   (analytic_*, color, mascot_v2, scared_thing, bazi_twelve_qi_stages, bazi_time_solar_terms,
--    chinese_horoscope8_square_*, bazi_reference_documents, *_card_image, compatibility_*_description,
--    power_*_description) — anonymizing those would corrupt readings.
-- ANONYMIZE (user-supplied identity/content): name/surname, email, tel, picture/image urls, account,
--   refer code, chat messages, journal notes/goals, client names, submitter contact.
-- Deterministic key = the row's identity (user_id/anon_id) so fakes are stable + joinable.

BEGIN;

-- ── core account ──────────────────────────────────────────────────────────────────────────────────
UPDATE "user" SET
  name                  = 'user_'  || left(user_id, 8),
  surname               = 'sn_'    || left(user_id, 8),
  email                 = 'user_'  || left(user_id, 8) || '@test.local',
  tel                   = '08000'  || lpad((abs(hashtext(user_id)) % 100000)::text, 5, '0'),
  account_name          = 'acct_'  || left(user_id, 8),
  refer_code            = 'ref_'   || left(user_id, 6),
  -- #183: replace (not wipe) user-facing image URLs with a LOCAL placeholder — '' left the v2 avatar
  -- broken/empty; a LOCAL path (served by the FE from public/) renders the mascot without leaking the
  -- real photo and without any external fetch. NEVER an external/CDN URL.
  picture_url           = '/images/v2/mascot/01.webp',
  share_img_profile_url = '/images/v2/mascot/01.webp';

UPDATE dashboard_users SET
  name  = 'dash_' || left(id::text, 8),
  email = 'dash_' || left(id::text, 8) || '@test.local';

UPDATE member SET
  first_name = 'first_' || left(id::text, 8),
  last_name  = 'last_'  || left(id::text, 8),
  username   = 'member_' || left(id::text, 8);

UPDATE employee SET username = 'emp_' || left(id::text, 8);

UPDATE use_provider SET
  name        = 'prov_' || left(user_id, 8),
  email       = 'prov_' || left(user_id, 8) || '@test.local',
  picture_url = '/images/v2/mascot/01.webp';  -- #183 (use_provider is empty today, but set for completeness)

-- ⚠️ user_provider (NOT use_provider — two near-identical names; use_provider is EMPTY, user_provider
-- has the real 5385 OAuth rows). id_token = a real OAuth id_token (JWT w/ user claims) → scrub it too.
UPDATE user_provider SET
  name        = 'prov_' || left(user_id, 8),
  email       = 'prov_' || left(user_id, 8) || '@test.local',
  picture_url = '/images/v2/mascot/01.webp',  -- #183 local placeholder (was '')
  id_token    = '';

-- ── calc / matching logs (name only; place_name = birth province → KEEP for compute) ────────────────
UPDATE log_calculate  SET name = 'calc_' || left(id::text, 8);
UPDATE log_love_mate  SET name = 'p_' || left(id::text, 8), your_name = 'you_' || left(id::text, 8);
UPDATE log_matching   SET name = 'p_' || left(matching_id, 8), your_name = 'you_' || left(matching_id, 8);
UPDATE log_work_vibe  SET name = 'p_' || left(id::text, 8), your_name = 'you_' || left(id::text, 8);
-- #183: member_with_friend.picture_url held 213 REAL external http URLs (a whole class the old script
-- missed) → local placeholder, not wiped.
UPDATE member_with_friend SET name = 'p_' || left(id::text, 8), surname = 'sn_' || left(id::text, 8),
                               picture_url = '/images/v2/mascot/01.webp';

-- ── chat / alerts / journal — REAL user text content ────────────────────────────────────────────────
UPDATE bazi_chat_histories SET line_user_id = 'line_' || left(id::text, 8),
                               messages = '[]'::jsonb;
UPDATE bazi_alerts         SET line_user_id = 'line_' || left(id::text, 8),
                               message = '(anonymized)';
UPDATE bazi_manifest_entry SET note = '(anonymized)', mood = mood;  -- mood = enum-ish, keep; note = free text
UPDATE bazi_manifest_goal  SET title = 'goal_' || left(id::text, 8), affirmation = '(anonymized)', image_url = '';
UPDATE bazi_manifest_task  SET title = 'task_' || left(id::text, 8);

-- ── customer reading records (client_name, device_label; KEEP birth_date/time/gender/province) ───────
UPDATE bazi_newdata_reading               SET client_name = 'client_' || left(id::text, 8), device_label = 'dev';
UPDATE bazi_newdata_reading_pdf_versions  SET client_name = 'client_' || left(id::text, 8);
UPDATE bazi_newdata_reading_revisions     SET client_name = 'client_' || left(id::text, 8);

-- ── sacred map: submitter_contact = PII; name/address/deity = public temple info → KEEP ─────────────
UPDATE bazi_sacred_map_location SET submitter_contact = '(anonymized)';

-- ── payment / otp / line mappings ───────────────────────────────────────────────────────────────────
UPDATE payment SET email = 'pay_' || left(id::text, 8) || '@test.local', note = '(anonymized)';
UPDATE otp     SET tel = '0800000000', message = '(anonymized)' WHERE to_regclass('public.otp') IS NOT NULL;
UPDATE user_line_mappings SET line_user_id = 'line_' || left(clerk_user_id, 8)
  WHERE to_regclass('public.user_line_mappings') IS NOT NULL;

-- 🛡️ SELF-VERIFY (inside the tx, before COMMIT — so a leak ROLLS BACK, atomic + LOUD, not false-green).
-- Sweeps EVERY email column in information_schema, not the list above — this is exactly the class of bug
-- that hid user_provider (a mis-named/empty target UPDATEs 0 rows and "succeeds" silently). If ANY email
-- column still holds a non-@test.local address, the whole anonymize aborts and rolls back.
DO $$
DECLARE r record; leaked int; total int := 0;
BEGIN
  FOR r IN
    select table_name, column_name from information_schema.columns
    where table_schema='public' and data_type in ('text','character varying') and column_name ~* 'email|mail'
  LOOP
    EXECUTE format('select count(*) from %I where %I ~ ''@'' and %I !~ ''@test.local$''',
                   r.table_name, r.column_name, r.column_name) INTO leaked;
    IF leaked > 0 THEN
      RAISE WARNING 'PII LEAK: %.% = % real emails', r.table_name, r.column_name, leaked;
      total := total + leaked;
    END IF;
  END LOOP;
  IF total > 0 THEN
    RAISE EXCEPTION 'anonymize INCOMPLETE: % real emails remain across the DB — rolling back', total;
  END IF;
END $$;

-- ANCHOR: anonymize-picture-placeholder — the 5 user-facing picture columns must be 100% the LOCAL
-- placeholder after anonymize (proof-of-teeth: the SELF-VERIFY guard below rolls the tx back on any leak).
-- 🛡️ SELF-VERIFY #183 (picture URLs — inside the tx, before COMMIT: a leak ROLLS BACK, atomic + LOUD).
-- Every user-facing picture column MUST be 100% the LOCAL placeholder — never an external URL, never left
-- as-is. This guards the EXACT failure that let member_with_friend.picture_url keep 213 real http URLs: an
-- UPDATE that targets a wrong/missing column "succeeds" with 0 rows and the column stays unscrubbed. If any
-- of the 5 columns has rows but is not entirely the placeholder (external URL remains, OR the column is
-- 100% empty = the UPDATE never fired), the whole anonymize aborts and rolls back.
DO $$
DECLARE
  ph  text := '/images/v2/mascot/01.webp';
  cols text[] := ARRAY['user.picture_url','user.share_img_profile_url','user_provider.picture_url',
                       'use_provider.picture_url','member_with_friend.picture_url'];
  spec text; tbl text; col text; tot int; okc int; ext int; bad int := 0;
BEGIN
  FOREACH spec IN ARRAY cols LOOP
    tbl := split_part(spec, '.', 1); col := split_part(spec, '.', 2);
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'select count(*), count(*) filter (where %I = %L), count(*) filter (where %I ~ ''https?://'') from %I',
      col, ph, col, tbl) INTO tot, okc, ext;
    IF tot > 0 AND okc <> tot THEN
      RAISE WARNING '#183 picture NOT anonymized: %.% total=% placeholder=% external=%', tbl, col, tot, okc, ext;
      bad := bad + 1;
    END IF;
  END LOOP;
  IF bad > 0 THEN
    RAISE EXCEPTION '#183 anonymize INCOMPLETE: % user-facing picture column(s) not fully set to the local placeholder — rolling back', bad;
  END IF;
END $$;

COMMIT;

-- NOTE: extend after inspecting real data (golden queries C sweep every text column for known real
-- domains gmail/hotmail/yahoo/line + Thai names). This covers the identity-bearing tables enumerated
-- from information_schema; reference/engine tables are intentionally untouched.
