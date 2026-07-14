// Deterministic tests for the Ops dashboard gate (#mumate-ops-dashboard-phase1 Step 1).
// Run: bun scripts/ops-gate.test.ts   or: npx tsx scripts/ops-gate.test.ts
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

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

function resetEnv() {
  delete process.env.OPS_DASHBOARD_KEY
  delete process.env.MAINTENANCE_MODE
  delete process.env.MAINTENANCE_BYPASS_KEY
  delete process.env.GLASS_BOX_KEY
  delete process.env.WHATIF_KEY
}

function mkReq(path: string, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest(new URL('http://localhost' + path), { headers })
}

const rewriteTarget = (res: any): string | null => res.headers.get('x-middleware-rewrite')
const locationTarget = (res: any): string | null => res.headers.get('location')
const isPassThrough = (res: any): boolean => rewriteTarget(res) == null && locationTarget(res) == null
const isRewrittenToMaintenance = (res: any): boolean => (rewriteTarget(res) || '').includes('/maintenance')

function main() {
  t('fails closed on /ops and any /api/ops/* route when OPS_DASHBOARD_KEY is unset', () => {
    resetEnv()
    assert.equal(isRewrittenToMaintenance(middleware(mkReq('/ops'))), true)
    assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/ops/login'))), true)
    assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/ops/anything'))), true)
  })

  t('/api/ops/login always passes through when the key is configured, cookie or not', () => {
    resetEnv()
    process.env.OPS_DASHBOARD_KEY = 'test-secret'
    assert.equal(isPassThrough(middleware(mkReq('/api/ops/login'))), true)
    assert.equal(isPassThrough(middleware(mkReq('/api/ops/login', 'ops_access=wrong'))), true)
  })

  t('/ops itself passes through even without a cookie (page renders the gate form)', () => {
    resetEnv()
    process.env.OPS_DASHBOARD_KEY = 'test-secret'
    assert.equal(isPassThrough(middleware(mkReq('/ops'))), true)
    assert.equal(isPassThrough(middleware(mkReq('/ops', 'ops_access=wrong'))), true)
  })

  t('every other /api/ops/* route denies without a valid cookie (defense in depth)', () => {
    resetEnv()
    process.env.OPS_DASHBOARD_KEY = 'test-secret'
    const res: any = middleware(mkReq('/api/ops/metrics'))
    // A denial here is a direct 401 JSON response, not a rewrite/redirect — isPassThrough only
    // detects the latter, so check the status directly.
    assert.equal(res.status, 401)
    assert.equal(rewriteTarget(res), null)
    assert.equal(locationTarget(res), null)
  })

  t('valid cookie passes through everywhere under /ops and /api/ops', () => {
    resetEnv()
    process.env.OPS_DASHBOARD_KEY = 'test-secret'
    assert.equal(isPassThrough(middleware(mkReq('/ops', 'ops_access=test-secret'))), true)
    assert.equal(isPassThrough(middleware(mkReq('/api/ops/metrics', 'ops_access=test-secret'))), true)
  })

  t('unrelated paths are unaffected by the ops guard', () => {
    resetEnv()
    process.env.OPS_DASHBOARD_KEY = 'test-secret'
    assert.equal(isPassThrough(middleware(mkReq('/'))), true)
    assert.equal(isPassThrough(middleware(mkReq('/my-destiny'))), true)
  })

  if (process.exitCode) {
    console.error(`\nops-gate: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-gate: all ${pass} passed ✓`)
  }
}

main()
