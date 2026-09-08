-- 0019 · v2_payment: remember WHETHER the QI a buyer paid for actually reached the engine (mootech-fe#605 G1)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 Applying to prod requires ฟีม. ADDITIVE ONLY — one nullable column on our own v2_payment, plus one
-- partial index. No CHECK, no FK, no DROP, no backfill, nothing rewritten. Existing rows keep NULL.
-- Both statements are IF NOT EXISTS, so re-running is safe.
--
-- WHY THIS EXISTS — the QI lane could take money and credit nothing, with no queue and no retry:
--   repo.ts settleAndProvision sets status='APPROVED' INSIDE the transaction, then fires
--   grantQiPurchase AFTER it. If the engine call fails, the code writes two console.error lines and
--   returns. Nothing retries it. And the reconciler only ever looks at status='PENDING'
--   (reconcile.ts:53,68) — so an APPROVED row whose grant failed is never revisited by anything.
--   ⇒ money in, QI not credited, recoverable only by a human reading logs.
--   This is the QI-lane shape of #371, which was fixed for the membership lane and left open here.
--
-- 🔴 NULL DOES NOT MEAN "FAILED". It means "this row carries no record of a successful grant" — which for
-- a row written before this migration is ignorance, not a verdict. Retrying on ignorance is safe ONLY
-- because the engine's grant is idempotent on ref = charge_id (lib/qi/grant.ts:3-4): it checks its ledger
-- before adding, so a repeat credits nothing twice. Ignorance + an idempotent retry = repair.
-- Deliberately NOT backfilled to now() for existing APPROVED QI rows: that would mark a genuinely failed
-- grant as done and throw away the only chance to repair it. Prod holds ZERO tier_code='QI' rows today
-- (`select status, tier_code, count(*) from v2_payment group by 1,2`, read 2026-09-08), so none is affected.
--
-- 🔴 NOT a status column. `status` keeps its CHECK ('PENDING','APPROVED','REJECT') and still describes the
-- MONEY. This column describes the GOODS, and only for tier_code='QI'. A membership row leaves it NULL
-- forever — that lane's provisioning is the member_subscription write inside the SAME transaction, so it
-- cannot half-happen the way a cross-network grant can.

ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS qi_granted_at timestamptz;
--> statement-breakpoint
-- The reconciler's QI pass scans exactly this predicate. Partial, so it holds only rows that can ever
-- match — today zero — and stays proportional to unrepaired purchases, never to sales volume.
CREATE INDEX IF NOT EXISTS idx_v2_payment_qi_ungranted
  ON v2_payment (created_at)
  WHERE tier_code = 'QI' AND status = 'APPROVED' AND qi_granted_at IS NULL;
--> statement-breakpoint
COMMENT ON COLUMN v2_payment.qi_granted_at IS 'When the engine confirmed this QI purchase was credited (POST {BAZI_BASE_URL}/api/qi/grant returned ok). NULL = no record of a successful grant; for a QI row that makes it a repair candidate for the reconciler, NOT a verdict that it failed. Retry is safe because the engine dedups on ref = charge_id. Always NULL for a membership row. #605 G1';
