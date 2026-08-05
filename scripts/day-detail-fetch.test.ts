// Unit gate for the v2 day-detail client fetch (goo · G-2 foundation). Plain tsx + node:assert.
//
// ANCHOR: scripts/day-detail-fetch.test.ts#g2-day-detail-fetch-total
// Bug-class: a client fetch that REJECTS on network/non-2xx forces every caller to babysit a promise; the
// anti-latch hook (G-2) must not have to catch. fetchDayDetail is TOTAL — it always resolves a well-formed
// response (detail null + degraded on any failure), never throws, and always sends person+userId+date.
import assert from 'node:assert'
import { fetchDayDetail } from '../features/v2-calendar/hooks/fetch-day-detail'
import type { FeCalcInput } from '../lib/bazi-bridge/input'

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

const person = { name: 'ทดสอบ', dob: '1990-01-01', gender: 'male' } as unknown as FeCalcInput
const realFetch = globalThis.fetch

async function run() {
  // success — detail parsed, body carries person+userId+date
  let body: Record<string, unknown> = {}
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    body = JSON.parse(init.body)
    return { ok: true, json: async () => ({ detail: { date: '2026-08-05', luckyDirection: 'ทิศตะวันออก' }, cached: false }) }
  }) as unknown as typeof fetch
  const okRes = await fetchDayDetail(person, 'user-1', '2026-08-05')
  ok('success parses detail', okRes.detail?.date === '2026-08-05' && okRes.detail?.luckyDirection === 'ทิศตะวันออก')
  ok('sends person+userId+date in body', body.userId === 'user-1' && body.date === '2026-08-05' && !!body.person)

  // cached passthrough
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ detail: { date: 'x' }, cached: true }) })) as unknown as typeof fetch
  ok('cached flag passes through', (await fetchDayDetail(person, 'u', 'd')).cached === true)

  // !ok → degraded, detail null, no throw
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
  const bad = await fetchDayDetail(person, 'u', 'd')
  ok('!ok → detail null + degraded, no throw', bad.detail === null && bad.degraded === true)

  // network throw → degraded, no reject to the caller
  globalThis.fetch = (async () => { throw new Error('net') }) as unknown as typeof fetch
  const threw = await fetchDayDetail(person, 'u', 'd')
  ok('throw → detail null + degraded, never rejects', threw.detail === null && threw.degraded === true)

  globalThis.fetch = realFetch
  console.log(`✅ day-detail-fetch.test.ts — ${pass} assertions passed`)
}

run().catch((e) => {
  globalThis.fetch = realFetch
  console.error(e)
  process.exit(1)
})
