-- 0034 INVENTORY · read-only identity re-measure for mumate-login-identity-001 slice 2.
-- Safe to run against production BY THE OWNER. Read-only by construction and by
-- transaction setting, and it emits ONLY counts.
--
-- 🔴 This file deliberately emits no id_token, no email, no name and no user_id.
--    The forward migration's STEP 0 and STEP 1 DO emit rows, because the owner
--    needs a dump to recover from a deletion and needs to see which identities
--    collide. Those are his to run. This one is the aggregates-only version that
--    an agent may run under the slice-2 authorization, which limits output to
--    "aggregates or non-identifying references, never raw tokens or personal data".
--
-- The numbers in PLAN.md 0.2 are a 2026-09-23 planning checkpoint taken before
-- slice 1 landed. They WILL have drifted. This replaces them.

BEGIN;
SET LOCAL default_transaction_read_only = on;

SELECT 'rows_total'                AS metric, count(*)::bigint AS value FROM user_provider
UNION ALL SELECT 'members_total',            count(DISTINCT user_id)    FROM user_provider
UNION ALL SELECT 'spelling_GOOGLE',          count(*) FROM user_provider WHERE provider = 'GOOGLE'
UNION ALL SELECT 'spelling_google',          count(*) FROM user_provider WHERE provider = 'google'
UNION ALL SELECT 'spelling_LINE',            count(*) FROM user_provider WHERE provider = 'LINE'
UNION ALL SELECT 'spelling_line_other_case', count(*) FROM user_provider WHERE lower(provider) = 'line' AND provider <> 'LINE'
UNION ALL SELECT 'provider_blank',           count(*) FROM user_provider WHERE btrim(provider) = ''
UNION ALL SELECT 'provider_blank_ya29',      count(*) FROM user_provider WHERE btrim(provider) = '' AND id_token LIKE 'ya29%'
UNION ALL SELECT 'provider_other_nonblank',  count(*) FROM user_provider WHERE btrim(provider) <> '' AND lower(provider) NOT IN ('google', 'line')
UNION ALL SELECT 'id_token_empty',           count(*) FROM user_provider WHERE btrim(id_token) = ''
UNION ALL SELECT 'identity_groups_same_user_duplicated',
  (SELECT count(*) FROM (
     SELECT 1 FROM user_provider GROUP BY user_id, lower(provider), id_token HAVING count(*) > 1
   ) x)
UNION ALL SELECT 'identity_groups_claimed_by_many_members',
  (SELECT count(*) FROM (
     SELECT 1 FROM user_provider GROUP BY lower(provider), id_token HAVING count(DISTINCT user_id) > 1
   ) x)
UNION ALL SELECT 'members_touched_by_those_collisions',
  (SELECT count(DISTINCT up.user_id) FROM user_provider up
    JOIN (SELECT lower(provider) AS p, id_token FROM user_provider
           GROUP BY 1, 2 HAVING count(DISTINCT user_id) > 1) c
      ON lower(up.provider) = c.p AND up.id_token = c.id_token)
UNION ALL SELECT 'members_whose_only_credentials_are_dead',
  (SELECT count(*) FROM (
     SELECT user_id FROM user_provider GROUP BY user_id
      HAVING count(*) FILTER (WHERE btrim(provider) = '' AND id_token LIKE 'ya29%') = count(*)
   ) x)
ORDER BY 1;

COMMIT;
