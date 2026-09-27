// The member's chart, derived from the bazi engine (mumate-be-retirement-001 slice 1, plan rev 0.4, C1).
//
// v2 reads five things from a "chart": the year animal, the day stem's element and yin/yang, the
// `element_cycle` row, and the birth it was computed from. mootech-be used to compute those from its
// own legacy tables and store them as one JSON blob in `log_calculate`. The owner decided (R2/R3) that
// v2 is bazi-only: these values now come live from the engine's `POST /api/bazi/public-calc`, and the
// engine wins wherever it disagrees with the legacy chart (births near Chinese New Year, 23:00-24:00).
//
// This module is PURE apart from fetchPublicCalc (a plain HTTP call, no DB). It is shared by the
// session-bound routes (lib/chart/engine-chart-server.ts) and by scripts/measure-chart-drift.ts, which
// must be able to import it without constructing the app's database client.
//
// Engine fields used (bazi-sft-dataset origin/pdf-dev src/app/api/bazi/public-calc/route.ts):
//   pillars.year.branch  - earthly-branch glyph of the year pillar  -> year animal (ZODIAC_TABLE)
//   pillars.day.stem     - heavenly-stem glyph of the day pillar    -> element + yin/yang (STEM_TABLE)
//   dayMaster            - the same day stem, used only if pillars.day is missing
import { ZODIAC_TABLE } from '@/lib/personalization/zodiac'
import { toBaziInput, type FeCalcInput, type BaziRawInput } from '@/lib/bazi-bridge/input'

export type ChartElement = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER'
export type ChartPower = 'YANG' | 'YIN'
export type ChartGender = 'MALE' | 'FEMALE'

// The ten heavenly stems, keyed by glyph. VERIFIED row for row against the reference table BE reads the
// day stem from, `chinese_horoscope8_square_above` (lib/db/schema.ts:210; BE
// chinese-horoscope.service.ts:245-252), on the local testenv copy 2026-09-27: id, chinese_symbol,
// element and power are exactly these. scripts/engine-chart.test.ts pins the table, and
// scripts/engine-chart-db.test.ts re-checks it against Postgres when TEST_DATABASE_URL is set.
// The vocabulary (WOOD..WATER, YANG/YIN) is the one `element_cycle` is keyed by.
export const STEM_TABLE: Readonly<Record<string, { id: number; element: ChartElement; power: ChartPower }>> = {
  甲: { id: 1, element: 'WOOD', power: 'YANG' },
  乙: { id: 2, element: 'WOOD', power: 'YIN' },
  丙: { id: 3, element: 'FIRE', power: 'YANG' },
  丁: { id: 4, element: 'FIRE', power: 'YIN' },
  戊: { id: 5, element: 'EARTH', power: 'YANG' },
  己: { id: 6, element: 'EARTH', power: 'YIN' },
  庚: { id: 7, element: 'METAL', power: 'YANG' },
  辛: { id: 8, element: 'METAL', power: 'YIN' },
  壬: { id: 9, element: 'WATER', power: 'YANG' },
  癸: { id: 10, element: 'WATER', power: 'YIN' },
}

/** The subset of the public-calc response this module reads. */
export type PublicCalcResponse = {
  dayMaster?: string | null
  pillars?: {
    year?: { stem?: string | null; branch?: string | null } | null
    day?: { stem?: string | null; branch?: string | null } | null
  } | null
}

/** What the engine gives us, in the legacy chart's own vocabulary. */
export type EngineChartCore = {
  yearBelow: { id: number; constellation: string; chinese_symbol: string }
  dayAbove: { id: number; chinese_symbol: string; element: ChartElement; power: ChartPower }
}

/** The DB `element_cycle` row, in the snake_case shape BE stored it under `chart.elementCycle`
 *  (features/v2-first-run/hooks/first-run-source-map.ts cycleFromChart reads these keys). */
export type ElementCycleRow = {
  id: number
  element: string
  power: string
  gender: string
  element_friend: string
  element_work: string
  element_career: string
  element_fortune: string
  element_spouse: string
  element_supporter: string
}

const BRANCH_ROW = new Map(ZODIAC_TABLE.map((z) => [z.branch, z]))

/** Map a public-calc response to the year animal and the day stem. null when either glyph is missing
 *  or unknown - the caller reports "no chart", it never guesses one. */
export function deriveChartCore(resp: PublicCalcResponse | null | undefined): EngineChartCore | null {
  // NFC: the legacy reference table stores 辰 as the CJK COMPATIBILITY ideograph U+F971 (found by
  // scripts/engine-chart-db.test.ts), the engine and ZODIAC_TABLE use U+8FB0. NFC folds the former into
  // the latter, so a glyph from either source maps.
  const branch = (resp?.pillars?.year?.branch ?? '').trim().normalize('NFC')
  const stem = (resp?.pillars?.day?.stem ?? resp?.dayMaster ?? '').trim().normalize('NFC')
  const z = BRANCH_ROW.get(branch)
  const s = STEM_TABLE[stem]
  if (!z || !s) return null
  return {
    yearBelow: { id: z.id, constellation: z.en, chinese_symbol: z.branch },
    dayAbove: { id: s.id, chinese_symbol: stem, element: s.element, power: s.power },
  }
}

