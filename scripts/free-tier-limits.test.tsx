// scripts/free-tier-limits.test.tsx — ล็อกผู้ใช้ฟรี + คะแนนสากล (Kittipon / gafiw / เอ็ม 2026-10-20)
//   FT1 หน้าต่างปฏิทินฟรี 7 วัน (วันนี้…+6) ข้ามเดือนได้ · วันที่ผ่านมาล็อก · สมาชิกไม่ล็อก
//   FT2 กริด: วันล็อกโชว์กุญแจ ไม่มี % · กดแล้วไปหน้าแพ็กเกจ (onLocked) · legend บอกสมาชิก
//   FT3 ด่านไพ่ (useCardGate): สิทธิ์ฟรี → ทำเลย · จะหัก QI → ป็อปอัป (ดูแพ็กเกจ / ใช้ QI / ไว้ก่อน) · 402 → ป็อปอัปแบบ QI ไม่พอ
//   FT4 คะแนนสากล: จาก almanac.universal หรือ strength.ratioDay · การ์ดคะแนน 2 วง (สากล | เฉพาะบุคคล)
//   FT5 แอดวานซ์แบบเบลอ (ฟรี): ข้อความตัวอย่าง ไม่ใช่ข้อมูลจริง · แตะแล้วเรียก onTap
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act, renderHook } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

import { calendarDateOpen, calendarMonthReachable, freeWindowDates, freeWindowMonths } from '@/lib/v2/entitlement'
import { MonthGrid } from '@/features/v2-calendar/components/MonthGrid'
import type { CalendarDay } from '@/features/v2-calendar'
import { useCardGate } from '@/features/v2-shell/hooks/useCardGate'
import { universalLabel, universalOf } from '@/lib/v2-calendar/universal'
import { DayScoreCard } from '@/features/v2-calendar/components/day-detail/DayScoreCard'
import { AdvancedTeaser } from '@/features/v2-calendar/components/day-detail/AdvancedTeaser'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const FREE = { isPaid: false, tier: 'FREE' }
const PLUS = { isPaid: true, tier: 'PLUS' }

describe('FT1 หน้าต่างปฏิทินฟรี 7 วัน', () => {
  it('วันนี้…+6 และข้ามเดือน/ปีได้', () => {
    expect(freeWindowDates('2026-10-20')).toEqual(['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'])
    expect(freeWindowDates('2026-12-28').slice(-3)).toEqual(['2027-01-01', '2027-01-02', '2027-01-03'])
    expect(freeWindowMonths('2026-10-20')).toEqual(['2026-10'])
    expect(freeWindowMonths('2026-10-28')).toEqual(['2026-10', '2026-11'])
  })

  it('ฟรี: วันที่ผ่านมาและเกิน 7 วันล็อก · สมาชิกเปิดทุกวัน', () => {
    expect(calendarDateOpen(FREE, '2026-10-20', '2026-10-20')).toBe(true)
    expect(calendarDateOpen(FREE, '2026-10-26', '2026-10-20')).toBe(true)
    expect(calendarDateOpen(FREE, '2026-10-27', '2026-10-20')).toBe(false)
    expect(calendarDateOpen(FREE, '2026-10-19', '2026-10-20')).toBe(false)
    expect(calendarDateOpen(PLUS, '2026-10-01', '2026-10-20')).toBe(true)
  })

  it('ฟรี: เปิดเดือนหน้าได้เฉพาะเมื่อหน้าต่างข้ามเดือน · ไม่ส่ง today = กติกาเดิม', () => {
    expect(calendarMonthReachable(FREE, '2026-11', '2026-10', '2026-10-20')).toBe(false)
    expect(calendarMonthReachable(FREE, '2026-11', '2026-10', '2026-10-28')).toBe(true)
    expect(calendarMonthReachable(FREE, '2026-09', '2026-10', '2026-10-28')).toBe(false)
    expect(calendarMonthReachable(FREE, '2026-10', '2026-10')).toBe(true)
    expect(calendarMonthReachable(PLUS, '2027-03', '2026-10', '2026-10-20')).toBe(true)
  })
})

describe('FT2 กริดวันล็อก', () => {
  const day = (d: number, extra: Partial<CalendarDay> = {}): CalendarDay => ({ date: `2026-10-${String(d).padStart(2, '0')}`, day: d, ganzhi: '甲子', percent: 70, grade: 'B+', ...extra })
  it('กุญแจแทน % · กดแล้วไปหน้าแพ็กเกจ · legend', () => {
    const onLocked = vi.fn()
    const onSelect = vi.fn()
    render(<MonthGrid weeks={[[day(20), day(27, { locked: true, ganzhi: '', percent: 0, grade: '' })]]} selectedDate="2026-10-20" onSelect={onSelect} onLocked={onLocked} />)
    const locked = screen.getByTestId('calendar-day-locked')
    expect(locked.textContent).toContain('🔒')
    expect(locked.textContent).not.toContain('%')
    fireEvent.click(locked)
    expect(onLocked).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('calendar-day')).toHaveLength(1)
    expect(screen.getByTestId('calendar-legend-locked')).toBeTruthy()
  })
})

