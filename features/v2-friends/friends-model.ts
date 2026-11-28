// features/v2-friends/friends-model.ts — pure helpers for the friends list (/v2/friends, ประชุม 24 พ.ย. ข้อ 3).
// No React, no fetch: everything here runs under node, so the list's rules are unit-tested without a screen.
//
// "เพื่อน" ในแอปมีสองกลุ่มแยกกัน และหน้านี้ต้องไม่ปนสองกลุ่ม:
//   • รายชื่อเพื่อน   = แถว member_with_friend ที่ผู้ใช้บันทึกวันเกิดไว้เพื่อดูดวงสมพงศ์ (GET /api/member-with-friend)
//   • เพื่อนที่ชวนมา = คนที่สมัครด้วยโค้ดของผู้ใช้ (GET /api/referral) — เป้า 5 ธาตุนับจากกลุ่มนี้เท่านั้น
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'

export type FriendRow = {
  id: string
  name: string
  surname?: string | null
  picture_url?: string | null
  /** 'YYYY-MM-DD' (ค.ศ.) — ค่าที่ชีตเพิ่มเพื่อนเขียน (แปลงจาก พ.ศ. แล้ว) */
  dob?: string | null
  /** 'HH:mm' | '' */
  time?: string | null
  is_remember_time?: boolean | null
  /** เพื่อนที่เป็นสมาชิก MuMate (server อ่านโปรไฟล์จากตาราง user ให้) */
  is_member?: boolean
  /** เกินเพดานฟรี — server ติดธงไว้ รายชื่อยังโชว์ แต่ตัวเลือกดูดวงคู่จะไม่ให้เลือก */
  is_disable?: boolean
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** GET /api/member-with-friend ตอบเป็น array เปล่า ๆ. อย่างอื่น (body  error / null / object) → null
 *  เพื่อให้จอบอก "โหลดไม่สำเร็จ" แทนที่จะวาด "ยังไม่มีเพื่อน" ทับความล้มเหลว (คืบหน้าเดียวกับ historyState). */
export function parseFriendRows(json: unknown): FriendRow[] | null {
  if (!Array.isArray(json)) return null
  const out: FriendRow[] = []
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const id = (str(r.id) ?? '').trim()
    if (!id) continue // แถวไม่มี id อ้างอิงไม่ได้ จึงลบก็ไม่ได้ — ตัดทิ้ง ไม่วาดแถวที่จับต้องไม่ได้
    out.push({
      id,
      name: str(r.name) ?? '',
      surname: str(r.surname),
      picture_url: str(r.picture_url),
      dob: str(r.dob),
      time: str(r.time),
      is_remember_time: typeof r.is_remember_time === 'boolean' ? r.is_remember_time : null,
      is_member: r.is_member === true,
      is_disable: r.is_disable === true,
    })
  }
  return out
}

export function friendName(f: FriendRow): string {
  return `${f.name}${f.surname ? ` ${f.surname}` : ''}`.replace(/\s+/g, ' ').trim() || 'ไม่ระบุชื่อ'
}

/** อักษรแรกของชื่อสำหรับวงรูป (ไม่มีรูป) — ชื่อว่างทั้งแถว → '?' */
export function friendInitial(f: FriendRow): string {
  const n = `${f.name ?? ''}`.trim()
  return n ? Array.from(n)[0] : '?'
}

/** '14 ก.ค. 2538' · ไม่ทราบเวลาเกิด → ต่อท้ายบรรทัดเดียว · วันเกิด parse ไม่ได้/ไม่มี → '' (ไม่เดา) */
export function friendBirthText(f: FriendRow): string {
  const date = f.dob ? formatThaiDateAbbr(f.dob.slice(0, 10)) : ''
  if (!date) return ''
  return f.is_remember_time === false ? `${date} · ไม่ทราบเวลาเกิด` : date
}

