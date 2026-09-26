// lib/v2/bazi-share.ts — payload ปาจื่อ (ผัง + วัยจร/ปีจร + ธาตุ 5) ที่ฝังไปกับ snapshot.fullText ตอนแชร์ดวงธาตุ.
// เอ็ม 2026-09-26: ดวงที่แชร์ให้ขึ้น "ผังปาจื่อ + วัยจรปัจจุบัน + ปีจรปัจจุบัน (ทั้งตาราง) + จุดแข็ง-จุดอ่อน 5 ธาตุ".
//   ไม่แก้ DB schema — เข้ารหัสเป็น JSON คั่นด้วย sentinel แล้ว prepend หน้า prose ใน fullText (writer=DestinyScreen,
//   reader=pages/invite/[code].tsx). ค่าทุกตัว "พร้อมแสดง" (สีธาตุ/ป้าย EN คำนวณจากฝั่ง DestinyScreen ที่มี helper ครบ)
//   หน้า invite จึงเรนเดอร์ตรง ๆ ไม่ต้องรู้ตรรกะปาจื่อ.

export type BaziGlyph = { ch: string; ink: string }
export type BaziPillar = {
  label: string // ลัคนา/ยาม/วัน/เดือน/ปี
  stem: string
  stemInk: string
  stemEn: string // "Yin Metal"
  branch: string
  branchInk: string
  branchEn: string // "rooster"
  hidden: BaziGlyph[] // ไส้แฝง 藏干
}
export type BaziLuckPhase = { range: string; sym: string; ink: string; band: string; qi?: string } // band = "ราศีบน"/"ราศีล่าง"
export type BaziLuckCard = {
  range: string // "43–52"
  current: boolean
  phases: BaziLuckPhase[]
  stem?: BaziGlyph // fallback เมื่อไม่มี phases
  branch?: BaziGlyph
}
export type BaziYearCard = {
  year: number
  be: number // พ.ศ.
  stem: BaziGlyph
  branch: BaziGlyph
  qi?: string
  age?: string // "อายุ 46 ปี"
  clash?: boolean
  current: boolean
}
export type BaziElement = {
  th: string // "ไม้"
  count: number | null
  role: string // "เพื่อน/พี่น้อง/หุ้นส่วน"
  nisai?: string
  tint: string // สีพื้นไอคอน
  mascot: string // path รูปมาสคอตธาตุ
}
export type BaziSharePayload = {
  headline: string // "ธาตุไม้หยาง"
  tagline?: string
  pillars: BaziPillar[]
  luck: BaziLuckCard[]
  years: BaziYearCard[]
  elements: BaziElement[]
}

const OPEN = '@@MBZ@@'
const CLOSE = '@@/MBZ@@'

/** เข้ารหัส payload เป็นสตริง sentinel เพื่อ prepend หน้า prose ใน fullText */
export function encodeBaziShare(p: BaziSharePayload): string {
  return `${OPEN}${JSON.stringify(p)}${CLOSE}`
}

/** แยก payload ปาจื่อ + prose ที่เหลือออกจาก fullText (best-effort — พังก็คืน prose เดิม) */
export function extractBaziShare(fullText: string | null | undefined): { bazi: BaziSharePayload | null; prose: string } {
  if (!fullText) return { bazi: null, prose: '' }
  const m = fullText.match(/@@MBZ@@([\s\S]*?)@@\/MBZ@@/)
  if (!m || m.index == null) return { bazi: null, prose: fullText.trim() }
  let bazi: BaziSharePayload | null = null
  try {
    bazi = JSON.parse(m[1]) as BaziSharePayload
  } catch {
    bazi = null
  }
  const prose = (fullText.slice(0, m.index) + fullText.slice(m.index + m[0].length)).trim()
  return { bazi, prose }
}
