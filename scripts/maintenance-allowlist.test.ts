// Deterministic tests for the maintenance gate allowlist (#mootech-maint-gate-incognito-login).
// Proves: with MAINTENANCE_MODE=on and NO bypass cookie, the NextAuth handshake
// (/api/auth/*) + /auth/error pass through UNGATED (NextResponse.next), while every
// real app page is still rewritten to /maintenance (containment intact).
//
// This is the GREEN guard for the fix. The RED state was confirmed on prod:
//   GET https://bazichart.mumate.co/api/auth/csrf -> text/html (maintenance page)
//   instead of JSON, which broke login for cold-cookie clients (incognito/mobile).
//
// Run: npx tsx scripts/maintenance-allowlist.test.ts   or: bun scripts/maintenance-allowlist.test.ts
import assert from 'node:assert/strict'

// Must be set BEFORE importing the middleware (it reads process.env at call time,
// but set early to be safe / explicit).
process.env.MAINTENANCE_MODE = 'on'
process.env.MAINTENANCE_BYPASS_KEY = 'testkey'

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

function mkReq(path: string, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest(new URL('http://localhost' + path), { headers })
}

// NextResponse.rewrite(...) sets `x-middleware-rewrite`; NextResponse.next() does not.
const rewriteTarget = (res: any): string | null =>
  res.headers.get('x-middleware-rewrite')
const isPassThrough = (res: any): boolean =>
  res.headers.get('x-middleware-rewrite') == null &&
  res.headers.get('location') == null
const isRewrittenToMaintenance = (res: any): boolean =>
  (rewriteTarget(res) || '').includes('/maintenance')

// ── ALLOWLIST: NextAuth handshake must pass through ungated (the fix) ──
t('/api/auth/csrf passes through (was served maintenance HTML before fix)', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/auth/csrf'))), true)
})

t('/api/auth/session passes through', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/auth/session'))), true)
})

t('/api/auth/callback/line (cross-site cold hop) passes through', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/auth/callback/line'))), true)
})

t('/api/auth/providers passes through', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/auth/providers'))), true)
})

t('/auth/error passes through (no longer masked behind maintenance)', () => {
  assert.equal(isPassThrough(middleware(mkReq('/auth/error?error=Configuration'))), true)
})

// ── CONTAINMENT: real app pages must STILL be gated (no exposure) ──
t('/ is still rewritten to maintenance (app stays gated)', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/'))), true)
})

t('/profile is still rewritten to maintenance', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/profile'))), true)
})

t('/login is still rewritten to maintenance without bypass', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/login'))), true)
})

t('a non-auth api (/api/user) is still rewritten to maintenance', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/user'))), true)
})

// ── #605/#606 B2: the Vercel crons must NOT be swallowed by the maintenance gate ──
// A rewrite to /maintenance answers HTTP 200, so Vercel's cron log would record success while nothing
// ran. The reconciler is the only thing that recovers a paid charge whose webhook was lost, and the
// cutover turns maintenance on exactly while the team is making test payments.
// These carry NO bypass cookie on purpose: Vercel's scheduler has no cookies. It authenticates with
// CRON_SECRET at the route (pages/api/cron/reconcile-payment.ts:26), which this must not replace.
t('#B2 /api/cron/reconcile-payment passes the maintenance gate (else it 200s the maintenance page)', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/cron/reconcile-payment'))), true)
})

t('#B2 /api/cron/push-reminders passes the maintenance gate', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/cron/push-reminders'))), true)
})

// Prefix, not a free pass for anything with "cron" in it. The allowlist is `/api/cron/` with the
// trailing slash, so a look-alike outside that directory stays gated.
t('#B2 a look-alike path outside /api/cron/ is still gated', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/cronjobs'))), true)
})

t('#B2 a page path merely starting with /cron is still gated', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/cron/anything'))), true)
})

// ── #606 B1: the Omise webhook must pass the maintenance gate too (survives guardV2 deletion at launch) ──
// Without this, once #606 removes guardV2 the webhook falls to the maintenance gate, is rewritten to
// /maintenance and answers HTTP 200 → Omise reads 2xx as delivered and never retries → money taken,
// nobody provisioned. Exact match, not prefix: only this one literal is unauthenticated.
t('#B1 /api/v2/payment/webhook passes the maintenance gate (else Omise 200s the maintenance page)', () => {
  assert.equal(isPassThrough(middleware(mkReq('/api/v2/payment/webhook'))), true)
})

t('#B1 a look-alike /api/v2/payment/webhookX is still gated (exact match, not prefix)', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/v2/payment/webhookX'))), true)
})

t('#B1 /api/v2/payment/webhook/extra is still gated (exact match, not prefix)', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/v2/payment/webhook/extra'))), true)
})

// ── bypass cookie still works for the rest of the app ──
t('valid bypass cookie passes the app through', () => {
  assert.equal(isPassThrough(middleware(mkReq('/', 'mnt_bypass=testkey'))), true)
})

t('wrong bypass cookie is still gated', () => {
  assert.equal(isRewrittenToMaintenance(middleware(mkReq('/', 'mnt_bypass=nope'))), true)
})

if (process.exitCode) {
  console.error(`\nmaintenance-allowlist: FAILED (${pass} passed)`)
} else {
  console.log(`maintenance-allowlist: all ${pass} passed ✓`)
}
