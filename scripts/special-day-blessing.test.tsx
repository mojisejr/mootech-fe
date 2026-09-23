// scripts/special-day-blessing.test.tsx — ซินแสนุ้ย 2026-09-23
// กดป้าย "วันความรัก"/"วันลาภสวรรค์" ในปฏิทิน → เด้งคำอธิษฐาน + สถานที่สักการะ (+ ทิศ ลาภสวรรค์).
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

import { blessingForStar } from '@/features/v2-calendar/components/day-detail/special-day-blessings'
import { SpecialDays } from '@/features/v2-calendar/components/day-detail/SpecialDays'
import type { DayDetailStar } from '@/features/v2-calendar/types'

afterEach(cleanup)

describe('blessingForStar', () => {
  it('วันความรัก → เฒ่าจันทรา (love)', () => {
    const b = blessingForStar('วันความรัก')
    expect(b?.generatorTopic).toBe('love')
    expect(b?.deity).toContain('เฒ่าจันทรา')
    expect((b?.shrines ?? []).length).toBeGreaterThan(0)
  })
  it('วันลาภสวรรค์ → ไฉ่ซิ้งเอี้ย (wealth) + โชว์ทิศ', () => {
    const b = blessingForStar('วันลาภสวรรค์')
    expect(b?.generatorTopic).toBe('wealth')
    expect(b?.deity).toContain('ไฉ่ซิ้งเอี้ย')
    expect(b?.showDirection).toBe(true)
  })
  it('วันพิเศษอื่นไม่มีคำอธิษฐาน (null)', () => {
    expect(blessingForStar('วันหมอเทพ')).toBeNull()
    expect(blessingForStar('วันมงคล')).toBeNull()
  })
})

describe('SpecialDays interactive', () => {
  const stars: DayDetailStar[] = [
    { name: 'วันความรัก', polarity: 'good', activity: 'เสริมเสน่ห์' },
    { name: 'วันมงคล', polarity: 'good', activity: 'ตั้งศาล' },
  ]

  it('วันความรัก กดได้ → เปิดแผงคำอธิษฐาน + สถานที่; วันมงคล กดไม่ได้', () => {
    render(<SpecialDays specialDays={stars} luckyDirection="ทิศตะวันตก" />)
    const opens = screen.getAllByTestId('special-day-open')
    // มีปุ่มเปิดแค่วันความรัก (วันมงคลไม่มี blessing)
    expect(opens.length).toBe(1)
    fireEvent.click(opens[0])
    const popup = screen.getByTestId('special-day-popup')
    expect(within(popup).getByTestId('special-day-prayer')).toBeTruthy()
    expect(within(popup).getByTestId('special-day-shrines')).toBeTruthy()
  })

  it('วันลาภสวรรค์ → โชว์ทิศมงคลที่ส่งเข้ามา', () => {
    render(<SpecialDays specialDays={[{ name: 'วันลาภสวรรค์', polarity: 'good', activity: '' }]} luckyDirection="ทิศตะวันออก" />)
    fireEvent.click(screen.getByTestId('special-day-open'))
    const dir = screen.getByTestId('special-day-direction')
    expect(dir.textContent).toContain('ทิศตะวันออก')
  })

  it('วันความรัก polarity=bad ไม่ทำให้กดได้ (กันเคสประหลาด)', () => {
    render(<SpecialDays specialDays={[{ name: 'วันความรัก', polarity: 'bad', activity: '' }]} />)
    expect(screen.queryByTestId('special-day-open')).toBeNull()
  })
})
