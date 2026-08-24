// scripts/reconcile-window.test.ts — the screen's deadline must stay downstream of the reconciler's (#423).
//
// 🔴 WHAT THIS FILE IS ACTUALLY GUARDING. Three numbers used to be 15 minutes in three different files with
// no relationship between them, and the bug was born the moment two of them meant different things:
//
//   the screen quit at minute 15   ┐
//   the cron could not act before  ├─ so the user was told "ขอ QR ใหม่" 0–15 minutes BEFORE the repair
//     minute 15, and might not     │  that exists for exactly their case was allowed to start
//     act until minute 30          ┘
//
// The fix computes the screen's horizon from the reconciler's own numbers. That removes the drift between
// code and code — but NOT the drift between code and `vercel.json`, which is deployment config a browser
// cannot read, so the cron period is mirrored as a constant. THIS FILE IS THE THING THAT MAKES THAT MIRROR
// SAFE: it parses the real vercel.json and fails when the two disagree.
//
// Run:  npx vitest run scripts/reconcile-window.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_WINDOW } from '../lib/payment/reconcile'
import {
  RECONCILE_CRON_INTERVAL_MS,
  RECONCILE_HORIZON_MS,
  waitPhase,
} from '../lib/payment/reconcile-window'
import { POLL_UNTIL_MS } from '../features/v2-shop/useChargeStatus'

/** The reconcile cron's period, read from the file Vercel actually deploys. */
function cronIntervalMsFromVercelJson(): number {
  const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8')) as {
    crons?: { path: string; schedule: string }[]
  }
  const row = (cfg.crons ?? []).find((c) => c.path === '/api/cron/reconcile-payment')
  if (!row) throw new Error('no reconcile cron in vercel.json — the screen has no window to trust')
  // Only the shapes this repo uses are accepted. A schedule we cannot read must THROW, not fall back to a
  // guess: a silent default here would re-open the exact gap this file exists to close.
  const everyNMinutes = /^\*\/(\d+) \* \* \* \*$/.exec(row.schedule)
  if (everyNMinutes) return Number(everyNMinutes[1]) * 60_000
  if (row.schedule === '* * * * *') return 60_000
  throw new Error(`unhandled cron schedule ${row.schedule} — teach this test before shipping it`)
}

describe('#423 · the screen may not give up before the reconciler has had its turn', () => {
  it('🔴 the mirrored cron period equals the one Vercel actually runs', () => {
    expect(RECONCILE_CRON_INTERVAL_MS).toBe(cronIntervalMsFromVercelJson())
  })

  it('the horizon is grace + one full cron period — becoming eligible is not being looked at', () => {
    // Eligibility starts at graceMs (reconcile.ts selectReconcileCandidates filters `createdAt <= now - grace`),
    // but the run that would pick the row up may have fired a second before it aged in.
    expect(RECONCILE_HORIZON_MS).toBe(DEFAULT_WINDOW.graceMs + cronIntervalMsFromVercelJson())
  })

  it('🔴 THE BUG ITSELF: the screen must not reach "give up" before the repair window closes', () => {
    // This is the assertion that would have caught #423 on the day it shipped.
    expect(POLL_UNTIL_MS).toBeLessThan(RECONCILE_HORIZON_MS)
    expect(RECONCILE_HORIZON_MS).toBeGreaterThanOrEqual(DEFAULT_WINDOW.graceMs)
  })

  it('every minute between 0 and the horizon has a phase, and none of them is "exhausted"', () => {
    const minute = 60_000
    // Walk real minutes rather than asserting three sample points: an off-by-one in the comparison operators
    // would still satisfy hand-picked samples at 5 / 20 / 40.
    for (let m = 0; m * minute < RECONCILE_HORIZON_MS; m++) {
      const phase = waitPhase(m * minute, POLL_UNTIL_MS)
      expect(phase, `minute ${m}`).not.toBe('exhausted')
      expect(phase, `minute ${m}`).toBe(m * minute < POLL_UNTIL_MS ? 'waiting' : 'reconciling')
    }
    expect(waitPhase(RECONCILE_HORIZON_MS, POLL_UNTIL_MS)).toBe('exhausted')
    expect(waitPhase(RECONCILE_HORIZON_MS + 1, POLL_UNTIL_MS)).toBe('exhausted')
  })

  it('minute 15 — the exact instant the old code offered "ขอ QR ใหม่" — is now "reconciling"', () => {
    // Named on its own because it is the regression, not a boundary case.
    expect(waitPhase(15 * 60_000, POLL_UNTIL_MS)).toBe('reconciling')
    expect(waitPhase(29 * 60_000, POLL_UNTIL_MS)).toBe('reconciling')
  })
})