/** `element_cycle.gender` is 'MALE' | 'FEMALE' (verified on testenv; BE queries it with the value the
 *  client sent, chinese-horoscope.service.ts:843-849, and skips the lookup when gender is empty).
 *  Anything else - missing, blank, a typo - has no row: null, never a default. */
export function normalizeChartGender(g: unknown): ChartGender | null {
  const s = typeof g === 'string' ? g.trim().toUpperCase() : ''
  return s === 'MALE' || s === 'FEMALE' ? s : null
}

/** BE's lookup (element-cycle.service.ts: findOne where element, power, gender), over the 20 rows.
 *  No gender -> null, which first-run shows as `unavailable` (the same answer BE's skipped join gave). */
export function findElementCycle(
  rows: readonly ElementCycleRow[],
  element: string,
  power: string,
  gender: unknown,
): ElementCycleRow | null {
  const g = normalizeChartGender(gender)
  if (!g) return null
  return rows.find((r) => r.element === element && r.power === power && r.gender === g) ?? null
}

/** Coerce a raw DB row (bigserial id may arrive as a string or bigint) to ElementCycleRow. */
export function toElementCycleRow(r: Record<string, unknown>): ElementCycleRow {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : String(r[k] ?? ''))
  return {
    id: Number(r.id),
    element: s('element'),
    power: s('power'),
    gender: s('gender'),
    element_friend: s('element_friend'),
    element_work: s('element_work'),
    element_career: s('element_career'),
    element_fortune: s('element_fortune'),
    element_spouse: s('element_spouse'),
    element_supporter: s('element_supporter'),
  }
}

// BE's LogCalculateService.generateRandomString: 12 characters from [a-zA-Z0-9]. Same alphabet and
// length, so a code minted here is indistinguishable from one BE minted. crypto-backed instead of
// Math.random (a result_code is not a secret, but there is no reason to make it guessable either).
const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
export const RESULT_CODE_RE = /^[A-Za-z0-9]{12}$/

export function generateResultCode(randomIndex: (n: number) => number = cryptoIndex): string {
  let out = ''
  for (let i = 0; i < 12; i++) out += CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)]
  return out
}

function cryptoIndex(n: number): number {
  // Rejection sampling over one byte keeps the distribution uniform for n = 62.
  const limit = 256 - (256 % n)
  const buf = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % n
  }
}

/** The chart as v2 consumes it: the legacy chart's paths (detail.yearBelow, detail.dayAbove.element,
 *  elementCycle, dob/time/gender), so toComputeSource and cycleFromChart read it unchanged. Used both as
 *  the GET /api/chinese-horoscope `data` and as the minimal `log_calculate.result` JSON. */
export type ChartPayload = {
  source: 'bazi-engine'
  dob: string
  time: string
  gender: string
  yearOfZodiac: { below: string }
  summary: { element: ChartElement; power: ChartPower; yearBelow: string; dayAbove: string }
  detail: EngineChartCore
  elementCycle: ElementCycleRow | null
}

export function buildChartPayload(
  birth: { dob: string; time: string; gender: string },
  core: EngineChartCore,
  cycle: ElementCycleRow | null,
): ChartPayload {
  return {
    source: 'bazi-engine',
    dob: birth.dob,
    time: birth.time,
    gender: birth.gender,
    yearOfZodiac: { below: core.yearBelow.chinese_symbol },
    summary: {
      element: core.dayAbove.element,
      power: core.dayAbove.power,
      yearBelow: core.yearBelow.chinese_symbol,
      dayAbove: core.dayAbove.chinese_symbol,
    },
    detail: core,
    elementCycle: cycle,
  }
}

/** The engine request for a birth: the same FE -> bazi mapper /api/destiny and /api/home-fortune use
 *  (unknown time -> 12:00, province defaults to Bangkok), so the animal and stem agree with the
 *  persona element home already shows. */
export function engineInputFor(birth: FeCalcInput): BaziRawInput {
  return toBaziInput(birth).rawInput
}

export class EngineChartError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EngineChartError'
  }
}

export const PUBLIC_CALC_TIMEOUT_MS = 8000

/** POST /api/bazi/public-calc. Throws EngineChartError on timeout / non-2xx / unreachable / bad JSON. */
export async function fetchPublicCalc(
  rawInput: BaziRawInput,
  baseUrl: string,
  timeoutMs: number = PUBLIC_CALC_TIMEOUT_MS,
): Promise<PublicCalcResponse> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/bazi/public-calc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Exactly the rawInput /api/destiny and /api/home-fortune send (no calendarSystem/timezone of our
      // own), so the engine computes the same state it computes for the persona element.
      body: JSON.stringify(rawInput),
      signal: ac.signal,
    })
    if (!res.ok) throw new EngineChartError(`public-calc HTTP ${res.status}`)
    const json = (await res.json().catch(() => null)) as PublicCalcResponse | null
    if (!json || typeof json !== 'object') throw new EngineChartError('public-calc returned no JSON')
    return json
  } catch (e) {
    if (e instanceof EngineChartError) throw e
    throw new EngineChartError(`public-calc unreachable: ${(e as Error)?.message ?? String(e)}`)
  } finally {
    clearTimeout(timer)
  }
}
