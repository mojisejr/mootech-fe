-- 0005 · PWA push: push_subscription + reminder (mootech-fe#287)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). goo does NOT run
-- this on prod. ADDITIVE ONLY — two brand-new tables, no ALTER/DROP on any existing (pgloader'd) table.
-- Idempotent (IF NOT EXISTS) so a re-run on dev is safe. gen_random_uuid() is built-in on Supabase PG.

CREATE TABLE IF NOT EXISTS push_subscription (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     varchar(36) NOT NULL,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- endpoint is GLOBALLY unique to one device/browser-profile → uniqueness on endpoint ALONE (not
-- (user_id, endpoint)). This makes it impossible for one endpoint to bind to two users; re-subscribing
-- REASSIGNS ownership via the POST upsert (set user_id). Without this, #288's cron could push one
-- account's reminders to a device another user now controls, and the victim couldn't remove it. (ตู๋ #291 B2)
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscription_endpoint
  ON push_subscription (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscription_user_id
  ON push_subscription (user_id);

CREATE TABLE IF NOT EXISTS reminder (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        varchar(36) NOT NULL,
  reminder_date  varchar(10) NOT NULL,   -- YYYY-MM-DD, ยาม START's Asia/Bangkok day
  yam_id         varchar(8)  NOT NULL,
  yam_label      text        NOT NULL,
  yam_window     varchar(16) NOT NULL,   -- "HH:MM-HH:MM", display only (NOT `window` — reserved keyword)
  destinations   json        NOT NULL,
  fire_at_utc    timestamptz NOT NULL,   -- absolute notify instant, computed once at save
  sent_at        timestamptz,            -- #288 send-marker (NULL = not sent) — added now, prod migrated ONCE
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- natural key = the dedup: a lost-response retry of the same (user, date, ยาม) collides → DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_user_date_yam
  ON reminder (user_id, reminder_date, yam_id);
CREATE INDEX IF NOT EXISTS idx_reminder_user_id
  ON reminder (user_id);
-- #288 cron scans DUE-and-UNSENT by fire time — partial index is exactly that scan.
CREATE INDEX IF NOT EXISTS idx_reminder_due
  ON reminder (fire_at_utc) WHERE sent_at IS NULL;
