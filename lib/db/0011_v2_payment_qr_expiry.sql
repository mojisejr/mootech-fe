-- 0011 · v2_payment: remember WHEN the QR stops being scannable (mootech-fe#455)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). ADDITIVE ONLY —
-- one nullable column on our own v2_payment. No CHECK, no FK, no index, no backfill, nothing rewritten.
-- Existing rows keep NULL, which is the honest value: 124 of the 184 charges on this account are already
-- expired and we never recorded when — the value was thrown away at lib/payment/omise-gateway.ts.
--
-- WHY THIS EXISTS: #463 made a PromptPay QR die after 5 minutes instead of 24 hours. The screen still
-- tells the user "กำลังตรวจสอบการชำระเงิน อย่าเพิ่งปิดหน้านี้" until minute 15 (useChargeStatus.ts:106),
-- so for ten minutes it asks someone to WAIT when it should be telling them to ask for a new QR.
--
-- 🔴 AND THE GATEWAY NEVER TELLS US. Measured 2026-08-27 against the live API, full denominator:
--   GET /events  → 237 events, only charge.create (184) and charge.complete (53). No expiry event exists.
--   Of 124 expired charges, the number carrying any event other than charge.create is ZERO.
-- Omise's own plugins do the same thing this migration does: omise-magento stores it
-- (`setAdditionalInformation('charge_expires_at', $response['charge']->expires_at)`), omise-woocommerce
-- re-fetches it per page render. Neither computes it from its own clock — and neither do we.
--
-- 🔴 NOT a status column. `status` already exists with its CHECK ('PENDING','APPROVED','REJECT').
-- This is the gateway's stated deadline for the QR, never a verdict about the payment.
-- NULL means "we do not know", which is NOT the same as "not expired" — no caller may treat it as one.

ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS charge_expires_at timestamptz;

COMMENT ON COLUMN v2_payment.charge_expires_at IS 'Omise charge.expires_at verbatim — when the QR stops being scannable. PromptPay only; card charges have no expiry and stay NULL. NULL also means the row predates #455, or Omise did not say. NULL is never "not expired". #455';
