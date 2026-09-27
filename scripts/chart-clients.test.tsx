// mumate-be-retirement-001 slice 1 — the v2 screens read and write the chart through the FE routes.
//
// 🔴 MUTANT CONTRACT:
//   CC1 register (useV2ProfileForm) saves through POST /api/v2/birth-chart with no user_id, and only a
//       returned `code` counts as saved (an error body must not advance to first-run)
//   CC2 home (useV2Home) shows the ENGINE animal from GET /api/chinese-horoscope's payload; the
//       result_code gate is unchanged (no code → /v2/register)
//   CC3 the chart cache: a cleared cache (edit-birth) refetches instead of showing the old mascot
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

let cookieJar: Record<string, string> = {}
vi.mock('react-cookie', () => ({ useCookies: () => [cookieJar] }))

const replace = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ replace, push: vi.fn(), query: {}, pathname: '/v2', isReady: true }) }))

const prefetch = vi.fn()
vi.mock('@/features/v2-first-run/hooks/summary-cache', () => ({ prefetchSummary: (...a: unknown[]) => prefetch(...a), getSummary: async () => ({ status: 'unavailable' }) }))

const userGet = vi.fn()
const chartGet = vi.fn()
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: (...a: unknown[]) => userGet(...a) }))
vi.mock('@/constants/api/api-chinese-horoscope-get', () => ({ ChineseHoroscopeGet: (...a: unknown[]) => chartGet(...a) }))

import { useV2ProfileForm } from '@/features/auth/hooks/useV2ProfileForm'
import { useV2Home } from '@/features/auth/hooks/useV2Home'
import { clearChartCache } from '@/features/auth/hooks/chart-cache'
import { animalFromCompute } from '@/lib/personalization/mascot'
import { buildChartPayload, deriveChartCore } from '@/lib/chart/engine-chart'

const ME = '11111111-1111-4111-8111-111111111111'

// What GET /api/chinese-horoscope now answers: the engine-derived payload (午 year = HORSE).
const ENGINE_CHART = {
  data: buildChartPayload(
    { dob: '1990-05-15', time: '08:30', gender: 'MALE' },
    deriveChartCore({ pillars: { year: { branch: '午' }, day: { stem: '庚' } } })!,
    null,
  ),
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  cookieJar = { 'cookie-mumate-id': ME, 'cookie-mumate-name': 'Nok', 'cookie-mumate-image': 'img.png' }
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ code: 'AbC123xyZ789' }) }))
  vi.stubGlobal('fetch', fetchMock)
  replace.mockReset()
  prefetch.mockReset()
  userGet.mockReset()
  chartGet.mockReset()
  clearChartCache()
})
afterEach(() => vi.unstubAllGlobals())

function fill(result: { current: ReturnType<typeof useV2ProfileForm> }) {
  act(() => {
    result.current.fields.setGender('FEMALE')
    result.current.fields.setBirthDay('1995-06-15')
    result.current.fields.setSurname('S')
    result.current.fields.setTimeHourBirth('7')
    result.current.fields.setTimeMinuteBirth('5')
  })
}

describe('CC1 — register saves through /api/v2/birth-chart', () => {
  it('posts the form without a user_id and hands the returned code on', async () => {
    const onSaved = vi.fn()
    const { result } = renderHook(() => useV2ProfileForm(onSaved))
    fill(result)
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(onSaved).toHaveBeenCalledWith('AbC123xyZ789')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(url).toBe('/api/v2/birth-chart')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toEqual({ name: 'Nok', dob: '1995-06-15', time: '07:05', gender: 'FEMALE', picture_url: 'img.png', surname: 'S', account_name: 'Nok' })
    expect(body).not.toHaveProperty('user_id')
    expect(prefetch).toHaveBeenCalledWith(ME, { birthDate: '1995-06-15', birthTime: '07:05', gender: 'female' })
  })

  it('time not remembered → time ""', async () => {
    const { result } = renderHook(() => useV2ProfileForm(vi.fn()))
    fill(result)
    act(() => result.current.fields.setIsRememberTimeBirth(false))
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body).time).toBe('')
  })

  it.each([
    ['500 with an error body', { ok: false, status: 500, json: async () => ({ error: 'save failed' }) }],
    ['200 without a code', { ok: true, status: 200, json: async () => ({}) }],
    ['network error', null],
  ])('%s → stays on the form with an error, onSaved never called', async (_l, answer) => {
    fetchMock.mockImplementation(async () => {
      if (!answer) throw new Error('offline')
      return answer
    })
    const onSaved = vi.fn()
    const { result } = renderHook(() => useV2ProfileForm(onSaved))
    fill(result)
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.error).toBe('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
  })
})

describe('CC2 — home reads the engine chart', () => {
  it('the mascot animal is the engine year animal (午 → มะเมีย)', async () => {
    userGet.mockResolvedValue({ user_id: ME, result_code: 'AbC123xyZ789', is_refresh: false, onboarded_at: '2026-09-01' })
    chartGet.mockResolvedValue(ENGINE_CHART)
    const { result } = renderHook(() => useV2Home('authed'))
    await waitFor(() => expect(result.current.computeSource).not.toBeNull())
    expect(animalFromCompute(result.current.computeSource)).toBe('มะเมีย')
    expect(replace).not.toHaveBeenCalled()
  })

  it('the registered gate is still result_code: none → /v2/register, no chart fetched', async () => {
    userGet.mockResolvedValue({ user_id: ME, result_code: '', is_refresh: false })
    renderHook(() => useV2Home('authed'))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/v2/register'))
    expect(chartGet).not.toHaveBeenCalled()
  })

  it('engine down (GET answers an error) → home lands on the default mascot, not register', async () => {
    userGet.mockResolvedValue({ user_id: ME, result_code: 'AbC123xyZ789', is_refresh: false, onboarded_at: '2026-09-01' })
    chartGet.mockResolvedValue({ error: 'chart engine unreachable' })
    const { result } = renderHook(() => useV2Home('authed'))
    await waitFor(() => expect(result.current.loading.mascot).toBe(false))
    expect(result.current.computeSource).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('CC3 — chart cache and edit-birth', () => {
  it('same result_code → cached (no refetch); cleared cache → refetch', async () => {
    userGet.mockResolvedValue({ user_id: ME, result_code: 'AbC123xyZ789', is_refresh: false, onboarded_at: '2026-09-01' })
    chartGet.mockResolvedValue(ENGINE_CHART)
    const first = renderHook(() => useV2Home('authed'))
    await waitFor(() => expect(first.result.current.computeSource).not.toBeNull())
    first.unmount()
    expect(chartGet).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useV2Home('authed'))
    await waitFor(() => expect(userGet).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 20))
    expect(chartGet).toHaveBeenCalledTimes(1) // fresh by result_code
    second.unmount()

    clearChartCache() // what EditBirthScreen does after a successful save
    const third = renderHook(() => useV2Home('authed'))
    await waitFor(() => expect(chartGet).toHaveBeenCalledTimes(2))
    third.unmount()
  })
})
