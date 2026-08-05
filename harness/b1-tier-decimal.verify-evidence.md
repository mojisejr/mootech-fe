# verify-evidence — B-1 ONE-NUMBER reader READS decimals (harness = μุน's tool)

goo · 2026-08-05 · Track B · แตะ `harness/run-tier-gate.ts` (เครื่องมือของมุน) — ขอ ตู๋ ตรวจจุดนี้เป็นพิเศษ.

**สิ่งที่ patch นี้แก้ = ตัวอ่านค่า (reader) ให้ ONE-NUMBER อ่านถูก — ไม่ใช่ "จับ scale bug ได้".** ค่าจริง
บนสายเป็นทศนิยม (man-vs-day 40.83·61.67). regex เดิม `/(\d+)%/` อ่านแค่จำนวนเต็มก่อน `%`: `"61.67%"`→`"67"`,
`"57.3%"`→`"3"` = ขยะทันทีที่ต่อข้อมูลจริง (ONE-NUMBER เทียบขยะ). แก้: reader decimal-aware + เทียบตัวเลข.
แยกเป็น `harness/tier-percent.ts` (side-effect-free — run-tier-gate เรียก main() เองตอน import). assertion
2 ตัวความหมายเดิมเป๊ะ (tile==sentence · ring==tile), check() count 51→51.

## proof-of-teeth
`scripts/tier-percent.test.ts` (12 assert, รันจริง):

| case | tile/sentence/ring | agree | ผล |
|---|---|---|---|
| CLEAN | 57.3 / 57.3 / 57.3 | true | 🟢 GREEN |
| `mut-decimal-percent` | 57.3 / 57.3 / 57 | false | 🔴 RED (อ่านทศนิยมถูก → เทียบ 57.3≠57) |
| `mut-percent-divergence` | 0.57 / 0.57 / 57 | false | 🔴 RED (3 จุดไม่ตรงกัน) |

contrast: old regex อ่าน `"0.57%"`→`"57"` → PASS string-compare (บั๊กเดิม) · new อ่าน `0.57`.
full harness `run-tier-gate.ts` รันจริงบน dev :3099 = **all checks passed** (ONE-NUMBER: tile=71 · ring=71 numeric).

ANCHOR: harness/tier-percent.ts#b1-percent-divergence

## ⚠️ สิ่งที่ patch นี้ **ไม่ได้ปิด** (μุน #175 review — สำคัญ)
ตอนแรกผมตั้งชื่อ mutant นี้ว่า `mut-fraction-scale` และเขียนว่าด่าน "certified a scale bug instead of catching
it. Fixed" — **overclaim**. μุน (เจ้าของ harness) จับได้ว่ามันเฝ้า **divergence** (3 จุดไม่ตรงกัน) ไม่ใช่
**scale-leak**. ของจริง UI ผูก 3 จุดกับ `detail.percent` ตัวเดียว (ruling H + ONE-NUMBER บังคับแหล่งเดียว) →
scale รั่วที่แหล่งจะรั่วพร้อมกันทั้ง 3 จุด: `0.57 / 0.57 / 0.57 → agree=true → ด่านเขียว` (μุน + ผมรันยืนยัน).
**ONE-NUMBER เป็น invariant แบบ "ตรงกันไหม" — วัดความผิดของแหล่งที่ตัวมันเปรียบเทียบไม่ได้โดยนิยาม** (บทเรียน
เดียวกับ #171 CLS-delta ที่เขียวทั้งที่กลุ่มหนึ่งแย่ลง 8×). ผม rename tooth เป็น `mut-percent-divergence` ให้ตรง
สิ่งที่มันกัดจริง + assert เคส A2 (0.57/0.57/0.57 → GREEN) ไว้ในเทสต์ เพื่อไม่ให้ใครเข้าใจผิดว่าครอบ scale แล้ว.

**A2 (ยังไม่ปิด, ต้อง invariant คนละตัว): PERCENT-SCALE** — เปอร์เซ็นต์ที่ render ต้องอยู่ในช่วงจริง (ค่าที่แปลว่า
"กำลังดิถี" render < 1 = fraction รั่ว), หรือแน่นกว่า: เทียบเลขจาก API กับเลขบนจอ (คนละชั้น ไม่ใช่จอ-เทียบ-จอ).
μุน เสนอ + จะถือ A2 นี้ (harness ของเขา).

## adversary sign-off
Cross-oracle: harness เป็นของมุน — **μุน (runtime lens) รัน `run-tier-gate.ts` บน branch นี้เอง** ยืนยัน (a) 60/60
เขียวครบ (reader เปลี่ยนเป็น numeric, พฤติกรรมเดิม) (b) readPct ถูกทุกเคส (40.83→40.83 · 61.67→61.67 · 0.57%→0.57).
**μุน จับ overclaim (mut-fraction-scale)** → ผมแก้ถ้อยคำ+rename+A2 ตามที่เขาชี้. ผมไม่ self-certify tooth ของ harness เขา.

## evidence limits
patch แก้ **reader** (อ่านถูก) ไม่ใช่ **จับ scale**. scale-leak สม่ำเสมอ = A2 (PERCENT-SCALE, คนละ invariant).
`check()` count 51→51 static. ไม่แตะ `features/` · `pages/*.tsx` · `DESIGN.md` (git diff).
