// #244 ขั้น 1 — teeth on the side that DECIDES, not the side that draws.
//
// WHY THIS FILE EXISTS: `#240` shipped a three-state wrapper so the last first-run screen can never be a
// permanent spinner. Its tests all render <FirstRunElementView status={…}/> with the status handed in as a
// prop, and `first-run-source.test.ts` covers the pure mappers. NOTHING covered useFirstRunSource — the
// hook that actually produces the status. `git grep useFirstRunSource -- scripts/` was empty.
// So the hook could be wrong in every branch and 111 specs stayed green. It was wrong. ฟีม hit it by hand
// on the local arena (2026-08-10): the first walk after a reset showed the "ยังแสดงผลธาตุไม่ได้ตอนนี้"
// dead-end card, the second walk was fine.
//
// 🔴 MUTANT CONTRACT — every branch that can end in `unavailable` must be pinned here:
//   H1  identity not known YET (cookie not read on the first render) must be `loading`, NEVER terminal
//       ← this is the bug ฟีม hit. Same class as #215/gap-C, which useV2Home.ts:127 guards against by
//         name ("a null/loading row is NEVER misread"). This hook did the opposite.
//   H2  no user row            ⇒ unavailable
//   H3  no chart / refresh     ⇒ unavailable
//   H4  mascot unresolvable    ⇒ unavailable
//   H5  fetch throws           ⇒ unavailable
//   H6  happy path            ⇒ ready
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

let cookieValue: string | undefined
vi.mock('react-cookie', () => ({ useCookies: () => [{ member_id: cookieValue }] }))
vi.mock('@/constants/cookie-key', () => ({ CookieKey: { MEMBER_ID: 'member_id' } }))

const userGet = vi.fn()
const chartGet = vi.fn()
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: (...a: unknown[]) => userGet(...a) }))
vi.mock('@/constants/api/api-chinese-horoscope-get', () => ({
  ChineseHoroscopeGet: (...a: unknown[]) => chartGet(...a),
}))
vi.mock('./../features/v2-first-run/hooks/summary-cache', () => ({
  getSummary: async () => ({ status: 'unavailable' }),
}))
vi.mock('@/features/v2-first-run/hooks/summary-cache', () => ({
  getSummary: async () => ({ status: 'unavailable' }),
}))

import { useFirstRunSource, IDENTITY_GRACE_MS } from '@/features/v2-first-run/hooks/useFirstRunSource'

// ✓ SHAPE TRACED, NOT GUESSED — my first draft of this fixture invented `animal`/`element` keys and H6
// failed. The real path is toComputeSource (lib/personalization/compute-source.ts:23):
//   chart.data.detail.yearBelow.constellation | .id   → animalFromCompute → toNakkasat
//   chart.data.detail.dayAbove.element                → elementFromCompute (pillars.day.stemElement)
// `id` is the numeric branch (zodiac.ts:96 ID_TO_TH), so it needs no glyph table here.
// If the endpoint's shape ever moves, H6 goes red — which is correct: that IS a regression for this screen.
const CHART_OK = {
  data: {
    dob: '1990-01-01',
    time: '08:00',
    gender: 'MALE',
    detail: { yearBelow: { id: 1 }, dayAbove: { element: 'WOOD' } },
    elementCycle: null,
  },
}

beforeEach(() => {
  cookieValue = 'u-1'
  userGet.mockReset()
  chartGet.mockReset()
})
afterEach(cleanup)

describe('H1 — identity not known YET is not the same as "no identity"', () => {
  it('🔴 cookie has not been read on the first render ⇒ loading, NEVER unavailable', async () => {
    cookieValue = undefined
    const { result } = renderHook(() => useFirstRunSource())
    // Nothing has been asked yet — the screen must hold a frame, not offer the way out.
    expect(result.current.status).toBe('loading')
    // and it must stay that way for at least a tick (no async race flipping it terminal)
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current.status).not.toBe('unavailable')
  })

  it('🔴 empty-string cookie (the shape `|| \'\'` produces) is also "not known yet"', async () => {
    cookieValue = ''
    const { result } = renderHook(() => useFirstRunSource())
    expect(result.current.status).toBe('loading')
  })

  it('H1c — but the grace is NOT forever: a cookie that never arrives still lands terminal, never a permanent spinner', async () => {
    cookieValue = undefined
    const { result } = renderHook(() => useFirstRunSource())
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('unavailable'), {
      timeout: IDENTITY_GRACE_MS + 1000,
    })
  })

  // ⚠️ MY FIRST VERSION OF THIS TEST HAD NO TEETH. It only asserted the END state ('ready'), which is
  // reached with or without the reset — so removing `setStatus('loading')` left it GREEN. Exactly the
  // "signal that passes without the real thing" class we keep catching in review; I caught it by firing
  // the mutant instead of trusting a passing spec. What matters is the state DURING the refetch: while
  // the new request is in flight the screen must have stopped offering the exit. So the fetch is held
  // open deliberately and the mid-flight state is asserted.
  it('H1d — identity arriving after the grace expired clears the stale terminal state BEFORE the refetch finishes', async () => {
    cookieValue = undefined
    let release: (v: unknown) => void = () => {}
    userGet.mockImplementation(() => new Promise((r) => (release = r)))
    chartGet.mockResolvedValue(CHART_OK)
    const { result, rerender } = renderHook(() => useFirstRunSource())
    await waitFor(() => expect(result.current.status).toBe('unavailable'), {
      timeout: IDENTITY_GRACE_MS + 1000,
    })

    cookieValue = 'u-1'
    rerender()
    // 🔴 the load-bearing assertion: still fetching, so no longer terminal
    await waitFor(() => expect(result.current.status).toBe('loading'))

    release({ user_id: 'u-1', result_code: 'CODE' })
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })
})

describe('the branches that ARE genuinely terminal', () => {
  it('H2 — no user row ⇒ unavailable', async () => {
    userGet.mockResolvedValue(null)
    const { result } = renderHook(() => useFirstRunSource())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('H3 — no computed chart ⇒ unavailable', async () => {
    userGet.mockResolvedValue({ user_id: 'u-1', result_code: '' })
    const { result } = renderHook(() => useFirstRunSource())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('H4 — chart returns but no mascot can be resolved ⇒ unavailable', async () => {
    userGet.mockResolvedValue({ user_id: 'u-1', result_code: 'CODE' })
    chartGet.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useFirstRunSource())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('H5 — the fetch throws ⇒ unavailable (never a permanent spinner)', async () => {
    userGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useFirstRunSource())
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })
})

describe('H6 — happy path', () => {
  it('user + chart + mascot ⇒ ready, and source is non-null', async () => {
    userGet.mockResolvedValue({ user_id: 'u-1', result_code: 'CODE' })
    chartGet.mockResolvedValue(CHART_OK)
    const { result } = renderHook(() => useFirstRunSource())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.source).not.toBeNull()
  })
})
