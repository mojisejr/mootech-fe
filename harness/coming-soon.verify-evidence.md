# ปุ่มที่กดไม่ได้ 5 จุด → **กดแล้วตอบ "เร็วๆ นี้"** (ฟีมเคาะแบบ ก)

**มุน 2026-08-06** · branch `feat/coming-soon-buttons` · base `4f686c7` *(แตกจาก main ตรง ไม่ซ้อน #190)*

## ภาพ route จริง @393
`harness/out/coming-soon-upsell-393.png` · `coming-soon-upgrade-393.png` · `coming-soon-loading-cta-393.png`

## ผลดิบ
```
harness/capture-coming-soon.ts   ✅ 14 passed, 0 failed
  อัพเกรด pill : <button> · ตอบ "ระบบสมาชิกกำลังจะมา เร็วๆ นี้" · หายเอง
  avatar       : <button> · ตอบ "โปรไฟล์กำลังจะมา เร็วๆ นี้"    · หายเอง
  upsell CTA   : <button> · ตอบ "ระบบสมาชิกกำลังจะมา เร็วๆ นี้" · หายเอง
  loading CTA  : "กำลังโหลด…" + disabled (เดิมเป็นปุ่มเปล่าไม่มีตัวอักษร)
tsc ✅  ·  scripts ทั้งหมด ✅  ·  CI-parity build ✅ exit 0  ·  D2 ledger ✅ PASSED
```

## proof-of-teeth
ใบนี้**ไม่ได้เพิ่มด่านถาวร** ตามเกณฑ์ใหม่ — สิ่งที่ภาพหน้าจอพิสูจน์ไม่ได้คือ **"กดแล้วมีอะไรเกิดขึ้นไหม"** จึงกดจริงแล้วอ่านผล
**verify-the-instrument**: ทุกตัว assert ว่า **element มีอยู่จริง** ก่อน แล้วจึง assert ว่าเป็น `<button>` ไม่ใช่ `<span>` ที่ทาสีไว้ · และ assert ว่า**คำตอบหายเอง** — คำเตือนที่ค้างจะกลายเป็นเฟอร์นิเจอร์

ANCHOR: harness/capture-coming-soon.ts#coming-soon-toast

## adversary sign-off

1. **🔴 เกือบพัง `notifications` ด้วยมือตัวเอง** — เขียน loading state เป็น `!ctaLabel` ซึ่ง**กิน `undefined` ด้วย**
   `/v2/calendar/notifications` ส่ง state `saved` โดยไม่ส่ง label ⇒ จะเสีย `✓ คุณบันทึกลงปฏิทินแล้ว` กลายเป็นปุ่ม disabled "กำลังโหลด…"
   ⇒ **`''` กับ `undefined` คนละความหมาย** — เฉพาะสตริงว่างที่ตั้งใจส่งเท่านั้นคือสัญญาณกำลังโหลด
   *(ตระกูลเดียวกับที่ตู๋ทักในใบ 2: เงื่อนไขที่ "ดูใจกว้าง" แล้วกลืนเคสอื่นไปเงียบๆ)*
2. **ปุ่มโหลดไม่ใช่เคส "เร็วๆ นี้"** — action มีจริง แค่ยังไม่พร้อมไม่กี่ร้อยมิลลิวินาที ⇒ **บอกตรงๆ แล้ว disabled** ไม่ใช่แกล้งรับการกด
3. **จุดที่ 5 ตรวจแล้วไม่แตะ** — ลูกศร DayStrip ขอบเดือนเป็น `aria-hidden` + opacity 40% อยู่แล้ว = **disabled ที่ซื่อสัตย์ ไม่ใช่ปุ่มตาย**
4. **ยังไม่ครอบ (A2)** — ไม่ได้ไล่ทั้งแอป ครอบเฉพาะ 5 จุดที่ฟีมระบุ · หน้า service/home อาจมีทรงเดียวกันอีก **ไม่อ้างว่าครอบ**
