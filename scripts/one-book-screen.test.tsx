// scripts/one-book-screen.test.tsx — /v2/service/one-book (Your Life Code)
// ไม่มีเฟรม Figma → หน้าออกแบบเอง; ล็อกคอนเทนต์หลัก + accordion + ราคา + CTA ไปไลน์ (บริการสั่งทำ)
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/one-book', isReady: true, asPath: '/v2/service/one-book' }),
}))

import { OneBookScreen } from '@/features/v2-service/components/OneBookScreen'

afterEach(() => cleanup())

describe('จอ Your Life Code (one-book)', () => {
  it('แสดง hero + ราคา 2 แพ็ก + CTA ทักไลน์', () => {
    render(<OneBookScreen />)
    expect(screen.getByTestId('one-book-hero')).toBeTruthy()
    // ราคาตรงคอนเทนต์การตลาด
    expect(screen.getByText('1,890')).toBeTruthy()
    expect(screen.getByText('2,390')).toBeTruthy()
    // วิเคราะห์โดยคนจริง ไม่ใช้ AI
    expect(screen.getByText(/ไม่ใช้ AI/)).toBeTruthy()
    // CTA เป็นลิงก์ไป LINE OA (บริการสั่งทำ ไม่ใช่ checkout ในแอป)
    const cta = screen.getByTestId('one-book-order') as HTMLAnchorElement
    expect(cta.getAttribute('href')).toBe('https://line.me/R/ti/p/@082cvuiy?ts=09151109&oat_content=url')
  })

  it('มีครบ 15 ด้าน + accordion เปิด/ปิดได้', () => {
    render(<OneBookScreen />)
    // 15 หัวข้อ
    for (let i = 0; i < 15; i += 1) expect(screen.getByTestId(`one-book-ch-${i}`)).toBeTruthy()
    // ข้อ 0 เปิดเป็นค่าเริ่ม → เห็น hook; กดปิดแล้ว hook หาย
    expect(screen.getByText(/เผยรหัสจิตวิทยาที่ซ่อนในวันเกิด/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('one-book-ch-0'))
    expect(screen.queryByText(/เผยรหัสจิตวิทยาที่ซ่อนในวันเกิด/)).toBeNull()
    // เปิดข้ออื่น
    fireEvent.click(screen.getByTestId('one-book-ch-6'))
    expect(screen.getByText(/เช็กดวงคู่แท้ก่อนเสียเวลา/)).toBeTruthy()
  })
})
