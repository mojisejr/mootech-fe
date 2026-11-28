// lib/v2/friend-reading-engine.ts — เรียก engine สองทางสำหรับ "ดูดวงเพื่อน" (ประชุม 24 พ.ย. ข้อ 2) server-only
//   public-calc     → ชะตา (ChartPayload แบบเดียวกับหน้าดวง) + เสา 4 ต้น
//   reading-essence → ใจความดวง (บุคลิก/นิสัย/ความรัก/ข้อควรระวัง/เทพประจำตัว/จังหวะปี-เดือน)
// แยกจากไฟล์ route เพราะ pages/api ต้องมีแค่ default export · ไม่มีข้อความปั้น เป็นตัวส่งต่อให้ engine ล้วน ๆ
import { baziFetch } from '@/lib/bazi/fetch'
import type { FeCalcInput } from '@/lib/bazi-bridge/input'
import { EngineChartError, buildChartPayload, deriveChartCore, engineInputFor, fetchPublicCalc, type ChartPayload, type PublicCalcResponse } from '@/lib/chart/engine-chart'

const CALL_TIMEOUT_MS = 15000 // เท่า lane ของ /api/destiny — engine ค้างไม่ควรแขวนคำขอ

/** เสาหนึ่งต้นจาก public-calc (ก้าน+กิ่งเป็นอักษรจีน + ธาตุภาษาไทยจาก engine) — ไม่แปลงหรือเดาเอง */
export type FriendPillar = { stem: string; branch: string; stemElement: string; branchElement: string }
export type FriendChart = {
  chart: ChartPayload
  pillars: { year: FriendPillar | null; month: FriendPillar | null; day: FriendPillar | null; hour: FriendPillar | null }
}

type PublicCalcWide = Omit<PublicCalcResponse, 'pillars'> & { pillars?: Record<string, Partial<FriendPillar> | null> | null }

const pillarOf = (p: { stem?: string | null; branch?: string | null; stemElement?: string | null; branchElement?: string | null } | null | undefined): FriendPillar | null =>
  typeof p?.stem === 'string' && typeof p.branch === 'string' && p.stem && p.branch
    ? { stem: p.stem, branch: p.branch, stemElement: String(p.stemElement ?? ''), branchElement: String(p.branchElement ?? '') }
    : null

/** ชะตาของเพื่อน: เรียก public-calc ครั้งเดียว ได้ทั้งชะตาและเสา 4 ต้น (โยน EngineChartError เมื่อ engine ไม่ตอบ/ตอบไม่ได้) */
export async function computeFriendChart(fe: FeCalcInput & { dob: string }, base: string): Promise<FriendChart> {
  const resp = (await fetchPublicCalc(engineInputFor(fe), base)) as PublicCalcWide
  const core = deriveChartCore(resp)
  if (!core) throw new EngineChartError('public-calc answered without a mappable year branch / day stem')
  const p = resp.pillars ?? {}
  return {
    chart: buildChartPayload({ dob: fe.dob, time: typeof fe.time === 'string' ? fe.time : '', gender: String(fe.gender ?? '') }, core, null),
    pillars: { year: pillarOf(p.year), month: pillarOf(p.month), day: pillarOf(p.day), hour: pillarOf(p.hour) },
  }
}

/** ใจความดวงจาก /api/reading/reading-essence — โยนเมื่อ engine ตอบไม่สำเร็จ/ช้าเกิน 15 วินาที (ผู้เรียกจึงไม่หักชี) */
export async function postFriendEssence(rawInput: unknown, base: string): Promise<unknown> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), CALL_TIMEOUT_MS)
  try {
    const r = await baziFetch(`${base}/api/reading/reading-essence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rawInput),
      signal: ac.signal,
    })
    if (!r.ok) throw new Error(`reading-essence failed (${r.status})`)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}
