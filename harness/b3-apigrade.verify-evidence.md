# verify-evidence — B-3 ApiGrade wire contract

goo · 2026-08-05 · Track B · `lib/v2/api-grade.ts` (ฝั่งท่อ) แยกจาก UI `Grade` ของมุน (ไม่แตะ features/).

13 ระดับตรง rating-scale bazi · `parseApiGrade`: 1 ใน 13 หรือ null (คิดไม่ได้ PR-1) ผ่าน · ค่านอกลิสต์ THROW.

## proof-of-teeth
Bug-class: เกรดนอกสัญญาที่ **เงียบผ่าน** ไปเรนเดอร์เป็นช่องว่างที่ไม่มีใครสังเกต. `scripts/api-grade.test.ts` (56 assert รันจริง):

| input | ผล |
|---|---|
| 13 ระดับ F..A+ | isApiGrade true · parseApiGrade ผ่าน (order ตรง rating-scale) |
| null / undefined | → null (ไม่ throw) |
| `"-"` sentinel · `"Z"` · `"A++"` · `42` · `{}` · `""` · `"F "` (14 ตัว) | **THROW ทุกตัว** (ไม่เงียบผ่าน) + isApiGrade=false |

teeth = ถ้าเปลี่ยน `parseApiGrade` ให้ return แทน throw (silent) → 14 assertion แดงทันที.

ANCHOR: lib/v2/api-grade.ts#b3-apigrade-loud

## adversary sign-off
Cross-oracle (ตู๋ static): (ก) ครบ 13 ตรง rating-scale bazi ไหม — enumerate ทั้ง 13 + order-match assertion (ถ้าเลข/ลำดับเพี้ยนจาก bazi → แดง) (ข) `"-"` sentinel หลุดเข้าเป็น valid grade ไหม — assert `!isApiGrade("-")` (ท่อใช้ null) (ค) whitespace/case (`"F "`,`"a+"`) เนียนผ่านไหม — throw. ผมพยายามหักเอง: ยิง 14 ค่านอกลิสต์ + null/undefined + 13 valid = ครบ boundary ของ set.

## evidence limits
pure type contract — ไม่มี runtime/DB. 13 ระดับ verify เทียบ `gradeForPercent` จริงใน PR-1/#18 (deployed). ไม่แตะ `features/` (git diff --stat).
