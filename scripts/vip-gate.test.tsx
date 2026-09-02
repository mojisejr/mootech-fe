// scripts/vip-gate.test.tsx — VipGate (template ล็อกฟีเจอร์ 🔒 ตามมีตติ้งทีม) ประกอบจริง 3 สถานะ
//
// 🔴 MUTANT CONTRACT (แต่ละข้อทำ `npm test` แดงถ้าพัง):
//   V1  paid user ยังเห็น children                          → "paid แสดงเนื้อหา" แดง
//   V2  free user เห็นกรอบมงกุฎ + ป้าย 🔒 + ปุ่มพาไป shop   → 2 เคส free แดง
//   V3  ระหว่างโหลด/erred ต้องเป็น skeleton — ห้ามโชว์ปุ่มขายให้คนที่ยังไม่รู้สิทธิ์ตัวเอง
//                                                           → "undetermined" แดง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/destiny', asPath: '/v2/destiny', route: '/v2/destiny', query: {}, isReady: true, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))

const membershipState: { isPaid: boolean | null } = { isPaid: null }
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({
    userId: 'u-vip',
    done: membershipState.isPaid !== null,
    errored: false,
    user: membershipState.isPaid === null ? null : { user_id: 'u-vip', membership: { isPaid: membershipState.isPaid, tier: membershipState.isPaid ? 'PRO' : 'FREE', source: 'v2' } },
  }),
}))

import { VipGate } from '@/features/v2-shell/components/VipGate'

function Subject() {
  return (
    <VipGate label="ปฏิทินดวงขั้นสูง" description="ดูย้อนหลังและคำพยากรณ์รายเดือน" testId="vip">
      <p>เนื้อหาลับ</p>
    </VipGate>
  )
}

describe('VipGate', () => {
  beforeEach(() => { membershipState.isPaid = null })
  afterEach(() => cleanup())

  it('V1 paid → แสดงเนื้อหาจริง ไม่มีกรอบล็อก', () => {
    membershipState.isPaid = true
    render(<Subject />)
    expect(screen.getByText('เนื้อหาลับ')).toBeTruthy()
    expect(screen.queryByTestId('vip-locked')).toBeNull()
    expect(screen.queryByTestId('vip-cta')).toBeNull()
  })

  it('V2 free → กรอบมงกุฎ + ป้าย 🔒 + ปุ่มพาไปหน้าจ่าย และไม่โชว์เนื้อหา', () => {
    membershipState.isPaid = false
    render(<Subject />)
    expect(screen.getByTestId('vip-locked')).toBeTruthy()
    expect(screen.getByTestId('vip-crown')).toBeTruthy()
    expect(screen.getByText(/ปฏิทินดวงขั้นสูง/).textContent).toContain('🔒')
    expect(screen.getByText(/ดูย้อนหลัง/)).toBeTruthy()
    const cta = screen.getByTestId('vip-cta') as HTMLAnchorElement
    expect(cta.getAttribute('href')).toBe('/v2/shop')
    expect(screen.queryByText('เนื้อหาลับ')).toBeNull()
  })

  it('V3 สิทธิ์ยังไม่รู้ (โหลดค้าง/erred) → skeleton เท่านั้น ทั้งเนื้อหาและปุ่มขายห้ามโผล่', () => {
    membershipState.isPaid = null
    render(<Subject />)
    expect(screen.getByTestId('vip-undetermined')).toBeTruthy()
    expect(screen.queryByTestId('vip-locked')).toBeNull()
    expect(screen.queryByTestId('vip-cta')).toBeNull()
    expect(screen.queryByText('เนื้อหาลับ')).toBeNull()
  })
})
