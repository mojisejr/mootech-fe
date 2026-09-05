# Parity Tracker — Profile + QI (กอง A) — 2026-09-05

> เทียบ Figma (`g2tyfcBQNU7CNlHBxQr3PL`, page `- profile`) × โค้ดจริง branch `feat/figma-parity-profile-qi`
> Verdict: **M** ตรง · **C** ต่างผิว/คำ · **S** ต่างโครง · **BE** = ติด backend (in scope ตาม memory)
> วิธี: sweep ด้วย 4 read-only agent (get_screenshot ทุกเฟรม + อ่าน component). audit table เดิม (09-04) stale แล้ว — นี่คือผลสด 09-05.

## ✅ แก้แล้วรอบนี้ (2026-09-05)

| จุด | ไฟล์ | สิ่งที่แก้ |
|---|---|---|
| #1 การ์ด radius | AccountScreen | 20px→24px ทั้ง 6 การ์ด (kit/global standard) |
| 🔴 invite รางวัลผิด | pages/invite/[code].tsx | `+100/+250 เหรียญ` → `+30/+50 QI` (referee/inviter) + คำว่า "ชี่"→"QI" — **บั๊ก correctness** |
| day-one checkin | AccountScreen | header "0/7"→"เริ่มสัปดาห์แรก" เมื่อ streak=0; ช่องวันนี้ label "วันนี้" |
| day-one friends 0 | AccountScreen | ซ่อน avatar stack + copy "สะสมเพื่อนให้ครบ 5 ธาตุ / ชวนเพื่อนคนแรก รับ 50 QI" |
| day-one activity empty | AccountScreen | เพิ่มการ์ด empty "ยังไม่มีความเคลื่อนไหว…" (เดิมซ่อนทั้ง section) |
| settings logout dialog | settings/index | title "ออกจากระบบ?" กลาง + ปุ่มแนวนอน ยกเลิก\|ออกจากระบบ + inject qi ในเนื้อ |
| settings language sheet | settings/index | flat rows + check ✓ (แทน pill) + grab handle + helper |
| settings text-size sheet | settings/index | preview card สด + rows ขนาดจริง + check (แทน grid 4 ช่อง) |
| edit-profile วันเกิด | EditProfileScreen | ISO ดิบ → วันที่ไทย "15 ม.ค. 2527, 09:30 น." (helper thaiBirthLabel) |

| **chunk 1 (v2-qi)** | | |
| insufficient-sheet | QiScreen/QiSpendSheets | dead code แก้ — ส่ง hints (checkinQi/shareQi) → pills +5/+10 ขึ้น |
| buy-qi | QiBuyScreen | balance card เป็น link+chevron, "โบนัส"→"แถม", pack radius 18→24 |
| checkin | QiCheckinScreen | banner day-count, toast 2 บรรทัด+coin+"อีก N วันรับ +30", celebration 7✓ strip |
| **chunk 2** | | |
| delete-account | delete-account.tsx | rewrite: countdown circle + value/restore preview (guarded) + 4 alternatives (export/consent/notif/faq) + reason checklist 6 ข้อ + refund warning + radius 24 |

tsc: ✅ สะอาด · เทสต์จอที่แก้ ✅ เขียว (อัปเดต 2 เทสต์ค่าเก่า)
| **chunk 3 (settings-privacy)** | | |
| FAQ | FaqScreen | header "คำถามที่พบบ่อย" + search bar + no-match state + contact CTA (LINE) + radius 24 |
| doc-reader | DocReaderScreen | header = doc title จริง + CTA ล่าง (ยินยอม/แชร์) + radius 24 |
| notifications | NotificationsScreen | group "พลังชี่และเพื่อน", "QI ใกล้หมด" sub "น้อยกว่า 30 QI", radius 24 |
| **chunk 4 (orders + gate)** | | |
| orders refund | OrdersScreen | statusWord เพิ่มเคส "คืนเงินแล้ว" (pink pill) |
| order-receipt | OrderReceiptScreen | primary "ส่งใบเสร็จอีกครั้ง" (ยิง endpoint + fallback honest) + refund pill |
| ProfileGate | ProfileGate | error state เพิ่มไอคอน + "แจ้งปัญหาทาง LINE" + radius 24 |

