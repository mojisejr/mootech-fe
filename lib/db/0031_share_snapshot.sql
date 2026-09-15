-- 0031 · share snapshot for short share links (mootech-fe#359 ซินแสนุ้ย รอบ 14 2026-09-15)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md). ADDITIVE ONLY —
-- one brand-new table, no ALTER/DROP on any existing table. Idempotent (IF NOT EXISTS) so a re-run is safe.
--
-- ทำไม: เดิมแชร์ผลด้วยการยัด t/s/d/g/m ลง query ของ /invite → ภาษาไทย 1 ตัว = 9 ตัวอักษรเมื่อ URL-encode
-- ทำให้ลิงก์ที่โชว์ในแชท (LINE/Messenger) ยาวมหาศาลและดูแย่. แก้โดยเก็บสแนปช็อตการ์ดใต้โค้ดสั้น แล้วลิงก์
-- ที่แชร์ = /invite/<referral>?c=<id> (สั้น กดได้) ส่วน og:image ไปดึงแถวนี้มา render (URL ยาวได้ ซ่อนใน meta).

CREATE TABLE IF NOT EXISTS share_snapshot (
  id          varchar(24) PRIMARY KEY,          -- โค้ดสั้น base62 (สร้างฝั่ง API)
  user_id     varchar(36),                      -- เจ้าของผล (null ได้)
  title       text        NOT NULL,
  subtitle    text,
  summary     text,
  tag         text,
  image       text,                             -- URL รูปมาสคอต/การ์ด
  created_at  timestamptz NOT NULL DEFAULT now()
);
