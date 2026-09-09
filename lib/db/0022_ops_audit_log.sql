-- 0022 — บันทึกการกระทำของแอดมิน /ops (tier/QI/วันเกิด ฯลฯ) เพื่อ traceability (เงิน/สิทธิ์ ต้องตามรอยได้)
-- ADDITIVE/idempotent. admin_user_id = dashboard_users.id (จาก cookie ops_user) — null ถ้าไม่ทราบ
CREATE TABLE IF NOT EXISTS "ops_audit_log" (
  "id"             varchar(36) PRIMARY KEY,
  "admin_user_id"  text,
  "action"         text NOT NULL,
  "target_user_id" text,
  "payload"        jsonb,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ops_audit_log_target" ON "ops_audit_log" ("target_user_id", "created_at");
