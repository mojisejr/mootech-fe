// ANCHOR: home-persona-fields-complete — the greeting "ธาตุของคุณ" line binds persona.strengthLabel
// (day-master strength band) from bazi. This pins the BFF persona contract (omission→test): a persona
// is valid ONLY when strengthLabel is present + non-empty (bazi is its only source); a missing/blank
// strength must degrade to null (line hidden), never render a bare "·". DB/React-free.
// Run: npx tsx scripts/home-persona-fields.test.ts
import assert from 'node:assert/strict'
import { normalizePersona, type HomePersona } from '../pages/api/home-fortune'

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

const REQUIRED: (keyof HomePersona)[] = ['elementTh', 'strengthLabel']

t('complete: bazi persona → both fields present, strengthLabel is the REAL engine vocab', () => {
  const p = normalizePersona({ elementTh: 'ไม้', strengthLabel: 'ดิถีแข็ง' })
  assert.ok(p, 'normalizePersona returned null for a complete persona')
  for (const k of REQUIRED) assert.ok(k in p, `MISSING field: ${k}`)
  assert.equal(p.elementTh, 'ไม้')
  assert.equal(p.strengthLabel, 'ดิถีแข็ง')
  assert.notEqual(p.strengthLabel, 'แข็งแรง') // copy guard: Figma word must never appear
})

t('strengthLabel REQUIRED: missing → null (line hidden, never a bare "·")', () => {
  assert.equal(normalizePersona({ elementTh: 'ไม้' }), null)
  assert.equal(normalizePersona({ elementTh: 'ไม้', strengthLabel: '' }), null)
  assert.equal(normalizePersona({ elementTh: 'ไม้', strengthLabel: 123 }), null)
})

t('elementTh may be "" (degraded) without voiding a valid persona', () => {
  const p = normalizePersona({ strengthLabel: 'ดิถีสมดุล' })!
  assert.equal(p.strengthLabel, 'ดิถีสมดุล')
  assert.equal(p.elementTh, '') // wire binds the compute/mascot element for the text; blank is harmless
})

t('non-object / null → null (graceful, no crash)', () => {
  assert.equal(normalizePersona(null), null)
  assert.equal(normalizePersona(undefined), null)
  assert.equal(normalizePersona('nope'), null)
})

console.log(`\n  ${pass} passed${process.exitCode ? ' · SOME FAILED' : ''}`)