function norm(s: string): string {
  // สระอำแบบแยกส่วน (ํ + า) → ำ ก่อน NFC: U+0E33 อยู่ใน Composition Exclusion ของ Unicode จึงรวมให้เองไม่ได้
  return s.replace(/\u0E4D\u0E32/g, '\u0E33').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** ค้นหาแบบ "มีคำนี้อยู่ในชื่อหรือนามสกุล" — ไม่สนตัวพิมพ์/ช่องว่างซ้ำ/สระอำที่พิมพ์มาแบบแยกส่วน */
export function filterFriends(rows: FriendRow[], query: string): FriendRow[] {
  const needle = norm(query)
  if (!needle) return rows
  return rows.filter((f) => norm(friendName(f)).includes(needle))
}

// --- การ์ดเพื่อนบนโปรไฟล์ (AccountScreen) ---------------------------------------------------------
// ตัวเลขบนการ์ด = เพื่อนในรายชื่อ (บันทึกวันเกิดไว้) ให้ตรงกับหน้า /v2/friends ที่การ์ดพาไป.
// 🔴 รายชื่อโหลดไม่ได้ (saved = null) ไม่ใช่ "ไม่มีเพื่อน": ถ้าวาดสถานะว่างทับความล้มเหลว คนที่มีเพื่อน 20 คน
//    จะเห็น "ชวนเพื่อนคนแรก" — จึงใช้จำนวนชวนมาแบบเดิม (พฤติกรรมก่อนหน้าบนนี้) และวง "ธ" แทนชื่อที่ยังไม่รู้.
const GOAL_BONUS_QI = 1000
const FIRST_INVITE_QI = 50
const PLACEHOLDER_GLYPH = 'ธ'
const goalSub = (missing: string[]): string =>
  `เก็บครบ 5 ธาตุรับ ${GOAL_BONUS_QI.toLocaleString('th-TH')} QI${missing.length ? ` · ยังขาด${missing.join('และ')}` : ''}`
const placeholders = (n: number): string[] => Array.from({ length: Math.min(Math.max(n, 0), 3) }, () => PLACEHOLDER_GLYPH)

export type FriendsCardView = {
  /** มีเพื่อนให้โชว์วง (รายชื่อ หรือชวนมา) — false = ไอคอนวงเดียวของสถานะว่าง */
  has: boolean
  /** ตัวอักษรในวง avatar stack (≤3): อักษรแรกของชื่อเพื่อน หรือ "ธ" เมื่อรู้แค่จำนวน */
  stack: string[]
  /** "+N" เมื่อมีมากกว่า 3 */
  extra: number
  title: string
  sub: string
}

export function accountFriendsCard(saved: FriendRow[] | null, invited: number, missing: string[]): FriendsCardView {
  const invitedN = Number.isFinite(invited) ? Math.max(0, Math.floor(invited)) : 0
  if (saved === null) {
    return {
      has: invitedN > 0,
      stack: placeholders(invitedN),
      extra: Math.max(0, invitedN - 3),
      title: invitedN > 0 ? `เพื่อนของคุณ ${invitedN} คน` : 'สะสมเพื่อนให้ครบ 5 ธาตุ',
      sub: invitedN > 0 ? goalSub(missing) : `ชวนเพื่อนคนแรก รับ ${FIRST_INVITE_QI} QI`,
    }
  }
  const n = saved.length
  if (n > 0) {
    return { has: true, stack: saved.slice(0, 3).map(friendInitial), extra: n - 3, title: `เพื่อนของคุณ ${n} คน`, sub: goalSub(missing) }
  }
  if (invitedN > 0) {
    // ยังไม่บันทึกวันเกิดเพื่อนไว้เลย แต่ชวนคนเข้า MuMate แล้ว — บอกตามที่เป็น ไม่พูดว่า "ชวนเพื่อนคนแรก"
    return {
      has: true,
      stack: placeholders(invitedN),
      extra: Math.max(0, invitedN - 3),
      title: `เพื่อนที่ชวนมา ${invitedN} คน`,
      sub: goalSub(missing),
    }
  }
  return { has: false, stack: [], extra: 0, title: 'สะสมเพื่อนให้ครบ 5 ธาตุ', sub: `ชวนเพื่อนคนแรก รับ ${FIRST_INVITE_QI} QI` }
}
