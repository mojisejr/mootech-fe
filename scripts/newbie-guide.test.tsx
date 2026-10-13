// scripts/newbie-guide.test.tsx — เส้นทางมือใหม่ 6 บท (ไกด์ "ปุ่มพากด" + รางวัล QI · เอ็ม 2026-10-13)
//   NG1 การ์ดหน้าหลัก: บทที่ 1 · 0/6 + ภารกิจถัดไป = ภารกิจแรก (ลิงก์มี ?guide=) + บอกรางวัล QI
//   NG2 มาจากไกด์ → ไฮไลต์ปุ่มจริง "กดตรงนี้" → ผู้ใช้กดปุ่มนั้น → ภารกิจสำเร็จ + ยิง /api/missions guide_<id> → โชว์ +QI
//   NG3 เข้าหน้าเอง (ไม่มี ?guide=) → ไม่ไฮไลต์ ไม่นับผ่าน (ต้องทำตามไกด์ถึงได้รางวัล)
//   NG4 ภารกิจหลายขั้น (เซียมซี): ช่องพิมพ์ผ่านเมื่อเริ่มพิมพ์ → ขั้นถัดไปไฮไลต์ปุ่มเสี่ยงทาย
//   NG5 จบบท → ปุ่มรับโบนัสบท (guide_ch1) → บทถัดไป · จบทุกบท+โบนัสครบ → รางวัลใหญ่ guide_complete + ป้าย
//   NG6 sync จาก engine: guide_<id> ที่รับแล้ว (อีกเครื่อง) นับว่าผ่าน
//   NG7 กดย่อ → เหลือแถบเล็ก ไม่หาย + เปิดกลับได้ · questForPath จับ path ลูก
//   NG8 6 บท 25 ภารกิจ · บท 2 ล็อกจนบท 1 ครบ · หลายเควสหน้าเดียวกันเลือกตาม ?guide=
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react'

let route: { pathname: string; asPath?: string; query: Record<string, string>; isReady: boolean; push: ReturnType<typeof vi.fn> } = { pathname: '/v2', query: {}, isReady: true, push: vi.fn() }
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
// jsdom ไม่มี scrollIntoView + ปุ่มต้องมีขนาด/อยู่ในจอ (findTarget ข้ามของที่ width 0)
Element.prototype.scrollIntoView = vi.fn()
const realRect = Element.prototype.getBoundingClientRect
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () { return { top: 100, left: 20, width: 200, height: 40, bottom: 140, right: 220, x: 20, y: 100, toJSON: () => ({}) } as DOMRect }
})

import { GuideCard } from '@/features/v2-guide/GuideCard'
import { GuideCoach } from '@/features/v2-guide/GuideCoach'
import { GUIDE_CHAPTERS, GUIDE_QUESTS, GUIDE_TOTAL, questForPath } from '@/features/v2-guide/quests'

beforeEach(() => { localStorage.clear(); posted = []; serverMissions = []; fetchMock.mockClear(); route = { pathname: '/v2', query: {}, isReady: true, push: vi.fn() } })
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = realRect })

const q = (id: string) => GUIDE_QUESTS.find((x) => x.id === id)!
const CH1 = GUIDE_CHAPTERS[0].quests

