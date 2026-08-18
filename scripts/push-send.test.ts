// #288 phase 4 — the web-push wrapper's classification + arg-mapping (goo). ONLY the web-push module
// is mocked; sendPush's own mapping (subscription → sendNotification shape, payload → JSON, HTTP
// status → outcome) runs for real, so the arg-mapping has a fang ([[thin-wrapper-mocked-both-sides]]).
// The 404/410-vs-429/5xx split IS the ตู๋ gate: deleting on a transient error eats healthy subscribers.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}))
import webpush from 'web-push'
import { sendPush, type PushTarget } from '@/lib/push/send'
import type { PushPayload } from '@/lib/push/payload'

const target: PushTarget = { endpoint: 'https://push.example/abc', p256dh: 'PKEY', auth: 'AKEY' }
const payload: PushPayload = { title: 't', body: 'b', url: '/v2/calendar/2026-08-19' }

beforeAll(() => {
  process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub'
  process.env.VAPID_PRIVATE_KEY = 'priv'
})
afterEach(() => vi.clearAllMocks())

const webPushError = (statusCode: number) => Object.assign(new Error('WebPushError'), { statusCode })

describe('sendPush · classifies the push service answer', () => {
  it('2xx → ok, and maps subscription + payload onto sendNotification (arg-mapping fang)', async () => {
    vi.mocked(webpush.sendNotification).mockResolvedValueOnce(undefined as never)
    expect(await sendPush(target, payload)).toEqual({ status: 'ok' })
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: target.endpoint, keys: { p256dh: 'PKEY', auth: 'AKEY' } },
      JSON.stringify(payload),
    )
  })
  it('404 → gone (subscription really dead → delete)', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(webPushError(404))
    expect(await sendPush(target, payload)).toEqual({ status: 'gone' })
  })
  it('410 → gone', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(webPushError(410))
    expect(await sendPush(target, payload)).toEqual({ status: 'gone' })
  })
  it('429 → transient (rate-limit — KEEP the subscription)', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(webPushError(429))
    expect(await sendPush(target, payload)).toEqual({ status: 'transient' })
  })
  it('500 → transient (push service hiccup — KEEP)', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(webPushError(500))
    expect(await sendPush(target, payload)).toEqual({ status: 'transient' })
  })
  it('network error with no statusCode → transient (never blame the endpoint)', async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(new Error('ECONNRESET'))
    expect(await sendPush(target, payload)).toEqual({ status: 'transient' })
  })
})