describe('FT3 ด่านไพ่/เซียมซี/เบอร์มงคล (ฟรีรวม 1 ครั้ง/วัน)', () => {
  const stubQuota = (q: unknown) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => q })))

  function Harness({ run }: { run: () => void }) {
    const gate = useCardGate()
    return <><button data-testid="go" onClick={() => void gate.guard(run)}>go</button><button data-testid="block" onClick={gate.blocked}>b</button>{gate.modal}</>
  }

  it('สิทธิ์ฟรี → ทำเลย ไม่มีป็อปอัป', async () => {
    stubQuota({ nextSource: 'free', cost: 0, freeRemaining: 1, affordable: true })
    const run = vi.fn()
    render(<Harness run={run} />)
    await act(async () => { fireEvent.click(screen.getByTestId('go')) })
    expect(run).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('unlimited-upsell-modal')).toBeNull()
  })

  it('ครั้งนี้จะหัก QI → ป็อปอัปก่อน · ใช้ QI = ทำต่อ · ไว้ก่อน = ไม่ทำ', async () => {
    stubQuota({ nextSource: 'qi', cost: 10, freeRemaining: 0, affordable: true })
    const run = vi.fn()
    render(<Harness run={run} />)
    await act(async () => { fireEvent.click(screen.getByTestId('go')) })
    expect(run).not.toHaveBeenCalled()
    expect(screen.getByTestId('unlimited-upsell-cta').getAttribute('href')).toBe('/v2/shop')
    fireEvent.click(screen.getByTestId('unlimited-upsell-qi'))
    expect(run).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('unlimited-upsell-modal')).toBeNull()

    await act(async () => { fireEvent.click(screen.getByTestId('go')) })
    fireEvent.click(screen.getByTestId('unlimited-upsell-close'))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('QI ไม่พอ / 402 → ป็อปอัปไม่มีปุ่มใช้ QI แต่ชวนเติม', async () => {
    stubQuota({ nextSource: null, cost: 10, freeRemaining: 0, affordable: false })
    const run = vi.fn()
    render(<Harness run={run} />)
    await act(async () => { fireEvent.click(screen.getByTestId('go')) })
    expect(run).not.toHaveBeenCalled()
    expect(screen.queryByTestId('unlimited-upsell-qi')).toBeNull()
    expect(screen.getByTestId('unlimited-upsell-topup')).toBeTruthy()
    fireEvent.click(screen.getByTestId('unlimited-upsell-close'))
    fireEvent.click(screen.getByTestId('block'))
    expect(screen.getByTestId('unlimited-upsell-topup')).toBeTruthy()
  })

  it('เช็คล้ม → ปล่อยทำ (engine ยังตัดสิทธิ์จริง)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const run = vi.fn()
    const { result } = renderHook(() => useCardGate())
    await act(async () => { await result.current.guard(run) })
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('FT4 คะแนนสากล', () => {
  it('อ่านจาก almanac.universal ก่อน · ไม่มีก็จาก strength.ratioDay · ไม่มีเลย = null', () => {
    expect(universalOf({ universal: { score: 72, label: 'ดี' } })).toEqual({ score: 72, label: 'ดี' })
    expect(universalOf({ strength: { ratioDay: 1.08 } })).toEqual({ score: 100, label: 'ดีเยี่ยม' })
    expect(universalOf({ strength: { ratioDay: 0.43 } })).toEqual({ score: 43, label: 'ระวัง' })
    expect(universalOf({})).toBeNull()
    expect([universalLabel(80), universalLabel(65), universalLabel(45), universalLabel(44)]).toEqual(['ดีเยี่ยม', 'ดี', 'พอใช้', 'ระวัง'])
  })

  const DETAIL = { date: '2026-10-20', day: 20, ganzhi: '丁卯', percent: 35, grade: 'D+', summary: 'ระวัง', suitable: [], avoid: [], yams: [] } as never
  it('มีคะแนนสากล → 2 วง · ไม่มี → วงเดียวแบบเดิม', () => {
    render(<DayScoreCard detail={{ ...(DETAIL as object), universal: { score: 90, label: 'ดีเยี่ยม' } } as never} />)
    expect(screen.getByTestId('day-dual-score')).toBeTruthy()
    expect(screen.queryByTestId('day-universal-score')).toBeNull() // เอ็ม 2026-10-20: สากลมีแค่คำ ไม่มีวง/ตัวเลข
    expect(screen.getByTestId('day-universal-label').textContent).toBe('ดีเยี่ยม')
    expect(screen.getByTestId('day-personal').textContent).toContain('35%')
    cleanup()
    render(<DayScoreCard detail={DETAIL} />)
    expect(screen.queryByTestId('day-dual-score')).toBeNull()
  })
})

describe('FT5 แอดวานซ์แบบเบลอ', () => {
  it('ข้อความตัวอย่างเบลอ + ป้ายปลดล็อก · แตะแล้วเรียก onTap', async () => {
    const onTap = vi.fn()
    render(<AdvancedTeaser onTap={onTap} />)
    const t = screen.getByTestId('advanced-teaser')
    expect(t.textContent).toContain('ปลดล็อกโหมดแอดวานซ์')
    expect(t.querySelector('.blur-\\[5px\\]')).toBeTruthy()
    fireEvent.click(t)
    await waitFor(() => expect(onTap).toHaveBeenCalledTimes(1))
  })
})
