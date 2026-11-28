// lib/v2/daily-fortune-access.ts — สิทธิ์รับแจ้งเตือน "ดวงประจำวัน" (ประชุม 24 พ.ย. 2569 ข้อ 6). PURE: ไม่มี DB/fetch.
//
// กติกา: สมาชิก Plus/Pro ได้ทุกวัน · ผู้ใช้ฟรีได้ 7 วันแรกนับจากวันสมัคร (ค่าตั้งต้นที่ตั้งไว้ ยังไม่มีใครเถียง)
// "วัน" นับตามปฏิทินไทย: วันสมัคร = วันที่ 1 (เหลือ 7) → วันที่ 8 (เหลือ 0) ไม่ส่ง
// ตัดสินไม่ได้ว่าจ่ายหรือไม่ (isPaid null) หรือหาวันสมัครไม่ได้ → ไม่ส่ง (fail-closed เหมือน remindersLocked)
export const FREE_DAILY_REMINDER_DAYS = 7

export type DailyReminderAccess = {
  allowed: boolean
  /** จำนวนวันฟรีที่เหลือ (เฉพาะผู้ใช้ฟรีที่ยังอยู่ในช่วง) — null = ไม่เกี่ยว (สมาชิก / หมดช่วงแล้ว / ตัดสินไม่ได้) */
  daysLeft: number | null
  reason: 'member' | 'trial' | 'trial_over' | 'undetermined'
}

/** เวลาไทย = UTC+7 ไม่มี DST → 'YYYY-MM-DD' ของวันไทย */
export function bkkDateOf(d: Date): string {
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000)
  return `${bkk.getUTCFullYear()}-${String(bkk.getUTCMonth() + 1).padStart(2, '0')}-${String(bkk.getUTCDate()).padStart(2, '0')}`
}

/** วันที่แบบ 'YYYY-MM-DD' → จำนวนวันนับจาก epoch (ใช้ลบกันหา "ผ่านไปกี่วัน") · รูปแบบไม่ถูก → null */
export function dayNumber(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : null
}

/** วันสมัครของผู้ใช้จากตาราง user:
 *   create_at    varchar เก็บแบบเวลาไทย 'YYYY-MM-DD HH:mm:ss' (แบบเดียวกับที่ friend-store เขียน)
 *   onboarded_at text    ISO ที่เขียนตอนจบ first-run — ใช้เมื่อ create_at อ่านไม่ได้
 *   อ่านไม่ได้ทั้งคู่ → null (ผู้เรียก fail-closed) ไม่เดาวัน */
export function parseSignupDate(createAt: unknown, onboardedAt?: unknown): Date | null {
  const a = typeof createAt === 'string' ? createAt.trim() : ''
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(a)
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0) - 7, Number(m[5] ?? 0), Number(m[6] ?? 0)))
    // เดือน/วันเกินจริง (2026-13-45) Date จะปัดไปวันอื่นโดยไม่ error — เช็คย้อนกลับว่ายังเป็นวันเดิม
    if (Number.isFinite(d.getTime()) && bkkDateOf(d) === `${m[1]}-${m[2]}-${m[3]}`) return d
  }
  const iso = typeof onboardedAt === 'string' ? onboardedAt.trim() : ''
  if (iso) {
    const d = new Date(iso)
    if (Number.isFinite(d.getTime())) return d
  }
  return null
}

export function dailyReminderAccess(input: { isPaid: boolean | null; signupAt: Date | null; now: Date }): DailyReminderAccess {
  if (input.isPaid === true) return { allowed: true, daysLeft: null, reason: 'member' }
  if (input.isPaid === null) return { allowed: false, daysLeft: null, reason: 'undetermined' }
  if (!input.signupAt) return { allowed: false, daysLeft: null, reason: 'undetermined' }
  const signupDay = dayNumber(bkkDateOf(input.signupAt))
  const today = dayNumber(bkkDateOf(input.now))
  if (signupDay === null || today === null) return { allowed: false, daysLeft: null, reason: 'undetermined' }
  const passed = Math.max(0, today - signupDay) // นาฬิกาเดินมั่วให้วันสมัครอยู่อนาคต → ถือว่าเพิ่งสมัคร ไม่เกิน 7
  const daysLeft = Math.max(0, FREE_DAILY_REMINDER_DAYS - passed)
  return daysLeft > 0 ? { allowed: true, daysLeft, reason: 'trial' } : { allowed: false, daysLeft: 0, reason: 'trial_over' }
}

/** ข้อความสั้น ๆ ต่อท้ายแถว "ดวงประจำวัน" ในจอแจ้งเตือน — '' เมื่อไม่มีอะไรต้องบอก */
export function dailyReminderAccessNote(a: DailyReminderAccess | null): string {
  if (!a) return ''
  if (a.reason === 'trial' && a.daysLeft !== null) return ` · ทดลองฟรีอีก ${a.daysLeft} วัน`
  if (a.reason === 'trial_over') return ' · หมดช่วงทดลองฟรีแล้ว'
  return ''
}
