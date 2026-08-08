// ANCHOR: chart-cache-memory-only-self-heal — the v2 home mascot/chart cache (P3). Pins the invariants that
// make it correct BEFORE it is wired into useV2Home (บอง: place the gate + prove it bites, then build under it):
//   • self-heal (DoD#2): a stale chart is served ONLY while its resultCode matches the live row; dob edit →
//     new result_code → not fresh → refetch. Mutant #1 (drop the resultCode check) → RED.
//   • 🔴 memory-only (DoD#4): NEVER touches localStorage. Mutant #2 (write to localStorage) → RED — but a
//     naive "assert nothing was written" is a 0-from-0 vacuum (the module doesn't even import localStorage),
//     so a SPY + a POSITIVE CONTROL prove the spy is actually attached before we trust the 0.
//   • logout (DoD#5): clearChartCache empties it.
// Run: npx tsx scripts/chart-cache.test.ts
import assert from 'node:assert/strict'
import { peekChart, isChartFresh, setChart, clearChartCache, _chartCacheSize } from '../features/auth/hooks/chart-cache'
import type { ComputeMascotSource } from '../lib/personalization/mascot'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

const CHART_A = { character: '/images/v2/mascot/12.webp' } as unknown as ComputeMascotSource
const CHART_B = { character: '/images/v2/mascot/07.webp' } as unknown as ComputeMascotSource

// spy localStorage that COUNTS every access (so "0 writes" can be proven, not assumed)
function makeSpyLS(): { ls: Storage; calls: { setItem: number; getItem: number; removeItem: number } } {
  const calls = { setItem: 0, getItem: 0, removeItem: 0 }
  const m = new Map<string, string>()
  const ls = {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k: string) => {
      calls.getItem++
      return m.has(k) ? (m.get(k) as string) : null
    },
    setItem: (k: string, v: string) => {
      calls.setItem++
      m.set(k, String(v))
    },
    removeItem: (k: string) => {
      calls.removeItem++
      m.delete(k)
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  } as Storage
  return { ls, calls }
}

// ── memory hit / miss ──
t('miss on unknown user → undefined', () => {
  clearChartCache()
  assert.equal(peekChart('u1'), undefined)
})
t('setChart then peekChart → returns the cached chart + resultCode', () => {
  clearChartCache()
  setChart('u1', 'rc1', CHART_A)
  assert.deepEqual(peekChart('u1'), { resultCode: 'rc1', chart: CHART_A })
})

// ── self-heal (DoD#2) — mutant #1 target ──
t('isChartFresh: same resultCode → fresh (keep, no refetch)', () => {
  clearChartCache()
  setChart('u1', 'rc1', CHART_A)
  assert.equal(isChartFresh('u1', 'rc1'), true)
})
t('🔴 isChartFresh: dob edited → new resultCode → NOT fresh (refetch, no stale mascot)', () => {
  clearChartCache()
  setChart('u1', 'rc1', CHART_A)
  // BE minted a new result_code after the dob edit → the cached chart is stale
  assert.equal(isChartFresh('u1', 'rc2'), false)
})
t('isChartFresh: unknown user → not fresh', () => {
  clearChartCache()
  assert.equal(isChartFresh('nobody', 'rc1'), false)
})
t('setChart overwrites on refetch (new resultCode for same user)', () => {
  clearChartCache()
  setChart('u1', 'rc1', CHART_A)
  setChart('u1', 'rc2', CHART_B)
  assert.deepEqual(peekChart('u1'), { resultCode: 'rc2', chart: CHART_B })
  assert.equal(_chartCacheSize(), 1, 'still one entry per user')
})

// ── logout (DoD#5) ──
t('clearChartCache → empty (next identity starts clean)', () => {
  clearChartCache()
  setChart('u1', 'rc1', CHART_A)
  setChart('u2', 'rc9', CHART_B)
  clearChartCache()
  assert.equal(_chartCacheSize(), 0)
  assert.equal(peekChart('u1'), undefined)
})

// ── 🔴 DoD#4: MEMORY-ONLY — never touches localStorage (spy + positive control) ──
t('🔴 chart-cache NEVER touches localStorage — spy stays at 0, and the spy is PROVEN attached', () => {
  const { ls, calls } = makeSpyLS()
  ;(globalThis as { localStorage?: Storage }).localStorage = ls
  try {
    clearChartCache()
    setChart('u1', 'rc1', CHART_A) // if this ever wrote localStorage (mutant #2), the spy would catch it
    peekChart('u1')
    isChartFresh('u1', 'rc1')
    setChart('u1', 'rc2', CHART_B)
    clearChartCache()
    assert.equal(calls.setItem, 0, 'no localStorage writes')
    assert.equal(calls.getItem, 0, 'no localStorage reads')
    assert.equal(calls.removeItem, 0, 'no localStorage removes')
    // POSITIVE CONTROL — without this, "0 writes" is a 0-from-0 vacuum (the module never imports
    // localStorage, so the assertion would pass even if the spy were not attached). A real write MUST move
    // the counter, proving the spy is the thing actually being watched.
    ;(globalThis as { localStorage: Storage }).localStorage.setItem('probe', '1')
    assert.equal(calls.setItem, 1, 'positive control: the spy IS attached — a real write moves the counter')
  } finally {
    ;(globalThis as { localStorage?: Storage }).localStorage = undefined
  }
})

console.log(`\n${pass} passed`)
