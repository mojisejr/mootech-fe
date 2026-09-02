-- #239 — backfill `onboarded_at` for legacy users (ป้องกัน launch แล้ว user เก่า 4,742 คนโดนเด้งเข้า first-run)
--
-- ปัญหา: first-run gate ดู `onboarded_at IS NULL` เป็น "ยังไม่ onboard" → ผู้ใช้เก่าทุกคนที่ไม่มีค่านี้
-- จะถูกพาเข้า flow first-run ใหม่หลัง launch (#239)
-- นโยบาย (ปรึกษาทีมก่อนรัน): user ที่ "ใช้งานจริงมาก่อน" = มีข้อมูลเกิดครบ (dob ไม่ null) หรือเคยคำนวณดวง
-- ให้ถือว่า onboard แล้ว → ตั้ง onboarded_at = NOW()
-- ผู้ใช้ที่ dob ว่างด้วย = ปล่อย NULL ไว้ (เข้า first-run ได้ ซึ่งถูกต้องเพราะข้อมูลยังไม่ครบอยู่แล้ว)
--
-- รันบน: Supabase PROD (soxsccdlsycaevusndro) — ให้ operator รันเท่านั้น (อย่ารัน 2 ครั้ง: dry-run ก่อนเสมอ)
--
-- ===== DRY RUN (ดูก่อนว่าจะกระทบกี่แถว) =====
SELECT COUNT(*) AS will_backfill
FROM "user"
WHERE onboarded_at IS NULL
  AND dob IS NOT NULL;

-- ===== RUN จริง =====
UPDATE "user"
SET onboarded_at = NOW()
WHERE onboarded_at IS NULL
  AND dob IS NOT NULL;

-- ===== ตรวจหลังรัน =====
SELECT
  COUNT(*) FILTER (WHERE onboarded_at IS NULL)                AS still_null,
  COUNT(*) FILTER (WHERE onboarded_at IS NOT NULL)            AS onboarded,
  COUNT(*) FILTER (WHERE onboarded_at IS NULL AND dob IS NOT NULL) AS leftover_should_be_zero
FROM "user";
