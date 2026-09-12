-- 0022 — cache การ์ด "ดวงวันนี้" หน้าหลัก (home-fortune) ต่อผู้ใช้ 1 แถว keyed ด้วย "วันเวลาเกิด + วันที่ (Bangkok)".
-- เหตุผล: /api/home-fortune ยิง engine /api/home (bazi compute หนัก ~timeout 12s) + mergeEngineBirth ทุกครั้งที่
-- เข้าหน้าหลัก. ผลดวงวันนี้ของคน ๆ เดิม "ในวันเดียวกัน" เท่ากันเสมอ → เก็บ payload ไว้ คืนทันทีไม่ยิง engine ซ้ำ.
-- cache_key = version|dob|time|gender|province|วันที่(Asia/Bangkok): แก้วันเกิด → miss, ขึ้นวันใหม่ → miss แล้วคำนวณใหม่.
-- payload = { fortune, persona } (ก้อนที่ FE ส่งให้จอ). ADDITIVE/idempotent — ไม่กระทบตารางอื่น.
CREATE TABLE IF NOT EXISTS "bazi_home_fortune_cache" (
  "user_id"    text PRIMARY KEY,
  "cache_key"  text NOT NULL,
  "payload"    jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
