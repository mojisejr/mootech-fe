// #298 (reframed 2026-08-17) — the wire from the SAVE button to the reminder + push_subscription tables.
// Two layers, tested apart:
//   • transport (postPushSubscription / deletePushSubscription): fetch is the ONLY stub; body shape,
//     status→boolean mapping, drain, and never-throw are exercised for real.
//   • orchestration (saveWithNotification): every dep is a fake so we prove the invariants the reframe cares
//     about — the reminder is ALWAYS saved, the permission request LEADS the gesture, and push is only touched
//     when the device can receive it. These are the homes for the new mutant set M9-a…e (old M9 died with the
//     switch; @too to confirm the set is enough).
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  postPushSubscription,
  deletePushSubscription,
  saveWithNotification,
  type SaveWithNotifyDeps,
} from '@/lib/pwa/persist-subscription'
import type { SubscribeResult } from '@/lib/pwa/subscribe'
import type { NotifyState } from '@/features/v2-calendar/notify-state'

function fakeSub(endpoint = 'https://push.example/dev-abc'): PushSubscription {
  return {
    endpoint,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'PKEY', auth: 'AKEY' } }),
  } as unknown as PushSubscription
}
function fakeRes(status: number, textSpy = vi.fn(async () => '')): Response {
  return { status, ok: status >= 200 && status < 300, text: textSpy } as unknown as Response
}

afterEach(() => vi.restoreAllMocks())

describe('transport · postPushSubscription', () => {
  it('POSTs toJSON()+userAgent to /api/v2/push/subscribe and returns true on 201', async () => {
    const fetchMock = vi.fn(async () => fakeRes(201))
    vi.stubGlobal('fetch', fetchMock)
    const ok = await postPushSubscription(fakeSub('https://push.example/xyz'), 'UA/1.0')
    expect(ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v2/push/subscribe')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).credentials).toBe('same-origin')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      endpoint: 'https://push.example/xyz',
      expirationTime: null,
      keys: { p256dh: 'PKEY', auth: 'AKEY' },
      userAgent: 'UA/1.0',
    })
  })

  it('drains the response body and returns false on 500', async () => {
    const textSpy = vi.fn(async () => 'boom')
    vi.stubGlobal('fetch', vi.fn(async () => fakeRes(500, textSpy)))
    const ok = await postPushSubscription(fakeSub())
    expect(textSpy).toHaveBeenCalledTimes(1)
    expect(ok).toBe(false)
  })

  it('returns false (never throws) when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(postPushSubscription(fakeSub())).resolves.toBe(false)
  })
})

describe('transport · deletePushSubscription', () => {
  it('DELETEs with the endpoint url-encoded and returns true on 200', async () => {
    const fetchMock = vi.fn(async () => fakeRes(200))
    vi.stubGlobal('fetch', fetchMock)
    const ok = await deletePushSubscription('https://push.example/a b?c=1')
    expect(ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`/api/v2/push/subscribe?endpoint=${encodeURIComponent('https://push.example/a b?c=1')}`)
    expect((init as RequestInit).method).toBe('DELETE')
  })

  it('returns false on 500 and on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeRes(500)))
    expect(await deletePushSubscription('e')).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await deletePushSubscription('e')).toBe(false)
  })
})

// Base deps: default state, permission grants, server accepts, reminder saves. `calls` records the ORDER of
// the two side effects so M9-b (permission must lead the gesture) has a fang. Each test overrides one axis.
function deps(over: Partial<SaveWithNotifyDeps> = {}) {
  const calls: string[] = []
  const d: SaveWithNotifyDeps = {
    notify: 'default',
    requestSubscription: async (): Promise<SubscribeResult> => { calls.push('request'); return { ok: true, subscription: fakeSub() } },
    post: vi.fn(async () => { calls.push('post'); return true }),
    saveReminder: vi.fn(async () => { calls.push('save'); return true }),
    ...over,
  }
  return { d, calls, post: d.post as ReturnType<typeof vi.fn>, saveReminder: d.saveReminder as ReturnType<typeof vi.fn> }
}

describe('orchestration · saveWithNotification', () => {
  it('default → requests permission, saves reminder, and POSTs on grant (M9-a / M9-c home)', async () => {
    const { d, post, saveReminder } = deps()
    const r = await saveWithNotification(d)
    expect(saveReminder).toHaveBeenCalledTimes(1) //     reminder saved
    expect(post).toHaveBeenCalledTimes(1) //             device registered on grant
    expect(r).toEqual({ saved: true, pushed: true })
  })

  it('🔴 M9-b — permission request LEADS the save (Safari gesture): request before save', async () => {
    const { d, calls } = deps()
    await saveWithNotification(d)
    expect(calls.indexOf('request')).toBeLessThan(calls.indexOf('save'))
    expect(calls[0]).toBe('request') // must be the very first side effect in the gesture
  })

  it('🔴 M9-d — deny → reminder is STILL saved; no POST (ตั้งไว้ได้แม้เครื่องยังไม่พร้อม)', async () => {
    const { d, post, saveReminder } = deps({
      requestSubscription: async (): Promise<SubscribeResult> => ({ ok: false, reason: 'denied' }),
    })
    const r = await saveWithNotification(d)
    expect(saveReminder).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalled()
    expect(r).toEqual({ saved: true, pushed: false })
  })

  it('🔴 M9-e — denied/needs-install/unsupported → NEVER requests permission or POSTs; still saves', async () => {
    for (const notify of ['denied', 'needs-install', 'unsupported'] as NotifyState[]) {
      let requested = false
      const { d, post, saveReminder } = deps({
        notify,
        requestSubscription: async (): Promise<SubscribeResult> => { requested = true; return { ok: true, subscription: fakeSub() } },
      })
      await saveWithNotification(d)
      expect(requested, `${notify} must not request permission`).toBe(false)
      expect(post, `${notify} must not POST`).not.toHaveBeenCalled()
      expect(saveReminder, `${notify} must still save`).toHaveBeenCalledTimes(1)
    }
  })

  it('granted → registers the device (idempotent) and saves', async () => {
    const { d, post, saveReminder } = deps({ notify: 'granted' })
    const r = await saveWithNotification(d)
    expect(post).toHaveBeenCalledTimes(1)
    expect(saveReminder).toHaveBeenCalledTimes(1)
    expect(r.saved).toBe(true)
  })

  it('grant but POST fails → saved stays true, pushed false (push never blocks the save)', async () => {
    const { d } = deps({ post: vi.fn(async () => false) })
    const r = await saveWithNotification(d)
    expect(r).toEqual({ saved: true, pushed: false })
  })
})
