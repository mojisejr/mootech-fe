// scripts/qi-buy-screen.test.tsx — จอเติมชี่ (/v2/qi/buy, เฟรม buy-qi — select pack)
//
// 🔴 MUTANT CONTRACT:
//   B1 ราคาที่โชว์ต้องมาจาก /api/payment-package (แถวจริง) ❌ hardcode ในจอ
//   B2 แพ็กที่ปิดขาย (is_active=false) ❌ มีลิงก์เข้า checkout — ปุ่มต้องปิดพร้อมเหตุผล
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi/buy', isReady: true }),
}))

const PACKS: Record<string, { package_code: string; amount: number; is_active: boolean }> = {
  QI_200: { package_code: 'QI_200', amount: 59, is_active: true },
  QI_500: { package_code: 'QI_500', amount: 129, is_active: false }, // ปิดขายชั่วคราว (เคส B2)
  QI_1200: { package_code: 'QI_1200', amount: 299, is_active: true },
}

const fetchMock = vi.fn(async (url: string) => {
  const u = String(url)
  const m = /code=(QI_\d+)/.exec(u)
  if (m) {
    const row = PACKS[m[1]]
    return { ok: true, status: 200, json: async () => row }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import QiBuyScreen from '@/features/v2-qi/components/QiBuyScreen'

beforeEach(() => fetchMock.mockClear())
afterEach(() => cleanup())

describe('จอเติมชี่ (buy-qi — select pack)', () => {
  it('B1 โชว์ครบ 3 แพ็ก: จำนวนชี่จาก catalog map + ราคาจากแถวจริง + CTA เข้า checkout ของแพ็กนั้น', async () => {
    render(<QiBuyScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-pack-QI_200')).toBeTruthy())
    expect(screen.getByText('200 ชี่')).toBeTruthy()
    expect(screen.getByText('1,200 ชี่')).toBeTruthy()
    expect(screen.getByText('฿59')).toBeTruthy()
    expect(screen.getByText('฿299')).toBeTruthy()
    // โบนัสซื้อครั้งแรก (first_buy_bonus ของ engine)
    expect(screen.getByTestId('qi-buy-bonus').textContent).toContain('+30 ชี่')
    // badge คุ้มที่สุดบนแพ็กใหญ่สุด (ตามเฟรม buy-qi — select pack)
    expect(screen.getByText('คุ้มที่สุด')).toBeTruthy()
    // CTA = checkout เดิม ผูกโค้ดแพ็ก
    const cta = screen.getByTestId('qi-buy-cta-QI_200')
    expect(cta.getAttribute('href')).toBe('/v2/shop/checkout?package_code=QI_200')
    expect(screen.getByTestId('qi-buy-cta-QI_1200').getAttribute('href')).toBe('/v2/shop/checkout?package_code=QI_1200')
  })

  it('B2 แพ็กปิดขาย ❌ ไม่มีลิงก์เข้า checkout — ปุ่มปิดพร้อมเหตุผล', async () => {
    render(<QiBuyScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-pack-QI_500')).toBeTruthy())
    expect(screen.queryByTestId('qi-buy-cta-QI_500')).toBeNull()
    expect(screen.getByText('ปิดขายชั่วคราว')).toBeTruthy()
  })

  it('อ่านราคาล้มทั้งหมด → หน้า error พร้อมทางกลับหน้าชี่ ❌ เงียบ', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    render(<QiBuyScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-buy-error')).toBeTruthy())
  })
})
