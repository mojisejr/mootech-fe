-- 0007 · v2 payment records: v2_payment (mootech-fe#355, Phase 3 of #352)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). goo does NOT run
-- this on prod. ADDITIVE ONLY — one brand-new table, no ALTER/DROP on any existing (pgloader'd) table.
-- #354's 0006 migration is already merged; the idempotency index this ticket needs is 0007's OWN — no
-- one else was going to add it (ticket ⑤).
--
-- 🔴 IF-YOU-ARE-RUNNING-THIS-SQL: idempotent (IF NOT EXISTS) so re-running is safe — BUT IF NOT EXISTS
-- only guards CREATE, it does NOT reconcile. If the table ALREADY exists (an earlier apply / earlier
-- version of this file), re-running will NOT add a column / CHECK / FK / index added afterwards — you get
-- the OLD shape. If this file changes after a first apply, reconcile an existing table BY HAND (ALTER), or
-- on dev drop+recreate. The CHECK/FK/UNIQUE below are created only on the first CREATE.
--
-- WHY a separate v2 table (not v1 `payment`): v1 still takes money through `payment`; the settlement race
-- (#355 ⑤: read-then-write with no transaction → double-provision) is fixed HERE by making the DB the
-- arbiter. The webhook does a CONDITIONAL update — UPDATE ... SET status='APPROVED' WHERE charge_id=? AND
-- status <> 'APPROVED' — and provisions only when exactly 1 row changed, inside one transaction with the
-- member_subscription insert. `charge_id` is UNIQUE so a charge maps to at most one record (idempotent).
--
-- CHECK + FK (same discipline as 0006): unknown tier_code / status / method rejected at write; user_id
-- must reference a real user. tier_code is written by the server from lib/payment/catalog.ts (fail-loud
-- on an unmappable package), never from the client.

CREATE TABLE IF NOT EXISTS v2_payment (
  id             varchar(36) PRIMARY KEY,        -- app-supplied uuid
  user_id        text        NOT NULL REFERENCES "user"(user_id),   -- derived from the session, never the client
  package_code   text        NOT NULL,           -- what was bought (validated by catalog before charge)
  tier_code      text        NOT NULL CHECK (tier_code IN ('FREE','PLUS','PRO')),  -- granted level
  amount_satang  integer     NOT NULL,           -- server-computed satang actually charged (VAT-inclusive)
  vat_satang     integer     NOT NULL DEFAULT 0, -- VAT extracted BACKWARD from amount (0 until #362)
  method         text        NOT NULL CHECK (method IN ('card','promptpay')),
  charge_id      text        NOT NULL,           -- Omise charge id — the webhook's join key
  order_id       text        NOT NULL,           -- our 10-digit order ref (parity with v1 metadata.orderId)
  status         text        NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECT')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The settlement gate: one charge_id = one record. Two concurrent webhooks for the same charge collide on
-- this unique key on insert, and the conditional status UPDATE lets exactly one transition PENDING→APPROVED.
CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_payment_charge_id
  ON v2_payment (charge_id);
-- status.ts reads a user's own records by user_id.
CREATE INDEX IF NOT EXISTS idx_v2_payment_user_id
  ON v2_payment (user_id);
