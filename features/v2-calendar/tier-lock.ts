// #316 — บรรทัดที่ "ตัดสิน" ว่าปุ่มตั้งเตือนถูกล็อกไหม อยู่ที่นี่ ไม่ใช่ในไฟล์ page
//
// ทำไมต้องแยกออกมา: `pages/v2/calendar/[date].tsx` ลาก `next/config` เข้ามาทั้งโมดูล ⇒ unit test
// import ไฟล์นั้นไม่ได้ ⇒ ถ้าปล่อยตรรกะไว้ในนั้น มันจะเป็นบรรทัดที่ตัดสินพฤติกรรมของผู้ใช้
// **โดยไม่มีฟันแตะได้เลย** (รูปเดียวกับ #313 ที่ยังเปิดอยู่)
//
// 🔴 กติกาคือ fail-closed: `isPaid` มีสามค่า ไม่ใช่สองค่า
//   true   สมาชิก        → ปลดล็อก
//   false  ฟรี           → ล็อก
//   null   ยังไม่รู้ tier  → **ล็อก** ❌ ไม่ใช่ปลดล็อก
// ตอนนี้หน้าเพจซ่อน body ทั้งก้อนด้วย CSS ระหว่าง `isPaid === null` ([date].tsx:162) ⇒ ผู้ใช้กดไม่ถึงอยู่แล้ว
// แต่ "ปลอดภัยเพราะ CSS บังเอิญซ่อนไว้" ไม่ใช่ด่าน — ถ้าใครถอด `hidden` ออกวันหลัง (หรือเปลี่ยนเป็น
// spinner ทับแบบ pointer-events-none) ปุ่มที่ยิงจริงจะโผล่มาทันทีโดยไม่มีอะไรแดง

import { isYamPast } from '@/lib/v2/reminder-time'
import type { YamSlot } from './types'

/** ปุ่มตั้งเตือนถูกล็อกไหม — ล็อกทุกกรณีที่ยังไม่ยืนยันว่าเป็นสมาชิก */
export function remindersLocked(isPaid: boolean | null): boolean {
  return isPaid !== true
}

// #326 — ทางเข้าที่ **สอง**: ปุ่มหลักบนแถบล่าง ("เพิ่มลงปฏิทิน เพื่อแจ้งเตือน")
//
// `#316` ปิดทางเข้าที่ปุ่มรายยาม · ทางนี้ยังเปิดอยู่ และโกหกหนักกว่า เพราะผู้ใช้ free เลือกยามจนเสร็จ
// **ก่อน** จะโดน 403 แล้วชีทค้างไว้ให้ retry ⇒ ลงแรงไปแล้วค่อยถูกปฏิเสธ และจอไม่ได้บอกว่าเพราะไม่ใช่สมาชิก
//
// 🔴 ทำไมทั้ง "ตัดสิน" และ "ลงมือ" ต้องอยู่ในฟังก์ชันเดียวกันนี้ ไม่ใช่คืนแค่ boolean ให้หน้าเพจไปแตกเอง:
// ปุ่มตัวนี้ถูกวาดโดย `Menubar` ซึ่งมีจุด render 9 แห่งทั่วแอป ⇒ ทำ prop ให้ required แบบที่ `#316`
// ทำกับ `YamTimes` ไม่ได้ (พัง 9 จุดเพื่อกันจุดเดียว) ⇒ ด่านของผู้เรียกจึงต้องเป็น "หน้าเพจส่งอะไรเข้า
// `onCta`" · ถ้าที่นี่คืนแค่ `locked` แล้วปล่อยให้ `[date].tsx` เขียน `locked ? … : …` เอง บรรทัดที่ตัดสิน
// พฤติกรรมจะย้ายกลับเข้าไฟล์ที่ unit test import ไม่ได้ — ซึ่งเป็นเหตุผลเดียวกับที่ไฟล์นี้ถูกแยกออกมาแต่แรก
//
// ฟีมเคาะทาง **ก.** (2026-08-19): กดแล้ว *บอกว่าเป็นของสมาชิก* ❌ ไม่เปิดชีท ❌ ไม่ยิง POST
// 📌 #359 สร้างหน้า pricing แล้ว ⇒ สถานะ 7 พาไป `/v2/shop` · ข้อความ `DAY_CTA_LOCKED_MESSAGE` ถูกลบทิ้ง
//    (มันเคยเป็นสตริงเดียวกันเป๊ะกับ `YAM_LOCKED_MESSAGE` คนละไฟล์ — สำเนาที่ต้องซิงก์ด้วยมือ ตอนนี้ไม่มีแล้ว)

