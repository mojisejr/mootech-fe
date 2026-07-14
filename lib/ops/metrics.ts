// Business Metrics data source (#mumate-ops-dashboard-phase1 Step 3). Queries mootech-fe's own
// Drizzle client directly (same Supabase DB mootech-be uses) — no new mootech-be endpoint.
//
// Date columns on log_calculate/log_survey/log_activity/payment are VARCHAR, not native
// timestamps, stored as 'YYYY-MM-DD HH:mm:ss' in Asia/Bangkok local time (verified against live
// data 2026-07-14 — see log-save-image.ts's `nowBangkok()` for the same writer convention). The
// format is zero-padded and lexically sortable, so a plain string range comparison is correct
// and lets Postgres use the existing btree index on these columns (idx_...user_id indexes don't
// cover this, but the range still narrows the scan far below a full table scan).
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logActivity, logCalculate, logSurvey, payment } from '@/lib/db/schema'

export type BusinessMetrics = {
  calculate: { count: number }
  survey: { count: number }
  activityPoints: { count: number; points: number }
  revenue: { count: number; amount: number }
  rangeLabel: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// [start, end) for "today" in Asia/Bangkok, formatted to match the varchar convention above.
export function todayBangkokRange(now: Date = new Date()): { start: string; end: string; label: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const p: Record<string, string> = {}
  for (const part of parts) p[part.type] = part.value
  const y = Number(p.year)
  const m = Number(p.month)
  const d = Number(p.day)

  const start = `${p.year}-${p.month}-${p.day} 00:00:00`
  // Next calendar day — plain Date math (UTC-safe since we only use the Y/M/D parts).
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const end = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())} 00:00:00`

  return { start, end, label: `${p.year}-${p.month}-${p.day}` }
}

export async function fetchBusinessMetrics(range = todayBangkokRange()): Promise<BusinessMetrics> {
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
    calculate: { count: Number(calcRows[0]?.n ?? 0) },
    survey: { count: Number(surveyRows[0]?.n ?? 0) },
    activityPoints: { count: Number(activityRows[0]?.n ?? 0), points: Number(activityRows[0]?.points ?? 0) },
    revenue: { count: Number(revenueRows[0]?.n ?? 0), amount: Number(revenueRows[0]?.amount ?? 0) },
    rangeLabel: range.label,
  }
}
