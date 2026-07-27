// Verify-the-instrument BOTH ways for the BE-unreachable hint (บอง: prove it fires when it should AND stays
// silent when it should — a one-directional test can't tell "correct" from "always on", μุน's Zone-3 vacuous
// guard). Also pins the narrowness: only 502-on-/api counts; a 404/500 from a running BE, or a 502 off /api,
// must NOT be claimed as "BE not booted".
// Run: npx tsx scripts/backend-hint.test.ts
import assert from 'node:assert/strict'
import { detectBackendUnreachable, backendUnreachableHint, parseFailed } from '../harness/backend-hint'

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

const API = 'http://localhost:3000/api/chinese-horoscope'

// ── (a) FIRES when BE is unreachable — 502 on /api ──
t('502 on /api → detected, hint present', () => {
  assert.equal(detectBackendUnreachable([{ status: 502, url: API }]).length, 1)
  const h = backendUnreachableHint([{ status: 502, url: API }])
  assert.ok(h && h.includes('stack.sh up'), 'hint must name the boot command')
  assert.ok(h!.includes('not a UI bug'), 'hint must separate infra from UI bug')
})
t('502 on /api as a "STATUS url" string (capture.ts shape) → detected', () => {
  assert.equal(detectBackendUnreachable([`502 ${API}`]).length, 1)
})

// ── (b) STAYS SILENT when it should — the noise-avoidance / not-vacuous direction ──
t('BE is UP but errored: 500 on /api → NOT detected', () => {
  assert.equal(detectBackendUnreachable([{ status: 500, url: API }]).length, 0)
  assert.equal(backendUnreachableHint([{ status: 500, url: API }]), null)
})
t('404 on /api → NOT detected (missing resource ≠ BE down)', () => {
  assert.equal(detectBackendUnreachable([{ status: 404, url: API }]).length, 0)
})
t('502 OFF /api (e.g. some other proxy) → NOT detected (narrow to /api)', () => {
  assert.equal(detectBackendUnreachable([{ status: 502, url: 'http://localhost:3000/dashboard' }]).length, 0)
})
t('no failed requests → NOT detected', () => {
  assert.equal(detectBackendUnreachable([]).length, 0)
  assert.equal(backendUnreachableHint([]), null)
})
t('garbage / unparseable entries → ignored, NOT detected', () => {
  assert.equal(detectBackendUnreachable(['not a status line', '']).length, 0)
  assert.equal(parseFailed('not a status line'), null)
})

// ── (c) mixed: fires iff a 502-on-/api is present among noise ──
t('mixed [500 /api, 404 /other, 502 /api] → detects exactly the one 502-on-/api', () => {
  const hits = detectBackendUnreachable([
    `500 ${API}`,
    '404 http://localhost:3000/api/nope',
    `502 ${API}`,
  ])
  assert.equal(hits.length, 1)
  assert.equal(hits[0].status, 502)
})
t('mixed with NO 502-on-/api → silent', () => {
  assert.equal(backendUnreachableHint([`500 ${API}`, '404 http://localhost:3000/foo', '503 http://localhost:3000/x']), null)
})

console.log(`\nbackend-hint: ${pass} passed`)