export const DAY_CTA_LOCKED_LABEL = 'เพิ่มลงปฏิทิน · เฉพาะสมาชิก'
export const DAY_CTA_OPEN_LABEL = 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน'
// #343 — `dayDetailCta` (2 สถานะ) ถูก `dayReminderCta` (7 สถานะ) แทนที่แล้ว และหน้าเพจสลับมาเรียกตัวใหม่
// ⇒ ลบทิ้งตามที่ใบสั่ง ❌ ไม่เก็บไว้เป็นทางคู่ขนาน — ตัวตัดสินสองตัวสำหรับปุ่มเดียวคือรูปที่ทำให้จอโกหก
// ป้ายเดิม `DAY_CTA_SAVED_LABEL` ('คุณบันทึกลงปฏิทินแล้ว') ไปอยู่เป็นค่า default ใน `Menubar` แล้ว
// (หน้ารายการแจ้งเตือนยังใช้อยู่ · ไม่ได้ส่ง ctaLabel มา)

// ────────────────────────────────────────────────────────────────────────────
// #341 — ตรรกะยาม 3 สถานะ + ปุ่มแถบล่าง 7 สถานะ (goo · logic-only, P2/P3=มุน วาด)
//
// 🔴 ทำไม `dayReminderCta` เคยเป็นฟังก์ชัน **ใหม่** แทนการขยายตัวเดิมในที่ (บันทึกไว้เป็นประวัติ — seam ปิดแล้ว):
// ตอน #341 หน้าเพจยังเรียก `dayDetailCta({isPaid,saved,openSheet,say})` และเพจเป็นของมุน (P2/P3) goo แตะไม่ได้.
// 7 สถานะต้องรับ input เพิ่ม (yams · addedYamIds · now · saving/justSaved · goToList) ⇒ ถ้าเปลี่ยน signature
// ตัวเก่า เพจจะ compile ไม่ผ่าน + fang เดิม (day-cta-tier-gate ชั้น ② render เพจจริง) แตก + PR นี้ build แดง
// = ผิดเป้าใบเอง (ขนานกับมุน · แต่ละ PR เขียวเอง). จึงเก็บตัวเก่าไว้ครบ แล้วเพิ่มตัวใหม่ที่ input required
// (fail-closed: มุน render 7 สถานะไม่ได้ถ้าไม่ส่ง yam มา — กันป้ายโกหกเงียบ).
// ✅ #343 สลับ call site ของเพจมาที่ตัวนี้แล้ว และลบตัวเก่าทิ้ง ⇒ **ต่อสายแล้ว ไม่ใช่ unwired อีกต่อไป**
// ⚠️ ข้อจำกัดที่รู้ตัว: สถานะ 2 (`saving`) วาดไม่ถึงตาผู้ใช้บนหน้า day-detail เพราะตอน `saving` ชีท
// (`fixed inset-0 z-50`) คลุมเมนู (z-40) อยู่ และหลัง #343 ทุกเส้นทางบันทึกผ่านชีททั้งหมด — ต่อสายไว้
// เพราะ fail-safe ราคาศูนย์ แต่ **ไม่มีฟันตัวไหนอ้างว่าผู้ใช้เห็นมัน** (บันทึกไว้ใน mootech-fe#343).

export const DAY_CTA_SAVING_LABEL = 'กำลังบันทึก…'
export const DAY_CTA_JUST_SAVED_LABEL = 'บันทึกเรียบร้อยแล้ว'
export const DAY_CTA_ADD_MORE_LABEL = 'เพิ่มยาม'
export const DAY_CTA_VIEW_LIST_LABEL = 'ดูการแจ้งเตือนของวันนี้'
export const DAY_CTA_EXPIRED_LABEL = 'เลยเวลาบันทึกแล้ว'

/** สถานะของยามหนึ่งใน 3 อย่าง สำหรับวันหนึ่ง. */
export type YamReminderStatus = 'added' | 'past' | 'addable'

/**
 * ยามนี้อยู่สถานะไหน: **เพิ่มแล้ว · เลยเวลา · เพิ่มได้**.
 *
 * 🔑 "เพิ่มแล้ว" ชนะ "เลยเวลา" (ฟีมเคาะ 2026-08-19): ผู้ใช้เพิ่มไว้จริง และหน้ารายการมีหมวด "เตือนไปแล้ว"
 * รับอยู่แล้ว (`pages/v2/calendar/notifications.tsx`) — ถ้าโชว์ "เลยเวลา" ผู้ใช้จะนึกว่าของหาย. ดังนั้นเช็ค
 * `added` ก่อนเสมอ. window พัง → `isYamPast=false` → `addable` (ดู reminder-time.ts).
 */
export function yamReminderStatus(o: {
  yam: YamSlot
  date: string
  addedYamIds: readonly string[]
  now: Date
}): YamReminderStatus {
  if (o.addedYamIds.includes(o.yam.id)) return 'added' // ชนะ tie เสมอ
  if (isYamPast(o.date, o.yam.window, o.now)) return 'past'
  return 'addable'
}

export type ReminderCtaKind =
  | 'open' //      1 · ยังไม่มีอะไร · ยังเพิ่มได้
  | 'saving' //    2 · กำลังบันทึก
  | 'justSaved' // 3 · เพิ่งบันทึกเสร็จ (ชั่วคราว ~2s · เพจถือ timer)
  | 'addMore' //   4 · มีแล้ว · ยังเพิ่มได้อีก
  | 'viewList' //  5 · มีแล้ว · เพิ่มไม่ได้อีก
  | 'expired' //   6 · ไม่มีเลย · เลยเวลาหมด
  | 'locked' //    7 · free / ยังไม่รู้ tier (ชนะทุกตัว)

