// scripts/newbie-guide.test.tsx — เส้นทางมือใหม่ (ไกด์ "ปุ่มพากด" + รางวัล QI · เอ็ม 2026-10-13)
//   NG1 การ์ดหน้าหลัก: 0/N + ภารกิจถัดไป = ภารกิจแรก (ลิงก์มี ?guide=) + บอกรางวัล QI
//   NG2 มาจากไกด์ → ไฮไลต์ปุ่มจริง "กดตรงนี้" → ผู้ใช้กดปุ่มนั้น → ภารกิจสำเร็จ + ยิง /api/missions guide_<id> → โชว์ +QI
//   NG3 เข้าหน้าเอง (ไม่มี ?guide=) → ไม่ไฮไลต์ ไม่นับผ่าน (ต้องทำตามไกด์ถึงได้รางวัล)
//   NG4 ภารกิจหลายขั้น (เซียมซี): ช่องพิมพ์ผ่านเมื่อเริ่มพิมพ์ → ขั้นถัดไปไฮไลต์ปุ่มเสี่ยงทาย
//   NG5 ครบทุกภารกิจ → ปุ่มรับรางวัลจบ → ยิง guide_complete
//   NG6 sync จาก engine: guide_<id> ที่รับแล้ว (อีกเครื่อง) นับว่าผ่าน
//   NG7 กดซ่อน → การ์ดหายและจำไว้ · questForPath จับ path ลูก
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react'

let route: { pathname: string; query: Record<string, string>; isReady: boolean; push: ReturnType<typeof vi.fn> } = { pathname: '/v2', query: {}, isReady: true, push: vi.fn() }
vi.mock('next/router', () => ({ useRouter: () => route }))

let posted: string[] = []
let serverMissions: Array<{ id: string; completed: boolean; claimedAt: string | null }> = []
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  if (String(url).includes('/api/missions')) {
    if (init?.method === 'POST') {
      const id = JSON.parse(String(init.body)).missionId
      posted.push(id)
      return { ok: true, status: 200, json: async () => ({ missionId: id, rewarded: true }) }
    }
    return { ok: true, status: 200, json: async () => ({ missions: serverMissions }) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)
// jsdom ไม่มี scrollIntoView + ปุ่มต้องมีขนาด (findTarget ข้ามของที่ width 0)
Element.prototype.scrollIntoView = vi.fn()
const realRect = Element.prototype.getBoundingClientRect
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () { return { top: 100, left: 20, width: 200, height: 40, bottom: 140, right: 220, x: 20, y: 100, toJSON: () => ({}) } as DOMRect }
})

import { GuideCard } from '@/features/v2-guide/GuideCard'
import { GuideCoach } from '@/features/v2-guide/GuideCoach'
import { GUIDE_QUESTS, GUIDE_TOTAL, questForPath } from '@/features/v2-guide/quests'

beforeEach(() => { localStorage.clear(); posted = []; serverMissions = []; fetchMock.mockClear(); route = { pathname: '/v2', query: {}, isReady: true, push: vi.fn() } })
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = realRect })

const destiny = GUIDE_QUESTS.find((q) => q.id === 'destiny')!
const fortune = GUIDE_QUESTS.find((q) => q.id === 'fortune')!

