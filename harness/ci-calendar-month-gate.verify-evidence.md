# ci — ต่อ `run-calendar-month` เข้า design-verify (ด่านที่มีอยู่แต่ไม่มีอะไรรัน)

**PR**: #185 · **branch**: `chore/ci-calendar-month-gate` · **author**: บอง (coordinator)
**แตะไฟล์เดียว**: `.github/workflows/design-verify.yml`

ANCHOR: harness/run-calendar-month.ts#mut-hardcode-tier

---

## ปัญหา — พิสูจน์ด้วย grep ไม่ใช่ความรู้สึก

`harness/run-calendar-month.ts` มีอยู่มาหลายสัปดาห์ **โดยไม่มีอะไรเรียกมันเลย**

```
$ grep -rn "run-calendar-month" --include="*.ts" --include="*.json" --include="*.yml" . | grep -v node_modules
harness/run-calendar-month.ts:1:   // (ตัวไฟล์เอง)
harness/run-calendar-month.ts:11:  // npx tsx harness/run-calendar-month.ts   (คำสั่งในคอมเมนต์)
harness/bug-ledger/calendar-fidelity.json:  (อ้าง path ใน field "anchor" — ไม่ใช่ตัวรัน)
```
- `harness/run.ts` → ไม่ import
- `package.json` scripts → ไม่มี
- `.github/workflows/**` → ไม่มี

⇒ ประโยค **"หน้าปฏิทินมีด่าน browser คุ้มอยู่"** ในทางปฏิบัติแปลว่า **"ไม่มีด่านคุ้ม"**
รูปแบบเดียวกับ **#179** (anchor ของหน้าบริการแดงค้างเป็นสัปดาห์โดยไม่มีใครรู้)

---

## ทำไมต่อแค่ตัวเดียว — วัดก่อน ไม่ได้หวัง

μุน รัน anchor ปฏิทินทั้ง 3 ตัวบน `main fd41e02` **ก่อนแตะอะไร**:

