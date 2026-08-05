# verify-evidence — B-4 calendar-month ส่ง grade + ปลดด่านสมาชิกชั่วคราว

goo · 2026-08-05 · Track B · `pages/api/v2/calendar-month.ts` + `lib/v2-calendar/month.ts`.

- เพิ่ม `grade` ต่อวัน (pass-through จาก man-vs-day #18 — ท่อไม่ re-derive, bazi เป็น single source; null=คิดไม่ได้ ไม่ใช่ "-")
- 🔓 ปลดด่านสมาชิก **ชั่วคราว** (ฟีมสั่ง: ยังไม่เปิดขาย เปิดทั้ง free+paid) — คอมเมนต์หนี้คาไว้ครบ พร้อมโค้ดที่ต้องคืนก่อนเปิดขาย

## proof-of-teeth
Bug-class: grade หาย/เพี้ยนตอน strip 6 field · ด่านสมาชิกยังปิดเงียบ. `scripts/calendar-month.test.ts` (24 assert) + handler probe.

**unit (24 assert):** strip เหลือ 6 key (incl grade) · grade pass-through 08-01 B/08-13 C-/08-27 A+ · grade null (08-28, คิดไม่ได้ ไม่ใช่ "-") · grade absent/non-string → null (guard). teeth: ถ้า merge ไม่ map grade → 4 assert แดง.

**handler probe (รันจริง — man-vs-day-with-grade stub เพราะ #18 ยังไม่ deploy):**
```
HTTP 200 · allowed true · days 3      ← free user (userId=free-user-x) ได้ data = ด่านเปิดจริง
  2026-08-01  day 1  ganzhi 丁未  percent 61.67  grade "B"   isBuddhistDay false
  2026-08-02  day 2  ganzhi 戊申  percent 88.34  grade "A"   isBuddhistDay false
  2026-08-05  day 5  ganzhi 辛亥  percent 40.83  grade "C-"  isBuddhistDay false
SHAPE 6-field ✓ · GRADE pass-through ✓ · GATE-OPEN(free got data) ✓ → PASS
```
field mapping (ชื่อเดิม #165, มุนใช้อยู่): day=dayOfMonth · ganzhi=dayGanzhi · percent=overallPercent · isBuddhistDay=wanPhra · **grade ใหม่**. ค่าตรง man-vs-day (grade real-curl พิสูจน์ใน PR-1 #18).

ANCHOR: scripts/calendar-month.test.ts#b4-grade-passthrough

## adversary sign-off
Cross-oracle (ตู๋ static + curl): (ก) ท่อ re-derive grade เองไหม — ไม่ (pass-through `typeof d.grade==='string'?d.grade:null`, bazi single source) (ข) ด่านเปิดถาวรหลุดไหม — คอมเมนต์หนี้ + โค้ดคืนครบ, ฟีม-ruled ชั่วคราว (ค) grade null vs "-" — null. **⚠️ curl ผ่าน server จริง end-to-end ต้องรอ #18 deploy (bazi prod ยังไม่มี grade)** → พิสูจน์ด้วย handler probe + man-vs-day grade real-curl #18. จอไม่เปลี่ยน (ยังกิน mock).

## evidence limits
handler probe = real handler + stubbed upstream (deployed bazi ยังไม่มี grade จน #18 ship). man-vs-day grade เอง = real-curl ใน #18. ไม่แตะ `features/` · `pages/*.tsx` (git diff).
