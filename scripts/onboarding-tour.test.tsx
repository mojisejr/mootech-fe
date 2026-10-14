// scripts/onboarding-tour.test.tsx — ทัวร์แนะนำแอป 8 ขั้น (สเปก FTUE เอ็ม 2026-10-14)
//   OT1 หน้าหลักครั้งแรก → ขึ้น 1/8 + ถัดไป → 2/8 · แตะส่วนที่ส่อง = ขั้นต่อไป · แตะนอกส่วนที่ส่อง = ไม่มีผล
//   OT2 ขั้นที่ต้องอยู่หน้าอื่น → พาไปหน้านั้นเอง (router.push)
//   OT3 จบ "เริ่มต้นใช้งาน" → ยิง guide_tour + จำว่าดูแล้ว · ข้าม "ไว้คราวหลัง" → ไม่ยิง แต่จำ
//   OT4 ไม่ขึ้น: เคยดูแล้ว / engine จ่าย guide_tour แล้ว / จบเส้นทางมือใหม่ / มาจากไกด์ / ล็อกอินไม่ผ่าน / ไม่ใช่หน้าหลัก
//   OT5 หาส่วนที่ส่องไม่เจอ → ข้ามขั้นเอง ไม่ค้าง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react'

type Route = { pathname: string; asPath: string; query: Record<string, string>; isReady: boolean; push: ReturnType<typeof vi.fn> }
let route: Route
vi.mock('next/router', () => ({ useRouter: () => route }))

let posted: string[] = []
let serverMissions: Array<{ id: string; completed: boolean; claimedAt: string | null }> = []
let missionsOk = true
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  if (String(url).includes('/api/missions')) {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)).missionId)
      return { ok: true, status: 200, json: async () => ({ rewarded: true }) }
    }
    return { ok: missionsOk, status: missionsOk ? 200 : 401, json: async () => ({ missions: serverMissions }) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)
Element.prototype.scrollIntoView = vi.fn()
const realRect = Element.prototype.getBoundingClientRect

import { OnboardingTour } from '@/features/v2-guide/OnboardingTour'
import { TOUR_STEPS } from '@/features/v2-guide/tourSteps'

const ids = (sels: string[]) => sels.map((s) => s.match(/data-testid="([^"]+)"/)?.[1] ?? '')
// ทุกส่วนที่ทัวร์ส่อง วางไว้ในหน้าเดียว (router mock ไม่เปลี่ยนหน้าจริง)
function Targets() {
  return <>{TOUR_STEPS.flatMap((s) => ids(s.targets)).map((id) => <div key={id} data-testid={id}>{id}</div>)}</>
}

beforeEach(() => {
  localStorage.clear(); posted = []; serverMissions = []; missionsOk = true; fetchMock.mockClear()
  route = { pathname: '/v2', asPath: '/v2', query: {}, isReady: true, push: vi.fn() }
  Element.prototype.getBoundingClientRect = function () { return { top: 100, left: 20, width: 200, height: 40, bottom: 140, right: 220, x: 20, y: 100, toJSON: () => ({}) } as DOMRect }
})
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = realRect; delete document.documentElement.dataset.tour })

const started = () => waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeTruthy(), { timeout: 3000 })
const progress = () => screen.getByTestId('tour-progress').textContent
const N = TOUR_STEPS.length

