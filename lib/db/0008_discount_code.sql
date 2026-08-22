-- 0008 · discount codes: discount_code + discount_redemption + payment_quote (mootech-fe#361, Phase 9)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 NUMBERED 0008, not 0007 — the ticket said 0007 but #355 already merged 0007_v2_payment.sql to main
-- (verified on origin/main d04b181). This ticket owns its OWN migration; #355's 0007 had no discount cols.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). goo does NOT run this
-- on prod. ADDITIVE ONLY — three new tables + three ADD COLUMN on v2_payment (our own #355 table, empty on
-- prod). Nothing touches payment_code / member_payment_code (v1, still in use, 16 live redemptions).
--
-- 🔴 IF-YOU-ARE-RUNNING-THIS-SQL: idempotent (IF NOT EXISTS) so re-running is safe — BUT IF NOT EXISTS only
-- guards CREATE/ADD, it does NOT reconcile. If a table/column already exists in an OLDER shape, re-running
-- will NOT add a CHECK/FK/index added later; reconcile by hand (ALTER) or drop+recreate on dev.
-- Requires 0007 to have been applied first (the ALTERs below extend v2_payment).

-- Discount codes are a NEW model — they REDUCE the paid amount (money still flows), unlike v1 payment_code
-- which grants a free package. Two systems, two jobs; 100%-off / free grants stay on v1 payment_code.
CREATE TABLE IF NOT EXISTS discount_code (
  id                   varchar(36) PRIMARY KEY,
  code                 text        NOT NULL,
  kind                 text        NOT NULL CHECK (kind IN ('PERCENT','FIXED')),
  value                integer     NOT NULL,          -- PERCENT: 10 = 10% · FIXED: satang
  max_discount_satang  integer,                       -- cap for BOTH kinds (ตู๋ B4); NULL = no cap
  applies_to           text[]      NOT NULL DEFAULT '{}',  -- package_codes; '{}' = every package (one empty shape)
  starts_at            timestamptz,
  ends_at              timestamptz,
  max_use_total        integer,
  max_use_per_user     integer,
  status               text        NOT NULL CHECK (status IN ('ACTIVE','PAUSED','EXPIRED')),
  used_count           integer     NOT NULL DEFAULT 0,    -- the concurrency counter (see repo.reserve)
  created_by           text,                          -- the /ops key-holder's chosen login name — NOT a verifiable identity
  created_at           timestamptz NOT NULL DEFAULT now()
);
-- 🔴 case-insensitive uniqueness — v1 had none, so 'Yijing'/'YIJING' became two rows. lower(code) UNIQUE
-- also makes "a new code must not collide with an existing one, case-insensitively" a DB fact.
CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_code_lower_code
  ON discount_code (lower(code));

-- One row per successful use. UNIQUE (code_id, payment_id) makes a double-count from a webhook impossible;
-- (code_id, user_id) is the per-user quota's index. Written at CHARGE time (ฟีม/ตู๋ #370 → #361 ②) inside
-- the same transaction that reserves used_count, so the per-user count is serialized by the code-row lock.
CREATE TABLE IF NOT EXISTS discount_redemption (
  id                       varchar(36) PRIMARY KEY,
  code_id                  varchar(36) NOT NULL REFERENCES discount_code (id),
  user_id                  text        NOT NULL REFERENCES "user" (user_id),
  payment_id               varchar(36) NOT NULL REFERENCES v2_payment (id),
  discount_satang          integer     NOT NULL,
  vat_percent_at_purchase  integer     NOT NULL,      -- the RATE, not the money (ฟีม): an old receipt must not
                                                      -- recompute VAT with a rate changed later
  redeemed_at              timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_redemption_code_payment
  ON discount_redemption (code_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemption_code_user
  ON discount_redemption (code_id, user_id);

-- The server-fixed price quote (ตู๋ B3). preview writes it; charge recomputes and COMPARES, refusing on a
-- mismatch/expiry so the user is never charged a different amount than they saw. It needs its OWN table:
-- a quote exists BEFORE any v2_payment row (v2_payment is created at charge, quote at preview).
CREATE TABLE IF NOT EXISTS payment_quote (
  id               varchar(36) PRIMARY KEY,   -- quote_id
  user_id          text        NOT NULL REFERENCES "user" (user_id),
  package_code     text        NOT NULL,
  code_id          varchar(36) REFERENCES discount_code (id),   -- NULL = no code applied
  list_satang      integer     NOT NULL,
  discount_satang  integer     NOT NULL DEFAULT 0,
  amount_satang    integer     NOT NULL,
  vat_percent      integer     NOT NULL DEFAULT 0,   -- the rate quoted (frozen for compare)
  expires_at       timestamptz NOT NULL,             -- short TTL (e.g. 15 min)
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_quote_user ON payment_quote (user_id);

-- v2_payment gains the discount linkage (#355's 0007 had none; this ticket owns the ALTER, #361 ①).
ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS code_id varchar(36) REFERENCES discount_code (id);
ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS discount_satang integer NOT NULL DEFAULT 0;
ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS quote_id varchar(36) REFERENCES payment_quote (id);
