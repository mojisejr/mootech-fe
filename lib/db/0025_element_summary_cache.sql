-- 0025 — cache "ธาตุของคุณ" (element-summary) ต่อผู้ใช้ 1 แถว.
-- เหตุผล: /api/bazi/element-summary ยิง engine คำนวณ chart หนัก (~5-6s) ทุกครั้งที่เข้า /account — ไม่มี cache เลย.
-- ผล element-summary เป็น birth-deterministic (ผูกวันเวลาเกิดล้วน ไม่ขึ้นกับวันที่) → เก็บ payload ไว้ คืนทันที.
-- cache_key = version|birthDate|birthTime : แก้วันเกิด → key เปลี่ยน → miss แล้วคำนวณใหม่. ไม่มี term วันที่
--   (element summary ไม่เปลี่ยนตามวัน — ต่างจาก home-fortune ที่ผูก bkkDate).
-- payload = { summary: {...} } (ก้อนที่ route คืน). ADDITIVE/idempotent — ไม่กระทบตารางอื่น.
CREATE TABLE IF NOT EXISTS "bazi_element_summary_cache" (
  "user_id"    text PRIMARY KEY,
  "cache_key"  text NOT NULL,
  "payload"    jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
