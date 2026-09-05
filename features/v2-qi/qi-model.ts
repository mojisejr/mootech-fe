// features/v2-qi/qi-model.ts — types + helpers กลางของระบบชี่ ใช้ร่วมกันทุกจอในกลุ่ม /v2/qi.
//
// ที่มาเดียวของความจริง = engine pdf-dev (bazi-sft-dataset):
//   /api/qi/wallet·earn·spend·catalog·entitlements · /api/missions · /api/referral
// ตัวเลขโบนัส/ราคาทุกตัวที่จอแสดงมาจาก catalog ของ engine เสมอ — ห้าม hardcode ทับในจอ.
// reason ใน ledger มีรูปแบบตายตัว: `qi:earn:<code>` · `qi:spend:<code>` · `qi:refund:<code>` ·
//   `mission:<id>` · `referral:inviter|referee` (ตรวจจาก src/lib/bazi/qi/engine.ts + /api/referral).

export type WalletHistoryRow = {
  id: number | string
  qiDelta: number
  reason: string | null
  /** อ้างอิงเสริม — สำหรับ streak_restore = วันที่ (YYYY-MM-DD) ที่กู้คืน */
  ref?: string | null
  createdAt: string
}

export type Wallet = {
  anonId?: string
  qi?: number
  coins?: number
  xp?: number
  level?: number | string
  nextLevelXp?: number
  levelStartXp?: number
  history?: WalletHistoryRow[]
}

export type ReferralFriend = { name: string; joinedAt?: string | null; rewardQi?: number }
export type Referral = {
  anonId?: string
  code?: string
  inviteUrl?: string
  invitedCount?: number
  rewardPerInvite?: number
  friends?: ReferralFriend[]
}

export type MissionCategory = "daily" | "once" | "longterm"

export type Mission = {
  id: string
  title: string
  description: string
  period: "daily" | "once"
  /** กลุ่มบนจอ mission-board (ทำได้ทุกวัน/ครั้งเดียวจบ/ระยะยาว) */
  category: MissionCategory
  target: number
  /** รางวัล QI (ชื่อ field เดิม rewardCoins — engine เครดิตเป็น qi แล้ว) */
  rewardCoins: number
  rewardXp: number
  count: number
  completed: boolean
  claimedAt: string | null
  /** ปุ่ม "ทำเลย" → เส้นทางในแอป (เว้นว่าง = เสร็จเองจากที่อื่น เช่นเช็คอิน) */
  actionHref?: string
}

/** เป้าหมายระยะยาวที่คิดจาก referral (engine ส่งมาใน board.goals) */
export type MissionGoals = {
  referral: { invited: number; rewardPerInviteQi: number; earnedQi: number }
  element: { target: number; collected: number; bonusQi: number; elements: { key: string; collected: boolean }[] }
}

export type MissionBoard = { anonId: string; date: string; missions: Mission[]; goals?: MissionGoals }

export type QiEarnLine = {
  code: string
  qi: number
  limit: "once" | "daily" | "per_referral" | "none"
  title: string
  note: string
}

export type QiSpendGrant =
  | { type: "credit"; kind: "card_use" | "chat_question" | "matching_slot"; credits: number }
  | { type: "owned"; kind: "course" | "book"; sku: string }
  | { type: "tier"; sku: "plus" | "pro"; durationDays: number }

export type QiSpendLine = {
  code: string
  qi: number
  grant: QiSpendGrant
  title: string
  note: string
}

export type QiCatalog = { earn: QiEarnLine[]; spend: QiSpendLine[] }

export type Entitlements = {
  anonId?: string
  qi?: number
  tier?: "free" | "plus" | "pro"
  credits?: { card_use?: number; chat_question?: number; matching_slot?: number }
  owned?: Array<{ kind: string; sku: string }>
}

/** วันที่แบบ Asia/Bangkok (YYYY-MM-DD) จาก timestamp — engine ตัดรอบ daily ด้วยเขตเวลาเดียวกันนี้
 * (createdAt ของ engine เป็น ISO UTC — ต้องแปลงเขตก่อนเทียบ ไม่ใช่ slice ตัวอักษร) */
export function bangkokDay(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso)
}

/** วันที่วันนี้แบบ Asia/Bangkok (YYYY-MM-DD) */
export function todayBangkok(now: Date = new Date()): string {
  return bangkokDay(now)
}

/** เช็คอินวันนี้แล้วหรือยัง — ดูจากประวัติ: แถว `qi:earn:daily_login` ล่าสุดตรงกับวันนี้ (Bangkok) หรือไม่
 * (engine cap ด้วย bazi_qi_claim อยู่แล้ว — อ่านจาก history เพื่อ "โชว์สถานะก่อนกด" ไม่ใช่เป็นด่าน) */
