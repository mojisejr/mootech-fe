// Unit gate for the v2 day-detail client fetch (goo · G-2 foundation). Plain tsx + node:assert.
//
// ANCHOR: scripts/day-detail-fetch.test.ts#g2-day-detail-fetch-total
// Bug-class: a client fetch that REJECTS on network/non-2xx forces every caller to babysit a promise; the
// anti-latch hook (G-2) must not have to catch. fetchDayDetail is TOTAL — it always resolves a well-formed
// response (detail null + degraded on any failure), never throws, and sends person+date — and (#226)
// NO identity: the BFF reads the session and decides the tier there.
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
  // success — detail parsed, body carries person+date
  let body: Record<string, unknown> = {}
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    body = JSON.parse(init.body)
    return { ok: true, json: async () => ({ detail: { date: '2026-08-05', luckyDirection: 'ทิศ E' }, cached: false }) }
  }) as unknown as typeof fetch
  const okRes = await fetchDayDetail(person, '2026-08-05')
  ok('success parses detail', okRes.detail?.date === '2026-08-05' && okRes.detail?.luckyDirection === 'ทิศ E')
  ok('sends person+date in body', body.date === '2026-08-05' && !!body.person)
  // 🔴 #226 — assertion FLIPPED on purpose: it used to REQUIRE an identity in the body. The gate that
  // decides what this reply contains now lives on the server, and a client-supplied user id there is the
  // #252/#391 shape (a value that travels, looks authoritative, and must not be believed).
  ok('sends NO identity in the body (#226)', !('userId' in body) && !('user_id' in body))

  // cached passthrough
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ detail: { date: 'x' }, cached: true }) })) as unknown as typeof fetch
  ok('cached flag passes through', (await fetchDayDetail(person, 'd')).cached === true)

  // !ok → degraded, detail null, no throw
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch
  const bad = await fetchDayDetail(person, 'd')
  ok('!ok → detail null + degraded, no throw', bad.detail === null && bad.degraded === true)

  // network throw → degraded, no reject to the caller
  globalThis.fetch = (async () => { throw new Error('net') }) as unknown as typeof fetch
  const threw = await fetchDayDetail(person, 'd')
  ok('throw → detail null + degraded, never rejects', threw.detail === null && threw.degraded === true)

  globalThis.fetch = realFetch
  // 🔴 #358 Phase 3 (ตู๋ B4) — an out-of-span refusal must SURVIVE this layer.
  // The route answers { detail: null, outOfSpan: true } for a day outside what the level's package sells.
  // Before this the rebuild dropped every key it did not name, so a paid wall reached the client as a bare
  // `detail: null` — indistinguishable from "upstream died" and from "this profile has no birthday".
  // ฟีม decided the arrow should INVITE AN UPGRADE, and a state that cannot be told apart from breakage
  // cannot invite anything. Mutant: delete the `...(data.outOfSpan ? …)` spread → both lines below redden.
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ detail: null, outOfSpan: true }) })) as unknown as typeof fetch
  const span = await fetchDayDetail(person, '2029-01-05')
  ok('outOfSpan survives the rebuild', span.outOfSpan === true && span.detail === null)
  ok('an out-of-span answer is NOT degraded — that distinction is the whole field', span.degraded === undefined)
  // CONTROL — an ordinary degraded answer must not sprout the flag, so the two above are about the wire
  // and not about the rebuild setting it unconditionally.
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ detail: null, degraded: true }) })) as unknown as typeof fetch
  ok('a degraded answer does not fake outOfSpan', (await fetchDayDetail(person, '2029-01-06')).outOfSpan === undefined)

  console.log(`✅ day-detail-fetch.test.ts — ${pass} assertions passed`)
}

run().catch((e) => {
  globalThis.fetch = realFetch
  console.error(e)
  process.exit(1)
})
