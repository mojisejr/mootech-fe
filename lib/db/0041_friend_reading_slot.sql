-- 0041 — friend_reading_slot: สล็อตดูดวงเพื่อนฟรีของสมาชิก PRO (ประชุม 24 พ.ย. 2569 ข้อ 2)
-- Pro ดูดวงเพื่อนฟรี 10 คนแรก — "คนละ 1 สล็อต" (เพื่อนที่อยู่ในสล็อตแล้วดูซ้ำได้ฟรีต่อ)
-- คนที่ 11 ขึ้นไป และ Free/Plus ทุกคน จ่าย 30 QI ทุกครั้งที่ดู (engine: QI_SPEND_LINES.friend_reading — ไม่มีตารางที่นั่น)
--   user_id   = เจ้าของรายชื่อ ("user"(user_id) เส้นเดียวกับ member_with_friend.user_id / promo_share_*)
--   friend_id = member_with_friend.id ของเพื่อนคนนั้น (pk ร่วมกันกันเวียนสร้างสล็อตซ้ำ)
-- ADDITIVE ONLY · idempotent (IF NOT EXISTS) ตาม house style · เจ้าของรันเอง (ไม่มี db:apply ใน FE)
-- ต้องรันก่อนเปิดให้ Pro ใช้: ถ้าตารางยังไม่มี route /api/v2/friends/reading จะตอบ Pro ว่า 503 (ไม่หักชี) ส่วน Free/Plus ใช้ได้ปกติ

CREATE TABLE IF NOT EXISTS friend_reading_slot (
  user_id    text        NOT NULL REFERENCES "user"(user_id),
  friend_id  varchar(36) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
