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
  picture_url           = '',
  share_img_profile_url = '';

UPDATE dashboard_users SET
  name  = 'dash_' || left(id::text, 8),
  email = 'dash_' || left(id::text, 8) || '@test.local';

UPDATE member SET
  first_name = 'first_' || left(id::text, 8),
  last_name  = 'last_'  || left(id::text, 8),
  username   = 'member_' || left(id::text, 8);

UPDATE employee SET username = 'emp_' || left(id::text, 8);

UPDATE use_provider SET
  name  = 'prov_' || left(user_id, 8),
  email = 'prov_' || left(user_id, 8) || '@test.local';

-- ── calc / matching logs (name only; place_name = birth province → KEEP for compute) ────────────────
UPDATE log_calculate  SET name = 'calc_' || left(id::text, 8);
UPDATE log_love_mate  SET name = 'p_' || left(id::text, 8), your_name = 'you_' || left(id::text, 8);
UPDATE log_matching   SET name = 'p_' || left(matching_id, 8), your_name = 'you_' || left(matching_id, 8);
UPDATE log_work_vibe  SET name = 'p_' || left(id::text, 8), your_name = 'you_' || left(id::text, 8);
UPDATE member_with_friend SET name = 'p_' || left(id::text, 8), surname = 'sn_' || left(id::text, 8);

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

COMMIT;

-- NOTE: extend after inspecting real data (golden queries C sweep every text column for known real
-- domains gmail/hotmail/yahoo/line + Thai names). This covers the identity-bearing tables enumerated
-- from information_schema; reference/engine tables are intentionally untouched.