describe('เส้นทางมือใหม่', () => {
  it('NG1 การ์ด: 0/N + ภารกิจถัดไป + รางวัล', () => {
    render(<GuideCard />)
    expect(screen.getByTestId('guide-progress').textContent).toBe(`0/${GUIDE_TOTAL}`)
    const next = screen.getByTestId('guide-next')
    expect(next.textContent).toContain(GUIDE_QUESTS[0].title)
    expect(next.textContent).toContain('QI')
    expect(next.getAttribute('href')).toBe(`${GUIDE_QUESTS[0].href}?guide=${GUIDE_QUESTS[0].id}`)
  })

  it('NG2 ไฮไลต์ปุ่มจริง → กด → สำเร็จ + ยิง guide_destiny + โชว์รางวัล', async () => {
    route = { ...route, pathname: destiny.href, query: { guide: destiny.id } }
    render(<><button data-testid="destiny-weakness-toggle">จุดแข็ง-จุดอ่อน</button><GuideCoach /></>)
    await waitFor(() => expect(screen.getByTestId('guide-spotlight')).toBeTruthy(), { timeout: 3000 })
    expect(screen.getByTestId('guide-step-text').textContent).toContain('จุดแข็ง-จุดอ่อน')
    act(() => { fireEvent.click(screen.getByTestId('destiny-weakness-toggle')) })
    await waitFor(() => expect(screen.getByTestId('guide-reward').textContent).toContain('QI'), { timeout: 3000 })
    expect(posted).toEqual(['guide_destiny'])
    expect(JSON.parse(localStorage.getItem('mumate-guide-v1') ?? '{}').done).toContain('destiny')
  })

  it('NG3 เข้าหน้าเอง (ไม่มี ?guide=) → ไม่ไฮไลต์ ไม่นับผ่าน', async () => {
    route = { ...route, pathname: destiny.href }
    render(<><button data-testid="destiny-weakness-toggle">x</button><GuideCoach /></>)
    await new Promise((r) => setTimeout(r, 700))
    expect(screen.queryByTestId('guide-spotlight')).toBeNull()
    expect(posted).toEqual([])
  })

  it('NG4 หลายขั้น: พิมพ์คำถาม → ขั้นต่อไปไฮไลต์ปุ่มเสี่ยงทาย → กด → สำเร็จ', async () => {
    route = { ...route, pathname: fortune.href, query: { guide: fortune.id } }
    render(<><textarea data-testid="sage-question" /><button data-testid="sage-draw">เสี่ยง</button><GuideCoach /></>)
    await waitFor(() => expect(screen.getByTestId('guide-step-text').textContent).toContain('พิมพ์คำถาม'), { timeout: 3000 })
    act(() => { fireEvent.input(screen.getByTestId('sage-question'), { target: { value: 'งาน' } }) })
    await waitFor(() => expect(screen.getByTestId('guide-step-text').textContent).toContain('เสี่ยงทาย'), { timeout: 3000 })
    act(() => { fireEvent.click(screen.getByTestId('sage-draw')) })
    await waitFor(() => expect(screen.getByTestId('guide-reward')).toBeTruthy(), { timeout: 3000 })
    expect(posted).toEqual(['guide_fortune'])
  })

  it('NG5 ครบทุกภารกิจ → รับรางวัลจบ → guide_complete', async () => {
    localStorage.setItem('mumate-guide-v1', JSON.stringify({ done: GUIDE_QUESTS.map((q) => q.id), hidden: false, bonus: false }))
    render(<GuideCard />)
    fireEvent.click(await screen.findByTestId('guide-claim'))
    await waitFor(() => expect(screen.getByTestId('guide-claim-msg').textContent).toContain('QI'))
    expect(posted).toEqual(['guide_complete'])
  })

  it('NG6 sync จาก engine: ภารกิจที่รับแล้วนับว่าผ่าน', async () => {
    serverMissions = [{ id: 'guide_calendar', completed: true, claimedAt: '2026-10-13' }]
    render(<GuideCard />)
    await waitFor(() => expect(screen.getByTestId('guide-progress').textContent).toBe(`1/${GUIDE_TOTAL}`))
  })

  it('NG7 กดซ่อน → หายและจำไว้ · questForPath', () => {
    const { unmount } = render(<GuideCard />)
    act(() => { fireEvent.click(screen.getByTestId('guide-hide')) })
    expect(screen.queryByTestId('guide-card')).toBeNull()
    unmount()
    render(<GuideCard />)
    expect(screen.queryByTestId('guide-card')).toBeNull()
    expect(questForPath('/v2/fortune/oracle')?.id).toBe('fortune')
    expect(questForPath('/v2/service/compatibility/colleague')?.id).toBe('compat')
    expect(questForPath('/v2/destinyx')).toBeUndefined()
  })
})
