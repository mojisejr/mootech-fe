// Business Metrics data source (#mumate-ops-dashboard-phase1 Step 3). Queries mootech-fe's own
// Drizzle client directly (same Supabase DB mootech-be uses) — no new mootech-be endpoint.
//
// Date columns on log_calculate/log_survey/log_activity/payment are VARCHAR, not native
// timestamps, stored as 'YYYY-MM-DD HH:mm:ss' in Asia/Bangkok local time (verified against live
// data 2026-07-14 — see log-save-image.ts's `nowBangkok()` for the same writer convention). The
// format is zero-padded and lexically sortable, so a plain string range comparison is correct.
// Each of these columns got a dedicated CONCURRENTLY index (lib/db/0002_add_ops_date_indexes.sql)
// specifically so this range filter is an Index Only Scan, not the full seq scan it was before
// (verified via EXPLAIN — see PR description).
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logActivity, logCalculate, logSurvey, payment } from '@/lib/db/schema'

export type DateRange = { start: string; end: string; label: string }

export type MetricValue = { count: number; delta: number }
export type RevenueValue = { count: number; amount: number; deltaAmount: number }
export type ActivityValue = { count: number; points: number; deltaPoints: number }

export type BusinessMetrics = {
  calculate: MetricValue
  survey: MetricValue
  activityPoints: ActivityValue
  revenue: RevenueValue
  rangeLabel: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function bangkokYmd(now: Date): { y: number; m: number; d: number; label: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const p: Record<string, string> = {}
  for (const part of parts) p[part.type] = part.value
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), label: `${p.year}-${p.month}-${p.day}` }
}

function dayRange(y: number, m: number, d: number): DateRange {
  const start = `${y}-${pad(m)}-${pad(d)} 00:00:00`
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const end = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())} 00:00:00`
  return { start, end, label: `${y}-${pad(m)}-${pad(d)}` }
}

// [start, end) for "today" in Asia/Bangkok, formatted to match the varchar convention above.
export function todayBangkokRange(now: Date = new Date()): DateRange {
  const { y, m, d } = bangkokYmd(now)
  return dayRange(y, m, d)
}

export function yesterdayBangkokRange(now: Date = new Date()): DateRange {
  const { y, m, d } = bangkokYmd(now)
  const prev = new Date(Date.UTC(y, m - 1, d - 1))
  return dayRange(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate())
}

type RawTotals = { calc: number; survey: number; activityCount: number; activityPoints: number; revenueCount: number; revenueAmount: number }

async function fetchRawTotals(range: DateRange): Promise<RawTotals> {
  const { start, end } = range
  const [calcRows, surveyRows, activityRows, revenueRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(logCalculate).where(and(gte(logCalculate.createat, start), lt(logCalculate.createat, end))),
    db.select({ n: sql<number>`count(*)` }).from(logSurvey).where(and(gte(logSurvey.createat, start), lt(logSurvey.createat, end))),
    db
      .select({ n: sql<number>`count(*)`, points: sql<number>`coalesce(sum(${logActivity.point}), 0)` })
      .from(logActivity)
      .where(and(gte(logActivity.createat, start), lt(logActivity.createat, end))),
    db
      .select({ n: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(${payment.amount}), 0)` })
      .from(payment)
      .where(and(eq(payment.status, 'APPROVED'), gte(payment.submitAt, start), lt(payment.submitAt, end))),
  ])

  return {
    calc: Number(calcRows[0]?.n ?? 0),
    survey: Number(surveyRows[0]?.n ?? 0),
    activityCount: Number(activityRows[0]?.n ?? 0),
    activityPoints: Number(activityRows[0]?.points ?? 0),
    revenueCount: Number(revenueRows[0]?.n ?? 0),
    revenueAmount: Number(revenueRows[0]?.amount ?? 0),
  }
}

export async function fetchBusinessMetrics(
  range: DateRange = todayBangkokRange(),
  previousRange: DateRange = yesterdayBangkokRange(),
): Promise<BusinessMetrics> {
  const [today, yesterday] = await Promise.all([fetchRawTotals(range), fetchRawTotals(previousRange)])

  return {
    calculate: { count: today.calc, delta: today.calc - yesterday.calc },
    survey: { count: today.survey, delta: today.survey - yesterday.survey },
    activityPoints: {
      count: today.activityCount,
      points: today.activityPoints,
      deltaPoints: today.activityPoints - yesterday.activityPoints,
    },
    revenue: {
      count: today.revenueCount,
      amount: today.revenueAmount,
      deltaAmount: today.revenueAmount - yesterday.revenueAmount,
    },
    rangeLabel: range.label,
  }
}