describe('เส้นทางมือใหม่', () => {
  it('NG1 การ์ด: บทที่ 1 · 0/6 + ภารกิจถัดไป + รางวัล', () => {
    render(<GuideCard />)
    expect(screen.getByTestId('guide-chapter').textContent).toContain(GUIDE_CHAPTERS[0].title)
    expect(screen.getByTestId('guide-progress').textContent).toBe(`0/${CH1.length}`)
    const next = screen.getByTestId('guide-next')
    expect(next.textContent).toContain(CH1[0].title)
    expect(next.textContent).toContain('QI')
    expect(next.getAttribute('href')).toBe(`${CH1[0].href}?guide=${CH1[0].id}`)
  })

  it('NG2 ไฮไลต์ปุ่มจริง → กด → สำเร็จ + ยิง guide_destiny + โชว์รางวัล', async () => {
    route = { ...route, pathname: '/v2/destiny', query: { guide: 'destiny' } }
    render(<><button data-testid="destiny-weakness-toggle">จุดแข็ง-จุดอ่อน</button><GuideCoach /></>)
    await waitFor(() => expect(screen.getByTestId('guide-spotlight')).toBeTruthy(), { timeout: 3000 })
    expect(screen.getByTestId('guide-step-text').textContent).toContain('จุดแข็ง-จุดอ่อน')
    act(() => { fireEvent.click(screen.getByTestId('destiny-weakness-toggle')) })
    await waitFor(() => expect(screen.getByTestId('guide-reward').textContent).toContain('QI'), { timeout: 3000 })
    expect(posted).toEqual(['guide_destiny'])
    expect(JSON.parse(localStorage.getItem('mumate-guide-v1') ?? '{}').done).toContain('destiny')
  })

  it('NG3 เข้าหน้าเอง (ไม่มี ?guide=) → ไม่ไฮไลต์ ไม่นับผ่าน', async () => {
    route = { ...route, pathname: '/v2/destiny' }
    render(<><button data-testid="destiny-weakness-toggle">x</button><GuideCoach /></>)
    await new Promise((r) => setTimeout(r, 700))
    expect(screen.queryByTestId('guide-spotlight')).toBeNull()
    expect(posted).toEqual([])
  })

  it('NG4 หลายขั้น: พิมพ์คำถาม → ขั้นต่อไปไฮไลต์ปุ่มเสี่ยงทาย → กด → สำเร็จ', async () => {
    const f = q('fortune')
    route = { ...route, pathname: f.href, query: { guide: f.id } }
    render(<><textarea data-testid="sage-question" /><button data-testid="sage-draw">เสี่ยง</button><GuideCoach /></>)
    await waitFor(() => expect(screen.getByTestId('guide-step-text').textContent).toContain('พิมพ์คำถาม'), { timeout: 3000 })
    act(() => { fireEvent.input(screen.getByTestId('sage-question'), { target: { value: 'งาน' } }) })
    await waitFor(() => expect(screen.getByTestId('guide-step-text').textContent).toContain('เสี่ยงทาย'), { timeout: 3000 })
    act(() => { fireEvent.click(screen.getByTestId('sage-draw')) })
    await waitFor(() => expect(screen.getByTestId('guide-reward')).toBeTruthy(), { timeout: 3000 })
    expect(posted).toEqual(['guide_fortune'])
  })

  it('NG5 จบบท → รับโบนัสบท → บทถัดไป · จบทุกบท → รางวัลใหญ่ + ป้าย', async () => {
    localStorage.setItem('mumate-guide-v1', JSON.stringify({ done: CH1.map((x) => x.id), hidden: false, bonuses: [] }))
    const { unmount } = render(<GuideCard />)
    fireEvent.click(await screen.findByTestId('guide-claim-chapter'))
    await waitFor(() => expect(screen.getByTestId('guide-claim-msg').textContent).toContain('QI'))
    expect(posted).toEqual(['guide_ch1'])
    await waitFor(() => expect(screen.getByTestId('guide-chapter').textContent).toContain(GUIDE_CHAPTERS[1].title))
    unmount()
    posted = []
    localStorage.setItem('mumate-guide-v1', JSON.stringify({ done: GUIDE_QUESTS.map((x) => x.id), hidden: false, bonuses: GUIDE_CHAPTERS.map((c) => `guide_${c.id}`) }))
    render(<GuideCard />)
    fireEvent.click(await screen.findByTestId('guide-claim'))
    await waitFor(() => expect(screen.getByTestId('guide-badge')).toBeTruthy())
    expect(posted).toEqual(['guide_complete'])
  })

  it('NG6 sync จาก engine: ภารกิจที่รับแล้วนับว่าผ่าน', async () => {
    serverMissions = [{ id: 'guide_calendar', completed: true, claimedAt: '2026-10-13' }]
    render(<GuideCard />)
    await waitFor(() => expect(screen.getByTestId('guide-progress').textContent).toBe(`1/${CH1.length}`))
  })

  it('NG7 กดย่อ → เหลือแถบเล็ก (ไม่หาย) + เปิดกลับได้ · questForPath', () => {
    const { unmount } = render(<GuideCard />)
    act(() => { fireEvent.click(screen.getByTestId('guide-hide')) })
    // ย่อ = ไม่หายไป เหลือแถบเล็ก จำไว้ข้ามรอบ · กดแถบ = เปิดกลับ
    expect(screen.queryByTestId('guide-card')).toBeNull()
    expect(screen.getByTestId('guide-collapsed').textContent).toContain('บทที่ 1')
    unmount()
    render(<GuideCard />)
    act(() => { fireEvent.click(screen.getByTestId('guide-collapsed')) })
    expect(screen.getByTestId('guide-card')).toBeTruthy()
    expect(questForPath('/v2/fortune/oracle')?.id).toBe('oracle')
    expect(questForPath('/v2/service/compatibility/colleague')?.id).toBe('colleague')
    expect(questForPath('/v2/destinyx')).toBeUndefined()
  })

  it('NG8 6 บท 25 ภารกิจ · บท 2 ล็อก · เควสหน้าเดียวกันเลือกตาม ?guide=', async () => {
    expect(GUIDE_CHAPTERS.length).toBe(6)
    expect(GUIDE_TOTAL).toBe(25)
    expect(new Set(GUIDE_QUESTS.map((x) => x.id)).size).toBe(25)
    const { unmount } = render(<GuideCard />)
    fireEvent.click(screen.getByTestId('guide-toggle'))
    expect(screen.getByTestId('guide-ch-ch2').textContent).toContain('🔒')
    expect(screen.getByTestId('guide-ch-ch1').textContent).not.toContain('🔒')
    unmount()
    // /v2/destiny มีทั้ง destiny / lifepath / share — ?guide=lifepath ต้องไฮไลต์แท็บเส้นทางชีวิต
    route = { ...route, pathname: '/v2/destiny', query: { guide: 'lifepath' } }
    render(<><div data-testid="destiny-lifepath-tabs"><button>5 ปี</button></div><button data-testid="destiny-weakness-toggle">x</button><GuideCoach /></>)
    await waitFor(() => expect(screen.getByTestId('guide-step-text').textContent).toContain('เส้นทางชีวิต'), { timeout: 3000 })
  })

  it('NG9 หน้า dynamic route (compatibility/[kind]) → ไกด์ยังขึ้น (เทียบ asPath)', async () => {
    route = { ...route, pathname: '/v2/service/compatibility/[kind]', asPath: '/v2/service/compatibility/love?guide=compat', query: { guide: 'compat', kind: 'love' } }
    render(<><button data-testid="compat-person2">เลือกคู่</button><GuideCoach /></>)
    await waitFor(() => expect(screen.getByTestId('guide-spotlight')).toBeTruthy(), { timeout: 3000 })
  })
})
