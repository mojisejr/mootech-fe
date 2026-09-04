// scripts/calendar-day-tap-scroll.test.tsx — #567 "จิ้มวันแล้วข้อมูลเปลี่ยนอยู่ท้ายจอ"
//
// ฟีม: "จิ้มวันที่ หน้าจะสไลด์ข้อมูลด้านล่างขึ้นมา" — การ์ด DailyFortuneCard อยู่ใต้ตารางเดือน
// (pages/v2/calendar.tsx) ก่อนหน้านี้จิ้มแล้วเนื้อหาเปลี่ยนเงียบ ๆ โดยที่ผู้ใช้ต้องเลื่อนหาเอง
//
// 🔴 MUTANT CONTRACT:
//   S1 คืน `onSelect={selectDay}` (ไม่ผ่าน pickDay) → "จิ้มวันแล้วสไลด์" แดง
//   S2 ถอด scrollIntoView ใน pickDay ทิ้ง → เคสแรกแดง
//   S3 🔴 CONTROL — ไม่จิ้ม (render อย่างเดียว) ต้องไม่มีการสไลด์เอง ไม่งั้นหน้ากระโดดเองตอนเข้ามา
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), query: {}, pathname: '/v2/calendar' }) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

// identity/tier — paid จะได้ไม่เจอ promo ซ้อนทับ assertion
vi.mock('@/features/v2-shell/hooks/useClientTier', () => ({
  useClientTier: () => ({ isPaid: true, tier: 'PRO', loading: false }),
}))

// month fixture — สองสัปดาห์ สองวันก็พอ: selected = วันแรก, เป้ายิง = วันที่สอง
const selectDay = vi.fn()
vi.mock('@/features/v2-calendar', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const day = (date: string, dnum: number) => ({
    date, day: dnum, ganzhi: '甲子', percent: 70, isBuddhistDay: false,
  })
  return {
    ...actual,
    useCalendarMonth: () => ({
      month: {
        year: 2569, monthIndex: 8,
        weeks: [[day('2569-09-01', 1), day('2569-09-02', 2)]],
        days: [day('2569-09-01', 1), day('2569-09-02', 2)],
      },
      loading: false, refusal: null, year: 2569, monthIndex: 8,
      todayISO: '2569-09-01', selectedDate: '2569-09-01',
      selectDay, goPrev: vi.fn(), goNext: vi.fn(), goToday: vi.fn(),
    }),
    CalendarMenuState: actual.CalendarMenuState,
  }
})
vi.mock('@/features/v2-calendar/hooks/useDayDetail', () => ({ useDayDetail: () => ({ detail: null }) }))
vi.mock('@/features/v2-shell/components/AppHeader', () => ({ AppHeader: () => null }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-calendar/components/DateSelector', () => ({ DateSelector: () => null }))
vi.mock('@/features/v2-shell/components/DailyFortuneCard', () => ({
  DailyFortuneCard: () => <div data-testid="daily-card-stub" />,
}))

import V2CalendarPage from '@/pages/v2/calendar'

describe('#567 · จิ้มวันบนปฏิทิน → สไลด์ไปการ์ดข้อมูลของวันนั้น', () => {
  let scrollSpy: ReturnType<typeof vi.fn>
  beforeEach(() => {
    selectDay.mockClear()
    scrollSpy = vi.fn()
    // jsdom ไม่มี scrollIntoView — ผูก spy ไว้ที่ prototype แล้วอ่านว่าโดนเรียกที่การ์ดจริงไหม
    Element.prototype.scrollIntoView = scrollSpy
  })
  afterEach(() => cleanup())

  it('🔴 จิ้มวัน → scrollIntoView ที่การ์ดข้อมูลของวันนั้น', () => {
    render(<V2CalendarPage teamPreview={false} />)
    scrollSpy.mockClear()
    const cells = screen.getAllByTestId('calendar-day')
    fireEvent.click(cells[1]) // วันที่ 2 — ไม่ใช่วันที่เลือกอยู่
    expect(selectDay).toHaveBeenCalledWith('2569-09-02')
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    // ตัวที่ถูกสไลด์ต้องเป็น wrapper ของการ์ดข้อมูล ไม่ใช่ element อื่น
    const target = scrollSpy.mock.instances[0] as HTMLElement | undefined
    expect(target?.querySelector('[data-testid="daily-card-stub"]')).toBeTruthy()
  })

  it('🔴 CONTROL — เข้าหน้ามาใหม่โดยไม่จิ้ม → ไม่มีการสไลด์เอง', () => {
    render(<V2CalendarPage teamPreview={false} />)
    expect(scrollSpy).not.toHaveBeenCalled()
  })
})
