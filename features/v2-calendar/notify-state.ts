// Phase 2 (#286) · การแปล PwaCapability → สถานะเดียวที่ทุกจอใช้ร่วมกัน
//
// ทำไมต้องมีไฟล์นี้แทนที่จะให้แต่ละจอ if เอง: จอที่ต้องบอกสถานะแจ้งเตือนมี 2 ที่ (ชีทตั้งเตือน +
// หน้ารายการทั้งหมด) และจะมีที่ที่สามแน่นอน. ถ้าแต่ละที่แปล capability เอง มันจะเริ่มตรงกัน แล้ว
// ค่อยๆ ต่างกันโดยไม่มีใครเห็น — แปลที่เดียว ให้ทุกจอกินผลจากที่เดียวกัน.
//
// 🔴 6 สถานะ ไม่ใช่ 5 — ใบ #286 เขียนไว้ 5 และมันขาดเคสที่ contract ของ goo ระบุไว้เอง
// (`capability.ts`: เบราว์เซอร์ในแอป LINE จะได้ canReceivePush=false ⇒ "ไม่รองรับ").
// เคสนั้นไม่ใช่ 'ปฏิเสธไปแล้ว' และไม่ใช่ 'ต้องติดตั้งก่อน': **ไม่มีวิธีให้สอน** — ปุ่ม "ดูวิธี" ตรงนั้น
// จะพาไปสู่ขั้นตอนที่ทำแล้วก็ยังไม่ได้ผล. คนมู่เมทเข้าทาง LINE เป็นเรื่องปกติ ⇒ ปล่อยให้มันตกลง
// ช่องอื่นคือการโกหกที่เกิดกับผู้ใช้จริง ไม่ใช่เคสสมมติ. เขียนไว้ในใบแล้ว.
import type { PwaCapability } from '@/lib/pwa/capability'

export type NotifyState =
  | 'unknown' //        ยังไม่รู้ (SSR / กำลังอ่านค่า) — ต้องเป็น skeleton ❌ ห้ามวาดเป็น "ปิด"
  | 'granted' //        อนุญาตแล้ว — ติ๊กได้ตามปกติ
  | 'default' //        ยังไม่เคยถาม — ปิดอยู่ ติ๊กได้ · ติ๊ก = ขอสิทธิ์ทันที
  | 'denied' //         ปฏิเสธไปแล้ว — ปิด ติ๊กไม่ได้ · แก้ได้ที่ตั้งค่าเครื่อง
  | 'needs-install' //  iOS Safari ที่ยังไม่ Add-to-Home-Screen — ปิด ติ๊กไม่ได้ · แก้ได้ด้วยการติดตั้ง
  | 'unsupported' //    รันไทม์นี้ไม่มี push API เลย (webview ในแอป) — ปิด ติ๊กไม่ได้ · **ไม่มีวิธีให้สอน**

/**
 * ลำดับการถามสำคัญกว่าตัวเงื่อนไข — ถามผิดลำดับแล้วผู้ใช้จะได้คำแนะนำที่ทำตามแล้วไม่ได้ผล:
 *
 *   1) ยังไม่รู้ก่อนเสมอ      — `canReceivePush === null` คือ "ยังไม่ได้อ่าน" ไม่ใช่ "อ่านแล้วไม่มี"
 *                              🔴 ตัดสินจาก `null` เท่านั้น ❌ ห้ามเอา `permission === 'unknown'` มาร่วม:
 *                              `capability.ts` ตั้ง `permission='unknown'` ทุกครั้งที่ **ไม่มี Notification API**
 *                              (`hasNotification=false`) ซึ่งคือเคส `unsupported` เป๊ะๆ ⇒ เอามาไว้ด่านแรก
 *                              เมื่อไหร่ บรรทัด `unsupported` ข้างล่างไปไม่ถึงเลย และคนที่เปิดจากในแอป LINE
 *                              จะเห็นโครงกะพริบค้างถาวร — ไม่มีข้อความ ไม่มีปุ่มดูวิธี และไม่หายเอง เพราะ
 *                              `hasNotification` ไม่มีวันเปลี่ยน (ตู๋จับได้ที่ #292 · มิวแทนต์ U4 ของเขา
 *                              "รอด" แล้วกลายเป็นตัวแก้). ราก — `permission` แบกสองความหมายในค่าเดียว —
 *                              ยังอยู่ที่ `lib/pwa/capability.ts` ของ phase 1 ⇒ เป็นใบแยก ไม่ใช่ใบนี้
 *   2) ต้องติดตั้งก่อน        — ต้องมาก่อน unsupported เพราะ iOS แท็บ Safari ก็ได้ canReceivePush=false
 *                              เหมือนกัน แต่ของมันแก้ได้ด้วยการติดตั้ง ⇒ ถ้าเช็ค unsupported ก่อน
 *                              ผู้ใช้ iPhone จะถูกบอกว่า "เครื่องนี้ใช้ไม่ได้" ทั้งที่แค่ต้องติดตั้ง
 *   3) รับไม่ได้เลย           — ถึงตรงนี้แปลว่า install ก็ไม่ช่วย
 *   4) แล้วค่อยดูสิทธิ์       — permission มีความหมายเฉพาะเมื่อเครื่องรับ push ได้จริง
 */
export function notifyStateFrom(capability: PwaCapability): NotifyState {
  const { canReceivePush, needsInstall, permission } = capability

  if (canReceivePush === null || needsInstall === null) return 'unknown'
  if (needsInstall) return 'needs-install'
  if (!canReceivePush) return 'unsupported'
  if (permission === 'granted') return 'granted'
  if (permission === 'denied') return 'denied'
  return 'default'
}

/** สถานะที่ผู้ใช้ "ติ๊กเปิดแจ้งเตือนในแอป" ไม่ได้ — ปุ่มต้องเทาและกดไม่ได้จริง ไม่ใช่แค่ดูเทา */
export function canToggleMumate(state: NotifyState): boolean {
  return state === 'granted' || state === 'default'
}

/** ชีทสอนติดตั้ง/เปิดสิทธิ์ ช่วยได้ไหม — `unsupported` ช่วยไม่ได้ ⇒ ❌ ห้ามโชว์ปุ่ม "ดูวิธี" */
export function guideVariantFor(state: NotifyState): 'install' | 'permission' | null {
  if (state === 'needs-install') return 'install'
  if (state === 'denied') return 'permission'
  return null
}

/** ข้อความสั้นใต้แถว "มู่เมท" และบนแถบสถานะ — แปลที่เดียว ทุกจอพูดตรงกัน */
export const NOTIFY_REASON: Record<NotifyState, string | null> = {
  unknown: null,
  granted: null,
  default: null,
  denied: 'คุณปิดการแจ้งเตือนไว้ที่เครื่อง เปิดใหม่ได้ในตั้งค่า',
  'needs-install': 'iPhone ต้องเพิ่ม Mumate ลงหน้าจอโฮมก่อน จึงจะเตือนได้',
  unsupported: 'เบราว์เซอร์นี้รับการแจ้งเตือนไม่ได้ ลองเปิดใน Safari หรือ Chrome',
}
