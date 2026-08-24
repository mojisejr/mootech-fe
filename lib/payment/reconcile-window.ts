// features ↔ cron seam (mootech-fe#423) — how long the SCREEN must keep believing a repair is still
// possible, derived from the reconciler's own numbers instead of a second hand-picked deadline.
//
// ── THE BUG THIS FILE EXISTS TO PREVENT ─────────────────────────────────────────────────────────────
// Three fifteens lived in three files and nobody owned the relationship between them:
//
//   useChargeStatus.STALE_AFTER_MS   15m   the screen gives up and offers "ขอ QR ใหม่"
//   reconcile.DEFAULT_WINDOW.graceMs 15m   the reconciler REFUSES to touch a row younger than this
//   vercel.json  crons  */15         15m   so the next run that may touch it is up to 15m away
//
// The reconciler can therefore first act at minute 15 and last act at minute 30 — and the screen quit at
// minute 15 exactly. In the one case the reconciler exists for (money moved, webhook never arrived) the
// user was told to pay again 0–15 minutes BEFORE the repair was even allowed to start.
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
 * The last moment a repair can still plausibly happen for a charge created at t=0.
 *
 * grace: the reconciler ignores the row entirely until it is this old (reconcile.ts selectReconcileCandidates).
 * + one cron period: becoming ELIGIBLE is not the same as being LOOKED AT — the run that would pick it up
 *   may have fired one second before it aged in, so the first real chance is up to a full period later.
 *
 * Past this, the reconciler has had its turn and nothing more is coming automatically.
 */
export const RECONCILE_HORIZON_MS = DEFAULT_WINDOW.graceMs + RECONCILE_CRON_INTERVAL_MS

/**
 * PURE — which of the three honest things the screen may say, given how long it has been waiting.
 *
 * `waiting`     we are still polling; the webhook usually lands in seconds.
 * `reconciling` fast polling is over but the cron's window is still open, so we keep asking slowly. NOT a
 *               failure, and explicitly not an invitation to pay again — that invitation is exactly the bug.
 * `exhausted`   the automatic paths are spent. Only now may the screen suggest a new QR.
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
