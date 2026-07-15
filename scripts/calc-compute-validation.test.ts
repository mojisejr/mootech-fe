// Deterministic tests for the compute API's input validation + origin check
// (#public-bazi-calculator). Adversarial-boundary cases: empty, malformed, oversized, wrong
// type, delimiter-less. Run: bun scripts/calc-compute-validation.test.ts   or:
// npx tsx scripts/calc-compute-validation.test.ts
import assert from 'node:assert/strict'
import { validateInput, sameOrigin } from '../pages/api/calculator/compute'

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

function main() {
  t('valid full input passes, gender normalized to uppercase', () => {
    const r = validateInput({ dob: '1995-06-15', time: '14:30', gender: 'male' })
    assert.deepEqual(r, { dob: '1995-06-15', time: '14:30', gender: 'MALE' })
  })

  t('empty time is valid (optional field)', () => {
    const r = validateInput({ dob: '1995-06-15', time: '', gender: 'FEMALE' })
    assert.deepEqual(r, { dob: '1995-06-15', time: '', gender: 'FEMALE' })
  })

  t('missing time field entirely is valid (treated as empty)', () => {
    const r = validateInput({ dob: '1995-06-15', gender: 'MALE' })
    assert.deepEqual(r, { dob: '1995-06-15', time: '', gender: 'MALE' })
  })

  t('empty body -> rejected (missing dob)', () => {
    assert.equal(validateInput({}), null)
  })

  t('malformed dob (no delimiter, wrong format) -> rejected', () => {
    assert.equal(validateInput({ dob: '19950615', gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: 'not-a-date', gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: '2026-99-99', gender: 'MALE' }), null)
  })

  t('malformed time (out of range or non-numeric) -> rejected', () => {
    assert.equal(validateInput({ dob: '1995-06-15', time: '25:99', gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: '1995-06-15', time: 'noon', gender: 'MALE' }), null)
  })

  t('out-of-range date components (month 99, day 99) -> rejected locally, not just by backend 500', () => {
    // Verified live 2026-07-15: mootech-be returns a real 500 for "2026-99-99" (not a clean
    // 400) — this API surfaces that as a generic 502 rather than crashing, but catching it here
    // avoids the wasted round trip to a call that's guaranteed to fail.
    assert.equal(validateInput({ dob: '2026-99-99', gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: '2026-13-01', gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: '2026-01-32', gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: '2026-00-15', gender: 'MALE' }), null)
  })

  t('invalid gender (wrong value, wrong type, missing) -> rejected', () => {
    assert.equal(validateInput({ dob: '1995-06-15', gender: 'OTHER' }), null)
    assert.equal(validateInput({ dob: '1995-06-15', gender: 123 }), null)
    assert.equal(validateInput({ dob: '1995-06-15' }), null)
  })

  t('non-string dob/time (wrong type from a malicious/malformed client) -> rejected, no throw', () => {
    assert.equal(validateInput({ dob: 12345, gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: { nested: true }, gender: 'MALE' }), null)
    assert.equal(validateInput({ dob: '1995-06-15', time: 9999, gender: 'MALE' }), null)
  })

  t('oversized/garbage string dob -> rejected (regex anchors to exact shape)', () => {
    assert.equal(validateInput({ dob: '1995-06-15'.repeat(50), gender: 'MALE' }), null)
  })

  t('sameOrigin: matching Origin+Host -> true', () => {
    const req = { headers: { origin: 'https://mumate.co', host: 'mumate.co' } } as any
    assert.equal(sameOrigin(req), true)
  })

  t('sameOrigin: missing Origin header -> false (fail closed)', () => {
    const req = { headers: { host: 'mumate.co' } } as any
    assert.equal(sameOrigin(req), false)
  })

  t('sameOrigin: cross-origin -> false', () => {
    const req = { headers: { origin: 'https://evil.example.com', host: 'mumate.co' } } as any
    assert.equal(sameOrigin(req), false)
  })

  t('sameOrigin: malformed Origin header -> false, does not throw', () => {
    const req = { headers: { origin: 'not a url', host: 'mumate.co' } } as any
    assert.equal(sameOrigin(req), false)
  })

  if (process.exitCode) {
    console.error(`\ncalc-compute-validation: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-compute-validation: all ${pass} passed ✓`)
  }
}

main()
