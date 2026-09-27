// mumate-be-retirement-001 slice 1 — the constants the engine chart relies on, checked against the real
// reference tables. Read-only. Skipped unless TEST_DATABASE_URL is set:
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   npx vitest run scripts/engine-chart-db.test.ts
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { STEM_TABLE, findElementCycle, toElementCycleRow } from '@/lib/chart/engine-chart'
import { ZODIAC_TABLE } from '@/lib/personalization/zodiac'

const TEST_URL = process.env.TEST_DATABASE_URL

describe.skipIf(!TEST_URL)('engine chart constants vs the reference tables', () => {
  const sql = postgres(TEST_URL as string, { prepare: false, max: 1 })
  afterAll(() => sql.end())

  it('STEM_TABLE is chinese_horoscope8_square_above, row for row (the table BE read the day stem from)', async () => {
    const rows = await sql`SELECT id, chinese_symbol, element, power FROM chinese_horoscope8_square_above ORDER BY id`
    expect(rows).toHaveLength(10)
    for (const r of rows) {
      expect(STEM_TABLE[r.chinese_symbol as string]).toEqual({ id: Number(r.id), element: r.element, power: r.power })
    }
  })

  it('ZODIAC_TABLE ids are chinese_horoscope8_square_below ids (what the legacy chart stored as yearBelow.id)', async () => {
    const rows = await sql`SELECT id, constellation, chinese_symbol FROM chinese_horoscope8_square_below ORDER BY id`
    expect(rows).toHaveLength(12)
    for (const r of rows) {
      const z = ZODIAC_TABLE.find((x) => x.id === Number(r.id))
      // 🔴 the table stores 辰 as U+F971 (CJK compatibility ideograph); ZODIAC_TABLE and the engine use
      // U+8FB0. Equal after NFC — which is why deriveChartCore normalises. Without NFC this row fails.
      expect(z).toMatchObject({ en: r.constellation, branch: (r.chinese_symbol as string).normalize('NFC') })
    }
  })

  it('element_cycle has exactly one row for every (element, power, gender) the lookup can ask for', async () => {
    const rows = (await sql`SELECT * FROM element_cycle`).map((r) => toElementCycleRow(r as Record<string, unknown>))
    for (const s of Object.values(STEM_TABLE)) {
      for (const g of ['MALE', 'FEMALE']) {
        const hits = rows.filter((r) => r.element === s.element && r.power === s.power && r.gender === g)
        expect(hits, `${s.element}/${s.power}/${g}`).toHaveLength(1)
        expect(findElementCycle(rows, s.element, s.power, g)?.id).toBe(hits[0].id)
      }
    }
  })
})
