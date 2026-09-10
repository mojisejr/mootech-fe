// scripts/one-book-screen.test.tsx — /v2/service/one-book (Your Life Code)
// Rebuild ตาม Figma 55666-3969 (2026-09-10): hero + สถิติ + หัวข้อ + FAQ + CTA สั่งซื้อ → LINE (บริการสั่งทำ)
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/one-book', isReady: true, asPath: '/v2/service/one-book' }),
}))
// header ใช้ TopBarAvatar/Bell (useCookies) — stub กัน context error ในเทส
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))

import { OneBookScreen } from '@/features/v2-service/components/OneBookScreen'

afterEach(() => cleanup())

describe('จอ Your Life Code (one-book)', () => {
  it('แสดง hero + section หลัก + ราคา ฿1,890', () => {
    render(<OneBookScreen />)
    expect(screen.getByTestId('one-book-hero')).toBeTruthy()
    expect(screen.getByTestId('one-book-stats')).toBeTruthy()
    expect(screen.getByTestId('one-book-topics')).toBeTruthy()
    expect(screen.getByTestId('one-book-faq')).toBeTruthy()
    // ราคาโปรวันนี้ ฿1,890 (โผล่หลายที่)
    expect(screen.getAllByText(/฿1,890/).length).toBeGreaterThan(0)
  })

  it('CTA สั่งซื้อ → ลิงก์ไป LINE OA (บริการสั่งทำ ไม่ใช่ checkout ในแอป)', () => {
    render(<OneBookScreen />)
    const cta = screen.getByTestId('one-book-order') as HTMLAnchorElement
    expect(cta.getAttribute('href')).toBe('https://line.me/R/ti/p/@082cvuiy?ts=09151109&oat_content=url')
    expect(cta.getAttribute('target')).toBe('_blank')
  })
})
