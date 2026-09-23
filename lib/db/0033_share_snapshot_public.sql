-- 0033: แชร์แบบ "เปิดเผย" ให้คนอื่นอ่านคำทำนายเต็มได้ (opt-in consent) — ซินแสนุ้ย/พี่พล 2026-09-23.
-- is_public = เจ้าของกดยินยอมเปิดเผย (แชร์แบบเปิดอ่านได้); full_text = คำทำนายเต็มที่ให้อ่าน;
-- consented_at = เวลาที่ยินยอม (หลักฐาน PDPA). ค่า default = ปิด (แชร์แบบเดิม preview อย่างเดียว).
ALTER TABLE share_snapshot ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE share_snapshot ADD COLUMN IF NOT EXISTS full_text text;
ALTER TABLE share_snapshot ADD COLUMN IF NOT EXISTS consented_at timestamptz;
