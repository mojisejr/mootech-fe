// ANCHOR: compute-source-envelope-unwrap — ChineseHoroscopeGet returns `{ data: chart }` but its type
// is force-cast FLAT, so toComputeSource must unwrap `.data` or the day-master element is silently null
// and the greeting ธาตุ row (mascot + text) vanishes on v2 home (the prod regression #104 exposed).
// This pins the unwrap to the USER-FACING outcome: element must survive to a resolvable mascot glyph.
// Run: npx tsx scripts/compute-source.test.ts
import assert from 'node:assert/strict'
import { toComputeSource } from '../lib/personalization/compute-source'
import { resolveMascotFromCompute } from '../lib/personalization/mascot'

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

// The REAL runtime shape (verified against my-destiny.tsx, which reads result.data.summary/.detail).
const wrapped = {
  data: {
    detail: {
      yearBelow: { constellation: 'PIG', id: 12 },
      dayAbove: { element: 'EARTH' }, // 日干 (day-master) element
    },
  },
}

t('unwraps { data } → day-master element survives to a resolvable mascot (EARTH → ธาตุ ดิน)', () => {
  const cs = toComputeSource(wrapped)
  assert.ok(cs, 'toComputeSource returned null for a real { data } chart')
  assert.equal(cs.enrichment?.pillars?.day?.stemElement, 'EARTH') // the field the envelope bug dropped
  const m = resolveMascotFromCompute(cs)
  assert.ok(m, 'mascot did not resolve from the unwrapped compute source')
  assert.equal(m.elementTh, 'ดิน') // EARTH → ดิน, the exact text the greeting renders
})

t('flat (pre-unwrapped) input still works — the ?? raw fallback', () => {
  const cs = toComputeSource(wrapped.data)
  assert.ok(cs)
  assert.equal(cs.enrichment?.pillars?.day?.stemElement, 'EARTH')
})

t('missing yearBelow / null → null (graceful — no chart, no ธาตุ row)', () => {
  assert.equal(toComputeSource({ data: { detail: {} } }), null)
  assert.equal(toComputeSource(null), null)
  assert.equal(toComputeSource({ data: null }), null)
})

console.log(`\n  ${pass} passed${process.exitCode ? ' · SOME FAILED' : ''}`)
