// MuMate v2 · push-reminder orchestrator (goo · #288 phase 4). The DECISION logic, DB- and
// transport-agnostic: it drives a PushRepo (the SQL half — repo.ts) and a Sender (the web-push half —
// send.ts) through injected interfaces, so every rule below is unit-provable with fakes, and the same
// logic runs unchanged whether Vercel cron or a future VPS calls it.
//
// The three guarantees ตู๋ set, each isolated so a mutant on one fails its OWN test line:
//   1. กันซ้ำ  — claimDue returns only sent_at-IS-NULL rows; markSent flips it → a second run this
//                minute (or after a redeploy) claims nothing. (deploy ใหม่ → ไม่ส่งซ้ำ)
//   2. เพดานช้า — withinCeiling drops rows > 15m late; they are left unsent (never sent behind time).
//   3. sub ตาย  — 'gone' (404/410) deletes the row; 'transient' (429/5xx) KEEPS it and does NOT mark
//                the reminder sent, so it retries next tick within the ceiling. (500 → ไม่มีใครถูกลบ)

import { buildReminderPayload, type PushPayload } from './payload'
import { withinCeiling, type ClaimableReminder } from './due'
import type { PushTarget, SendOutcome } from './send'

export interface SubscriptionRow extends PushTarget {
  id: string
}

// The SQL surface, kept tiny. claimDue MUST run inside a transaction that stays open across the whole
// run (repo.ts locks the claimed rows FOR UPDATE SKIP LOCKED) so an overlapping cron invocation —
// which Vercel documents CAN happen — skips rows already being processed instead of double-sending.
export interface PushRepo {
  claimDue(now: Date): Promise<ClaimableReminder[]>
  loadSubscriptions(userId: string): Promise<SubscriptionRow[]>
  markSent(reminderId: string, at: Date): Promise<void>
  deleteSubscription(subscriptionId: string): Promise<void>
}

export type Sender = (target: PushTarget, payload: PushPayload) => Promise<SendOutcome>

export interface RunSummary {
  claimed: number
  sent: number // reminders delivered to ≥1 device this run
  droppedLate: number // claimed but past the ceiling → not sent
  noDevice: number // due, in-window, but the user has no subscription yet → left for next tick
  deletedSubscriptions: number
}

export async function runDueReminders(deps: {
  repo: PushRepo
  now: Date
  send: Sender
}): Promise<RunSummary> {
  const { repo, now, send } = deps
  const claimed = await repo.claimDue(now)
  const summary: RunSummary = {
    claimed: claimed.length,
    sent: 0,
    droppedLate: 0,
    noDevice: 0,
    deletedSubscriptions: 0,
  }

  for (const r of claimed) {
    if (!withinCeiling(r.fireAtUtc, now)) {
      // Too late — leave sent_at NULL and never send behind time (ทิ้ง จบ). It stays out of every
      // future send because it only gets later; no marker needed.
      summary.droppedLate += 1
      continue
    }

    const subs = await repo.loadSubscriptions(r.userId)
    if (subs.length === 0) {
      // A reminder can outrun its device: users may set reminders before granting permission (#303).
      // Leave it unsent — if a subscription appears before the ceiling, the next tick delivers it.
      summary.noDevice += 1
      continue
    }

    const payload = buildReminderPayload({
      date: r.reminderDate,
      yamLabel: r.yamLabel,
      window: r.window,
    })
    let anyDelivered = false
    let anyKept = false // a subscription still present after this run (delivered OR transient-failed)
    for (const sub of subs) {
      const outcome = await send(sub, payload)
      if (outcome.status === 'ok') {
        anyDelivered = true
        anyKept = true
      } else if (outcome.status === 'gone') {
        await repo.deleteSubscription(sub.id)
        summary.deletedSubscriptions += 1
      } else {
        // transient — keep the subscription, do NOT count it delivered
        anyKept = true
      }
    }

    if (anyDelivered || !anyKept) {
      // Delivered to someone, OR every remaining target was gone (nobody left to deliver to) →
      // mark sent so we stop. Only-transient-failures (anyKept && !anyDelivered) leaves it unsent
      // so the next tick retries within the ceiling.
      await repo.markSent(r.id, now)
      if (anyDelivered) summary.sent += 1
    }
  }

  return summary
}
