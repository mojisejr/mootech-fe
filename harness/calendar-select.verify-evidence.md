# M-A + M-B — กดวันได้ · การ์ดตาม · จอมีสถานะจริง

**มุน 2026-08-06** · branch `feat/ma-day-cell-select` · base `62c5d76`
*(สั้นตามเกณฑ์ใหม่ของบอง 2026-08-06 — ภาพจริง + ผลดิบ ไม่ใช่เรียงความ)*

## ภาพ route จริง @393

| สถานะ | ไฟล์ |
|---|---|
| กำลังโหลด | `harness/out/calendar-state-loading-393.png` |
| แสดงไม่ได้ (ไม่มีวันเกิด) | `harness/out/calendar-state-unavailable-393.png` |
| ใช้งานจริง หลังกดวันที่ 2 | `harness/out/calendar-select-393.png` |

## ผลดิบ

```
npx tsx --tsconfig harness/tsconfig.json harness/run-calendar-select.ts
✅ run-calendar-select — 25 passed, 0 failed

npx tsx scripts/calendar-view-state.test.ts   ✅ 15 assertions
npx tsx scripts/day-cell-style.test.ts        ✅ 31 assertions
scripts/*.test.ts (ทั้งหมด)                    ✅ เขียวหมด
npx tsc --noEmit                               ✅ ไม่มี error
CI-parity build                                ✅ exit 0
```

## proof-of-teeth

ฟันทุกซี่ **รันจริงและเห็นมันกัด** ไม่ใช่แค่ประกาศไว้

| ฟัน | ทำอะไร | ผล |
|---|---|---|
| `mut-skeleton-on-null` | คืน `'loading'` เมื่อ `!month` | ✅ NO-DEAD-SKELETON แดง |
| `mut-empty-while-loading` | คืน `'unavailable'` เมื่อ `!month` | ✅ NO-PREMATURE-EMPTY แดง |
| `mut-loading-wins` | เช็ค `loading` ก่อน `month` | ✅ READY-WINS แดง |
| `mut-dead-skeleton` | เรนเดอร์ skeleton ให้ทุก null month | ✅ SETTLED-EMPTY แดง 3 เช็ค |
| `mut-card-today` | ผูกการ์ดกับ `todayISO` | ✅ CARD-FOLLOWS แดง `cta="ดูรายละเอียดวันนี้"` |
| `mut-cell-link` | ให้เซลล์พาออกหน้าอื่น | ✅ NO-NAVIGATE แดง |

**verify-the-instrument**: ทุกลูป assert ว่ามีของก่อนตัดสิน · เช็คพื้นแซฟไฟร์ assert ก่อนว่าสีที่เลือกกับสีพัก **ต่างกันจริง** (`rgb(20,85,164)` vs `rgb(254,241,224)`) ไม่งั้นเช็คพิกเซลพิสูจน์อะไรไม่ได้

ANCHOR: harness/run-calendar-select.ts#mut-dead-skeleton

## adversary sign-off

**สิ่งที่ผมพยายามหักล้างของตัวเอง** (ไม่ใช่ ✓)

1. **โพรบผิด 2 รอบ ของถูก** — (ก) locator `:not([data-selected])` **re-resolve หลังคลิก** ⇒ ไปถาม element ผิดตัว (ข) วัด focus ring ด้วย `.focus()` **หลังคลิกเมาส์** ⇒ Chromium ไม่ให้ `:focus-visible` **ซ่อมเครื่องมือ ไม่ลดเกณฑ์**
2. **เช็คที่ผมเขียนเองแบบกัดไม่ได้** — มี `|| true` ค้างอยู่ 1 เช็ค **ลบทิ้ง** (โพรบที่ล้มไม่ได้แย่กว่าไม่มีโพรบ เพราะมันรายงานว่าผ่าน)
3. **🔴 2 บั๊กที่ด่านจับไม่ได้ แต่ตาจับได้จากภาพ @393** — จอ "แสดงไม่ได้" ยังวาดโครงปฏิทินเทาเต็มจอ (= ยังสัญญาว่ากำลังมา) · skeleton ไม่มีการ์ดโปรโมแต่ ready มี ⇒ **ของเลื่อนทั้งหน้าตอนเดือนมาถึง** ⇒ แก้โดยให้ทั้งสองสถานะอยู่ใน **กรอบเดียวกัน** จะได้เพี้ยนจากกันไม่ได้
4. **ยังไม่ได้ครอบ** — วัด CLS เป็นตัวเลข (แก้ที่โครงสร้างแทน) · viewport อื่นนอก 393 · เดือนที่มี 5 แถว (skeleton จอง 6) ⇒ **A2 ไม่อ้างว่าครอบ**

## ที่แตะแล้วไม่ใช่ของผม

`harness/run-calendar-flow.ts` — เดิม `click a[href="/v2/calendar/2026-07-15"]`
**เส้นทางเปลี่ยนจริง ไม่ใช่แค่ selector**: กดวันไม่พาไปไหนแล้ว ⇒ assert เส้นทางที่**มีอยู่จริง** (กดแล้วไม่ navigate · CTA การ์ดพาไปวันที่เลือก) และอ่านวันที่จากตารางแทนการ hardcode
`harness/capture-daydetail-g2.ts` — **ตรวจแล้วไม่ต้องแก้** (DayStrip ยังเป็น `<Link>`)
