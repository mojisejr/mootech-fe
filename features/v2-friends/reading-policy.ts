// features/v2-friends/reading-policy.ts — กติกา "ดูดวงเพื่อน" (ประชุม 24 พ.ย. ข้อ 2). PURE: ไม่มี DB/fetch.
//
// ผู้ใช้ตัดสิน (2026-11-27): Pro อ่านดวงเพื่อนได้ 10 คน · คนที่ 11 ขึ้นไปคิด 30 ชีทุกครั้งที่ดู
// ค่าตั้งต้นที่ยังไม่มีใครเถียง: Plus/Free ไม่มีสล็อตฟรี — จ่าย 30 ชีทุกครั้งเหมือนกัน
//
// "10 คน" = เพื่อน 10 คนแรกที่เคยดู (คนละ 1 สล็อต บันทึกในตาราง friend_reading_slot) และคนที่อยู่ในสล็อตแล้ว
// ดูซ้ำได้ฟรีต่อ ส่วนคนนอกสล็อตจ่ายทุกครั้ง — แก้ค่าตรงนี้ที่เดียว (route + จออ่านจากไฟล์นี้ทั้งคู่)
export const FRIEND_READING_CODE = 'friend_reading' // ต้องตรงกับ QI_SPEND_LINES ฝั่ง engine
export const FRIEND_READING_QI = 30
export const PRO_FREE_FRIENDS = 10

/** slot = เพื่อนคนนี้อยู่ในสล็อตของ Pro แล้ว · new_slot = ครั้งนี้จะใช้สล็อตใหม่ (ฟรี) · qi = จ่าย 30 ชี */
export type ReadingBasis = 'slot' | 'new_slot' | 'qi'

export type ReadingPlanInput = {
  isPro: boolean
  /** จำนวนสล็อตที่ใช้ไปแล้ว (เฉพาะ Pro — คนอื่นส่ง 0) */
  slotsUsed: number
  /** เพื่อนคนนี้อยู่ในสล็อตของผู้ใช้แล้ว */
  alreadySlotted: boolean
}

export type ReadingPlan = {
  basis: ReadingBasis
  /** ชีที่ต้องจ่ายสำหรับการดู "ครั้งนี้" */
  priceQi: number
  /** จำนวนสล็อตที่จะถูกใช้หลังการดูครั้งนี้ (null = ไม่เกี่ยว) */
  freeUsedAfter: number | null
}

export function friendReadingPlan(input: ReadingPlanInput): ReadingPlan {
  const used = Number.isFinite(input.slotsUsed) ? Math.max(0, Math.floor(input.slotsUsed)) : 0
  // สล็อตเป็นสิทธิ์ของ Pro: หมดอายุสมาชิกแล้วแถวสล็อตยังอยู่ แต่ไม่ให้ฟรีจนกว่าจะเป็น Pro อีก
  if (input.isPro && input.alreadySlotted) return { basis: 'slot', priceQi: 0, freeUsedAfter: used }
  if (input.isPro && used < PRO_FREE_FRIENDS) return { basis: 'new_slot', priceQi: 0, freeUsedAfter: used + 1 }
  return { basis: 'qi', priceQi: FRIEND_READING_QI, freeUsedAfter: used }
}
