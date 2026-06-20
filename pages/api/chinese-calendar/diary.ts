// MIGRATED from NestJS GET /chinese-calendar/diary  (Phase 1 backfill, #mootech-fullstack-supabase-fold)
// Read -> Supabase via Drizzle. Parity target: ChineseCalendarService.getCalendarDairy.
// Composes 5 lookups: chinese_calendar (day/month/year) + scared_thing (by code) + analytic_color
// (element+STRONG -> JSON note = color codes) -> color (codes) + direction (good/bad). is_allow uses
// the Phase 2 membership gate; data returned regardless. Guards null lookups (NestJS would 500 on a
// missing analytic_color row; we skip it — a safe, non-divergent improvement).
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chineseCalendar, scaredThing, analyticColor, color, direction } from '@/lib/db/schema'
import { checkChineseCalendarUsage, AI_CODE } from '@/lib/usage'

// Map the Drizzle row to the NestJS entity shape (snake_case property names), coercing bigints.
function toEntity(r: typeof chineseCalendar.$inferSelect) {
  return {
    day: Number(r.day),
    month: Number(r.month),
    year: Number(r.year),
    is_thai_buddhist_day: r.isThaiBuddhistDay,
    is_chinese_buddhist_day: r.isChineseBuddhistDay,
    chinese_time_codes: r.chineseTimeCodes,
    chinese_time_ranges: r.chineseTimeRanges,
    scared_thing: r.scaredThing,
    color_1: r.color1,
    color_2: r.color2,
    direction_good: r.directionGood,
    direction_bad: r.directionBad,
    is_doctor_day: r.isDoctorDay,
    is_good_day: r.isGoodDay,
    is_thian_chai: r.isThianChai,
    desc_1: r.desc1,
    desc_2: r.desc2,
    percentage: r.percentage,
    above_1: Number(r.above1),
    above_2: Number(r.above2),
    above_3: Number(r.above3),
    below_1: Number(r.below1),
    below_2: Number(r.below2),
    below_3: Number(r.below3),
    time_change: r.timeChange,
  }
}

async function colorsForElement(element: string): Promise<any[]> {
  if (!element) return []
  const [analytic] = await db
    .select()
    .from(analyticColor)
    .where(and(eq(analyticColor.element, element), eq(analyticColor.level, 'STRONG')))
    .limit(1)
  if (!analytic?.note) return []
  let codes: string[]
  try {
    codes = JSON.parse(analytic.note)
  } catch {
    return []
  }
  if (!Array.isArray(codes) || codes.length === 0) return []
  return db.select({ name: color.name, hex: color.hex }).from(color).where(inArray(color.code, codes))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const day = Number(req.query.day ?? 0)
    const month = Number(req.query.month ?? 0)
    const year = Number(req.query.year ?? 0)
    const userId = (req.query.user_id as string) || null

    let isAllow = true
    if (userId != null) {
      const usage = await checkChineseCalendarUsage(userId)
      if (usage.code !== AI_CODE.SUCCESS) isAllow = false
    }

    const [row] = await db
      .select()
      .from(chineseCalendar)
      .where(
        and(eq(chineseCalendar.day, day), eq(chineseCalendar.month, month), eq(chineseCalendar.year, year)),
      )
      .limit(1)

    const result = row ? toEntity(row) : null

    let scaredThingInfo: { name: string; url: string } | null = null
    const colors: any[] = []
    let directionGood: any = null
    let directionBad: any = null

    if (result) {
      const [st] = await db
        .select({ name: scaredThing.name, url: scaredThing.url })
        .from(scaredThing)
        .where(eq(scaredThing.code, result.scared_thing))
        .limit(1)
      scaredThingInfo = st ?? null

      colors.push(...(await colorsForElement(result.color_1)))
      colors.push(...(await colorsForElement(result.color_2)))

      if (result.direction_good) {
        const [d] = await db.select().from(direction).where(eq(direction.code, result.direction_good)).limit(1)
        directionGood = d ? { id: Number(d.id), code: d.code, description: d.description } : null
      }
      if (result.direction_bad) {
        const [d] = await db.select().from(direction).where(eq(direction.code, result.direction_bad)).limit(1)
        directionBad = d ? { id: Number(d.id), code: d.code, description: d.description } : null
      }
    }

    return res.status(200).json({
      is_allow: isAllow,
      result,
      scared_thing: scaredThingInfo,
      colors,
      direction_good: directionGood,
      direction_bad: directionBad,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
