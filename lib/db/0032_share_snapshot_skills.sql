-- 0032 · share_snapshot: เพิ่มคอลัมน์ skills (mootech-fe#359 ซินแสนุ้ย รอบ 16 2026-09-15)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND on
-- dev → then prod (operator-gated). NEVER run blind / via drizzle push.
--
-- 🔴 prod = Supabase soxsccdlsycaevusndro. Applying to prod requires ฟีม (CLAUDE.md).
-- ADDITIVE ONLY — ADD COLUMN บนตาราง share_snapshot ที่เพิ่งสร้างเอง (0031) เท่านั้น, ไม่มี ALTER/DROP
-- ตารางเดิมอื่น. Idempotent (IF NOT EXISTS) รันซ้ำปลอดภัย.
--
-- ทำไม: การ์ดแชร์ "ดวงธาตุ" ต้องโชว์แถบสกิล 4 ด้าน (%+เกรด+จุดแข็ง) ใน OG image → เก็บสตริงสกิลที่ encode
-- แล้ว (label|percent|grade|color|top คั่นแถวด้วย "~") ไว้ใน snapshot เพื่อให้หน้า /invite สร้าง og:image ได้.

ALTER TABLE share_snapshot ADD COLUMN IF NOT EXISTS skills text;
