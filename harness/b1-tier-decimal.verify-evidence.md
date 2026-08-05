# verify-evidence — B-1 ONE-NUMBER reader reads decimals (harness = μุน's tool)

goo · 2026-08-05 · Track B · แตะ `harness/run-tier-gate.ts` (เครื่องมือของมุน) — ขอ ตู๋ ตรวจจุดนี้เป็นพิเศษ.

ค่าจริงบนสายเป็นทศนิยม (man-vs-day 40.83·61.67). regex เดิม `/(\d+)%/` อ่านแค่จำนวนเต็มก่อน `%` →
`"0.57%"`→`"57"` (fraction-scale หลุด อ่านเป็น 57 ตรงกับ ring `"57%"` → ด่านเขียวรับรองบั๊ก). แยก reader
เป็น `harness/tier-percent.ts` (side-effect-free — run-tier-gate เรียก main() เองตอน import) · decimal-aware ·
เทียบเป็นตัวเลข. ONE-NUMBER 2 assertion ความหมายเดิมเป๊ะ, check() count 51→51.

## proof-of-teeth
สอง scale-mutant ต้องทำให้ ONE-NUMBER แดง; clean เขียว (`scripts/tier-percent.test.ts`, รันจริง):

| case | tile/sentence/ring | agree | ผล |
|---|---|---|---|
| CLEAN | 57.3 / 57.3 / 57.3 | true | 🟢 GREEN |
| `mut-decimal-percent` | 57.3 / 57.3 / 57 | false | 🔴 RED (caught) |
| `mut-fraction-scale` | 0.57 / 0.57 / 57 | false | 🔴 RED (caught) |

contrast: old regex อ่าน `"0.57%"`→`"57"` (จึง PASS string-compare = บั๊กเดิม) · new อ่าน `0.57`.
full harness `run-tier-gate.ts` รันจริงบน dev :3099 = **all checks passed** (ONE-NUMBER: tile=71 sentence=71 · ring=71 tile=71).

ANCHOR: harness/tier-percent.ts#b1-fraction-scale

## adversary sign-off
Cross-oracle: harness เป็นเครื่องมือของมุน — μุน (runtime lens) รัน `run-tier-gate.ts` บน branch นี้ยืนยัน (a) 60/60 เขียวครบ (พฤติกรรมเดิม, reader เปลี่ยนเป็น numeric) (b) `mut-decimal-percent`/`mut-fraction-scale` แดงจริงในด่านเต็ม. จุดโจมตี: (ก) assertion เดิมเปลี่ยนความหมายไหม — ไม่ (ชื่อ+ตรรกะ tile==sentence·ring==tile คงเดิม, เปลี่ยนแค่ reader/compare, diff แนบ) (ข) `readPct` กับค่าจริงจาก render (integer หลังมุนปัด) ยัง agree — full harness ยืนยัน tile=71 numeric.

## evidence limits
มุนเป็นเจ้าของ harness — ผมไม่ self-certify การกัดของ mutant ในด่านเต็ม (unit-proved ที่ logic ตรงจุด assertion + full harness เขียว). `check()` count 51→51 พิสูจน์ static. ไม่แตะ `features/` · `pages/*.tsx` · `DESIGN.md` (git diff).
