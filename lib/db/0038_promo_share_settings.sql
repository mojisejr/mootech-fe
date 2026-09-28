-- ตั้งค่าแชร์เพื่อน (Pro ฟรี 1 เดือน) ให้ปรับได้จาก /ops โดยไม่ต้องแก้โค้ด (เอ็ม 2026-09-28).
-- เพิ่มคอลัมน์ในตัวนับแคมเปญ: enabled (เปิด/ปิดการแชร์ต่อ), max_per_issuer (เพดานคน/ผู้แชร์).
-- default = พฤติกรรมเดิม (เปิด · 10 คน/แอค) → รันแล้วไม่มีอะไรเปลี่ยนจนกว่าจะปรับเอง. idempotent.
ALTER TABLE promo_share_campaign ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE promo_share_campaign ADD COLUMN IF NOT EXISTS max_per_issuer integer NOT NULL DEFAULT 10;