tsc ✅ · เทสต์รวม **85 เคส (13 ไฟล์) เขียวหมด**
**Browser verify (dev):** ✅ account day-one · settings text-size · delete-account · FAQ (header/search/CTA) · buy-qi ("แถม"+ราคา+chevron+balance) — เรนเดอร์ตรง Figma

| **chunk 5** | | |
| buy-qi success | QiBuySuccess (ใหม่) + result.tsx | จอ success เฉพาะ QI: ยอดใหม่+delta pill+usage+ใบเสร็จย่อ+copy "เติม QI สำเร็จ"/"ถามเซียนมูเลย" (คง ResultScreen สำหรับ fail states ที่ audited); fix qiLine "ชี่"→"QI" |

tsc ✅ · result/catalog tests เขียว (58 เคส)

| **chunk 6 — DataExport (FE+BE scaffold)** | | |
| engine | bazi-sft-dataset: schema+0044 migration+route POST/GET?status | table `bazi_data_export_request` (applied on dev DB) · POST บันทึกคำขอ status=collecting (202, `emailPipelineReady:false`) · GET?status คืนคำขอล่าสุด · **email-send = TODO flag (รอ provider) ไม่ fake ว่าส่งแล้ว** |
| BFF | pages/api/account-export.ts | POST proxy + GET?status |
| FE | DataExportScreen | rebuild async-email: intro + info 4 bullets + meta (ส่งไปที่/JSON+CSV/ภายใน 30 วัน) + no-email notice + status "กำลังรวบรวม" (ไม่บอกว่าส่งแล้ว) |

tsc ✅ · settings-privacy tests อัปเดต+เขียว · engine POST/status ทดสอบจริงผ่าน (:3002) · browser ✅

| **chunk 7 — qi-guide + micro-copy** | | |
| qi-guide | QiScreen | hero copy → Figma ("คู่มือสะสมและใช้พลังชี่" + subtitle) · comparison "ทางไหนคุ้มกับคุณ" → stacked list + badge "คุ้มสุด" |
| missions/account | MissionsScreen, AccountScreen | "ยังขาด" join " " → " และ " |

### ⚠️ qi-guide = deliberate divergence (flag ผู้ใช้/ฟีม)
Figma 55399:7219 = **read-only guide** (earn/spend เป็นลิสต์ไม่มีปุ่ม, ไม่มี Growth Loop/referral/activity).
โค้ด QiScreen = **interactive hub** (earn "รับ"/spend redeem/referral/checkin) — **มีคอมเมนต์กำกับ + qi-screen.test ล็อกไว้ ~10 assertion**
(`getAllByRole('button',{name:'รับ'}).length===3`, redeem sheets, referral code). การแปลงเป็น guide เต็ม = ลบฟีเจอร์
ที่ทำงาน + พังเทสต์ → **เป็น product decision (ฟีม) ไม่ใช่ parity bug**. รอบนี้ทำแค่ alignment ที่ปลอดภัย.

## ยังเหลือ (polish / decision)
- qi-guide → guide เต็ม = รอ ฟีม เคาะ (deliberate divergence ข้างบน)
- invite landing redesign เต็ม (logo/hero/3-feature/badge — copy บั๊กแก้แล้ว) · per-screen empty states (qi-history/referral/saved/filtered)
- referral friend list (data-driven) · my-plan quota badges + "฿318 upsell" (data-driven)
- 🔴 DataExport email delivery จริง = รอเลือก email provider + credentials (engine พร้อมรับคำขอแล้ว)
- **qi-guide v2 layout** (55399:7219) — rebuild ใหญ่ + judgment (โค้ดมี interactive extras ตั้งใจ per comment)
- **referral**: friend list (data-driven) + rules link (FE เล็ก)
- **per-screen empty states**: qi-history / referral / saved-reading / filtered-orders
- **invite landing redesign** (copy บั๊กแก้แล้ว; เหลือ logo/hero/3-feature/badge)
- **missions micro-copy** (minor)
- 🔴 **DataExport async-email** (BE — architecture gap จริง: ต้อง export-request + email pipeline)
- **data-driven**: my-plan quota badges + "฿318 upsell" (AccountScreen upsell ก็ใช้ตัวนี้), order masked card ••••4242

## รายเฟรม (สรุปจาก sweep)

**M / ตรงแล้ว:** #1 account · connected · order-history · consent(5-purpose) · notifications(เหลือ copy จิ๋ว) · settings index · referral hub (50/30 QI ยืนยันถูก)

