// mumate-be-retirement-001 slice 1 — the engine chart mapping (lib/chart/engine-chart.ts).
//
// 🔴 MUTANT CONTRACT:
//   EC1 year branch glyph → the right animal (all 12), via the SAME table the mascot resolver uses
//   EC2 day stem glyph → element + yin/yang in element_cycle's vocabulary (all 10, pinned row for row)
//   EC3 an unknown / missing glyph is null, never a guessed chart
//   EC4 element_cycle lookup: (element, power, gender); missing / blank / unknown gender → null
//   EC5 result_code: BE's 12-char [A-Za-z0-9] format
//   EC6 the payload keeps the legacy paths toComputeSource + cycleFromChart read (no consumer change)
//   EC7 the engine request is the destiny/home-fortune rawInput, unchanged; failures throw EngineChartError
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  STEM_TABLE,
  deriveChartCore,
  findElementCycle,
  normalizeChartGender,
  generateResultCode,
  RESULT_CODE_RE,
  buildChartPayload,
  engineInputFor,
  fetchPublicCalc,
  EngineChartError,
  toElementCycleRow,
  type ElementCycleRow,
} from '@/lib/chart/engine-chart'
import { ZODIAC_TABLE, toNakkasat } from '@/lib/personalization/zodiac'
import { toComputeSource } from '@/lib/personalization/compute-source'
import { animalFromCompute, resolveMascotFromCompute } from '@/lib/personalization/mascot'
import { cycleFromChart } from '@/features/v2-first-run/hooks/first-run-source-map'
import { applyEngineProfileBirth } from '@/lib/bazi-bridge/input'

// A REAL public-calc answer: bazi-sft-dataset origin/pdf-dev tests/bazi-public-calc-pillars.test.ts pins
// 1990-05-15 08:30 → day 庚辰, year 庚午 (captured live 2026-07-15).
const REAL = {
  dayMaster: '庚',
  pillars: {
    day: { stem: '庚', branch: '辰', stemElement: 'ทอง', branchElement: 'ดิน' },
    year: { stem: '庚', branch: '午', stemElement: 'ทอง', branchElement: 'ไฟ' },
  },
}

