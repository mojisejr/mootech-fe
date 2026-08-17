// POST/GET/DELETE /api/v2/reminders — persist the ยามมงคล reminders (goo · #287).
//
// Every mutation is SERVER-GATED, twice:
//   1. identity — resolveSessionUserId derives user_id from the signed session; the request NEVER
//      names the subject (no user_id from body/cookie — that is #252/#273/be#16's hole).
//   2. membership — resolveMembership; only a paid member may create reminders (ฟีมเคาะ). A free user
//      is refused HERE, not merely hidden on the screen.
// The write DECISION (validate, compute fire time, reject ตั้งย้อนหลัง, atomic batch) is pure —
// lib/v2/reminder-plan.ts — so this handler is a thin DB shell around it.
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { reminder } from '@/lib/db/schema'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { resolveMembership } from '@/lib/usage'
import { planReminderCommit, type CommitInput } from '@/lib/v2/reminder-plan'

type Row = typeof reminder.$inferSelect

/** DB row → wire DTO. No `group`/totals (the client adapter derives those from fireAtUtc). */
function toDTO(r: Row) {
  return {
    id: r.id,
    date: r.reminderDate,
    yamId: r.yamId,
    yamLabel: r.yamLabel,
    window: r.window,
    destinations: r.destinations,
    fireAtUtc: r.fireAtUtc.toISOString(),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })
  const userId = who.userId

  // Membership gate — paid only. GET is gated too: a free user has no reminders to read anyway, and
  // gating everything keeps the paid boundary in one place.
  const membership = await resolveMembership(userId)
  if (membership.isFree) {
    return res.status(403).json({ ok: false, error: 'เฉพาะสมาชิก', reason: membership.reason })
  }

  try {
    if (req.method === 'GET') {
      const rows = await db.select().from(reminder).where(eq(reminder.userId, userId))
      return res.status(200).json({ ok: true, reminders: rows.map(toDTO) })
    }

    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Partial<CommitInput>
      const input: CommitInput = {
        date: typeof body.date === 'string' ? body.date : '',
        yams: Array.isArray(body.yams) ? body.yams : [],
        destinations: Array.isArray(body.destinations) ? body.destinations : [],
      }
      const plan = planReminderCommit(input, new Date())
      if (!plan.ok) {
        return res.status(plan.status).json({ ok: false, error: plan.error, pastYamIds: plan.pastYamIds })
      }

      const yamIds = plan.rows.map((r) => r.yamId)
      // One transaction: insert all-or-nothing. ON CONFLICT (user_id, reminder_date, yam_id) DO NOTHING
      // makes a lost-response RETRY idempotent — the same (user, date, ยาม) can't become a second row.
      // Then read the full set back (new + any that already existed) so the response is the same whether
      // this was the first attempt or a retry.
      const rows = await db.transaction(async (tx) => {
        await tx
          .insert(reminder)
          .values(
            plan.rows.map((r) => ({
              userId,
              reminderDate: input.date,
              yamId: r.yamId,
              yamLabel: r.yamLabel,
              window: r.window,
              destinations: r.destinations,
              fireAtUtc: r.fireAtUtc,
            })),
          )
          .onConflictDoNothing({
            target: [reminder.userId, reminder.reminderDate, reminder.yamId],
          })
        return tx
          .select()
          .from(reminder)
          .where(
            and(
              eq(reminder.userId, userId),
              eq(reminder.reminderDate, input.date),
              inArray(reminder.yamId, yamIds),
            ),
          )
      })
      return res.status(201).json({ ok: true, reminders: rows.map(toDTO) })
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : (req.body?.id as string | undefined)
      if (!id) return res.status(400).json({ ok: false, error: 'ต้องระบุ id' })
      // Scoped by session user_id → a caller can only cancel THEIR OWN reminder, never someone else's.
      await db.delete(reminder).where(and(eq(reminder.id, id), eq(reminder.userId, userId)))
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (err) {
    // Never leak DB error text to the browser — but DO log it (first-run-reset's #254 lesson).
    console.error('[reminders] failed', err)
    return res.status(500).json({ ok: false, error: 'reminders failed' })
  }
}
