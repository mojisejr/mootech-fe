// scripts/mate-ai-button-label.test.tsx — #568 (ฟีม): ปุ่มแชทบนเมนูชื่อ "เสี่ยวมู่"
//
// 🔴 MUTANT CONTRACT:
//   G1 ข้อความบนปุ่มกลับไปเป็น "Mate AI" → "ชื่อบนปุ่มคือ เสี่ยวมู่" แดง
//   G2 aria-label ไม่ตรงกับข้อความที่เห็น → "accessible name ตรงจอ" แดง
//      (screen reader อ่านชื่อเดิม "Mate AI" ทั้งที่จอเขียนว่าอย่างอื่น = ป้ายโกหก)
//   G3 identifier (data-testid) ถูกเปลี่ยนตามภาษา → "identifier คงเดิม" แดง — กติกาบ้าน: ชื่อเชิงโค้ด
//      ไม่เปลี่ยนตาม copy, ทุกคอมเมนต์/ฟันที่อ้าง nav-mate-ai ต้องยังจับเจอ
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/image', () => ({ default: () => null }))

import { MateAIButton } from '@/features/v2-shell/components/MateAIButton'

describe('#568 · ปุ่มเสี่ยวมู่', () => {
  afterEach(() => cleanup())

  it('G1 ข้อความบนปุ่มคือ เสี่ยวมู่ (ไม่ใช่ Mate AI)', () => {
    render(<MateAIButton />)
    const label = screen.getByTestId('nav-mate-ai-label')
    expect(label.textContent).toBe('เสี่ยวมู่')
  })

  it('G2 accessible name ตรงกับข้อความบนจอ', () => {
    render(<MateAIButton />)
    expect(screen.getByRole('link', { name: 'เสี่ยวมู่' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Mate AI' })).toBeNull()
  })

  it('G3 identifier คงเดิม — nav-mate-ai ต้องยังอยู่', () => {
    render(<MateAIButton />)
    expect(screen.getByTestId('nav-mate-ai').getAttribute('href')).toBe('/v2/chat')
  })
})
