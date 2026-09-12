-- 0024 — cache overlays บาซิ 4 หัวข้อของ /my-destiny (chinese-horoscope) ต่อผู้ใช้ 1 แถว.
-- เหตุผล: /api/chinese-horoscope ยิง bazi /api/reading/topic 4 หัวข้อ (chart_foundation/love/career/turning)
-- แต่ละหัวข้อ "คำนวณ chart เดิมซ้ำ" ฝั่ง engine → หน้า /my-destiny ช้า ~9s ทุกครั้ง.
-- overlays เป็น birth-deterministic (pure compute) → เก็บ payload ไว้ คืนทันที ข้ามการยิง 4 หัวข้อ.
-- (chart หลักจาก BE ยังยิงสด — เป็น stored-chart lookup ที่เร็ว.)
-- cache_key = version|birthDate|birthTime|gender|province|เดือน(Asia/Bangkok):
--   แก้วันเกิด → BE คืน birth ใหม่ → key เปลี่ยน → miss แล้วคำนวณใหม่ · ขึ้นเดือนใหม่ → miss (กัน clash/age รายปีค้าง).
-- payload = { cf, love, career, turning } (ผล topic ดิบจาก engine). ADDITIVE/idempotent — ไม่กระทบตารางอื่น.
CREATE TABLE IF NOT EXISTS "bazi_chinese_horoscope_cache" (
  "user_id"    text PRIMARY KEY,
  "cache_key"  text NOT NULL,
  "payload"    jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
