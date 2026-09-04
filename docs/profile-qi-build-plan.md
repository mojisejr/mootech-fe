# Build Plan — Profile v2 + Qi ระบบเต็ม (จาก Figma หน้า "- profile")

> แหล่ง design: Figma "Mumate app_ final" → หน้า **"- profile"** (~45 เฟรม อ่านรายชื่อครบ 2026-09-03)
> สถานะโค้ด ณ วางแผน: QiScreen (bffc526/70f602d) ครอบ qi-guide บางส่วน + referral บางส่วน ·
> AccountScreen (#365, ไม่มี design เดิม — ตอนนี้มี design แล้ว) · ลบบัญชี 1 หน้า (70b8d76) ·
> deep link /invite + ช่องโค้ดบนหน้าสมัคร (4583e68/ca7facc)

## ✅ Reskin ตาม Figma จริง 2026-09-04 — ปิด gap ภาษาภาพทั้งคลัสเตอร์

เปิด Figma จริงผ่าน Browser Use (screen reader ของ Figma ยังเปิดค้างในบัญชี mootech co) เทียบรายเฟรม
แล้ว reskin ทั้งคลัสเตอร์ "หน้า - profile" ด้วย design kit ใหม่ `features/v2-profile/components/kit.tsx`
(SkyBackdrop BG01 · SkyHeader ลูกศร+ชื่อน้ำเงินหนา ไม่มี badge · SectionCard มุมมน 24 · MenuRow ไอคอนไทล์
+ ค่าปัจจุบันทางขวา · QuickAction · CoinStack จาก coin.png แทน 🪙 ที่เป็นกล่องโหว่บน Windows):

- โปรไฟล์ = เฟรม profile-and-qi-wallet: hero ชี่+มาสคอต+ปุ่มเติมชี่ → quick actions 4 → แผน+มงกุฎ →
  เมนู 9 แถวไอคอนไทล์ (ย้ายประวัติซื้อออกไป /v2/orders เต็มที่ตามเฟรม; fangs #365 ย้ายตามไป
  orders-screen + mount test เขียนใหม่เป็นสัญญาของ hero ชี่)
- ชี่ = qi-guide: hero น้ำเงิน 28px เหรียญใหญ่ + แถบ XP progress + แถวสะสมเป็นไอคอนไทล์
- เติมชี่ = buy-qi: แบนเนอร์โบนัสไล่สี + การ์ดใหญ่ 3 ใบกองเหรียญ + badge คุ้มที่สุด (QI_1200)
- เช็คอิน = check-in states: hero สตรีค + strip เหรียญทอง ✓/ขอบวันนี้/เทาอนาคต
- settings = settings — UX v2: การ์ดโปรไฟล์บนสุด + แถวไอคอน + ค่าปัจจุบัน (ภาษา ไทย / ขนาด ปกติ)
- ชวนเพื่อน = referral - hub: โค้ดใหญ่ + ปุ่ม LINE เขียวเด่น + 3 ขั้นตอน + สถิติ + preview + ใช้โค้ด
- จอย่อยอีก 12 (edit×2/connected/plan/orders×2/notifications/consent/export/faq/doc/delete) สลับ
  เป็น Sky ทั้งชุด — ถอนออกจาก SCREENS ของ header-tier-badge (21→7) พร้อมฟันกันการย้อนกลับ

บั๊กที่แก้พร้อมกัน: ประวัติชี่แปลง `qi:spend:birth_edit`→"แลก แก้วันเกิด" + `qi:buy:QI_N`→"ซื้อแพ็กชี่ N ชี่"
· checkout แพ็กชี่โชว์ "แพ็กชี่ 200 ชี่" + "ชี่เข้าบัญชีทันทีหลังชำระเงินสำเร็จ" แทนโค้ดดิบ/อายุ 1 ปี

ตรวจ: tsc สะอาด · lint = baseline · ชุดเกี่ยว 116 เคสเขียว · ชุดเต็ม 1,391 ผ่าน (แดง 9 เดิม + flake #526
ที่รันเดี่ยวเขียว) · ถ่ายเทียบ browser ครบ 6 จอหลัก + checkout ตามจริง

## ✅ สถานะ 2026-09-03 (ปิดวัน) — ทำครบ 6 ก้อน เชื่อม engine pdf-dev ทุกเฟรมในลิสต์

**FE commits:** eb380cd (เฟส 1) · 8c883f0 (เฟส 2) · 7799a52 (เฟส 3-4) — บน feat/mumate-ai-chat ·
**Engine commits:** 4ae4879 (grant+referral) · 6176086 (profile+โควตา) · 65c84a4 (privacy+ลบบัญชี) — บน pdf-dev

**ทำเสร็จรอบนี้ (ต่อจากก้อน 1/5.1 ช่วงเช้า):**
- เฟรม buy-qi ×2: ราง Omise v2 เดิม (QI_200/500/1200 ราคาชั่วคราว 59/129/299 — migration 0016) +
  settle เลน QI → engine /api/qi/grant (secret QI_GRANT_SECRET, idempotent by charge_id,
  first_buy_bonus +30, referral trigger) + /v2/qi/buy + result กลับ /v2/qi
- เฟรม check-in — states: /v2/qi/checkin (strip 7 วันเขตไทย + สตรีค)
- เฟรม invite-landing + share-code in LINE: /invite landing จริง (inviterName, ยอมรับ→localStorage)
  + LINE preview บน hub + engine GET /api/referral?code=
- เฟรม profile-and-qi-wallet + day one: /v2/account restyle (hero ชี่ + day-one + แถวครบ)
- เฟรม my-plan / order-history / order-receipt: /v2/account/plan · /v2/orders · /v2/orders/[id]
- เฟรม edit-personal-info / edit-birth-data ×4: engine 0041 (profile เต็ม+โควตาฟรี 1 ครั้ง+
  correction request) + /v2/settings/edit-profile · /v2/settings/edit-birth (409→ชีตชี่ไม่พอ)
- เฟรม account-login — connected: /v2/settings/connected (session provider + @name)
- เฟรม settings ×6: settings UX v2 (แถวครบ) + ชีตภาษา/ขนาดตัวอักษร (zoom ทั้งแอป) + logout sheet +
  settings-notifications (prefs 3 หมวด — engine 0042) 
- เฟรม privacy-consent / privacy-data-export / help-faq / document-reader: /v2/privacy/consent
  (บันทึก insert-only) · /v2/privacy/data-export (ดาวน์โหลด JSON จริง — engine /api/account/export) ·
  /v2/help/faq + /v2/help/doc/[slug] (bazi_help_article seed 5 บทความ)
- เฟรมลบบัญชี ×6: flow 4 ขั้นจริง (what-you-lose → alternatives → pending 30 วัน ยกเลิกได้ →
  feedback sheet) + banner บน account — engine /api/account/delete + cron /api/cron/account-purge
- เฟรม empty-states / loading & error: ProfileGate + สถานะครบทุกจอใหม่ (loading/error/empty แยกจริง)

**ทดสอบ:** เทสต์ใหม่ทั้งหมด ~60 เคส (รวมเช้า) · ชุดเต็ม 1,395 ผ่าน แดง 9 = แดงเดิมของ branch ทุกตัว
(พิสูจน์ด้วย stash แล้ว: charge-status/compat-readers×4/compat-tier-quota/consent-header/evidence-dir/public-env)
· E2E จริงผ่าน dev server สองฝั่ง: earn/spend/grant(230→730)/409/โควตาแก้วันเกิด(free→100 ชี่)/
consent/prefs/delete(POST→GET→cancel)/export/faq ผ่านทุกเส้น · tsc สะอาด · lint baseline

**ของที่รอต่อ (ไม่ใช่งานโค้ดขาด):**
- 🔴 Figma visual parity รอบละเอียด: โครง/ข้อมูล/flow ตรงตามเฟรมแล้ว แต่การวางแบบละเอียด (ระยะ/
  ไอคอน/สำเนาเป๊ะ) ต้องเปิด Figma (Browser Use — MCP ยังตาย DCR 403) เทียบทีละเฟรมอีกรอบ
- 🔴 ราคาแพ็กชี่ 59/129/299 เป็นค่าชั่วคราว — ทีมเคาะแล้วแก้ที่ payment_package ได้เลย
- 🔴 purge ฝั่ง mootech-be (ข้อมูลสมาชิก v1) ยังไม่ถูกล้างตอนลบบัญชี — รอทีม BE
- ⏳ 2C2P migration (มีตติ้ง) · LINE LIFF — งานใหญ่แยกตามเดิม

---

## สถานะช่วงเช้า (ก้อน 1 + 5.1) — เชื่อม BFF → engine ครบ 7 เส้น

**เชื่อม BFF → engine ครบ 7 เส้น** (engine ยังเป็นที่มาเดียวของความจริง — จอไม่ hardcode ตัวเลข):
`/api/qi-wallet` (+`?history=` 100) · `/api/qi-earn` · **`/api/qi-spend` (ใหม่)** ·
**`/api/qi-catalog` (ใหม่)** · **`/api/qi-entitlements` (ใหม่)** · **`/api/missions` (ใหม่)** · `/api/referral`

**หน้าจอใหม่/อัปเดต:**
- 1.1 ✅ QiScreen รอบใหม่: แถวสะสม/แถวแลกสิทธิ์เรียงตาม catalog engine + ป้าย tier/เครดิตคงเหลือ
  (figma-parity: `qi-guide - UX v2` ยังรออ่านเฟรมล่าสุด — โครง/ลำดับอาจขยับตาม design)
- 1.2 ✅ `/v2/qi/missions` บอร์ดภารกิจ (กระจกของ GET /api/missions; ครบเป้า engine จ่ายเอง)
- 1.3 ✅ `/v2/qi/history` ประวัติเต็ม 100 แถว + แปลง reason เป็นไทย (qi-model.ts)
- 1.4 ✅ เช็คอินรายวันบน QiScreen — สถานะ "เช็คอินแล้ววันนี้" อ่านจากประวัติเขต Asia/Bangkok
- 1.5 ✅ ชีต "ยืนยันใช้ N ชี่" + "ชี่ไม่พอ (ขาอีก N)" — 409 จาก engine → ชีตไม่พอ + reload ยอดจริง
- 1.6 ✅ (ทำแล้วตอนบ่าย — ดูสถานะปิดวันด้านบน): ซื้อชี่ผ่านราง Omise v2 + engine /api/qi/grant
- 5.1 ✅ `/v2/qi/referral` hub เต็ม: โค้ด+คัดลอก+แชร์ LINE (/invite/<code>) + นับเพื่อน + แถวโบนัส + ใช้โค้ด

**ทดสอบ:** เทสต์ใหม่ 26 เคส (qi-model/missions-screen/qi-history-screen/qi-screen/referral-hub)
· E2E จริงผ่าน dev server: earn(+5/+10) → wallet → spend 200 grant card_use=1 → spend 409 ไม่พอ
· BFF ไม่มีตัวตน 401 ทุกเส้น · หน้าใหม่ 307 เด้ง gate เหมือนหน้า v2 เดิมทุกประการ

**ค้างรอ (เดิม):** ก้อน 2 (ลบบัญชี 4 ขั้น — UI ล้วนรอ DELETE /user) · ก้อน 3 (3.4 นับสิทธิ์แก้วันเกิด ·
3.5) · ก้อน 4 · ก้อน 6 states กลาง · 1.6 · figma-parity ทุกเฟรมที่สร้างจากลิสต์ชื่อ (Figma MCP ยังตาย — DCR 403)


## รายการเฟรม design ครบตามที่อ่านได้ (45)

**Profile core:** profile-and-qi-wallet — UX v2 · profile — day one (0 QI) · my-plan ·
edit-personal-info · edit-birth-data (+ quota used + correction request sheet) · edit-birth-data — quota states ·
account-login — connected
**Settings:** settings — UX v2 · settings — sheets & dialogs · settings-logout-dialog ·
settings-text-size-sheet · settings-language-sheet · settings-notifications
**Qi:** qi-guide - UX v2 · missions — all · qi-history — all · check-in — reward moments ·
check-in — states ×2 · buy-qi — select pack · buy-qi — success · insufficient-qi-sheet · spend-confirm-sheet
**Referral:** referral - hub · share-code to friend · share-code — what the friend sees in LINE ·
invite-landing — friend opens the link
**ลบบัญชี:** delete-01-what-you-lose · delete-02-alternatives · delete-04-pending-recovery ·
delete-05b-feedback-optional (แนะนำ) · account-deletion — missing states
**Privacy/help:** privacy-consent · privacy-data-export · help-faq · document-reader — template
**Orders:** order-history · order-receipt
**States:** loading & error states · empty-states — all screens

## แผนแบ่งเป็น 6 ก้อน (เรียงตามคุณค่าต่อ launch)

### ก้อน 1 — Qi ครบวงจร (ต่อยอด QiScreen เดิม · engine พร้อมหมด)
| # | งาน | เฟรม | ข้อมูล |
|---|---|---|---|
| 1.1 | อัปเดตจอพลังชี่ให้ตรง design ล่าสุด | qi-guide - UX v2 | มี (/api/qi/*) |
| 1.2 | หน้าภารกิจเต็ม (แยกจากแถวย่อ) | missions — all | /api/missions |
| 1.3 | หน้าประวัติชี่เต็ม (แยกจาก "เคลื่อนไหวล่าสุด") | qi-history — all | wallet.history |
| 1.4 | เช็คอินรายวัน + สถานะ | check-in — reward moments/states | /api/qi/earn daily_login |
| 1.5 | ชีต "ชี่ไม่พอ" + "ยืนยันใช้ 30 QI" | insufficient-qi-sheet, spend-confirm-sheet | /api/qi/spend (ผูกปลดล็อคบท) |
| 1.6 | ซื้อชี่ (แพ็ก+สำเร็จ) | buy-qi — select pack/success | ผูก shop/payment |

### ก้อน 2 — ลบบัญชีครบ 4 ขั้น (มีของแล้ว 1 หน้า — อัปเกรด)
| # | งาน | เฟรม |
|---|---|---|
| 2.1 | ขั้น 1 สิ่งที่จะหาย (มีแล้ว) + ขั้น 2 ทางเลือกก่อนลบ | delete-01 / delete-02-alternatives |
| 2.2 | ขั้น pending-recovery (พัก 30 วัน + ยกเลิกได้) | delete-04-pending-recovery |
| 2.3 | ขั้น feedback (แนะนำ) + missing states | delete-05b-feedback-optional / account-deletion — missing states |
| 2.4 | ขาหลัง: DELETE /user + soft-delete 30 วัน (mootech-be) | 🔴 รอทีม BE |

### ก้อน 3 — Profile v2 ตาม design (แทน/ต่อยอด สิทธิ์ของฉัน)
| # | งาน | เฟรม | หมายเหตุ |
|---|---|---|---|
| 3.1 | หน้าโปรไฟล์ใหม่ (wallet + plan ในหน้าเดียว) | profile-and-qi-wallet — UX v2 · profile — day one (0 QI) | state "day one 0 QI" = มือใหม่ |
| 3.2 | แผนของฉัน + ประวัติสั่งซื้อ + ใบเสร็จ | my-plan · order-history · order-receipt | v1 มี order-history อยู่แล้ว ย้าย/แต่ง v2 |
| 3.3 | แก้ข้อมูลส่วนตัว | edit-personal-info | |
| 3.4 | แก้วันเกิด 1 ครั้งฟรี (ครบชุด state) | edit-birth-data ×4 | 🔴 ต้องมีขาหลังนับสิทธิ์ |
| 3.5 | ช่องทางล็อกอินที่เชื่อมต่ออยู่ | account-login — connected | |

### ก้อน 4 — Settings & Privacy
| # | งาน | เฟรม |
|---|---|---|
| 4.1 | หน้าตั้งค่าหลัก + ชีตทั้งหมด | settings — UX v2 / sheets & dialogs / logout-dialog |
| 4.2 | ขนาดตัวอักษร / ภาษา / การแจ้งเตือน | text-size-sheet / language-sheet / settings-notifications |
| 4.3 | PDPA: ความยินยอม / ส่งออกข้อมูล / คำถามที่พบบ่อย / อ่านเอกสาร | privacy-consent / privacy-data-export / help-faq / document-reader — template |

### ก้อน 5 — Referral เต็มรูป (มีของแล้วครึ่งหนึ่ง)
| # | งาน | เฟรม |
|---|---|---|
| 5.1 | หน้า referral hub เต็ม (แยกจากแถวใน QiScreen) | referral - hub |
| 5.2 | หน้าที่เพื่อนเห็นจากลิงก์ (แชร์ผ่าน LINE) | share-code to friend · share-code in LINE · invite-landing |
| — | deep link /invite มีแล้ว (4583e68) — ต่อยอดให้ตรง design | |

### ก้อน 6 — States กลาง (ทำควบคู่ทุกก้อน)
- loading & error states · empty-states — all screens → เฟรมมาตรฐานให้ทุกหน้าใหม่ใช้ซ้ำ

## ลำดับที่เสนอ (เริ่มได้ทันทีไม่ติดขาหลัง)
ก้อน 1 (Qi) → ก้อน 5 (Referral) → ก้อน 3.1-3.3 + 4.1 (Profile/Settings หน้าจอ) → ก้อน 6 →
ก้อน 2 ทำ UI ล้วนรอขาหลัง → ก้อน 3.4/3.5 รอขาหลังเช่นกัน

## ของที่ต้องขอ/รอ
- ฟีม/BE: นับสิทธิ์แก้วันเกิด 1 ครั้งฟรี (ตาราง+endpoint) · DELETE /user soft-delete 30 วัน ·
  Supabase dev restore (ปลดล็อก save เพื่อน — จากการทดสอบ 2026-09-03)
- อ่าน design ละเอียดรายเฟรม "ตอนจะสร้าง" ตามธรรมเนียม (ไม่อ่านรวดเดียวก่อน — เพราะเฟรมอัปเดตบ่อย)
