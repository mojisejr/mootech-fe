// scripts/qi-buy-screen.test.tsx — จอซื้อ QI (/v2/qi/buy, เฟรม buy-qi — select pack)
//   B1 ราคา/จำนวนจาก catalog+แถวจริง · เลือกแพ็ก radio → สรุปยอด+ปุ่มไปชำระอัปเดตตามแพ็กที่เลือก
//   B2 แพ็กปิดขาย (is_active=false) → radio disabled + "ปิดขายชั่วคราว"
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi/buy', isReady: true }),
}))

let PACKS: Record<string, { package_code: string; amount: number; is_active: boolean }> = {}
const fetchMock = vi.fn(async (url: string) => {
  const u = String(url)
  if (u.includes('/api/qi-wallet')) return { ok: true, status: 200, json: async () => ({ qi: 590, history: [] }) }
  const m = /code=(QI_\d+)/.exec(u)
  if (m) return { ok: true, status: 200, json: async () => PACKS[m[1]] ?? null }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import QiBuyScreen from '@/features/v2-qi/components/QiBuyScreen'

beforeEach(() => {
  PACKS = {
    QI_60: { package_code: 'QI_60', amount: 35, is_active: true },
    QI_200: { package_code: 'QI_200', amount: 99, is_active: true },
    QI_500: { package_code: 'QI_500', amount: 219, is_active: true },
    QI_1200: { package_code: 'QI_1200', amount: 449, is_active: true },
  }
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอซื้อ QI (buy-qi — select pack)', () => {
  it('B1 โชว์ 4 แพ็ก + สรุป/ปุ่มไปชำระตามแพ็กที่เลือก (default QI_500 = 575 QI, ฿219)', async () => {
    render(<QiBuyScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-pack-QI_60')).toBeTruthy())
    // จำนวน QI + ราคา + โบนัส จากแถวจริง/catalog
    expect(screen.getByTestId('qi-pack-QI_60').textContent).toContain('60 QI')
    expect(screen.getByTestId('qi-pack-QI_60').textContent).toContain('฿35')
    expect(screen.getByTestId('qi-pack-QI_1200').textContent).toContain('฿449')
    expect(screen.getByTestId('qi-pack-QI_500').textContent).toContain('โบนัส +75')
    // สรุป default = QI_500: รวม 575 QI, VAT ฿14, ปุ่ม → checkout ของ QI_500
    expect(screen.getByTestId('qi-buy-total').textContent).toBe('575 QI')
    expect(screen.getByTestId('qi-buy-vat').textContent).toBe('฿14')
    expect(screen.getByTestId('qi-buy-cta').getAttribute('href')).toBe('/v2/shop/checkout?package_code=QI_500')
    // เลือกแพ็กอื่น → สรุป/ปุ่มอัปเดต (1,200 + โบนัส 250 = 1,450)
    fireEvent.click(screen.getByTestId('qi-pack-QI_1200'))
    expect(screen.getByTestId('qi-buy-total').textContent).toBe('1,450 QI')
    expect(screen.getByTestId('qi-buy-cta').getAttribute('href')).toBe('/v2/shop/checkout?package_code=QI_1200')
  })

  it('B2 แพ็กปิดขาย (is_active=false) → radio disabled + "ปิดขายชั่วคราว"', async () => {
    PACKS.QI_1200 = { package_code: 'QI_1200', amount: 449, is_active: false }
    render(<QiBuyScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-pack-QI_1200')).toBeTruthy())
    expect((screen.getByTestId('qi-pack-QI_1200') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('qi-pack-QI_1200').textContent).toContain('ปิดขายชั่วคราว')
  })

  it('อ่านราคาล้มทั้งหมด → หน้า error พร้อมทางกลับหน้า QI', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/qi-wallet')) return { ok: true, status: 200, json: async () => ({ qi: 0 }) }
      return { ok: false, status: 500, json: async () => ({}) }
    })
    render(<QiBuyScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-buy-error')).toBeTruthy())
  })
})
