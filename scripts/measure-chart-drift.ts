// measure-chart-drift — DoD B2 of mumate-be-retirement-001 slice 1 (plan rev 0.4, R2/R3).
//
// For every registered member, compares the chart they saw until now (their CURRENT `log_calculate` row,
// found through `user.result_code`) with what v2 shows after slice 1 (the engine-derived chart on their
// current birth, lib/chart/engine-chart.ts — the same mapping the routes use). Prints AGGREGATE COUNTS
// ONLY: never a user id, a code, a name or a birth date.
//
// Usage (read-only; run it against a restored arena, never production directly):
//   MEASURE_DATABASE_URL='postgres://…' MEASURE_ENGINE_URL='http://…:3100' \
//     npx tsx scripts/measure-chart-drift.ts [--concurrency 4] [--limit N]
// (--db / --engine flags work too, but the env keeps the DB password out of `ps` and shell history.)
//
// The session is opened with default_transaction_read_only=on, so any write would be refused by
// Postgres itself. The engine is called once per member (public-calc is DB-free on the engine side).
import postgres from 'postgres'
import {
  deriveChartCore,
  engineInputFor,
  fetchPublicCalc,
  findElementCycle,
  toElementCycleRow,
  type ElementCycleRow,
} from '../lib/chart/engine-chart'
import { applyEngineProfileBirth, userRowToFeCalcInput, type UserBirthRow } from '../lib/bazi-bridge/input'

// ---- pure classification (exported for scripts/measure-chart-drift.test.ts) -------------------------

export type LegacyChart = { yearId: number | null; element: string | null; power: string | null; cycleId: number | null }
export type EngineSide = { yearId: number; element: string; power: string; cycleId: number | null }
export type Cause = 'birthChanged' | 'newYearWindow' | 'lateHour' | 'other'

/** The five values v2 read from a stored BE chart. null when the JSON is unusable. */
export function readLegacyChart(result: unknown): LegacyChart | null {
  let j: any
  try {
    j = typeof result === 'string' ? JSON.parse(result) : result
  } catch {
    return null
  }
  const yb = j?.detail?.yearBelow
  const da = j?.detail?.dayAbove
  if (!yb && !da) return null
  const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    yearId: num(yb?.id),
    element: typeof da?.element === 'string' ? da.element : null,
    power: typeof da?.power === 'string' ? da.power : null,
    cycleId: num(j?.elementCycle?.id),
  }
}

/** Month-day inside Jan 20 – Feb 20: the window where the legacy year boundary (lunar new year) and the
 *  engine's (立春, ~Feb 4) can disagree. */
export function inNewYearWindow(dob: string): boolean {
  const md = dob.slice(5, 10)
  return md >= '01-20' && md <= '02-20'
}

/** Birth time 23:00-23:59: the engine starts the next day at 23:00 (子時), the legacy chart ignored time. */
export function inLateHour(time: string): boolean {
  return /^23:[0-5]\d$/.test(time)
}

const normTime = (t: unknown) => (typeof t === 'string' ? t.trim().slice(0, 5) : '')
const normGender = (g: unknown) => (typeof g === 'string' ? g.trim().toUpperCase() : '')

export function classifyCause(
  current: { dob: string; time: string; gender: unknown },
  chartInputs: { dob: unknown; time: unknown; gender: unknown },
): Cause {
  const chartDob = typeof chartInputs.dob === 'string' ? chartInputs.dob.slice(0, 10) : ''
  if (
    chartDob !== current.dob ||
    normTime(chartInputs.time) !== normTime(current.time) ||
    normGender(chartInputs.gender) !== normGender(current.gender)
  ) {
    return 'birthChanged'
  }
  if (inNewYearWindow(current.dob)) return 'newYearWindow'
  if (inLateHour(current.time)) return 'lateHour'
  return 'other'
}

export type Tally = {
  membersWithResultCode: number
  skipped: { refreshFlagged: number; noLegacyChart: number; noBirth: number; engineError: number; engineUnmappable: number }
  compared: number
  same: number
  animalDiffers: number
  elementOrPowerDiffers: number
  cycle: { same: number; differs: number; newlyAvailable: number; lost: number; noneEitherSide: number }
  anyDifference: number
  anyDifferenceByCause: Record<Cause, number>
  animalDiffersByCause: Record<Cause, number>
}

export function emptyTally(): Tally {
  const causes = (): Record<Cause, number> => ({ birthChanged: 0, newYearWindow: 0, lateHour: 0, other: 0 })
  return {
    membersWithResultCode: 0,
    skipped: { refreshFlagged: 0, noLegacyChart: 0, noBirth: 0, engineError: 0, engineUnmappable: 0 },
    compared: 0,
    same: 0,
    animalDiffers: 0,
    elementOrPowerDiffers: 0,
    cycle: { same: 0, differs: 0, newlyAvailable: 0, lost: 0, noneEitherSide: 0 },
    anyDifference: 0,
    anyDifferenceByCause: causes(),
    animalDiffersByCause: causes(),
  }
}

/** Fold one compared member into the tally. "Any difference" counts what a member can SEE change: the
 *  animal, the day element/yin-yang, or a cycle row that differs or disappears. A cycle that becomes
 *  available where the legacy chart had none is counted on its own, not as a difference. */
