// #252 — the client half of the same invariant: the browser must not TELL the server who is consenting.
//
// ANCHOR: scripts/save-onboarding-client.test.tsx#onboarding-client-states-no-identity
// Bug-class this owns: re-introducing a client-supplied identity on the consent call. The route is now
// hardened (scripts/onboarding-identity.test.tsx), so a re-added `user_id` here would be silently
// IGNORED rather than break anything — which is precisely why it needs its own teeth: nothing else in the
// suite would go red, and the next reader would find a body field that looks load-bearing and is not.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MC1  the hook puts user_id (from the cookie or anywhere) back into the body  → ① reddens
//   MC2  the hook re-adds a local "no MEMBER_ID cookie → error without asking"   → ② reddens
//   MC3  save() reports success on a non-ok response                             → ③ reddens
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSaveOnboarding } from '../features/v2-first-run/hooks/useSaveOnboarding'

function bodyOf(fetchMock: ReturnType<typeof vi.fn>) {
  const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
  return JSON.parse(opts.body as string) as Record<string, unknown>
}

describe('#252 useSaveOnboarding — sends the goal, never an identity', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetchMock)
    // A MEMBER_ID cookie IS present — the point is that it must not travel even when it is available.
    // (document.cookie is writable in jsdom; this mirrors a real signed-in browser.)
    document.cookie = 'MEMBER_ID=COOKIE-USER-1; path=/'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = 'MEMBER_ID=; path=/; max-age=0'
  })

  // ① 🔴 MC1 — the body carries exactly one thing.
  it('🔴 ① posts { goal } only — no user_id, even with a MEMBER_ID cookie sitting right there', async () => {
    const { result } = renderHook(() => useSaveOnboarding())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.save('finance')
    })

    expect(ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = bodyOf(fetchMock)
    expect(body).toEqual({ goal: 'finance' })
    expect(Object.keys(body)).not.toContain('user_id')
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain('COOKIE-USER-1')
    expect(result.current.state).toBe('done')
  })

  // ② 🔴 MC2 — with the cookie gone the request must still be MADE. The old hook refused locally, which
  // could only ever produce a wrong refusal: a properly signed-in user whose (forgeable, client-set)
  // cookie had expired was told "error" without anyone asking the server.
  it('🔴 ② with no MEMBER_ID cookie it still asks the server (the server is the only judge now)', async () => {
    document.cookie = 'MEMBER_ID=; path=/; max-age=0'
    const { result } = renderHook(() => useSaveOnboarding())
    await act(async () => {
      await result.current.save('health')
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bodyOf(fetchMock)).toEqual({ goal: 'health' })
  })

  // ③ MC3 — a refusal from the hardened route (401/404/409) must NOT read as onboarded: the caller
  // advances only on a real success, else onboarded_at is unset and the gate loops the user forever.
  it('🔴 ③ a 401 from the route → save() is false and the state is error (never "done")', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: 'not signed in' }) })
    const { result } = renderHook(() => useSaveOnboarding())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.save('finance')
    })
    expect(ok).toBe(false)
    expect(result.current.state).toBe('error')
  })

  it('a thrown fetch (offline) → false + error, not a silent success', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useSaveOnboarding())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.save('love')
    })
    expect(ok).toBe(false)
    expect(result.current.state).toBe('error')
  })

  // A 200 whose body says ok:false is still a failure — the route uses that shape on the BE-side errors.
  it('200 with { ok: false } is a failure, not a success', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'consent save failed' }) })
    const { result } = renderHook(() => useSaveOnboarding())
    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.save('family')
    })
    expect(ok).toBe(false)
    expect(result.current.state).toBe('error')
  })
})
