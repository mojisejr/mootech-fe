// #455 — สถานะของเส้นตายของ QR เป็น "สามสถานะ" ❌ ไม่ใช่ boolean + null
//
// 🔴 ทำไมไม่ส่ง `chargeExpiresAt` ดิบ ๆ ให้จอไปตีความเอง (ตู๋ #476):
// `Date | null` เชิญให้เขียน `if (expiresAt && expiresAt < now)` ซึ่ง**ถูกสำหรับสองกรณี และเงียบสำหรับกรณีที่สาม**
// — แถวที่เป็น null จะตกไปอยู่ฝั่ง "ยังไม่หมดอายุ" โดยไม่มีใครตั้งใจ และ null คือเคสหลัก ไม่ใช่ขอบ:
// charge เก่า 124 ตัวจาก 184 บนบัญชีนี้เป็น null และเลนบัตรทั้งเลนก็เป็น null
//
// วิธีที่ทำให้ผิดยากคือ **ไม่มี boolean ให้หยิบ** — คนอ่านต้องเขียนสามกิ่งเสมอ เพราะไม่มีกิ่งที่สี่ให้ตกลงไป
// รูปเดียวกับที่ทีมใช้มาแล้วในคืนเดียวกันสามครั้ง: `isPaid` ที่ null ถือสองความหมายแล้วจอค้างตลอดกาล (#457),
// `failureCode` ที่ null ไม่ใช่ "ไม่ล้มเหลว" (#437), และ `retrieveCharge` ที่ null ไม่ใช่ "ไม่ได้จ่าย" (#360).

/**
 * `expired` — เลยเส้นตายที่ gateway บอกไว้แล้ว · QR สแกนไม่ได้แน่นอน
 * `live`    — ยังไม่ถึงเส้นตายที่ gateway บอกไว้
 * `unknown` — **เราไม่รู้** · ไม่ใช่ "ยังไม่หมดอายุ" และไม่ใช่ "หมดอายุแล้ว"
 */
export type QrDeadlineState = 'expired' | 'live' | 'unknown'

/**
 * `deadline` = `v2_payment.charge_expires_at` (null ได้) · `now` ฉีดเข้ามาเพื่อให้เทสต์พินเวลาได้
 *
 * 🔴 ค่าที่ parse ไม่ได้ตอบ `unknown` ❌ ไม่ใช่ `expired` — เราไม่รู้ว่ามันตายหรือยัง เรารู้แค่ว่าอ่านไม่ออก
 * การเดาไปทาง `expired` จะบอกคนที่ QR ยังใช้ได้ว่าให้ไปขอใหม่ ซึ่งคือการสร้างรายการที่สองโดยไม่จำเป็น
 */
export function qrDeadlineState(deadline: Date | string | null | undefined, now: Date): QrDeadlineState {
  if (deadline === null || deadline === undefined) return 'unknown'
  const at = deadline instanceof Date ? deadline : new Date(deadline)
  if (Number.isNaN(at.getTime())) return 'unknown'
  return at.getTime() <= now.getTime() ? 'expired' : 'live'
}

/**
 * สิ่งที่ `/api/v2/payment/status` บอกจอเกี่ยวกับ QR — **สองช่องที่สร้างพร้อมกันจากค่าเดียว**
 *
 * 🔴 `liveUntil` ไม่ใช่ "วันหมดอายุ" ที่ถูกกรอง มันคือ **หน้าต่างที่ยังเปิดอยู่** — จึงมีค่าเฉพาะตอน `live`
 *
 * ⚠️ **คำรับประกันที่ถูก** (มุนแก้ของตัวเองหลังตู๋ค้าน · #455):
 *   - `qrDeadline` เป็น**ทางเดียว**ที่จอพูดว่าหมดอายุได้
 *   - `liveUntil` ใช้ทำ countdown เท่านั้น
 *   - `now > liveUntil` **ไม่ใช่คำตัดสิน** — แปลว่าคำตอบที่ client ถืออยู่เก่าแล้ว ⇒ ไปถามใหม่ ❌ ห้ามพิมพ์ว่าหมดอายุ
 *
 * 🔴 ฉบับแรกของประโยคนี้ (ทั้งของมุนและของผม) เขียนว่า *"การไม่ส่งทำให้เงื่อนไขนั้นเป็นเท็จเสมอ"* — **ไม่จริง**
 * `liveUntil` ที่ไม่เป็น null แปลว่า server ตัดสินว่า `live` **ณ วินาทีที่มันตอบ** · client ถือคำตอบไว้ และ
 * slow poll ห่างกัน 30 วินาที ⇒ ระหว่างสองรอบ `liveUntil < now` **เป็นจริงบนเครื่องผู้ใช้ทุกวัน** — และนั่นคือ
 * เคสที่ถูกต้อง มันคือ countdown เดินถึงศูนย์ ❌ ไม่ใช่ QR ตาย
 *
 * ⇒ สิ่งที่ทาง ข เอาออกคือ **ค่าดิบที่ใช้สรุปว่า "หมดอายุ" ได้** ❌ ไม่ใช่การเปรียบเทียบเวลา
 * ⇒ payload นี้สร้าง `{ qrDeadline: 'expired' | 'unknown', liveUntil: <ค่า> }` ไม่ได้ และนั่นคือทั้งหมดของมัน
 */
export type QrStatusFields = { qrDeadline: QrDeadlineState; liveUntil: string | null }

export function qrStatusFields(deadline: Date | string | null | undefined, now: Date): QrStatusFields {
  const qrDeadline = qrDeadlineState(deadline, now)
  if (qrDeadline !== 'live') return { qrDeadline, liveUntil: null }
  const at = deadline instanceof Date ? deadline : new Date(deadline as string)
  return { qrDeadline, liveUntil: at.toISOString() }
}
