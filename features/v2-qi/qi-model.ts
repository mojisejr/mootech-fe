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
  createdAt: string
}

export type Wallet = {
  anonId?: string
  qi?: number
  coins?: number
  xp?: number
  level?: number | string
  history?: WalletHistoryRow[]
}

export type Referral = {
  anonId?: string
  code?: string
  inviteUrl?: string
  invitedCount?: number
  rewardPerInvite?: number
}

export type Mission = {
  id: string
  title: string
  description: string
  period: "daily" | "once"
  target: number
  rewardCoins: number
  rewardXp: number
  count: number
  completed: boolean
  claimedAt: string | null
}

export type MissionBoard = { anonId: string; date: string; missions: Mission[] }

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
}

/** reason ดิบของ ledger → ข้อความไทยที่คนอ่านออก; ภารกิจอาจส่ง titles map (id → ชื่อ) มาเติม */
export function reasonLabel(reason: string | null, missionTitles?: Map<string, string>): string {
  if (!reason) return "ภารกิจ"
  if (reason.startsWith("qi:earn:")) return EARN_LABELS[reason.slice(8)] ?? reason.slice(8)
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
