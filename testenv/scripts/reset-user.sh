#!/usr/bin/env bash
# reset-user.sh — ลบ "ผู้ใช้ที่สมัครบนสนามซ้อม" ให้กลับไปเป็นคนที่ยังไม่เคยเข้า (#231 Phase 4)
#
#   bash testenv/scripts/reset-user.sh            # ดูก่อนว่าจะลบใคร (ไม่ลบจริง)
#   bash testenv/scripts/reset-user.sh --yes      # ลบจริง
#   bash testenv/scripts/reset-user.sh --list     # แค่ดูรายชื่อ ไม่ต้องถาม
#
# 🔑 แยก "คนที่สมัครบน local" ออกจาก "ข้อมูลที่ยกมาจาก prod" ได้ยังไง
#    anonymize.sql ตั้ง user_provider.id_token = '' ให้ทุกแถวที่มาจาก dump (ยืนยัน: 5,609/5,609 แถวว่าง)
#    ส่วนการสมัครจริงบนเครื่องนี้ BE จะเขียน id_token ของ provider ลงไป ⇒ ไม่ว่าง
#    ⇒ `id_token <> ''` = เกิดบนสนามซ้อมนี้เท่านั้น · ตัดสินจากผลของ anonymize ไม่ใช่จากเวลา/การเดา
#    ⇒ คำสั่งนี้จึงแตะข้อมูลที่ยกมาจาก prod ไม่ได้เลย แม้จะรันผิดตอน
#
# ⚠️ ผลข้างเคียงที่ตั้งใจ: user จาก dump ทุกคน "ล็อกอินผ่าน LINE/Google กลับเข้าไม่ได้" อยู่แล้ว
#    (BE หา user ด้วย id_token ที่ว่าง ⇒ ไม่เจอ ⇒ สร้างใหม่) ⇒ ทดสอบ old-user ให้ใช้ /dev-login
set -euo pipefail

PSQL=/opt/homebrew/opt/postgresql@17/bin/psql
URL='postgresql://postgres:postgres@localhost:5433/mumate_test?sslmode=require'
[ -x "$PSQL" ] || { echo "❌ ไม่พบ pg17 psql ที่ $PSQL"; exit 1; }

# ทุกตารางที่มีคอลัมน์ user_id ถูกกวาดอัตโนมัติ — ไม่ต้องมารื้อรายชื่อทุกครั้งที่ schema เปลี่ยน
# (ค้นจาก information_schema ตอนรัน ⇒ ตารางใหม่ที่มี user_id ก็โดนกวาดเอง)
SEL_IDS="select user_id from user_provider where id_token is not null and id_token <> ''"

q() { "$PSQL" "$URL" -tAc "$1"; }

N=$(q "select count(distinct user_id) from ($SEL_IDS) t")
if [ "${N:-0}" = "0" ]; then
  echo "✅ ไม่มีผู้ใช้ที่สมัครบนสนามซ้อม — ตอนนี้เปิด /v2 ก็เป็นคนใหม่อยู่แล้ว"
  exit 0
fi

echo "พบผู้ใช้ที่สมัครบนสนามซ้อมนี้ $N คน:"
q "select '  · user_id='||left(u.user_id,8)||'… provider='||string_agg(distinct p.provider,'/')||' ชื่อ='||coalesce(max(u.name),'(ไม่มี)')
    from \"user\" u join user_provider p on p.user_id=u.user_id
    where p.id_token is not null and p.id_token <> '' group by u.user_id"

case "${1:-}" in
  --list) exit 0 ;;
  --yes)  ;;
  *) echo; echo "นี่คือการดูเฉย ๆ ยังไม่ลบอะไร — สั่งลบจริงด้วย:  bash ${0##*/} --yes"; exit 0 ;;
esac

echo
echo "── ลบจริง ──"
TABLES=$(q "select string_agg(quote_ident(table_name), ' ' order by table_name) from information_schema.columns where table_schema='public' and column_name='user_id'")
for t in $TABLES; do
  # ข้าม 2 ตารางนี้ในลูป แล้วไปลบท้ายสุดตามลำดับที่ถูกต้อง:
  #   user_provider = แหล่งที่ SEL_IDS ใช้ค้นเป้า — ลบก่อน = รายการเป้าหายกลางคัน ตารางที่เหลือจะไม่ถูกกวาด
  #   user          = ลบก่อน user_provider ได้ แต่จัดคู่กันไว้ท้ายสุดเพื่อให้ลำดับอ่านง่าย
  case "$t" in '"user"'|user|user_provider|'"user_provider"') continue ;; esac
  n=$("$PSQL" "$URL" -tAc "with d as (delete from $t where user_id in ($SEL_IDS) returning 1) select count(*) from d")
  [ "$n" != "0" ] && echo "   ลบ $t: $n แถว"
done
n=$("$PSQL" "$URL" -tAc "with d as (delete from \"user\" where user_id in ($SEL_IDS) returning 1) select count(*) from d")
echo "   ลบ user: $n แถว"
# user_provider ต้องลบท้ายสุดจริง ๆ — มันคือแหล่งที่ SEL_IDS ใช้ค้น ถ้าลบก่อน รายการเป้าจะหายกลางคัน
n=$("$PSQL" "$URL" -tAc "with d as (delete from user_provider where id_token is not null and id_token <> '' returning 1) select count(*) from d")
echo "   ลบ user_provider: $n แถว"

echo
echo "✅ เสร็จ — เหลือผู้ใช้ที่สมัครบนสนาม: $(q "select count(distinct user_id) from ($SEL_IDS) t") คน"
echo "   อย่าลืมล้าง cookie ของ localhost ในเบราว์เซอร์ (หรือเปิดหน้าต่างไม่ระบุตัวตน) ก่อนสมัครใหม่"
