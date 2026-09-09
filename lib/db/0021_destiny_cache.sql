-- 0021 — cache ผลคำนวณดวง (destiny) ต่อผู้ใช้ 1 แถว keyed ด้วย "วันเวลาเกิด" (birth_key).
-- เหตุผล: /api/destiny ยิง engine 7 lane ทุกครั้งที่เข้าหน้า (แพง+ช้า). ถ้าวันเวลาเกิดไม่เปลี่ยน
-- คืน payload ที่เก็บไว้แทน — ไม่ยิง engine ซ้ำ. birth_key เปลี่ยน (แก้วันเกิด) → miss → คำนวณใหม่ + ทับแถวเดิม.
-- payload = ก้อน engine-derived (ไม่รวม avatarUrl ซึ่งดึงสดจาก user ทุกครั้ง). ADDITIVE/idempotent.
CREATE TABLE IF NOT EXISTS "bazi_destiny_cache" (
  "user_id"    text PRIMARY KEY,
  "birth_key"  text NOT NULL,
  "payload"    jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
