-- 0012 · v2_payment: remember the shadow's expiry BEFORE this purchase pushed it (mootech-fe#484)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 Applying to prod requires ฟีม (CLAUDE.md). The prod project ref is spelled out in 0011 — not
-- repeated here, because the machine-wide PreToolUse guard refuses to write a file that names it.
-- ADDITIVE ONLY — one nullable column on our own v2_payment. No CHECK, no FK, no index, no backfill,
-- nothing rewritten. A nullable column with no DEFAULT does not rewrite the table: the lock is a
-- momentary catalog update. Same shape as 0010 and 0011, both already applied to prod.
--
-- WHY THIS EXISTS: when a charge is REVERSED — it succeeded, then the money went back — the entitlement
-- has to come off. member_subscription can be walked back on its own (one row per purchase, and
-- schema.ts already allows 'EXPIRED'). member_payment cannot: it is ONE row per user, written with
--   expire_at = GREATEST(member_payment.expire_at, subscription.expire_at)     repo.ts:559
-- so the value this purchase overwrote is gone the moment it is written. Nothing can compute it back —
-- not from the row, not from the other rows, because a legacy member's baseline was never a v2 row at all.
-- Recomputing from "the ACTIVE rows that remain" therefore has a case it gets WRONG every time: a member
-- who already had a legacy membership and then bought v2 would lose the legacy date on reversal.
-- So the previous value is captured on the way in, on the payment that changed it.
--
-- 🔴 NOT a status column, and nothing may branch on it as one. It is one date, verbatim, in the same
-- 'YYYY-MM-DD' text shape member_payment.expire_at itself uses (varchar there — see schema.ts:589).
-- NULL means "we do not know": either the row predates this migration, or the user had no shadow row at
-- settle time. NULL is NEVER "the user had no entitlement" — a reversal on a NULL row must hand the
-- member_payment side to a human and MUST NOT guess a value over it.

ALTER TABLE v2_payment ADD COLUMN IF NOT EXISTS prev_member_expire_at text;

COMMENT ON COLUMN v2_payment.prev_member_expire_at IS 'member_payment.expire_at as it stood immediately BEFORE this payment settled, verbatim YYYY-MM-DD. Restored on reversal. NULL = row predates #484, or the user had no member_payment row then — never "no entitlement". #484';
