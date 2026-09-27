// Server side of the engine chart (mumate-be-retirement-001 slice 1): the parts that touch the app's
// database. The mapping itself lives in ./engine-chart (pure) so the drift measurement can reuse it.
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mergeEngineBirth } from '@/lib/bazi-bridge/engine-birth'
import { userRowToFeCalcInput, type FeCalcInput, type UserBirthRow } from '@/lib/bazi-bridge/input'
import {
  buildChartPayload,
  deriveChartCore,
  engineInputFor,
  EngineChartError,
  fetchPublicCalc,
  findElementCycle,
  toElementCycleRow,
  type ChartPayload,
  type ElementCycleRow,
} from './engine-chart'

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? (r as Record<string, unknown>[]) : ((r as { rows?: Record<string, unknown>[] })?.rows ?? [])

// `element_cycle` is a 20-row reference table nobody writes at runtime. Read it once per process (and
// again after an hour), instead of one query per home load on a pool of ONE connection (lib/db/index.ts).
const CYCLE_TTL_MS = 60 * 60 * 1000
let cycleCache: { at: number; rows: ElementCycleRow[] } | null = null

export async function loadElementCycles(now: number = Date.now()): Promise<ElementCycleRow[]> {
  if (cycleCache && now - cycleCache.at < CYCLE_TTL_MS) return cycleCache.rows
  const rows = rowsOf(
    await db.execute(
      sql`SELECT id, element, power, gender, element_friend, element_work, element_career,
                 element_fortune, element_spouse, element_supporter
          FROM element_cycle`,
    ),
  ).map(toElementCycleRow)
  if (rows.length > 0) cycleCache = { at: now, rows } // an empty read is not cached
  return rows
}

/** test-only */
export function _resetElementCycleCache(): void {
  cycleCache = null
}

/** Engine chart for one birth. Throws EngineChartError when the engine cannot answer or answers with
 *  glyphs we cannot map. A missing gender is NOT an error: the chart is returned with elementCycle null. */
export async function computeChartForBirth(
  birth: FeCalcInput & { dob: string },
  baseUrl: string = BAZI_BASE,
): Promise<ChartPayload> {
  const resp = await fetchPublicCalc(engineInputFor(birth), baseUrl)
  const core = deriveChartCore(resp)
  if (!core) throw new EngineChartError('public-calc answered without a mappable year branch / day stem')
  const cycles = await loadElementCycles()
  const cycle = findElementCycle(cycles, core.dayAbove.element, core.dayAbove.power, birth.gender)
  return buildChartPayload(
    { dob: birth.dob, time: typeof birth.time === 'string' ? birth.time : '', gender: String(birth.gender ?? '') },
    core,
    cycle,
  )
}

export type MemberChartResult =
  | { ok: true; chart: ChartPayload }
  | { ok: false; reason: 'no-user' | 'no-birth' }

/** The signed-in member's chart, live, from their CURRENT birth: the `user` row with the engine profile's
 *  birth on top (mergeEngineBirth - the same rule /api/destiny and /api/home-fortune apply, so the animal
 *  and stem agree with the persona element home shows). Throws EngineChartError when the engine fails. */
export async function computeMemberChart(userId: string): Promise<MemberChartResult> {
  const row = rowsOf(
    await db.execute(
      sql`SELECT user_id, name, dob, "time", gender, place_name, is_remember_time FROM "user" WHERE user_id = ${userId} LIMIT 1`,
    ),
  )[0]
  if (!row) return { ok: false, reason: 'no-user' }
  const merged = await mergeEngineBirth(userId, row as UserBirthRow)
  const fe = userRowToFeCalcInput(merged)
  const dob = typeof fe.dob === 'string' ? fe.dob.trim().slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return { ok: false, reason: 'no-birth' }
  const chart = await computeChartForBirth({ ...fe, dob })
  return { ok: true, chart }
}
