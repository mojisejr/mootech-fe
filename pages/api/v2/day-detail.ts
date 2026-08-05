// BFF — v2 ปฏิทินดวง DAY DETAIL. Browser → this route → bazi man-vs-day(day) + almanac IN PARALLEL, then
// trims the ~2.3MB reply to only what the day screen renders (< 50KB). WHY a proxy (same as calendar-month):
// BAZI_BASE_URL is a SERVER env, birth data must not leave to a 3rd origin, no browser→bazi CORS.
//
// TWO upstreams (❗ must fire both): man-vs-day embeds only 9 almanac keys; deity · spirits(8เทพ) ·
// thaiLunar(วันพระ) · dayPillar/monthPillar/yearPillar(ธาตุ) come from the almanac fetch. The mapper
// (lib/v2-calendar/day-detail.ts) owns the field-by-field trim — every field traces to a raw upstream field.
//
// Gate: OPEN (ฟีม 2026-08-05, Track B — ยังไม่เปิดขาย, เปิดทั้ง free+paid; ก่อนเปิดขายค่อยพิจารณา gate เหมือน
// calendar-month). Cache per (user, birth-signature, date) — mirrors fortuneCacheKey so re-open a day is instant.
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { mapDayDetail, type DayDetail } from '@/lib/v2-calendar/day-detail'
import { BAZI_BASE, BAZI_TIMEOUT_MS, fetchAlmanacDays, type AlmanacDay } from '@/lib/v2-calendar/month'

type AlmanacDated = AlmanacDay & { date?: unknown }

function parseDate(input: unknown): { y: number; m: number; d: number; yearBE: number } | null {
  if (typeof input !== 'string') return null
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!mm) return null
  const y = Number(mm[1]); const m = Number(mm[2]); const d = Number(mm[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d, yearBE: y + 543 }
}

async function fetchFortuneDay(rawInput: unknown, date: string, signal: AbortSignal): Promise<unknown> {
  const r = await fetch(`${BAZI_BASE}/api/bazi/man-vs-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person: rawInput, date }),
    signal,
  })
  if (!r.ok) throw new Error(`man-vs-day ${r.status}`)
  return r.json()
}

// day-detail cache per (user, birth-signature, date) — deterministic in the birth input + date.
const dayCache = new Map<string, DayDetail>()
const DAY_CACHE_MAX = 512
const dayCacheKey = (userId: string, rawInput: unknown, date: string) => `${userId}:${JSON.stringify(rawInput)}:${date}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { person, date, userId } = (req.body ?? {}) as { person?: FeCalcInput; date?: string; userId?: string }

  const parsed = parseDate(date)
  if (!parsed) return res.status(400).json({ error: 'Invalid date; expected "YYYY-MM-DD".' })
  if (!person) return res.status(400).json({ error: 'person (birth data) is required.' })
  if (!userId) return res.status(400).json({ error: 'userId is required.' })

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
  try {
    const { rawInput } = toBaziInput(person)
    const key = dayCacheKey(userId, rawInput, date as string)
    const cached = dayCache.get(key)
    if (cached) {
      clearTimeout(timer)
      return res.status(200).json({ detail: cached, cached: true })
    }

    const [mvd, almanacDays] = await Promise.all([
      fetchFortuneDay(rawInput, date as string, ac.signal),
      fetchAlmanacDays(parsed.yearBE, parsed.m, ac.signal).catch(() => [] as AlmanacDay[]),
    ])
    clearTimeout(timer)

    const almanacDay = (almanacDays as AlmanacDated[]).find((a) => a && a.date === date) ?? null
    const detail = mapDayDetail(mvd, almanacDay)
    if (dayCache.size >= DAY_CACHE_MAX) dayCache.clear()
    dayCache.set(key, detail)
    return res.status(200).json({ detail })
  } catch {
    clearTimeout(timer)
    // upstream unreachable/timeout → graceful, never 5xx (UI shows its own retry state)
    return res.status(200).json({ detail: null, degraded: true })
  }
}
