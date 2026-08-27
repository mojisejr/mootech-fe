// features ↔ cron seam (mootech-fe#423) — how long the SCREEN must keep believing a repair is still
// possible, derived from the reconciler's own numbers instead of a second hand-picked deadline.
//
// ── THE BUG THIS FILE EXISTS TO PREVENT — ⚠️ PAST TENSE. This is the world BEFORE #423, kept because the
// relationship it describes is the reason this file exists. It is NOT a description of today's behaviour.
// (มุน read it as current on 2026-08-27 and nearly deferred #455's screen work on the strength of it.)
//
//   useChargeStatus.STALE_AFTER_MS   15m   the screen GAVE UP and offered "ขอ QR ใหม่"
//        🔴 that symbol no longer exists — #423 renamed it to POLL_UNTIL_MS (useChargeStatus.ts:100) and,
//        more importantly, changed what happens at that moment: the screen now enters RECONCILING
//        (result-state.ts:74) and keeps waiting until the horizon below, instead of quitting.
//   reconcile.DEFAULT_WINDOW.graceMs 15m   the reconciler REFUSES to touch a row younger than this
//   vercel.json  crons  */15         15m   so the next run that may touch it is up to 15m away
//
// The reconciler can therefore first act at minute 15 and last act at minute 30 — and the screen USED TO
// quit at minute 15 exactly. In the one case the reconciler exists for (money moved, webhook never
// arrived) the user WAS told to pay again 0–15 minutes BEFORE the repair was even allowed to start.
//
// 🔴 SO THE HORIZON IS COMPUTED, NEVER TYPED. Whoever widens graceMs or slows the cron moves this with
// them; nobody has to remember that a screen in another folder depends on it.
import { DEFAULT_WINDOW } from './reconcile'

/**
 * The reconcile cron's period, mirrored from `vercel.json` ("*\/15 * * * *" on /api/cron/reconcile-payment).
 *
 * 🔴 It is duplicated here ON PURPOSE and pinned by a test. vercel.json is deployment config: it is not
 * bundled, so a browser cannot read it, and a client-side hook needs this number. The copy is only safe
 * because scripts/reconcile-window.test.ts parses the REAL vercel.json and fails when the two disagree —
 * the duplication is guarded, not trusted.
 */
export const RECONCILE_CRON_INTERVAL_MS = 15 * 60_000

/**
 * The moment the reconciler's FIRST LOOK is guaranteed to have happened, for a charge created at t=0.
 *
 * grace: the reconciler ignores the row entirely until it is this old (reconcile.ts selectReconcileCandidates).
 * + one cron period: becoming ELIGIBLE is not the same as being LOOKED AT — the run that would pick it up
 *   may have fired one second before it aged in, so the first real chance is up to a full period later.
 *
 * 🔴 THIS IS NOT "WHEN REPAIR STOPS BEING POSSIBLE" — an earlier version of this file said that and it was
 * WRONG (ตู๋, review of #424). There is no attempt counter, no give-up flag, and no terminal state anywhere
 * in lib/payment: a PENDING row is re-asked every cron period for as long as DEFAULT_WINDOW.windowMs — SEVEN
 * DAYS (repo.ts:191 `createdAt >= now - windowMs`). A run that cannot reach the gateway just counts itself
 * `unreachable` and leaves the row untouched for the next one (reconcile-run.ts:60-64).
 *
 * So passing this instant means only: "we can no longer PROMISE the user that a look is still pending."
 * The screen must keep that distinction — it may stop guaranteeing, it may never stop watching.
 */
export const RECONCILE_HORIZON_MS = DEFAULT_WINDOW.graceMs + RECONCILE_CRON_INTERVAL_MS

/**
 * PURE — which of the three honest things the screen may say, given how long it has been waiting.
 *
 * `waiting`     we are still polling; the webhook usually lands in seconds.
 * `reconciling` fast polling is over but the FIRST guaranteed look has not landed yet, so we keep asking
 *               slowly. NOT a failure, and explicitly not an invitation to pay again — that invitation is
 *               exactly the bug this file was opened for.
 * `exhausted`   the guarantee is spent, NOT the repair (see RECONCILE_HORIZON_MS). The screen may now offer
 *               a new QR to whoever never paid — while still telling whoever DID pay not to pay twice, and
 *               while still polling, because the cron is very much alive for another seven days.
 *
 * 🔴 `graceMs` is the LOWER bound, not the moment of repair — see RECONCILE_HORIZON_MS.
 */
export type WaitPhase = 'waiting' | 'reconciling' | 'exhausted'

export function waitPhase(
  elapsedMs: number,
  pollUntilMs: number,
  horizonMs: number = RECONCILE_HORIZON_MS,
): WaitPhase {
  if (elapsedMs < pollUntilMs) return 'waiting'
  if (elapsedMs < horizonMs) return 'reconciling'
  return 'exhausted'
}