**ยังต้องแก้ — FE-fixable (คิว):**
| เฟรม | ไฟล์ | gap |
|---|---|---|
| FAQ | FaqScreen | header "คำถามที่พบบ่อย" + search bar + contact CTA (Line @mumate.co) + grouping(ต้อง category field) |
| doc-reader | DocReaderScreen | header = ชื่อเอกสารจริง + TOC card + meta(วันที่/เวอร์ชัน) + CTA ล่าง (ยินยอม/แชร์) |
| notifications | NotificationsScreen | group "พลังชี่และเพื่อน", sub "…น้อยกว่า 30 QI", billing lock note, ลบการ์ด PWA-push ที่ไม่มีใน Figma |
| delete-01 what-you-lose | delete-account | แทน ul → ตารางค่าจริง(QI/มูลค่า/ประวัติ/เช็คอิน/เพื่อน/tier) + refund warning + 2 ปุ่ม |
| delete-02 alternatives | delete-account | เพิ่ม 2/4 ทางเลือก (ลบเฉพาะประวัติ, พักบัญชี 90 วัน, จัดการยินยอม) + badge "ตรงกับเหตุผล" |
| delete-04 pending | delete-account | วงกลมนับถอยหลัง + การ์ด "สิ่งที่จะได้กลับคืน" |
| delete-05b feedback | delete-account | checklist 6 เหตุผล + textarea (เดิม textarea ล้วน) |
| delete index | delete-account | เพิ่มขั้น "ดาวน์โหลดข้อมูลก่อนลบ" (UI; export = BE) |
| invite-landing | pages/invite/[code] | (นอกจากบั๊กที่แก้) redesign เต็ม: logo/hero/3-feature/badge "ใช้แล้ว" |
| referral | ReferralHubScreen | รายชื่อ "เพื่อนที่ชวน" (+50 QI ต่อคน) + ลิงก์ "กติกา" |
| order-receipt | OrderReceiptScreen | ปุ่มหลัก "ส่งใบเสร็จอีกครั้ง" + บัตร ••••4242 + เวลาในวันที่ |
| order refund | OrdersScreen | statusWord เพิ่มเคส "คืนเงินแล้ว" (pink pill) |
| empty-states | ProfileGate + screens | 4 empty (history/referral/saved/filtered) — เดิม ProfileGate คืน null |
| loading & error | ProfileGate + payment | variants: offline, system-error(แจ้ง LINE), payment-progress/failure, AI-thinking |
| edit-birth base | EditBirthScreen | native input → dropdown ไทย + จังหวัด dropdown; ปุ่ม "บันทึกการเปลี่ยนแปลง" + dirty-gate |
| edit-profile gender | EditProfileScreen | 3 ปุ่ม → dropdown (ค่าต่ำ, optional) |

**Data-driven (ต้อง API/engine):**
- my-plan (#17): quota badges ต่อสิทธิ์ + upsell "฿318 จ่ายเดือนนี้ / Pro ประหยัด ฿119" — ต้องยอดใช้ QI รายเดือน + entitlement quota. (การ์ด upsell บน AccountScreen ก็ใช้ตัวนี้)
- referral friend list, order refund status value, doc-reader วันที่/เวอร์ชัน, delete ค่าจริง

**BE-blocked (in scope ตาม memory — ทำ engine ด้วย):**
- 🔴 **DataExport (#20):** โค้ด download JSON ทันที แต่ Figma = ส่งอีเมล async (JSON+CSV, 30 วัน) → ต้อง export-request + email pipeline (งานใหญ่สุดในกลุ่มนี้)
- avatar upload, account-linking "เชื่อม" backup login, edit-birth LINE correction flow, connected-date, edit-profile @name edit → intended/flag (ไม่ fake)

## Backend-blocked (flag, ไม่ fake) — ยืนยัน
- avatar upload · EditProfile @name edit · account-linking "เชื่อม" · edit-birth correction ผ่าน LINE · connected-date

## หมายเหตุแก้ความเข้าใจผิดจาก audit เดิม
- **150 QI แก้วันเกิด = Figma stale** — โค้ด 100 QI ถูกแล้ว (150 คือ matching_slot คนละ feature) **ห้ามแก้**
- referral 50/30 QI = แก้แล้วทั้ง ReferralHubScreen + engine (แต่ invite page ตกหล่น — แก้รอบนี้)