const cycleRow = (element: string, power: string, gender: string, id: number): ElementCycleRow => ({
  id,
  element,
  power,
  gender,
  element_friend: element,
  element_work: 'WATER',
  element_career: 'FIRE',
  element_fortune: 'WOOD',
  element_spouse: 'WOOD',
  element_supporter: 'EARTH',
})
// The 20-row shape verified on testenv: 5 elements × YANG/YIN × MALE/FEMALE.
const CYCLES: ElementCycleRow[] = (() => {
  const out: ElementCycleRow[] = []
  let id = 1
  for (const e of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'])
    for (const p of ['YANG', 'YIN'])
      for (const g of ['MALE', 'FEMALE']) out.push(cycleRow(e, p, g, id++))
  return out
})()

describe('EC1 — year branch → animal', () => {
  it('the real chart: 午 → HORSE (id 7, มะเมีย)', () => {
    const core = deriveChartCore(REAL)!
    expect(core.yearBelow).toEqual({ id: 7, constellation: 'HORSE', chinese_symbol: '午' })
    expect(toNakkasat(core.yearBelow.chinese_symbol)).toBe('มะเมีย')
  })

  it('辰 as the compatibility ideograph U+F971 (how the legacy table stores it) still maps to DRAGON', () => {
    const core = deriveChartCore({ pillars: { year: { branch: '\uF971' }, day: { stem: '甲' } } })
    expect(core?.yearBelow).toEqual({ id: 5, constellation: 'DRAGON', chinese_symbol: '\u8FB0' })
  })

  it('all 12 branches map to the zodiac row with the same id (子=1 … 亥=12)', () => {
    for (const z of ZODIAC_TABLE) {
      const core = deriveChartCore({ pillars: { year: { branch: z.branch }, day: { stem: '甲' } } })!
      expect(core.yearBelow.id).toBe(z.id)
      expect(core.yearBelow.constellation).toBe(z.en)
      expect(toNakkasat(core.yearBelow.id)).toBe(z.th)
    }
  })
})

describe('EC2 — day stem → element + power (chinese_horoscope8_square_above, row for row)', () => {
  it('the ten stems, pinned', () => {
    expect(STEM_TABLE).toEqual({
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
    })
  })

  it('the real chart: 庚 → METAL YANG', () => {
    expect(deriveChartCore(REAL)!.dayAbove).toEqual({ id: 7, chinese_symbol: '庚', element: 'METAL', power: 'YANG' })
  })

  it('dayMaster is used only when pillars.day is missing', () => {
    expect(deriveChartCore({ dayMaster: '癸', pillars: { year: { branch: '子' } } })!.dayAbove.element).toBe('WATER')
  })
})

describe('EC3 — no guessing', () => {
  it.each([
    ['null response', null],
    ['no pillars', {}],
    ['unknown branch', { pillars: { year: { branch: 'X' }, day: { stem: '甲' } } }],
    ['unknown stem', { pillars: { year: { branch: '子' }, day: { stem: '子' } } }],
    ['empty glyphs', { dayMaster: '', pillars: { year: { branch: '' }, day: { stem: '' } } }],
  ])('%s → null', (_label, resp) => {
    expect(deriveChartCore(resp as never)).toBeNull()
  })
})

describe('EC4 — element_cycle lookup', () => {
  it('finds the one row by (element, power, gender)', () => {
    expect(findElementCycle(CYCLES, 'METAL', 'YANG', 'MALE')?.id).toBe(13) // the id testenv stores for METAL/YANG/MALE
    expect(findElementCycle(CYCLES, 'METAL', 'YANG', 'FEMALE')?.id).toBe(14)
  })

  it('gender is normalised (female, " Male ") but never defaulted', () => {
    expect(findElementCycle(CYCLES, 'WOOD', 'YIN', 'female')?.gender).toBe('FEMALE')
    expect(findElementCycle(CYCLES, 'WOOD', 'YIN', ' Male ')?.gender).toBe('MALE')
    for (const g of [null, undefined, '', '   ', 'FRMALE', 'OTHER', 1]) {
      expect(findElementCycle(CYCLES, 'WOOD', 'YIN', g)).toBeNull()
    }
    expect(normalizeChartGender('frmale')).toBeNull()
  })

  it('no row for the key → null (and first-run shows unavailable)', () => {
    expect(findElementCycle([], 'WOOD', 'YIN', 'MALE')).toBeNull()
    expect(cycleFromChart(findElementCycle(CYCLES, 'WOOD', 'YIN', null))).toEqual({ status: 'unavailable' })
  })

  it('a raw DB row (bigserial id as string) coerces', () => {
    const r = toElementCycleRow({ ...cycleRow('FIRE', 'YIN', 'MALE', 0), id: '7' })
    expect(r.id).toBe(7)
  })
})

describe('EC5 — result_code', () => {
  it('12 chars of [A-Za-z0-9], like BE generateRandomString', () => {
    for (let i = 0; i < 200; i++) expect(generateResultCode()).toMatch(RESULT_CODE_RE)
  })

  it('draws from BE alphabet in order (injected index)', () => {
    expect(generateResultCode(() => 0)).toBe('aaaaaaaaaaaa')
    expect(generateResultCode(() => 61)).toBe('999999999999')
    expect(generateResultCode(() => 26)).toBe('AAAAAAAAAAAA')
  })
})

describe('EC6 — the payload is what home + first-run already read', () => {
  const core = deriveChartCore(REAL)!
  const payload = buildChartPayload(
    { dob: '1990-05-15', time: '08:30', gender: 'MALE' },
    core,
    findElementCycle(CYCLES, core.dayAbove.element, core.dayAbove.power, 'MALE'),
  )

  it('home: toComputeSource → animal มะเมีย (the mascot glyph animal)', () => {
    const cs = toComputeSource({ data: payload })
    expect(animalFromCompute(cs)).toBe('มะเมีย')
  })

  it('first-run: mascot from the ENGINE stem (ทอง) and the cycle row is ready', () => {
    const m = resolveMascotFromCompute(toComputeSource({ data: payload }))
    expect(m?.filename).toBe('07_มะเมีย-ทอง')
    const c = cycleFromChart(payload.elementCycle)
    expect(c.status).toBe('ready')
    expect(c.status === 'ready' && c.data).toMatchObject({ power: 'YANG', work: 'WATER' })
  })

  it('carries the birth first-run sends to the summary', () => {
    expect(payload).toMatchObject({ dob: '1990-05-15', time: '08:30', gender: 'MALE', source: 'bazi-engine' })
  })
})

describe('EC7 — the engine call', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('unknown time → 12:00, Bangkok, lowercase gender (the destiny mapper)', () => {
    expect(engineInputFor({ dob: '1990-05-15', time: '', gender: 'FEMALE', place_name: '' })).toEqual({
      birthDate: '1990-05-15',
      birthTime: '12:00',
      gender: 'female',
      province: 'Bangkok',
    })
  })

  it('POSTs the rawInput unchanged to /api/bazi/public-calc', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => REAL }))
    vi.stubGlobal('fetch', f)
    const raw = { birthDate: '1990-05-15', birthTime: '08:30', gender: 'male' as const, province: 'Bangkok' }
    await expect(fetchPublicCalc(raw, 'http://engine:3100/')).resolves.toEqual(REAL)
    const [url, init] = f.mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(url).toBe('http://engine:3100/api/bazi/public-calc')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(raw)
  })

  it('non-2xx, network error and bad JSON all throw EngineChartError', async () => {
    const raw = { birthDate: '1990-05-15', birthTime: '08:30', gender: 'male' as const, province: 'Bangkok' }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    await expect(fetchPublicCalc(raw, 'http://e')).rejects.toBeInstanceOf(EngineChartError)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    await expect(fetchPublicCalc(raw, 'http://e')).rejects.toBeInstanceOf(EngineChartError)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error('x') } })))
    await expect(fetchPublicCalc(raw, 'http://e')).rejects.toBeInstanceOf(EngineChartError)
  })
})

describe('the engine profile birth wins (applyEngineProfileBirth, used by mergeEngineBirth)', () => {
  const row = { dob: '1990-01-01', time: '10:00', is_remember_time: true, gender: 'MALE' }
  it('valid engine date overrides dob/time', () => {
    expect(applyEngineProfileBirth(row, { birth_date: '1991-02-03', birth_time: '23:15:00', time_unknown: false })).toMatchObject({
      dob: '1991-02-03',
      time: '23:15',
      is_remember_time: true,
      gender: 'MALE',
    })
  })
  it('time_unknown → time "" and not remembered', () => {
    expect(applyEngineProfileBirth(row, { birth_date: '1991-02-03', birth_time: '23:15', time_unknown: true })).toMatchObject({
      time: '',
      is_remember_time: false,
    })
  })
  it('no / bad engine row → the legacy row untouched', () => {
    expect(applyEngineProfileBirth(row, undefined)).toBe(row)
    expect(applyEngineProfileBirth(row, { birth_date: '' })).toBe(row)
  })
})
