// scripts/orders-screen.test.tsx — /v2/orders (เฟรม order-history) + /v2/orders/[id] (order-receipt)
//
// 🔴 MUTANT CONTRACT:
//   O1 APPROVED เท่านั้นที่อ่านว่า "สำเร็จ" — REJECT ❌ โชว์เป็นซื้อสำเร็จ (กติกา #365)
//   O2 แพ็กชี่ต้องโชว์เป็น "แพ็กชี่ N ชี่" ❌ ชื่อสมาชิก
//   O3 ใบเสร็จหาแถวด้วย chargeId, ไม่เจอ = "ไม่พบรายการนี้ในบัญชี" ❌ ใบเสร็จปลอม
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/orders', isReady: true }),
}))

const ROWS = {
  payments: [
    { chargeId: 'chg_1', orderId: '0000000001', packageCode: 'QI_200', tierCode: 'QI', amountSatang: 5900, method: 'promptpay', status: 'APPROVED', failureCode: null, createdAt: '2026-09-03T04:00:00.000Z' },
    { chargeId: 'chg_2', orderId: '0000000002', packageCode: 'V2_PRO_YEARLY', tierCode: 'PRO', amountSatang: 159000, method: 'card', status: 'REJECT', failureCode: 'gateway_expired', createdAt: '2026-09-01T04:00:00.000Z' },
  ],
}

let rowsPayload: unknown = ROWS
let rowsOk = true
const fetchMock = vi.fn(async (url: string) => {
  if (String(url).includes('/api/v2/payment/status')) {
    return { ok: rowsOk, status: rowsOk ? 200 : 500, json: async () => rowsPayload }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import OrdersScreen from '@/features/v2-account/components/OrdersScreen'
import OrderReceiptScreen from '@/features/v2-account/components/OrderReceiptScreen'

beforeEach(() => {
  rowsPayload = ROWS
  rowsOk = true
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอประวัติคำสั่งซื้อ (order-history)', () => {
  it('O1/O2 โชว์ทุกแถว: แพ็กชี่ + สถานะตามจริง (สำเร็จ/ไม่สำเร็จ)', async () => {
    render(<CookiesProvider><OrdersScreen /></CookiesProvider>)
    await waitFor(() => expect(screen.getAllByTestId('orders-row').length).toBe(2))
    expect(screen.getByText('แพ็กชี่ 200 ชี่')).toBeTruthy()
    expect(screen.getByText('Mumate Pro (สมาชิกรายปี)')).toBeTruthy()
    expect(screen.getByText('สำเร็จ')).toBeTruthy()
    expect(screen.getByText('ไม่สำเร็จ')).toBeTruthy()
    // ยอด/วันที่อยู่ในบรรทัดเดียวกัน — ตรวจจาก textContent ของแถวแรก (แพ็กชี่)
    expect(screen.getAllByTestId('orders-row')[0].textContent).toContain('฿59')
    // แถวเป็นลิงก์เข้าใบเสร็จ
    expect(screen.getAllByTestId('orders-row')[0].getAttribute('href')).toBe('/v2/orders/chg_1')
  })

  it('ไม่มีคำสั่งซื้อ → empty + ทางไปร้าน ❌ error', async () => {
    rowsPayload = { payments: [] }
    render(<CookiesProvider><OrdersScreen /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('orders-empty')).toBeTruthy())
    expect(screen.queryByTestId('orders-error')).toBeNull()
  })

  it('อ่านล้ม → error + ลองใหม่ ❌ "ยังไม่มีคำสั่งซื้อ"', async () => {
    rowsOk = false
    render(<CookiesProvider><OrdersScreen /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('orders-error')).toBeTruthy())
    expect(screen.queryByTestId('orders-empty')).toBeNull()
  })
})

describe('จอใบเสร็จ (order-receipt)', () => {
  it('เจอแถวด้วย chargeId → โชว์ยอด/วิธีชำระ/เลขที่ + สถานะตามจริง', async () => {
    render(<CookiesProvider><OrderReceiptScreen id="chg_1" /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('receipt-card')).toBeTruthy())
    expect(screen.getByTestId('receipt-title').textContent).toBe('แพ็กชี่ 200 ชี่')
    expect(screen.getByTestId('receipt-amount').textContent).toBe('฿59')
    expect(screen.getByTestId('receipt-method').textContent).toBe('พร้อมเพย์ QR')
    expect(screen.getByTestId('receipt-order').textContent).toBe('0000000001')
    expect(screen.getByTestId('receipt-status').textContent).toBe('สำเร็จ')
  })

  it('REJECT มี failureCode → ใบเสร็จพูดว่าไม่สำเร็จ ❌ ซื้อสำเร็จ', async () => {
    render(<CookiesProvider><OrderReceiptScreen id="chg_2" /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('receipt-status').textContent).toBe('ไม่สำเร็จ'))
    expect(screen.getByTestId('receipt-failure').textContent).toContain('gateway_expired')
  })

  it('O3 id ไม่ตรงแถวใด → "ไม่พบรายการนี้ในบัญชี" ❌ ใบเสร็จปลอม', async () => {
    render(<CookiesProvider><OrderReceiptScreen id="chg_nope" /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('receipt-not-found')).toBeTruthy())
    expect(screen.queryByTestId('receipt-card')).toBeNull()
  })
})
