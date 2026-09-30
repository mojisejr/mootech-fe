-- Promo B — "แชร์ให้เพื่อน Pro ฟรี 1 เดือน" (ฟิว/ซินแส 2026-09-28)
-- คนที่ได้โค้ดแชร์ = คนที่ "ใช้โค้ด MUMATE100 + จ่ายเงินสำเร็จ" เท่านั้น (ตรวจตอนออกโค้ด, ไม่เก็บซ้ำที่นี่).
-- เพื่อนที่กรอกโค้ด → ได้ Pro ฟรี 30 วัน (เขียน member_subscription 1 แถว). เพดาน: 10 คน/แอคคนออกโค้ด, 1000 สิทธิ์รวม.
-- คีย์ทั้งหมดใช้ "user"(user_id) เส้นเดียว (เหมือน discount_redemption / member_subscription) — ไม่ปน anonId.
-- idempotent (IF NOT EXISTS) ตาม house style; เจ้าของรันเอง (ไม่มี db:apply ใน FE).

CREATE TABLE IF NOT EXISTS promo_share_code (
  user_id     text        PRIMARY KEY REFERENCES "user"(user_id),
  code        varchar(16) NOT NULL,
  used_count  integer     NOT NULL DEFAULT 0,   -- จำนวนเพื่อนที่แลกไปแล้ว (เพดาน 10)
  created_at  timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_share_code_lower ON promo_share_code (lower(code));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS promo_share_redemption (
  id               varchar(36) PRIMARY KEY,
  code             varchar(16) NOT NULL,
  issuer_user_id   text        NOT NULL REFERENCES "user"(user_id),
  referee_user_id  text        NOT NULL REFERENCES "user"(user_id),
  redeemed_at      timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- เพื่อน 1 คน แลกได้ครั้งเดียวตลอดแคมเปญ (กันเวียนกรอกหลายโค้ด)
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_share_referee ON promo_share_redemption (referee_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ix_promo_share_code ON promo_share_redemption (code);
--> statement-breakpoint

-- ตัวนับสิทธิ์รวมทั้งแคมเปญ (atomic cap 1000) — 1 แถวต่อ 1 แคมเปญ
CREATE TABLE IF NOT EXISTS promo_share_campaign (
  id          text    PRIMARY KEY,
  used_count  integer NOT NULL DEFAULT 0,
  max_total   integer NOT NULL
);
--> statement-breakpoint
INSERT INTO promo_share_campaign (id, used_count, max_total)
VALUES ('MUMATE_FREE_MONTH', 0, 1000)
ON CONFLICT (id) DO NOTHING;
