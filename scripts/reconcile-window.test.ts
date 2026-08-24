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

describe('#423/#424 · the screen may not stop promising before the reconciler has been guaranteed a look', () => {
  it('🔴 the mirrored cron period equals the one Vercel actually runs', () => {
    expect(RECONCILE_CRON_INTERVAL_MS).toBe(cronIntervalMsFromVercelJson())
  })

  it('🔴 THE PROPERTY, NOT THE FORMULA: the screen sits strictly inside the reconciler\'s working range', () => {
    // ⚠️ THIS ASSERTION WAS REWRITTEN AFTER ตู๋'S REVIEW OF #424, AND THE REASON MATTERS MORE THAN THE LINE.
    // It used to read `HORIZON === graceMs + cronInterval` — an assertion about the formula this file happens
    // to use. ตู๋ mutated the horizon to `windowMs` (a defensible choice: the reconciler really does keep
    // trying that long) and ONLY that one test went red, while every test about behaviour stayed green.
    // A suite that pins the author's arithmetic tells the next person their better idea is a regression.
    //
    // So what is pinned here is the property the ticket is actually about:
    //   the screen must stop guaranteeing AFTER it stops polling fast, and NEVER LATER than the last moment
    //   the reconciler would still consider the row at all.
    // Any horizon inside that range is a legitimate product decision; anything outside it is #423 again.
    expect(POLL_UNTIL_MS).toBeLessThan(RECONCILE_HORIZON_MS)
    expect(RECONCILE_HORIZON_MS).toBeLessThanOrEqual(DEFAULT_WINDOW.windowMs)
    expect(RECONCILE_HORIZON_MS).toBeGreaterThanOrEqual(DEFAULT_WINDOW.graceMs)
  })

  it('the chosen horizon is grace + one cron period — documented, not enforced as the only right answer', () => {
    // Kept as a CHANGE DETECTOR for today's choice, deliberately separate from the property above so that
    // replacing the formula is a one-line, obviously-intentional edit instead of a mysterious red suite.
    // Eligibility starts at graceMs (reconcile.ts selectReconcileCandidates), but the run that would pick the
    // row up may have fired a second before it aged in — hence one full period, not zero.
    expect(RECONCILE_HORIZON_MS).toBe(DEFAULT_WINDOW.graceMs + cronIntervalMsFromVercelJson())
  })

  it("today's horizon leaves runway behind it — CHANGE DETECTOR, not a law", () => {
    // The claim this file used to make in prose ("nothing more is coming automatically") was false:
    // reconcile-run.ts:60-64 leaves an unreachable row untouched and repo.ts:191 keeps selecting it, so a
    // charge can settle long after the screen stops promising. That is why the screen keeps polling.
    //
    // ⚠️ Deliberately NOT part of the property above. A future horizon of exactly `windowMs` would be a
    // legitimate choice (promise for as long as the cron looks) and would turn this red — which is correct
    // for a change detector and would have been WRONG for a property. The two live apart so the next reader
    // can tell which kind of red they are looking at.
    expect(DEFAULT_WINDOW.windowMs).toBeGreaterThan(RECONCILE_HORIZON_MS)
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
