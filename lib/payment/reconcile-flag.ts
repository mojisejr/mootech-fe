// #409 — the reconciler's KILL SWITCH, on its own so the decision it encodes can be read in one place.
//
// WHY IT IS NOT `CRON_SECRET`: removing the secret does switch the reconciler off — and switches
// push-reminders off with it, because Vercel sends ONE project-level CRON_SECRET to every cron it invokes
// (our own note, pages/api/cron/push-reminders.ts:5-6, verified against Vercel docs 2026-07-15 — if Vercel
// changes that model this reasoning expires with it). The two crons carry very different costs when they
// misbehave: a wrong reminder annoys someone, a wrong reconciliation grants paid membership. They must be
// switchable apart.
//
// 🔴 DEFAULT IS ON, AND THAT IS DELIBERATE — it reads like a break from this repo's fail-closed habit, so
// here is the distinction it rests on:
//     the ACCESS gate is CRON_SECRET, and it still fails closed (no secret ⇒ every call is refused)
//     THIS flag is an OPERATIONAL switch — it turns off a REPAIR JOB, not a door
// "Closed by default" for a repair job means: a customer who paid and whose webhook was lost stays without
// their membership, quietly, forever — which is precisely the bug #360 exists to fix. So an unset variable
// keeps repairing, and turning it off takes a deliberate word.
//
// 🟡 MOVES TO app_setting when #362 lands — tracked in mootech-fe#410, not left as a hopeful comment.
// (That is the #293 lesson: CALENDAR_MONTH_GATE_OPEN was documented everywhere, named TEMPORARY, and still
//  sat wrong for 18 days because no ticket owned it.)

/** Values that mean "stop reconciling". Anything else — including an unset variable — keeps it running. */
const OFF_VALUES = new Set(['off', 'false', '0', 'no', 'disabled'])

/**
 * PURE. `raw` is `process.env.RECONCILE_ENABLED`.
 *
 * ⚠️ An unrecognised value (a typo, `maybe`, `ON PLEASE`) reads as ON, not OFF. The alternative — treat
 * anything we do not recognise as "off" — would let a typo silently stop paying customers from being
 * granted what they bought, and the only symptom would be nothing happening. A typo must not be able to
 * disable a money-recovery job; it can only fail to disable it, which is visible the moment someone checks.
 */
export function isReconcileEnabled(raw: string | undefined): boolean {
  if (raw === undefined) return true
  return !OFF_VALUES.has(raw.trim().toLowerCase())
}
