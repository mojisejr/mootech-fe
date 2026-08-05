# M-D — ครึ่งล่างหน้ารายละเอียดวันกินของจริง + เข็มทิศ

**มุน 2026-08-06** · branch `feat/md-daydetail-real` · base `62c5d76`
*(สั้นตามเกณฑ์บอง: ภาพจริง + ผลดิบ)*

## ภาพ route จริง @393
| | ไฟล์ |
|---|---|
| แอดวานซ์ (ค่าเริ่มต้น) | `harness/out/md-daydetail-advanced-393.png` |
| ธรรมดา (ปิด toggle) | `harness/out/md-daydetail-basic-393.png` |
| บอร์ดพร่อง (ทิศซ้ำจาก fixture จริง) | `harness/out/md-daydetail-partial-board-393.png` |

## ผลดิบ
```
harness/capture-daydetail-md.ts
  advanced      : 8 gate cells [S:開 SW:休 W:生 NW:傷 N:杜 NE:景 E:死 SE:驚] · unplaced=0
  basic         : 0 gate cells (paid+advanced only)                          · unplaced=0
  partial board : 7 gate cells [E:開 N:休 NE:生 SE:杜 S:景 SW:死 W:驚]        · unplaced=1 ✅ โผล่ให้เห็น

scripts/gate-compass.test.ts   ✅ 54 assertions
scripts/*.test.ts ทั้งหมด        ✅ เขียว
tsc --noEmit                   ✅ clean
CI-parity build                ✅ exit 0
เลน: ไม่มีไฟล์ hooks/ lib/ pages/api/
```

## proof-of-teeth

| ฟัน | ทำอะไร | ผล |
|---|---|---|
| `mut-compass-inverted` | เปลี่ยน `DIR_CELL` เป็นภาพสะท้อน 180° | ✅ COMPASS-TRUTH แดง (`NW is on the TOP row — 3,3`) |
| `mut-gate-dropped` | ข้ามประตูที่อ่านทิศไม่ออกเงียบๆ | ✅ NOTHING-LOST แดง (`unplaced — []`) |

**verify-the-instrument**: assert ก่อนว่า 8 ช่องเป็น**คนละช่องจริง**และไม่มีช่องไหนทับจุดกึ่งกลาง ไม่งั้น "ทุกประตูมีช่อง" จริงได้ด้วยการให้ทุกตัวช่องเดียวกัน
**และ bijection ไม่พอ** — ตารางที่กลับด้าน 180° ก็เป็น bijection สมบูรณ์ ⇒ ต้อง assert ว่า**เหนืออยู่บน ตะวันออกอยู่ขวา คู่ตรงข้ามสะท้อนผ่านกึ่งกลาง**

ANCHOR: scripts/gate-compass.test.ts#mut-compass-inverted

## adversary sign-off

**สิ่งที่พยายามหักล้างของตัวเอง**

1. **🔴 กับดัก mock — เกือบพลาดเอง** เขียน `normalizeDirection` รับแค่ `'NW'/'S'` เพราะโน้ตผมเองเขียนย่อว่า "ทิศ S" · เปิด `fixtures.ts` แล้วเจอว่าท่อส่ง **`'ทิศตะวันออกเฉียงเหนือ'`** ⇒ ถ้าไม่เปิดดู **ทุกประตูจะตกไป `unplaced` และบอร์ดว่างเปล่า** ⇒ รับทั้งสองคำ + assert ว่าคำประสม 4 ตัวไม่ถูกอ่านเป็นทิศหลัก (prefix match จะอ่าน NE เป็น E)
2. **โพรบผิด 2 รอบ ของถูก** — (ก) toggle แอดวานซ์เปิดเป็นค่าเริ่มต้น ผมกดปิดแล้วเรียกว่า "advanced" (ข) stub ใส่ `isMain` แต่ BFF คืน shape ที่ใช้ `isStrength` ⇒ ไม่มีการ์ดไหนได้ advice · **แก้ stub ไม่ใช่แก้ของ**
3. **🔴 3 บั๊กที่เจอด้วยตาจากภาพ ไม่ใช่จากด่าน** — chip โชว์ `NE` ดิบในจอไทย · ป้าย 8 เทพ `name.slice(0,1)` ตัดสระนำไทยได้ `เ` ลอยเดี่ยว 5 ตัวเหมือนกันหมด · สีพื้นการ์ด DayStrip มาจาก % ปลอม (บองสั่งตัดแค่เลข แต่**สีก็พูดว่าวันดี/ร้าย**เหมือนกัน)
4. **ยังไม่ครอบ (A2 ไม่อ้างว่าครอบ)** — ชั้น DOM/พิกเซลของเข็มทิศ **ไม่ได้ทำ ตามที่บองสั่งตัด** พร้อมเงื่อนไขกลับมาทำเขียนไว้ในไฟล์ · viewport นอก 393 · ยังไม่ยืนยันว่า backend จริงสะกดทิศแบบไหน (จึงรับทั้งสอง)

## ⏳ ค้างรอ #189 merge — ต่อ `run-calendar-select.ts` เข้า CI (ตู๋จับได้)
ledger ของ #189 เขียน `enforced_by` ไว้ทั้งที่**ไม่มีอะไรรันไฟล์นั้น** = ledger โกหก
ไฟล์อยู่ใน #189 ซึ่งยังไม่ขึ้น main ⇒ **ใส่บรรทัด CI ตอนนี้ = CI ใบนี้แดงเพราะหาไฟล์ไม่เจอ**
⇒ **#189 merge เมื่อไหร่ ผม rebase แล้ว push บรรทัดเดียวเข้าใบนี้ทันที** (ยังอยู่ในใบ 2 ตามที่บองสั่ง — CI ใบนี้จะได้รันมันจริงก่อน merge)