| anchor | ผล | สาเหตุ |
|---|---|---|
| `run-calendar-month` | 🟢 **PASSED** | no-app-fetch 0 · tier-fidelity 31/31 cells · selected+marker = 1 sapphire + 2 วันพระ ring · no-overflow 320/360/393 |
| `run-calendar-day` | 🔴 FAIL (4) | ล็อกอินด้วย passkey อย่างเดียว **ไม่เคยเป็น paid user** → tier gate ซ่อน toggle/compat/insight/predictions ที่ด่าน assert (regression ตกค้างจาก #171) |
| `run-calendar-fidelity` | 🔴 ERROR | สาเหตุเดียวกัน — day cell เป็น HIDDEN ตอน `isPaid` ยัง `null` |

⇒ ใบนี้ต่อ **เฉพาะตัวเขียว** · 2 ตัวแดงเป็น regression ที่รู้สาเหตุแล้ว → ใบซ่อมของมันเอง (μุน รับ)
⇒ ถ้าต่อตัวแดงตอนนี้ **ทุก PR ที่เปิดอยู่จะถูกบล็อกด้วยความผิดที่ไม่ใช่ของเจ้าของใบ**

---

## proof-of-teeth

ด่านนี้ **มีฟันอยู่แล้ว และฟันยังกัด** — ไม่ใช่ด่านที่ผ่านเพราะไม่ตรวจอะไร

```
mutant: mut-hardcode-tier   →  CAUGHT ✅
```
(มุตันฝัง tier tint แบบตายตัวแทนที่จะอ่านจาก `DAY_CELL_COLORS` — ด่านจับได้ ไม่ปล่อยผ่าน)

และมันตรวจ invariant ที่เป็น **ขาตั้งของการตัดสินใจใน #184** ด้วย:
```
selected+marker:  1 sapphire-filled cell (today in view) · 2 วันพระ rings
```
⇒ กฎ *"ช่องของวันที่เลือกต้องเป็นแซฟไฟร์ ไม่ใช่สี tier"* ถูกยืนยันบนจอจริง

**ฟันของ *ใบนี้เอง* (ว่าการต่อสายมีผลจริง ไม่ใช่ทำเฉยๆ)**:
`MCODE` เข้าเงื่อนไขปิดท้ายของ step — job จะแดงถ้า anchor ตัวนี้แดง
```yaml
[ "$CODE" -eq 0 ] && [ "$PCODE" -eq 0 ] && [ "$MCODE" -eq 0 ]
```
❌ ถ้าลืมข้อสุดท้าย = ต่อสายแล้วผลไม่ถูกใช้ = เขียวเงียบแบบเดียวกับที่ใบนี้พยายามฆ่า

**หลักฐานว่ามันรันจริงใน CI ไม่ใช่แค่บนเครื่อง μุน**: job `splash-harness` ของ PR นี้เอง
(ใบนี้แตะ `design-verify.yml` ซึ่งอยู่ใน `paths:` ของตัวเอง ⇒ workflow รันบนใบนี้)

---

## ของที่บันทึกไว้ให้ใบซ่อม — vacuous pass (ไม่ได้แก้ในใบนี้)

`run-calendar-day` รายงาน `✓ badge bg == accent (all grades)` **ทั้งที่ `count=0`**

```
loop ที่ไม่มีสมาชิก ไม่เคย fail
⇒ เขียวเพราะไม่มีอะไรให้ตรวจ ไม่ใช่เพราะถูก
```

ตระกูลเดียวกับ empty-ledger green ที่ฆ่าไปใน **#180** (`data.length === 0` → refuse to pass)
⇒ ใบซ่อมต้องแก้ **เป็นกฎ** ไม่ใช่จุดเดียว: *assertion ที่วนของ ต้อง assert ก่อนว่ามีของ*

---

## adversary sign-off

**สิ่งที่ผมพยายามหักล้างใบตัวเอง:**

1. *"ต่อแล้วจะบล็อกทีมไหม"* → ไม่ ตัวที่ต่อเขียวบน `main fd41e02` (μุน วัดมา) และ job นี้แดงได้เฉพาะเมื่อ anchor แดงจริง
2. *"บูต server เพิ่มไหม / job ช้าลงเท่าไร"* → ไม่บูตเพิ่ม ใช้ `next start -p 3000` ตัวเดิมใน step เดียวกัน เพิ่มแค่เวลารัน anchor
3. *"ทำให้ด่านเดิมอ่อนลงไหม"* → ไม่ `CODE`/`PCODE` คงเดิมทุกตัว เพิ่ม `MCODE` เข้าเงื่อนไข `&&` ⇒ เข้มขึ้นอย่างเดียว
4. *"แตะ job อื่นไหม"* → ไม่ ❌ ไม่แตะ `ci.yml` ❌ ไม่แตะ `main-guard.yml` ❌ ไม่แตะ job `provenance`
5. *"ถ้า anchor นี้ flaky ล่ะ"* → ความเสี่ยงจริงที่ยังไม่พิสูจน์ — มันเพิ่งถูกรันครั้งแรกในรอบหลายสัปดาห์
   ⇒ **เปิดเผยตรงๆ**: ถ้าเจอ flake ให้ถอดออกได้ทันที (revert ไฟล์เดียว) ❌ ไม่ต้องรื้ออะไร

**ยังไม่ได้พิสูจน์ (พูดตรงๆ ไม่ทำให้ดูเสร็จเกินจริง):**
- ❓ anchor นี้เขียวบน CI runner (ubuntu + production build) หรือเขียวเฉพาะเครื่อง μุน (dev) — **หน้า checks ของ PR นี้คือคำตอบ**
- ❓ 2 anchor ที่แดงจะซ่อมได้ด้วยแพตช์เดียวกันจริงไหม — เป็นสมมติฐานของ μุน ยังไม่ทดสอบ

**reviewer**: ตู๋ (ขอไปแล้ว) — จุดที่ขอให้เพ่ง: ต่อแค่ตัวเขียวถูกต้องไหม · `MCODE` เข้าเงื่อนไข fail ครบไหม ไม่ทำให้ job ผ่านเงียบ
