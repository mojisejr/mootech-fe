// #554 — WIRING teeth: the result hook must actually put the route's account photos on `persons`.
//
// Why this file exists at all. scripts/compatibility-result.test.ts already proves applyAccountPhotos is
// correct, and every one of those cases stays GREEN if someone deletes the call from the hook — a pure
// function nobody invokes is exactly the "green that passes without the real thing" shape. The assertion
// that cannot be faked is made through useCompatibilityResult itself, with only the API module mocked.
//
// 🔴 MUTANT CONTRACT (each one turns a named test below red):
//   MU1  drop applyAccountPhotos from useCompatibilityResult.ts   → "from the history list" reddens
//   MU2  swap the order to applyCarriedBirth(applyAccountPhotos(…)) → "the carry still wins" reddens,
//        because applyCarriedBirth OVERWRITES imageProfile with the carried value (undefined included)
//
// .tsx = invisible to the pre-push tsx lane by extension, so it is registered in vitest.config.mts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/constants/api/api-v2-matching', () => ({
  V2MatchingCalculateApi: vi.fn(),
  V2MatchingGetDetailApi: vi.fn(),
}))

import { useCompatibilityResult, rememberCompatPersons } from '@/features/v2-service/hooks/useCompatibilityResult'
import { V2MatchingGetDetailApi } from '@/constants/api/api-v2-matching'

const mockDetail = vi.mocked(V2MatchingGetDetailApi)

const ACCOUNT_A = 'https://storage.example/public/mootech/profile-images/feem.png'
const ACCOUNT_B = 'https://storage.example/public/mootech/profile-images/friend.png'
const JUST_UPLOADED = 'https://storage.example/public/mootech/profile-images/uploaded-a-second-ago.png'

const pairMatch = {
  overall: { percent: 62, ratingText: 'เข้ากันดี' },
  persons: { a: { displayName: 'ฟีม', dayGanzhi: '己巳' }, b: { displayName: 'เพื่อน', dayGanzhi: '丙午' } },
}
// Shaped exactly as pages/api/v2/matching/[id].ts:64-69 answers (callApi resolves to response.data).
const detailResponse = (userPic: unknown, friendPic: unknown) => ({
  user: { name: 'ฟีม', user_surname: '', picture: userPic },
  friend: { name: 'เพื่อน', user_surname: '', picture: friendPic },
  result: JSON.stringify({ pairMatch }),
  type: 'LOVE',
})

const MATCHING_ID = 'm-554'

describe('#554 the result hook fills the hero photos from the route', () => {
  beforeEach(() => {
    mockDetail.mockReset()
    window.sessionStorage.clear()
    // the mascot effect fires on any dayGanzhi; answer 404 so it resolves to null and never hits the network
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }) as any))
  })

  it('🔴 from the history list (no form carry) both people get their ACCOUNT photo, not the fallback', async () => {
    mockDetail.mockResolvedValue(detailResponse(ACCOUNT_A, ACCOUNT_B))
    const { result } = renderHook(() => useCompatibilityResult(MATCHING_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.result?.persons.a?.imageProfile).toBe(ACCOUNT_A)
    expect(result.current.result?.persons.b?.imageProfile).toBe(ACCOUNT_B)
  })

  it('the carry still wins — a photo picked on the form is not overwritten by the account column', async () => {
    rememberCompatPersons(
      MATCHING_ID,
      { id: 'u1', name: 'ฟีม', dob: '1990-01-01', time: '09:00', imageProfile: JUST_UPLOADED } as any,
      { id: 'u2', name: 'เพื่อน', dob: '1992-02-02', time: '', imageProfile: '' } as any,
    )
    mockDetail.mockResolvedValue(detailResponse(ACCOUNT_A, ACCOUNT_B))
    const { result } = renderHook(() => useCompatibilityResult(MATCHING_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.result?.persons.a?.imageProfile).toBe(JUST_UPLOADED)
    expect(result.current.result?.persons.b?.imageProfile).toBe(ACCOUNT_B) // b carried none → account fills
  })

  it('CONTROL — an account with no picture stays undefined, so the screen shows its own fallback', async () => {
    mockDetail.mockResolvedValue(detailResponse('', null))
    const { result } = renderHook(() => useCompatibilityResult(MATCHING_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.result?.persons.a?.imageProfile).toBeUndefined()
    expect(result.current.result?.persons.b?.imageProfile).toBeUndefined()
    expect(result.current.result?.persons.a?.displayName).toBe('ฟีม') // the rest of the contract still arrived
  })
})
