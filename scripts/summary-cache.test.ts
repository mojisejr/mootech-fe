// Phase C3 (#233): the reading prefetched at register must be REUSED by the first-run selector, not
// re-fetched. Run: npx tsx scripts/summary-cache.test.ts
import assert from 'node:assert/strict'

// Count fetches + return a ready summary. Set before importing/using the cache (fetch is read at call time).
let calls = 0
globalThis.fetch = (async () => {
  calls++
  return {
    ok: true,
    json: async () => ({ summary: { tagline: 'x', traits: [], advice: [] } }),
  } as any
}) as any

import { prefetchSummary, getSummary, clearSummaryCache } from '../features/v2-first-run/hooks/summary-cache'

const person = { birthDate: '1990-06-15', gender: 'female' as const }

let pass = 0
function t(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => { pass++ })
    .catch((e: any) => {
      console.error(`✗ ${name}\n  ${e?.message ?? e}`)
      process.exitCode = 1
    })
}

async function main() {
  // prefetch then read ⇒ ONE fetch (selector reuses the register-time promise).
  await t('prefetch is reused by getSummary (no double fetch)', async () => {
    clearSummaryCache()
    calls = 0
    prefetchSummary('u1', person)
    const s = await getSummary('u1', person)
    assert.equal(calls, 1)
    assert.equal(s.status, 'ready')
  })

  // MUTANT: if getSummary ignored the cache and always fetched, calls would be 2 here.
  await t('second getSummary for same user does not re-fetch', async () => {
    clearSummaryCache()
    calls = 0
    prefetchSummary('u2', person)
    await getSummary('u2', person)
    await getSummary('u2', person)
    assert.equal(calls, 1)
  })

  // No prefetch ⇒ getSummary fetches once itself.
  await t('getSummary with no prefetch fetches once', async () => {
    clearSummaryCache()
    calls = 0
    await getSummary('u3', person)
    assert.equal(calls, 1)
  })

  console.log(`\n${process.exitCode ? '✗' : '✅'} summary-cache — ${pass} passed`)
}

main()
