// MIGRATED from NestJS GET /chinese-calendar/month  (Phase 1 backfill, #mootech-fullstack-supabase-fold)
// Read -> Supabase via Drizzle. Parity target: ChineseCalendarService.getCalendarMonth.
// is_allow uses the Phase 2 membership gate (only paid MEMBER -> SUCCESS -> allowed); data is
// returned regardless of allow, matching NestJS.
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chineseCalendar, holiday } from '@/lib/db/schema'
import { checkChineseCalendarUsage, AI_CODE } from '@/lib/usage'

function groupByFlags(data: any[]) {
  const result = {
    is_thai_buddhist_day: [] as number[],
    is_chinese_buddhist_day: [] as number[],
    is_doctor_day: [] as number[],
    is_good_day: [] as number[],
    is_thian_chai: [] as number[],
  }
  for (const d of data) {
    if (d.is_thai_buddhist_day) result.is_thai_buddhist_day.push(d.day)
    if (d.is_chinese_buddhist_day) result.is_chinese_buddhist_day.push(d.day)
    if (d.is_doctor_day) result.is_doctor_day.push(d.day)
    if (d.is_good_day) result.is_good_day.push(d.day)
    if (d.is_thian_chai) result.is_thian_chai.push(d.day)
  }
  return result
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const month = Number(req.query.month ?? 0)
    const year = Number(req.query.year ?? 0)
    const userId = (req.query.user_id as string) || null

    let isAllow = true
    if (userId != null) {
      const usage = await checkChineseCalendarUsage(userId)
      if (usage.code !== AI_CODE.SUCCESS) isAllow = false
    }

    const rows = await db
      .select()
      .from(chineseCalendar)
      .where(and(eq(chineseCalendar.month, month), eq(chineseCalendar.year, year)))
      .orderBy(asc(chineseCalendar.day))

    const calendars = rows.map((r) => ({
      day: Number(r.day),
      month: Number(r.month),
      year: Number(r.year),
      is_thai_buddhist_day: r.isThaiBuddhistDay,
      is_chinese_buddhist_day: r.isChineseBuddhistDay,
      is_doctor_day: r.isDoctorDay,
      is_good_day: r.isGoodDay,
      is_thian_chai: r.isThianChai,
    }))

    const groups = groupByFlags(calendars)

    const holidayRows = await db
      .select()
      .from(holiday)
      .where(and(eq(holiday.month, month), eq(holiday.year, year)))
      .orderBy(asc(holiday.day))
    const holidays = holidayRows.map((h) => ({
      day: Number(h.day),
      month: Number(h.month),
      year: Number(h.year),
      date: h.date,
      description: h.description,
    }))

    return res.status(200).json({ is_allow: isAllow, calendars, groups, holidays })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