export function checkedInToday(history: WalletHistoryRow[] | undefined, today: string): boolean {
  if (!history?.length) return false
  return history.some(
    (h) => h.reason === "qi:earn:daily_login" && bangkokDay(h.createdAt) === today,
  )
}

/** วันที่เช็คอินทั้งหมด (YYYY-MM-DD แบบ Bangkok) จากประวัติ — ใช้วาด strip/streak ของจอเช็คอิน */
export function checkedInDays(history: WalletHistoryRow[] | undefined): Set<string> {
  const days = new Set<string>()
  for (const h of history ?? []) {
    if (h.reason === "qi:earn:daily_login") days.add(bangkokDay(h.createdAt))
    // กู้คืนสตรีค: แถวหักแต้ม qi:spend:streak_restore ถือ ref = วันที่ที่กู้ (นับเป็นวันเช็คอินย้อนหลัง)
    else if (h.reason === "qi:spend:streak_restore" && h.ref) days.add(h.ref)
  }
  return days
}

/** วันก่อนหน้า (YYYY-MM-DD แบบ Bangkok) — ใช้ 12:00 UTC ของวันก่อนหน้า = 19:00 ไทย กลางวันเสมอ */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  return bangkokDay(new Date(Date.UTC(y, m - 1, d - 1, 12)))
}

/** สตรีคเช็คอิน (วันต่อเนื่องนับถอยหลังจากวันอ้างอิง): ยังไม่เช็คอินวันนี้ = สตรีคยังไม่หัก
 * (นับถอยหลังจาก "เมื่อวาน" ได้ถ้าวันนี้ยังว่าง — สตรีคตายเมื่อข้ามคืนโดยไม่เช็คอิน ไม่ใช่ตอนยังไม่กด) */
export function checkinStreak(history: WalletHistoryRow[] | undefined, today: string): number {
  const days = checkedInDays(history)
  if (!days.has(today)) return streakFrom(days, dayBefore(today))
  return streakFrom(days, today)
}

function streakFrom(days: Set<string>, startDay: string): number {
  let count = 0
  let cursor = startDay
  while (days.has(cursor)) {
    count += 1
    cursor = dayBefore(cursor)
    if (count > 366) break // กันวนไม่จบถ้าข้อมูลเพี้ยน
  }
  return count
}

const EARN_LABELS: Record<string, string> = {
  signup: "โบนัสสมัครใหม่",
  daily_login: "เช็คอินรายวัน",
  share: "แชร์คอนเทนต์",
  referral_free: "ชวนเพื่อนสมัครฟรี",
  referral_plus: "ชวนเพื่อนอัปเกรด PLUS",
  referral_pro: "ชวนเพื่อนอัปเกรด PRO",
  wuxing_matrix: "แคมเปญ Wu-Xing Matrix",
}

const SPEND_LABELS: Record<string, string> = {
  card_use: "เปิดการ์ด/เสี่ยงทาย",
  chat_question: "ถาม AI",
  matching_slot: "ช่องจับคู่สมพงษ์",
  course_destiny: "คอร์สลิขิตชีวิต",
  plus_month: "แพ็กเกจ PLUS 1 เดือน",
  book_lifecode: "หนังสือ Life Code",
  birth_edit: "แก้วันเกิด",
}

/** reason ดิบของ ledger → ข้อความไทยที่คนอ่านออก; ภารกิจอาจส่ง titles map (id → ชื่อ) มาเติม */
export function reasonLabel(reason: string | null, missionTitles?: Map<string, string>): string {
  if (!reason) return "ภารกิจ"
  if (reason.startsWith("qi:earn:")) return EARN_LABELS[reason.slice(8)] ?? reason.slice(8)
  if (reason.startsWith("qi:buy:")) {
    // qi:buy:QI_200 — ปริมาณฝังใน package_code (catalog รับรองรูปแบบอยู่แล้ว)
    const m = /^QI_(\d+)$/.exec(reason.slice(7))
    return m ? `ซื้อแพ็ก ${Number(m[1]).toLocaleString("th-TH")} QI` : "ซื้อแพ็ก QI"
  }
  if (reason.startsWith("qi:spend:")) return `แลก ${SPEND_LABELS[reason.slice(9)] ?? reason.slice(9)}`
  if (reason.startsWith("qi:refund:")) return `คืนแต้ม — ${SPEND_LABELS[reason.slice(10)] ?? reason.slice(10)} ล้ม`
  if (reason.startsWith("mission:")) {
    const id = reason.slice(8)
    return missionTitles?.get(id) ?? `ภารกิจ ${id}`
  }
  if (reason === "referral:inviter") return "เพื่อนใช้โค้ดของคุณ"
  if (reason === "referral:referee") return "ใช้โค้ดแนะนำสำเร็จ"
  return reason
}