export interface ReminderCtaPlan {
  /** สถานะที่ตัดสินได้ — จุดยึดของฟัน/แอนเคอร์ และตัวที่มุนใช้เลือกสไตล์ */
  kind: ReminderCtaKind
  /** ข้อความบนปุ่ม */
  label: string
  /** กดไม่ได้ (2 saving · 3 justSaved · 6 expired) — press เป็น no-op ปลอดภัยเสมอ */
  disabled: boolean
  /** ล็อกเพราะ tier (เฉพาะ 7) — สำหรับฟัน fail-closed ไม่ได้ใช้วาดเอง */
  locked: boolean
  /** สิ่งที่เกิดเมื่อกด — ทางล็อก/ปิดใช้งานไม่มีเส้นทางไป openSheet/goToList */
  press: () => void
}

/**
 * ปุ่มแถบล่างควรพูดว่าอะไร + กดแล้วเกิดอะไร ครบ 7 สถานะ. ตรรกะล้วน — มุน (P2/P3) เอาไปวาด.
 *
 * ลำดับความสำคัญ (สำคัญ — บนชนะล่าง):
 *   7 locked   `remindersLocked(isPaid)` (isPaid!==true) — **ชนะทุกอย่าง** (fail-closed)
 *   2 saving   กำลังบันทึก
 *   3 justSaved เพิ่งบันทึกเสร็จ (เพจถือเวลา 2s เอง — ไม่เอา state ค้างข้ามหน้า · #323)
 *   จากนั้น aggregate ยามทั้งวัน → 1/4/5/6
 *
 * เคสยามว่าง (`yams=[]`) → 6 `expired` (กดไม่ได้ · press ปลอดภัย). ไม่ควรเกิดจริง (almanac ให้ luckyHours เสมอ).
 */
export function dayReminderCta(o: {
  isPaid: boolean | null
  saving: boolean
  justSaved: boolean
  yams: readonly YamSlot[]
  addedYamIds: readonly string[]
  date: string
  now: Date
  openSheet: () => void
  /** #359 — สถานะล็อกพาไปหน้าแพ็กเกจ ❌ ไม่ประกาศ 'เร็วๆ นี้' อีกต่อไป (ปลายทางมีแล้ว)
   *  ชื่อนี้ทำให้ผู้เรียกที่ยังส่ง `say` มาแดงที่คอมไพเลอร์ แทนที่จะเงียบแล้วปุ่มไม่พาไปไหน */
  goToShop: () => void
  goToList: () => void
}): ReminderCtaPlan {
  const noop = () => {}

  // 7 — สมาชิกภาพชนะทุกอย่าง
  if (remindersLocked(o.isPaid)) {
    return {
      kind: 'locked',
      label: DAY_CTA_LOCKED_LABEL,
      disabled: false,
      locked: true,
      press: () => o.goToShop(),
    }
  }
  // 2 — กำลังบันทึก
  if (o.saving) {
    return { kind: 'saving', label: DAY_CTA_SAVING_LABEL, disabled: true, locked: false, press: noop }
  }
  // 3 — เพิ่งบันทึกเสร็จ (ชั่วคราว)
  if (o.justSaved) {
    return { kind: 'justSaved', label: DAY_CTA_JUST_SAVED_LABEL, disabled: true, locked: false, press: noop }
  }

  // aggregate สถานะยามทั้งวัน
  let added = 0
  let addable = 0
  for (const yam of o.yams) {
    const s = yamReminderStatus({ yam, date: o.date, addedYamIds: o.addedYamIds, now: o.now })
    if (s === 'added') added += 1
    else if (s === 'addable') addable += 1
  }
  const hasAny = added > 0
  const canAddMore = addable > 0

  // 1 — ยังไม่มีอะไร · ยังเพิ่มได้
  if (!hasAny && canAddMore) {
    return { kind: 'open', label: DAY_CTA_OPEN_LABEL, disabled: false, locked: false, press: o.openSheet }
  }
  // 4 — มีแล้ว · ยังเพิ่มได้อีก
  if (hasAny && canAddMore) {
    return { kind: 'addMore', label: DAY_CTA_ADD_MORE_LABEL, disabled: false, locked: false, press: o.openSheet }
  }
  // 5 — มีแล้ว · เพิ่มไม่ได้อีก
  if (hasAny && !canAddMore) {
    return { kind: 'viewList', label: DAY_CTA_VIEW_LIST_LABEL, disabled: false, locked: false, press: o.goToList }
  }
  // 6 — ไม่มีเลย · เลยเวลาหมด (รวมเคสยามว่าง)
  return { kind: 'expired', label: DAY_CTA_EXPIRED_LABEL, disabled: true, locked: false, press: noop }
}
