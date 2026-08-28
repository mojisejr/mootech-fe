-- 0010 · v2_payment: remember WHY the gateway refused (mootech-fe#437)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). ADDITIVE ONLY —
-- two nullable columns on our own v2_payment. No CHECK, no FK, no index, no backfill, nothing rewritten.
-- Existing rows keep NULL, which is the honest value: for every charge created before this migration we
-- genuinely do not know why it was refused, because lib/payment/omise-gateway.ts threw the answer away.
--
-- WHY THIS EXISTS: on 2026-08-25 a real card was declined (chrg_test_68smuuztswneop8au3z). Omise answers a
-- declined card with HTTP 200 + object 'charge' + status 'failed' + failure_code — never an error object —
-- so omisePost did not throw, the adapter returned only the id, and the reason was unrecoverable from our
-- side. Answering "why was this card refused?" required a human opening the Omise dashboard. After this
-- migration the row answers it.
--
-- 🔴 NOT a status column. `status` already exists and already has its CHECK ('PENDING','APPROVED','REJECT');
-- these two columns are the REASON, never the verdict. Nothing may branch on them.

ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS failure_code    text;
ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS failure_message text;

COMMENT ON COLUMN v2_payment.failure_code    IS 'Omise failure_code verbatim (e.g. insufficient_fund, payment_rejected). NULL = the gateway did not say, or the charge never failed. #437';
COMMENT ON COLUMN v2_payment.failure_message IS 'Omise failure_message verbatim, for a human reading the row. Never shown to the end user. #437';
