// scripts/calendar-cards-mascot.test.tsx — ฟันของ #555 + #535 (การ์ดโปรโมท/อัปเซลล์ปฏิทิน × มาสคอต)
//
// สองใบนี้เป็นบั๊ก "ขอบ/การทับ" ที่ CI มองไม่เห็นด้วยข้อความ — textContent ถูกทุกตัวอักษรทั้งที่จอพัง
// (คลาสเดียวกับ #306/#517) จึงเหลือสองทาง: ภาพจริง (ไม่มีเลน) หรือสัญญาคลาส ไฟล์นี้เลือกสัญญาคลาส
// โดยเขียนกุญแจไว้ตรงจุดที่โค้ดแก้ — ถอดทิ้งแล้วต้องแดง
//
// 🔴 MUTANT CONTRACT:
//   M1 #555 คืน overflow-hidden + รูปเกิน 113% บนกล่องมาสคอต upsell → "ไม่ครอบภาพ" แดง
//   M2 #535 ถอด z-10 จากบล็อกข้อความ promo → "ข้อความอยู่ชั้นบน" แดง
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/image', () => ({
  default: (props: { src: string; 'data-testid'?: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} data-testid={props['data-testid']} className={props.className} alt="" />
  ),
}))

import { PersonalCalendarUpsell } from '@/features/v2-calendar/components/upsell/PersonalCalendarUpsell'
import { PersonalCalendarPromo } from '@/features/v2-calendar/components/upsell/PersonalCalendarPromo'

describe('#555 · มาสคอตบนการ์ดอัปเซลล์ — ไม่มีการครอบตัดภาพ (กรอบที่ฟีมเห็น)', () => {
  afterEach(() => cleanup())

  it('M1 กล่องมาสคอตไม่ overflow-hidden และรูปไม่ถูกดันเกินกรอบ (113%)', () => {
    render(<PersonalCalendarUpsell percent={62} />)
    const mu = screen.getByTestId('calendar-upsell-mu')
    expect(mu.className).not.toContain('overflow-hidden')
    const img = mu.querySelector('img') as HTMLImageElement
    expect(img.className).not.toMatch(/113/)
    expect(img.className).toContain('object-contain')
  })
})

describe('#535 · การ์ดโปรโมทปฏิทิน — ข้อความไม่ถูกภาพทับ', () => {
  afterEach(() => cleanup())

  it('M2 บล็อกข้อความอยู่ชั้นบน (relative z-10) และหัวข้อครบทุกตัวอักษร', () => {
    render(<PersonalCalendarPromo />)
    const headline = screen.getByText(/เปิดการใช้งาน/)
    const block = headline.closest('div') as HTMLElement
    expect(block.className).toContain('z-10')
    expect(block.className).toContain('relative')
    // หัวข้อครบ — ตัวเดิมถูกภาพบังจนเหลือ "เปิดการใช้ง" ที่ 320
    expect(screen.getByText(/ปฏิทินเฉพาะฉัน/)).toBeTruthy()
  })
})