export function tallyMember(t: Tally, legacy: LegacyChart, engine: EngineSide, cause: Cause): void {
  t.compared++
  const animal = legacy.yearId !== engine.yearId
  const elem = legacy.element !== engine.element || legacy.power !== engine.power
  let cycleChanged = false
  if (legacy.cycleId === null && engine.cycleId === null) t.cycle.noneEitherSide++
  else if (legacy.cycleId === null) t.cycle.newlyAvailable++
  else if (engine.cycleId === null) (t.cycle.lost++, (cycleChanged = true))
  else if (legacy.cycleId !== engine.cycleId) (t.cycle.differs++, (cycleChanged = true))
  else t.cycle.same++
  if (animal) (t.animalDiffers++, t.animalDiffersByCause[cause]++)
  if (elem) t.elementOrPowerDiffers++
  if (animal || elem || cycleChanged) (t.anyDifference++, t.anyDifferenceByCause[cause]++)
  else t.same++
}

// ---- I/O ----------------------------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const dbUrl = arg('db') ?? process.env.MEASURE_DATABASE_URL
  const engineUrl = arg('engine') ?? process.env.MEASURE_ENGINE_URL
  const concurrency = Math.max(1, Number(arg('concurrency') ?? 4) || 4)
  const limit = arg('limit') ? Number(arg('limit')) : undefined
  if (!dbUrl || !engineUrl) {
    console.error('usage: MEASURE_DATABASE_URL=… MEASURE_ENGINE_URL=… npx tsx scripts/measure-chart-drift.ts [--concurrency 4] [--limit N]')
    process.exit(2)
  }
  if (/bazichart\.mumate\.co/i.test(engineUrl)) throw new Error('[GUARDRAIL] engine URL points at old prod')

  const sql = postgres(dbUrl, {
    prepare: false,
    max: 1,
    connection: { default_transaction_read_only: 'on', application_name: 'measure-chart-drift' },
  })
  try {
    const cycles: ElementCycleRow[] = (await sql`SELECT * FROM element_cycle`).map((r) => toElementCycleRow(r as Record<string, unknown>))

    // One row per member with a result_code: their birth now (user + engine profile) and the chart row
    // the old home read (same code AND user_id — BE's own lookup, chinese-horoscope.service.ts:1340).
    const rows = await sql`
      SELECT u.dob, u."time", u.is_remember_time, u.gender, u.place_name, u.is_refresh,
             p.birth_date::text AS birth_date, p.birth_time::text AS birth_time, p.time_unknown,
             l.result, l.dob AS chart_dob, l."time" AS chart_time, l.gender AS chart_gender
      FROM "user" u
      LEFT JOIN bazi_user_profile p ON p.anon_id = u.user_id
      LEFT JOIN LATERAL (
        SELECT result, dob, "time", gender FROM log_calculate
        WHERE code = u.result_code AND user_id = u.user_id
        ORDER BY id DESC LIMIT 1
      ) l ON true
      WHERE coalesce(u.result_code, '') <> ''
      ${limit ? sql`LIMIT ${limit}` : sql``}`

    const t = emptyTally()
    t.membersWithResultCode = rows.length
    let next = 0
    let done = 0

    async function worker() {
      for (;;) {
        const i = next++
        if (i >= rows.length) return
        const r = rows[i]
        try {
          if (r.is_refresh === true) {
            t.skipped.refreshFlagged++ // home sends these to /v2/register; they never see the mascot
            continue
          }
          const legacy = r.result === null || r.result === undefined ? null : readLegacyChart(r.result)
          if (!legacy) {
            t.skipped.noLegacyChart++
            continue
          }
          const merged = applyEngineProfileBirth(r as unknown as UserBirthRow, {
            birth_date: r.birth_date,
            birth_time: r.birth_time,
            time_unknown: r.time_unknown,
          })
          const fe = userRowToFeCalcInput(merged)
          const dob = typeof fe.dob === 'string' ? fe.dob.slice(0, 10) : ''
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            t.skipped.noBirth++
            continue
          }
          let resp
          try {
            resp = await fetchPublicCalc(engineInputFor({ ...fe, dob }), engineUrl as string)
          } catch {
            t.skipped.engineError++
            continue
          }
          const core = deriveChartCore(resp)
          if (!core) {
            t.skipped.engineUnmappable++
            continue
          }
          const cycle = findElementCycle(cycles, core.dayAbove.element, core.dayAbove.power, r.gender)
          const time = typeof fe.time === 'string' ? fe.time : ''
          const cause = classifyCause(
            { dob, time, gender: r.gender },
            { dob: r.chart_dob, time: r.chart_time, gender: r.chart_gender },
          )
          tallyMember(
            t,
            legacy,
            { yearId: core.yearBelow.id, element: core.dayAbove.element, power: core.dayAbove.power, cycleId: cycle ? cycle.id : null },
            cause,
          )
        } finally {
          done++
          if (done % 250 === 0) console.error(`… ${done}/${rows.length}`)
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker))

    console.log(
      JSON.stringify(
        {
          measure: 'mumate-be-retirement-001 slice 1 chart drift (legacy stored chart vs engine on current birth)',
          note: 'aggregate counts only; causes: birthChanged = the stored chart was computed from a different dob/time/gender than the current birth; newYearWindow = born Jan 20-Feb 20; lateHour = birth time 23:00-23:59; other = none of these',
          ...t,
        },
        null,
        2,
      ),
    )
  } finally {
    await sql.end()
  }
}

// Run only when executed directly (the test imports the pure helpers above).
const isMain = typeof process !== 'undefined' && Array.isArray(process.argv) && /measure-chart-drift\.ts$/.test(process.argv[1] ?? '')
if (isMain) {
  main().catch((e) => {
    // The message of a failed connection can echo the URL; print the class of error only.
    console.error(`measure-chart-drift failed: ${e?.code ?? e?.name ?? 'error'}`)
    process.exit(1)
  })
}
