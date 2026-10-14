// scripts/newcomer-coach.test.tsx — คนใหม่ (ยังไม่มีบัญชี) หาธาตุฟรีก่อนสมัคร (เอ็ม 2026-10-14)
//   NC1 ไกด์ส่องส่วนที่บอก + ข้อความ + ลำดับ x/4 · ไม่มีขั้น = ไม่ขึ้น · หาไม่เจอ = ไม่ขึ้น (ไม่ค้างจอมืด)
//   NC2 บังคับกด: ฉากกันรอบช่อง กดได้เฉพาะของจริงในช่อง
//   NC3 ?newcomer=1 → จำทั้ง session · วันเกิดที่กรอกจำไว้ให้หน้าสมัคร · ล้างหลังสมัคร
//   NC4 หน้าแนะนำ: ปุ่มหน้าสุดท้ายใช้ lastLabel
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, renderHook } from '@testing-library/react'

Element.prototype.scrollIntoView = vi.fn()
const realRect = Element.prototype.getBoundingClientRect

import { NEWCOMER_STEPS, NewcomerCoach, clearNewcomer, readNewcomerBirth, saveNewcomerBirth, useNewcomer } from '@/features/v2-guide/NewcomerCoach'
import { OnboardingCarousel } from '@/features/onboarding/components/OnboardingCarousel'

beforeEach(() => {
  sessionStorage.clear()
  Element.prototype.getBoundingClientRect = function () { return { top: 300, left: 40, width: 200, height: 40, bottom: 340, right: 240, x: 40, y: 300, toJSON: () => ({}) } as DOMRect }
})
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = realRect })

describe('ไกด์คนใหม่ หาธาตุก่อนสมัคร', () => {
  it('NC1 ส่องขั้นวันเกิด 1/4 · ไม่มีขั้น/หาไม่เจอ = ไม่ขึ้น', async () => {
    const { rerender } = render(<><input data-testid="finder-date" /><NewcomerCoach step="date" /></>)
    await waitFor(() => expect(screen.getByTestId('newcomer-spotlight')).toBeTruthy())
    expect(screen.getByTestId('newcomer-text').textContent).toBe(NEWCOMER_STEPS.date.text)
    expect(screen.getByTestId('newcomer-coach').textContent).toContain('1/4')
    rerender(<><input data-testid="finder-date" /><NewcomerCoach step={null} /></>)
    expect(screen.queryByTestId('newcomer-coach')).toBeNull()
    rerender(<><input data-testid="finder-date" /><NewcomerCoach step="signup" /></>)
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.queryByTestId('newcomer-coach')).toBeNull()
  })

  it('NC2 ช่องว่างตรงส่วนที่ส่อง กดของจริงได้ · รอบๆ มีฉากกัน', async () => {
    const onClick = vi.fn()
    render(<><button data-testid="finder-submit" onClick={onClick}>ดูธาตุ</button><NewcomerCoach step="submit" /></>)
    await waitFor(() => expect(screen.getByTestId('newcomer-spotlight')).toBeTruthy())
    const blockers = screen.getAllByTestId('newcomer-coach-block')
    expect(blockers.length).toBe(4)
    expect(screen.queryByTestId('newcomer-coach-hole')).toBeNull() // pass = ไม่มีชิ้นรับแตะในช่อง
    // ฉากบนสูงถึงขอบบนของช่อง (300 - pad 8) · ฉากล่างเริ่มที่ขอบล่างช่อง
    expect((blockers[0] as HTMLElement).style.height).toBe('292px')
    expect((blockers[1] as HTMLElement).style.top).toBe('348px')
    fireEvent.click(screen.getByTestId('finder-submit'))
    expect(onClick).toHaveBeenCalled()
  })

  it('NC3 จำ ?newcomer=1 ทั้ง session + วันเกิดส่งต่อหน้าสมัคร + ล้างหลังสมัคร', () => {
    const first = renderHook(() => useNewcomer('1'))
    expect(first.result.current).toBe(true)
    const later = renderHook(() => useNewcomer(undefined))
    expect(later.result.current).toBe(true)

    expect(readNewcomerBirth()).toBeNull()
    saveNewcomerBirth({ date: '1990-05-17', time: '' })
    expect(readNewcomerBirth()).toEqual({ date: '1990-05-17', time: '' })
    saveNewcomerBirth({ date: 'bad', time: '10:00' })
    expect(readNewcomerBirth()).toBeNull()

    clearNewcomer()
    expect(readNewcomerBirth()).toBeNull()
    expect(renderHook(() => useNewcomer(undefined)).result.current).toBe(false)
  })

  it('NC4 หน้าแนะนำหน้าสุดท้าย = lastLabel', () => {
    const done = vi.fn()
    render(<OnboardingCarousel lastLabel="ลองหาธาตุของคุณฟรี" onComplete={done} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    fireEvent.click(screen.getByRole('button', { name: 'ลองหาธาตุของคุณฟรี' }))
    expect(done).toHaveBeenCalledTimes(1)
  })
})