describe('ทัวร์แนะนำแอป', () => {
  it('OT1 ขึ้นครั้งแรก 1/8 → ถัดไป 2/8 → แตะส่วนที่ส่อง 3/8', async () => {
    render(<><Targets /><OnboardingTour /></>)
    await started()
    expect(progress()).toBe(`1/${N}`)
    expect(screen.getByTestId('tour-title').textContent).toBe(TOUR_STEPS[0].title)
    expect(document.documentElement.dataset.tour).toBe('on')
    act(() => { fireEvent.click(screen.getByTestId('tour-next')) })
    await waitFor(() => expect(progress()).toBe(`2/${N}`))
    await started()
    // แตะกลางส่วนที่ส่อง (top 100 left 20 กว้าง 200 สูง 40)
    act(() => { fireEvent.click(screen.getByTestId('onboarding-tour'), { clientX: 100, clientY: 120 }) })
    await waitFor(() => expect(progress()).toBe(`3/${N}`))
    await started()
    act(() => { fireEvent.click(screen.getByTestId('onboarding-tour'), { clientX: 300, clientY: 600 }) })
    expect(progress()).toBe(`3/${N}`)
  })

  it('OT2 ขั้นบริการ → พาไป /v2/service เอง', async () => {
    render(<><Targets /><OnboardingTour /></>)
    for (let i = 0; i < 4; i++) {
      await started()
      act(() => { fireEvent.click(screen.getByTestId('tour-next')) })
    }
    await waitFor(() => expect(route.push).toHaveBeenCalledWith('/v2/service'))
  })

  it('OT3 จบ → ยิง guide_tour + จำ · ข้าม → ไม่ยิง แต่จำ', async () => {
    const { rerender } = render(<><Targets /><OnboardingTour /></>)
    await started()
    for (let i = 0; i < N - 1; i++) {
      route = { ...route, pathname: TOUR_STEPS[i + 1].page, asPath: TOUR_STEPS[i + 1].page }
      act(() => { fireEvent.click(screen.getByTestId('tour-next')) })
      rerender(<><Targets /><OnboardingTour /></>)
      await waitFor(() => expect(progress()).toBe(`${i + 2}/${N}`))
      await started()
    }
    act(() => { fireEvent.click(screen.getByTestId('tour-finish')) })
    await waitFor(() => expect(screen.getByTestId('tour-reward').textContent).toContain('+10 QI'))
    expect(posted).toEqual(['guide_tour'])
    expect(localStorage.getItem('mumate-tour-v1')).toBe('done')
    expect(screen.queryByTestId('onboarding-tour')).toBeNull()
    expect(document.documentElement.dataset.tour).toBeUndefined()

    cleanup(); localStorage.clear(); posted = []
    route = { pathname: '/v2', asPath: '/v2', query: {}, isReady: true, push: vi.fn() }
    render(<><Targets /><OnboardingTour /></>)
    await started()
    act(() => { fireEvent.click(screen.getByTestId('tour-skip')) })
    expect(screen.queryByTestId('onboarding-tour')).toBeNull()
    expect(localStorage.getItem('mumate-tour-v1')).toBe('skipped')
    expect(posted).toEqual([])
  })

  it.each([
    ['เคยดูแล้วในเครื่องนี้', () => { localStorage.setItem('mumate-tour-v1', 'skipped') }],
    ['engine จ่าย guide_tour แล้ว (อีกเครื่อง)', () => { serverMissions = [{ id: 'guide_tour', completed: true, claimedAt: '2026-10-14' }] }],
    ['จบเส้นทางมือใหม่แล้ว', () => { serverMissions = [{ id: 'guide_complete', completed: true, claimedAt: '2026-10-14' }] }],
    ['มาจากไกด์เควส', () => { route.query = { guide: 'destiny' }; route.asPath = '/v2?guide=destiny' }],
    ['ล็อกอินไม่ผ่าน', () => { missionsOk = false }],
    ['ไม่ใช่หน้าหลัก', () => { route.pathname = '/v2/calendar'; route.asPath = '/v2/calendar' }],
  ])('OT4 ไม่ขึ้นเมื่อ %s', async (_name, setup) => {
    setup()
    render(<><Targets /><OnboardingTour /></>)
    await new Promise((r) => setTimeout(r, 1300))
    expect(screen.queryByTestId('onboarding-tour')).toBeNull()
  })

  it('OT5 หาส่วนที่ส่องไม่เจอ → ข้ามขั้นเอง', async () => {
    render(<OnboardingTour />)
    await waitFor(() => expect(progress()).toBe(`1/${N}`), { timeout: 3000 })
    await waitFor(() => expect(progress()).toBe(`2/${N}`), { timeout: 8000 })
  }, 15000)
})
