// Public Calculator usage — ops dashboard card (#public-bazi-calculator Phase 3, extends the
// PR#55/56 Business Metrics pattern). `calculator_usage_log.created_at` is a real `timestamptz`
// column (unlike the varchar date columns elsewhere in ops/metrics.ts) — native Date boundaries,
// not string-range comparison.
//
// Queries run SEQUENTIALLY, not via Promise.all: PR#56 found that two concurrent queries against
// the shared `max: 1` postgres connection (lib/db/index.ts) can hang indefinitely (see
// lib/ops/ai-usage.ts's fetchAiQuota for the full writeup) — root cause not fully understood, so
// staying conservative here rather than risking the same class of bug on a new query shape.
import { and, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { calculatorUsageLog } from '@/lib/db/schema'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function bangkokYmd(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const p: Record<string, string> = {}
  for (const part of parts) p[part.type] = part.value
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day) }
}

// [start, end) as real UTC instants for a Bangkok calendar day, `offsetDays` from today.
export function bangkokDayBoundary(offsetDays: number, now: Date = new Date()): { start: Date; end: Date; label: string } {
  const { y, m, d } = bangkokYmd(now)
  const base = new Date(Date.UTC(y, m - 1, d + offsetDays))
  // Bangkok is UTC+7 with no DST — a fixed offset is safe here.
  const start = new Date(base.getTime() - 7 * 3600_000)
  const end = new Date(start.getTime() + 24 * 3600_000)
  const label = `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`
  return { start, end, label }
}

export type CalculatorUsage = {
  today: number
  delta: number
  trend: Array<{ label: string; count: number }>
}

async function countInRange(start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(calculatorUsageLog)
    .where(and(gte(calculatorUsageLog.createdAt, start), lt(calculatorUsageLog.createdAt, end)))
  return Number(rows[0]?.n ?? 0)
}

export async function fetchCalculatorUsage(days = 7): Promise<CalculatorUsage> {
  const todayRange = bangkokDayBoundary(0)
  const todayCount = await countInRange(todayRange.start, todayRange.end)

  const yesterdayRange = bangkokDayBoundary(-1)
  const yesterdayCount = await countInRange(yesterdayRange.start, yesterdayRange.end)

  const trend: Array<{ label: string; count: number }> = []
  for (let offset = -(days - 1); offset <= 0; offset++) {
    const range = bangkokDayBoundary(offset)
    const count = offset === 0 ? todayCount : offset === -1 ? yesterdayCount : await countInRange(range.start, range.end)
    trend.push({ label: range.label, count })
  }

  return { today: todayCount, delta: todayCount - yesterdayCount, trend }
}
