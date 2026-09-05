// scripts/sinsae-screen.test.tsx — /v2/service/sinsae (ดูดวงส่วนตัว กับซินแส)
// ไม่มีเฟรม Figma → หน้าออกแบบเอง; ล็อก 3 แพ็กเกจ (ราคา/เวลา) + แถบความน่าเชื่อถือ + CTA ไปไลน์ (บริการจอง)
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/sinsae', isReady: true, asPath: '/v2/service/sinsae' }),
}))

import { SinsaeScreen } from '@/features/v2-service/components/SinsaeScreen'
import { hrefById } from '@/features/v2-service/services'

afterEach(() => cleanup())

describe('จอ ดูดวงส่วนตัว กับซินแส (sinsae)', () => {
  it('แสดง 3 แพ็ก (ราคา+เวลา) + Popular + แถบความน่าเชื่อถือ', () => {
    render(<SinsaeScreen />)
    expect(screen.getByTestId('sinsae-hero')).toBeTruthy()
    // 3 แพ็กเกจครบ
    expect(screen.getByTestId('sinsae-tier-unlock')).toBeTruthy()
    expect(screen.getByTestId('sinsae-tier-deepdive')).toBeTruthy()
    expect(screen.getByTestId('sinsae-tier-levelup')).toBeTruthy()
    // ราคาตรงคอนเทนต์
    expect(screen.getByText(/690 บาท \/ 30 นาที/)).toBeTruthy()
    expect(screen.getByText(/1,190 บาท \/ 60 นาที/)).toBeTruthy()
    expect(screen.getByText(/2,890 บาท \/ 90 นาที/)).toBeTruthy()
    // ป้าย Popular + VIP
    expect(screen.getByText(/Popular/)).toBeTruthy()
    expect(screen.getByText(/VIP/)).toBeTruthy()
    // ปรึกษาคนจริง ไม่ใช้ AI
    expect(screen.getByText(/ไม่ใช้ AI/)).toBeTruthy()
    // แถบความน่าเชื่อถือ
    expect(screen.getByTestId('sinsae-trust')).toBeTruthy()
  })

  it('ทุกปุ่มจองเป็นลิงก์ไป LINE OA (บริการจอง ไม่ใช่ checkout ในแอป)', () => {
    render(<SinsaeScreen />)
    const line = 'https://line.me/R/ti/p/@082cvuiy?ts=09151109&oat_content=url'
    for (const id of ['unlock', 'deepdive', 'levelup']) {
      const cta = screen.getByTestId(`sinsae-book-${id}`) as HTMLAnchorElement
      expect(cta.getAttribute('href')).toBe(line)
      expect(cta.getAttribute('target')).toBe('_blank')
    }
  })

  it('id บริการ sinsae ชี้ไปหน้าจริง /v2/service/sinsae (ไม่ใช่ coming-soon)', () => {
    expect(hrefById('sinsae')).toBe('/v2/service/sinsae')
  })
})
