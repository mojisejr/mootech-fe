// #298 — the wire from the mumate toggle to the push_subscription table. Two layers, tested apart:
//   • transport (postPushSubscription / deletePushSubscription): fetch is the ONLY stub; body shape,
//     status→boolean mapping, drain, and never-throw are exercised for real.
//   • orchestration (toggleMumatePush): every dep is a fake so we prove the DIRECTION + the invariant that
//     matters most for #298 — the toggle flips ONLY when the server row actually changed, never on the mere
//     fact the browser granted permission or a POST was merely attempted.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  postPushSubscription,
  deletePushSubscription,
  toggleMumatePush,
  type MumateToggleDeps,
} from '@/lib/pwa/persist-subscription'
import type { SubscribeResult } from '@/lib/pwa/subscribe'

// A fake PushSubscription with the toJSON() the Push API guarantees ({endpoint, expirationTime, keys}).
function fakeSub(endpoint = 'https://push.example/dev-abc'): PushSubscription {
  return {
    endpoint,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'PKEY', auth: 'AKEY' } }),
  } as unknown as PushSubscription
}

// A Response whose body reader we can observe (to prove we drain it — the networkidle trap from #291).
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
    // body carries endpoint + keys (from toJSON) AND userAgent — exactly the endpoint's contract
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      endpoint: 'https://push.example/xyz',
      expirationTime: null,
      keys: { p256dh: 'PKEY', auth: 'AKEY' },
      userAgent: 'UA/1.0',
    })
  })

  it('drains the response body (so the request finishes) and returns false on 500', async () => {
    const textSpy = vi.fn(async () => 'boom')
    vi.stubGlobal('fetch', vi.fn(async () => fakeRes(500, textSpy)))

    const ok = await postPushSubscription(fakeSub())

    expect(textSpy).toHaveBeenCalledTimes(1) // drained even on the error path
    expect(ok).toBe(false)
  })

  it('returns false (never throws) when fetch rejects — network down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(postPushSubscription(fakeSub())).resolves.toBe(false)
  })
})

describe('transport · deletePushSubscription', () => {
  it('DELETEs with the endpoint url-encoded in the query and returns true on 200', async () => {
    const fetchMock = vi.fn(async () => fakeRes(200))
    vi.stubGlobal('fetch', fetchMock)

    const ok = await deletePushSubscription('https://push.example/a b?c=1')

    expect(ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`/api/v2/push/subscribe?endpoint=${encodeURIComponent('https://push.example/a b?c=1')}`)
    expect((init as RequestInit).method).toBe('DELETE')
    expect((init as RequestInit).credentials).toBe('same-origin')
  })

  it('returns false on 500 and on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeRes(500)))
    expect(await deletePushSubscription('e')).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await deletePushSubscription('e')).toBe(false)
  })
})

// Base deps: turn-ON, permission granted, server accepts, device has a subscription. Each test overrides
// only the one axis it probes — so a failing assertion names the exact edge.
function deps(over: Partial<MumateToggleDeps> = {}): { d: MumateToggleDeps; flip: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } {
  const d: MumateToggleDeps = {
    isOn: false,
    requestSubscription: async (): Promise<SubscribeResult> => ({ ok: true, subscription: fakeSub() }),
    currentSubscription: async () => fakeSub(),
    post: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    flip: vi.fn(),
    ...over,
  }
  // read the spies back OFF the merged deps so an override in `over` is the one we assert against
  return { d, flip: d.flip as ReturnType<typeof vi.fn>, post: d.post as ReturnType<typeof vi.fn>, remove: d.remove as ReturnType<typeof vi.fn> }
}

describe('orchestration · toggleMumatePush — the toggle mirrors the SERVER row', () => {
  it('turn ON · granted · POST 201 → posts then flips (ticks) exactly once', async () => {
    const { d, flip, post } = deps()
    await toggleMumatePush(d)
    expect(post).toHaveBeenCalledTimes(1)
    expect(flip).toHaveBeenCalledTimes(1)
  })

  it('turn ON · permission NOT granted → never POSTs, never flips', async () => {
    const { d, flip, post } = deps({
      requestSubscription: async (): Promise<SubscribeResult> => ({ ok: false, reason: 'denied' }),
    })
    await toggleMumatePush(d)
    expect(post).not.toHaveBeenCalled()
    expect(flip).not.toHaveBeenCalled()
  })

  it('🆕 turn ON · granted but POST FAILS → does NOT flip (no tick without a stored row)', async () => {
    const { d, flip, post } = deps({ post: vi.fn(async () => false) })
    await toggleMumatePush(d)
    expect(post).toHaveBeenCalledTimes(1)
    expect(flip).not.toHaveBeenCalled()
  })

  it('turn OFF · DELETEs the current device endpoint then flips (unticks)', async () => {
    const { d, flip, remove } = deps({ isOn: true, currentSubscription: async () => fakeSub('https://push.example/keep') })
    await toggleMumatePush(d)
    expect(remove).toHaveBeenCalledWith('https://push.example/keep')
    expect(flip).toHaveBeenCalledTimes(1)
  })

  it('turn OFF · DELETE fails → does NOT flip (stays on)', async () => {
    const { d, flip } = deps({ isOn: true, remove: vi.fn(async () => false) })
    await toggleMumatePush(d)
    expect(flip).not.toHaveBeenCalled()
  })

  it('turn OFF · no device subscription → unticks without calling DELETE', async () => {
    const { d, flip, remove } = deps({ isOn: true, currentSubscription: async () => null })
    await toggleMumatePush(d)
    expect(remove).not.toHaveBeenCalled()
    expect(flip).toHaveBeenCalledTimes(1)
  })
})
