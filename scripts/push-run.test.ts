// #288 phase 4 — the orchestrator's guarantees, each isolated so a mutant fails its OWN line (goo).
// Fake repo models the two facts SQL enforces (claimDue returns only NOT-sent rows; deleteSubscription
// drops a device); the rest is real run.ts logic. NOTE: this proves the dedup/ceiling/lifecycle
// DECISIONS; true row-level concurrency (FOR UPDATE SKIP LOCKED, two claimers at once) is proven on a
// real pg in scripts/push-concurrency.test.ts (บอง: overlap ต้องกันที่ชั้น DB ไม่ใช่รัน 2 รอบเรียงกัน).
import { describe, it, expect, vi } from 'vitest'
import { runDueReminders, type PushRepo, type SubscriptionRow } from '@/lib/push/run'
import type { ClaimableReminder } from '@/lib/push/due'
import type { SendOutcome } from '@/lib/push/send'

const NOW = new Date('2026-08-19T10:00:00.000Z')
const minAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

const reminder = (id: string, userId: string, fireAtUtc: Date): ClaimableReminder => ({
  id,
  userId,
  reminderDate: '2026-08-19',
  yamLabel: 'ยามรุ่ง',
  window: '06:00-07:00',
  fireAtUtc,
})
const sub = (id: string): SubscriptionRow => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: 'P',
  auth: 'A',
})

function makeRepo(reminders: ClaimableReminder[], subsByUser: Record<string, SubscriptionRow[]>) {
  const sent = new Set<string>()
  const deleted = new Set<string>()
  const markSent = vi.fn(async (id: string) => {
    sent.add(id)
  })
  const deleteSubscription = vi.fn(async (id: string) => {
    deleted.add(id)
  })
  const repo: PushRepo = {
    claimDue: vi.fn(async () => reminders.filter((r) => !sent.has(r.id))),
    loadSubscriptions: vi.fn(async (userId: string) =>
      (subsByUser[userId] ?? []).filter((s) => !deleted.has(s.id)),
    ),
    markSent,
    deleteSubscription,
  }
  return { repo, markSent, deleteSubscription }
}

const okSender = () => vi.fn(async (): Promise<SendOutcome> => ({ status: 'ok' }))
const senderByEndpoint = (map: Record<string, SendOutcome>) =>
  vi.fn(async (t: { endpoint: string }): Promise<SendOutcome> => map[t.endpoint] ?? { status: 'ok' })

describe('runDueReminders · dedup / ceiling / subscription lifecycle', () => {
  it('deploy ใหม่: a second run this minute sends NOTHING (sent_at claimed the row)', async () => {
    const { repo } = makeRepo([reminder('r1', 'u1', minAgo(5))], { u1: [sub('s1')] })
    const send = okSender()
    const first = await runDueReminders({ repo, now: NOW, send })
    const second = await runDueReminders({ repo, now: NOW, send })
    expect(first.sent).toBe(1)
    expect(second.sent).toBe(0)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('เพดานความช้า: 14m late → send · 16m late → dropped · 15m boundary → send', async () => {
    for (const [late, shouldSend] of [
      [14, true],
      [16, false],
      [15, true],
    ] as const) {
      const { repo, markSent } = makeRepo([reminder(`r${late}`, 'u1', minAgo(late))], {
        u1: [sub('s1')],
      })
      const send = okSender()
      const summary = await runDueReminders({ repo, now: NOW, send })
      expect(send).toHaveBeenCalledTimes(shouldSend ? 1 : 0)
      expect(summary.droppedLate).toBe(shouldSend ? 0 : 1)
      if (!shouldSend) expect(markSent).not.toHaveBeenCalled() // dropped-late is never marked sent
    }
  })

  it('sub ตาย (404/410 → gone): row deleted AND reminder marked sent (nobody left to deliver to)', async () => {
    const { repo, deleteSubscription, markSent } = makeRepo([reminder('r1', 'u1', minAgo(2))], {
      u1: [sub('s1')],
    })
    const send = senderByEndpoint({ 'https://push.example/s1': { status: 'gone' } })
    const summary = await runDueReminders({ repo, now: NOW, send })
    expect(deleteSubscription).toHaveBeenCalledWith('s1')
    expect(summary.deletedSubscriptions).toBe(1)
    expect(markSent).toHaveBeenCalledWith('r1', NOW)
    expect(summary.sent).toBe(0) // deleted ≠ delivered
  })

  it('push 500 (transient): subscription KEPT, reminder NOT marked → retried next tick', async () => {
    const { repo, deleteSubscription, markSent } = makeRepo([reminder('r1', 'u1', minAgo(2))], {
      u1: [sub('s1')],
    })
    const first = await runDueReminders({
      repo,
      now: NOW,
      send: senderByEndpoint({ 'https://push.example/s1': { status: 'transient' } }),
    })
    expect(deleteSubscription).not.toHaveBeenCalled()
    expect(markSent).not.toHaveBeenCalled()
    expect(first.sent).toBe(0)
    // proof of retry: the service recovers next tick and it delivers
    const send2 = okSender()
    const second = await runDueReminders({ repo, now: NOW, send: send2 })
    expect(second.sent).toBe(1)
  })

  it('mixed devices (one ok + one gone): delivered + marked sent, only the gone one deleted', async () => {
    const { repo, deleteSubscription, markSent } = makeRepo([reminder('r1', 'u1', minAgo(2))], {
      u1: [sub('good'), sub('dead')],
    })
    const send = senderByEndpoint({
      'https://push.example/good': { status: 'ok' },
      'https://push.example/dead': { status: 'gone' },
    })
    const summary = await runDueReminders({ repo, now: NOW, send })
    expect(summary.sent).toBe(1)
    expect(deleteSubscription).toHaveBeenCalledWith('dead')
    expect(deleteSubscription).not.toHaveBeenCalledWith('good')
    expect(markSent).toHaveBeenCalledWith('r1', NOW)
  })

  it('the payload handed to send carries the ยาม + the deep-link built from reminderDate (not undefined)', async () => {
    const { repo } = makeRepo([reminder('r1', 'u1', minAgo(2))], { u1: [sub('s1')] })
    const seen: { url: string; title: string; body: string }[] = []
    const send = vi.fn(async (_t: unknown, p: { url: string; title: string; body: string }) => {
      seen.push(p)
      return { status: 'ok' } as SendOutcome
    })
    await runDueReminders({ repo, now: NOW, send })
    expect(seen).toHaveLength(1)
    expect(seen[0].url).toBe('/v2/calendar/2026-08-19') // reminderDate → date; never /v2/calendar/undefined
    expect(seen[0].title).toContain('ยามรุ่ง')
    expect(seen[0].body).toContain('06:00-07:00')
  })

  it('due but no device yet (#303): not sent, not marked → left for a later tick', async () => {
    const { repo, markSent } = makeRepo([reminder('r1', 'u1', minAgo(2))], {})
    const send = okSender()
    const summary = await runDueReminders({ repo, now: NOW, send })
    expect(send).not.toHaveBeenCalled()
    expect(markSent).not.toHaveBeenCalled()
    expect(summary.noDevice).toBe(1)
  })
})
