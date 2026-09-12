-- 0026 — cache "รายละเอียดวัน" (day-detail) แบบทน cold start.
-- เหตุผล: /api/v2/day-detail คำนวณ man-vs-day + almanac (~5s) และมีแค่ in-memory Map ที่หายตอน cold start/
-- instance อื่น → ผู้ใช้เจอ ~5s บ่อย (บนปฏิทินยิง 2 รอบ: วันนี้ prefetch + วันที่เลือก). ผล 1 วันของ birth
-- เป็น deterministic → เก็บลง DB คืนทันที (route ยังมี Map ชั้นบนไว้เร็วสุด).
-- cache_key = version|userId|birth-signature|date (unique ต่อ user×birth×วัน) — หลายแถวต่อ user (ต่างจาก
--   cache แบบ 1 แถว/user). แก้วันเกิด → birth-signature เปลี่ยน → key ใหม่ → miss.
-- payload = DayDetail เต็ม (route ตัดเป็น free view ตอนตอบ ไม่เก็บฉบับตัด). ADDITIVE/idempotent.
CREATE TABLE IF NOT EXISTS "bazi_day_detail_cache" (
  "cache_key"  text PRIMARY KEY,
  "payload"    jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
