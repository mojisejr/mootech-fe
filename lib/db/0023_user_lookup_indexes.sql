-- 0023 — index สำหรับ /api/user (pages/api/user.ts) ที่ทำให้หน้าหลัก/ทุกหน้าโหลดช้า.
-- /api/user นับ count(*) 2 ตารางนี้ทุกครั้ง (member_with_friend, fortune_telling_log) — ถ้าไม่มี index
-- บน user_id การนับจะ seq-scan ทั้งตาราง → ช้าขึ้นตามจำนวนแถว (วัดได้ 0.4s–11.9s ตอน DB โหลด).
-- ADDITIVE/idempotent. ⚠️ รันบน prod ด้วย CONCURRENTLY (ไม่ล็อกตาราง) และ "นอก transaction" —
-- รันทีละบรรทัด (เครื่องมือ migrate บางตัวห่อ transaction ให้ ต้องปิด หรือรันมือใน psql).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_member_with_friend_user_id"
  ON "member_with_friend" ("user_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_fortune_telling_log_user_id"
  ON "fortune_telling_log" ("user_id");
