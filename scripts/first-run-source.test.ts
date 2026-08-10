// Deterministic unit tests for the first-run source mappers (#233 C2). React-free / API-free.
// Run: npx tsx scripts/first-run-source.test.ts
//
// The load-bearing test (ตู๋, #233): a bazi TIMEOUT must map to `error`, NOT `unavailable`. A timeout
// reaches the selector as the proxy's `{ summary: null, reason: 'error' }` (the proxy converts
// timeout/4xx/5xx/parse → reason:'error'); an empty/missing profile reaches it as `reason:'unavailable'`.
// If summaryStateFromResponse collapsed the two, the screen would tell a timed-out user their profile is
// incomplete — a lie about the cause, invisible to มุน's screen because it only sees the state we hand it.
import assert from 'node:assert/strict'
import { cycleFromChart, summaryStateFromResponse } from '../features/v2-first-run/hooks/first-run-source-map'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

// ── summary: timeout (proxy reason:'error') ⇒ error, NEVER unavailable ──────────────────────────────
t('summary: reason error (timeout/4xx/5xx/parse) ⇒ error', () => {
  assert.equal(summaryStateFromResponse(true, { summary: null, reason: 'error' }).status, 'error')
})
t('summary: reason unavailable (missing dob / empty) ⇒ unavailable', () => {
  assert.equal(summaryStateFromResponse(true, { summary: null, reason: 'unavailable' }).status, 'unavailable')
})
// MUTANT: if the mapper treated `error` as `unavailable` (the conflation ตู๋ blocked), THIS fails.
t('summary: error and unavailable are NOT the same state', () => {
  const err = summaryStateFromResponse(true, { summary: null, reason: 'error' }).status
  const un = summaryStateFromResponse(true, { summary: null, reason: 'unavailable' }).status
  assert.notEqual(err, un)
})
t('summary: transport failure (!ok) ⇒ error', () => {
  assert.equal(summaryStateFromResponse(false, { summary: null, reason: 'unavailable' }).status, 'error')
  assert.equal(summaryStateFromResponse(false, null).status, 'error')
})
t('summary: present ⇒ ready with tagline/traits/advice (null tagline coerced to "")', () => {
  const s = summaryStateFromResponse(true, {
    summary: { tagline: 'x', traits: ['a'], advice: [{ key: 'talent', label: 'L', text: 'T' }] },
  })
  assert.equal(s.status, 'ready')
  if (s.status === 'ready') {
    assert.equal(s.data.tagline, 'x')
    assert.deepEqual(s.data.traits, ['a'])
    assert.equal(s.data.advice[0].text, 'T')
  }
  const coerced = summaryStateFromResponse(true, { summary: { tagline: null } })
  if (coerced.status === 'ready') assert.equal(coerced.data.tagline, '')
})

// ── cycle: chart.elementCycle is the DB row; null ⇒ unavailable (gender missing ⇒ no join) ──────────
t('cycle: real chart.elementCycle row ⇒ ready with 6 facets + power', () => {
  const s = cycleFromChart({
    element: 'WATER', power: 'YIN', gender: 'FEMALE',
    element_friend: 'WATER', element_work: 'WOOD', element_career: 'EARTH',
    element_fortune: 'FIRE', element_spouse: 'EARTH', element_supporter: 'METAL',
  })
  assert.equal(s.status, 'ready')
  if (s.status === 'ready') {
    assert.equal(s.data.power, 'YIN')
    assert.equal(s.data.friend, 'WATER')
    assert.equal(s.data.supporter, 'METAL')
  }
})
t('cycle: null (no join — gender missing) ⇒ unavailable, NOT error', () => {
  assert.equal(cycleFromChart(null).status, 'unavailable')
  assert.equal(cycleFromChart(undefined).status, 'unavailable')
})

console.log(`\n✅ first-run-source — ${pass} passed`)
