// MuMate v2 · push delivery (goo · #288 phase 4). The send phase, run AFTER the claim has already
// marked sent_at and committed (repo.claimAndMark). It runs OUTSIDE any transaction — so nothing here
// can roll back a mark, and a failure only makes a reminder MISS, never double-send. THIS at-most-once
// choice is the deliberate one (ตู๋ F1 → ฟีมเคาะ): it prevents the double-send, trading it for a crash
// AFTER the mark commits but BEFORE the send (rare), which the ticket's "ส่งช้าแย่กว่าไม่ส่ง" rule
// prefers. Transport- and DB-agnostic via injected deps.
//
// A CONSEQUENCE of that choice (not a separately-designed rule): a transient push error (429/5xx) is
// NOT retried — the row is already marked sent, so this reminder just misses this round. That is a
// real user-facing cost (the old design retried within the 15-min ceiling); ฟีม looked at it and
// accepted it on 2026-08-19 (#288 N2, option ก) — a safe retry would need per-device state = a schema
// change = out of this ticket. We still do NOT delete the subscription on transient (only 404/410 =
// gone deletes it); deleting on a temporary hiccup would eat healthy subscribers.

import { buildReminderPayload, type PushPayload } from './payload'
import type { ClaimedReminder } from './due'
import type { PushTarget, SendOutcome } from './send'

export interface SubscriptionRow extends PushTarget {
  id: string
}

export interface PushRepo {
  // Atomic claim+mark+return (repo.ts). MUST commit before delivery begins → at-most-once.
  claimAndMark(now: Date): Promise<ClaimedReminder[]>
  loadSubscriptions(userId: string): Promise<SubscriptionRow[]>
  deleteSubscription(subscriptionId: string): Promise<void>
}

export type Sender = (target: PushTarget, payload: PushPayload) => Promise<SendOutcome>

export interface DeliverSummary {
  claimed: number
  sent: number // reminders delivered to ≥1 device
  noDevice: number // claimed (and marked) but the user has no subscription — a miss, not retried
  deletedSubscriptions: number
  failed: number // a reminder whose delivery threw (DB/subs error) — isolated, batch continues
}

export async function deliverClaimed(deps: {
  claimed: ClaimedReminder[]
  repo: Pick<PushRepo, 'loadSubscriptions' | 'deleteSubscription'>
  send: Sender
}): Promise<DeliverSummary> {
  const { claimed, repo, send } = deps
  const summary: DeliverSummary = {
    claimed: claimed.length,
    sent: 0,
    noDevice: 0,
    deletedSubscriptions: 0,
    failed: 0,
  }

  for (const r of claimed) {
    try {
      const subs = await repo.loadSubscriptions(r.userId)
      if (subs.length === 0) {
        // Claimed + marked but no device (e.g. reminder set before granting permission, #303). Under
        // at-most-once this is a miss, not a retry — consistent with "ไม่เตือน 1 ใบ ดีกว่าปลุกซ้ำ".
        summary.noDevice += 1
        continue
      }
      const payload = buildReminderPayload({
        date: r.reminderDate,
        yamLabel: r.yamLabel,
        window: r.window,
      })
      let delivered = false
      for (const sub of subs) {
        const outcome = await send(sub, payload)
        if (outcome.status === 'ok') {
          delivered = true
        } else if (outcome.status === 'gone') {
          await repo.deleteSubscription(sub.id) // 404/410 — subscription really dead
          summary.deletedSubscriptions += 1
        }
        // transient (429/5xx/network): keep the subscription, do NOT retry the reminder (already marked)
      }
      if (delivered) summary.sent += 1
    } catch {
      // One reminder's DB/subs failure must not abort the whole batch (the row is already marked sent).
      summary.failed += 1
    }
  }

  return summary
}
