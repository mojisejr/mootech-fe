// #288 phase 4 — the DELIVERY phase (after the atomic claim+mark has committed). Fakes stand in for
// the DB reads/deletes; the real deliverClaimed logic runs. NOTE: dedup, the 15-min ceiling, and the
// FOR UPDATE SKIP LOCKED overlap guard are NOT here — they live in the single claimAndMark statement
// and are proven on a real pg in scripts/push-concurrency.test.ts. This file proves what happens once
// rows are already claimed: at-most-once delivery + subscription lifecycle.
import { describe, it, expect, vi } from 'vitest'
import { deliverClaimed, type PushRepo, type SubscriptionRow } from '@/lib/push/run'
import type { ClaimedReminder } from '@/lib/push/due'
import type { SendOutcome } from '@/lib/push/send'

const reminder = (id: string, userId: string): ClaimedReminder => ({
  id,
  userId,
  reminderDate: '2026-08-19',
  yamLabel: 'ยามรุ่ง',
  window: '06:00-07:00',
  fireAtUtc: new Date('2026-08-19T10:00:00.000Z'),
})
const sub = (id: string): SubscriptionRow => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: 'P',
  auth: 'A',
})

function makeRepo(subsByUser: Record<string, SubscriptionRow[]>) {
  const deleted = new Set<string>()
  const deleteSubscription = vi.fn(async (id: string) => {
    deleted.add(id)
  })
  const loadSubscriptions = vi.fn(async (userId: string) =>
    (subsByUser[userId] ?? []).filter((s) => !deleted.has(s.id)),
  )
  const repo: Pick<PushRepo, 'loadSubscriptions' | 'deleteSubscription'> = {
    loadSubscriptions,
    deleteSubscription,
  }
  return { repo, deleteSubscription, loadSubscriptions }
}

const okSender = () => vi.fn(async (): Promise<SendOutcome> => ({ status: 'ok' }))
const senderByEndpoint = (map: Record<string, SendOutcome>) =>
  vi.fn(async (t: { endpoint: string }): Promise<SendOutcome> => map[t.endpoint] ?? { status: 'ok' })

describe('deliverClaimed · at-most-once delivery + subscription lifecycle', () => {
  it('delivers to the device and reports sent', async () => {
    const { repo } = makeRepo({ u1: [sub('s1')] })
    const send = okSender()
    const summary = await deliverClaimed({ claimed: [reminder('r1', 'u1')], repo, send })
    expect(send).toHaveBeenCalledTimes(1)
    expect(summary.sent).toBe(1)
  })

  it('the payload carries the ยาม + the deep-link built from reminderDate (never /undefined)', async () => {
    const { repo } = makeRepo({ u1: [sub('s1')] })
    const seen: { url: string; title: string; body: string }[] = []
    const send = vi.fn(async (_t: unknown, p: { url: string; title: string; body: string }) => {
      seen.push(p)
      return { status: 'ok' } as SendOutcome
    })
    await deliverClaimed({ claimed: [reminder('r1', 'u1')], repo, send })
    expect(seen[0].url).toBe('/v2/calendar/2026-08-19')
    expect(seen[0].title).toContain('ยามรุ่ง')
    expect(seen[0].body).toContain('06:00-07:00')
  })

  it('sub ตาย (404/410 → gone): row deleted; delivery not counted', async () => {
    const { repo, deleteSubscription } = makeRepo({ u1: [sub('s1')] })
    const send = senderByEndpoint({ 'https://push.example/s1': { status: 'gone' } })
    const summary = await deliverClaimed({ claimed: [reminder('r1', 'u1')], repo, send })
    expect(deleteSubscription).toHaveBeenCalledWith('s1')
    expect(summary.deletedSubscriptions).toBe(1)
    expect(summary.sent).toBe(0)
  })

  it('push 500 (transient): subscription KEPT — never deleted on a temporary error', async () => {
    const { repo, deleteSubscription } = makeRepo({ u1: [sub('s1')] })
    const send = senderByEndpoint({ 'https://push.example/s1': { status: 'transient' } })
    const summary = await deliverClaimed({ claimed: [reminder('r1', 'u1')], repo, send })
    expect(deleteSubscription).not.toHaveBeenCalled()
    expect(summary.sent).toBe(0)
    // at-most-once: the reminder was already marked sent in the claim → NO retry happens here
  })

  it('mixed devices (one ok + one gone): delivered, and only the gone one deleted', async () => {
    const { repo, deleteSubscription } = makeRepo({ u1: [sub('good'), sub('dead')] })
    const send = senderByEndpoint({
      'https://push.example/good': { status: 'ok' },
      'https://push.example/dead': { status: 'gone' },
    })
    const summary = await deliverClaimed({ claimed: [reminder('r1', 'u1')], repo, send })
    expect(summary.sent).toBe(1)
    expect(deleteSubscription).toHaveBeenCalledWith('dead')
    expect(deleteSubscription).not.toHaveBeenCalledWith('good')
  })

  it('no device (claimed but user has no subscription): counted as a miss, nothing sent', async () => {
    const { repo } = makeRepo({})
    const send = okSender()
    const summary = await deliverClaimed({ claimed: [reminder('r1', 'u1')], repo, send })
    expect(send).not.toHaveBeenCalled()
    expect(summary.noDevice).toBe(1)
    expect(summary.sent).toBe(0)
  })

  it('one reminder failing (DB read throws) is isolated — the rest of the batch still delivers', async () => {
    const { repo } = makeRepo({ u2: [sub('s2')] })
    repo.loadSubscriptions = vi.fn(async (userId: string) => {
      if (userId === 'u1') throw new Error('pooler dropped')
      return [sub('s2')]
    })
    const send = okSender()
    const summary = await deliverClaimed({
      claimed: [reminder('r1', 'u1'), reminder('r2', 'u2')],
      repo,
      send,
    })
    expect(summary.failed).toBe(1)
    expect(summary.sent).toBe(1) // r2 still delivered
  })
})
