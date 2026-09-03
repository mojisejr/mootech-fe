// scripts/qi-history-screen.test.tsx — จอประวัติชี่ (/v2/qi/history, ก้อน 1.3)
//
// 🔴 บทเรียน #365: การอ่านล้มต้องไม่ถูก render เป็น "ยังไม่มีรายการ" — สถานะ error แยกจาก empty เสมอ
// แถวประวัติต้องแปลง reason ดิบเป็นข้อความไทย (ภารกิจใช้ชื่อจริงจาก GET /api/missions)
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi/history', isReady: true }),
}))

const WALLET = {
  anonId: '11111111-1111-1111-1111-111111111111',
  qi: 45, coins: 350, xp: 120, level: 2,
  history: [
    { id: 3, qiDelta: 50, reason: 'mission:checkin_mu', createdAt: '2026-09-03T02:00:00.000Z' },
    { id: 2, qiDelta: -30, reason: 'qi:spend:chat_question', createdAt: '2026-09-02T10:00:00.000Z' },
    { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: '2026-09-02T01:30:00.000Z' },
  ],
}
const BOARD = { anonId: WALLET.anonId, date: '2026-09-03', missions: [{ id: 'checkin_mu', title: 'ภารกิจเช็คอินมู' }] }

let walletStatus = 200
let walletPayload: unknown = WALLET
const fetchMock = vi.fn(async (url: string) => {
  const u = String(url)
  if (u.includes('/api/qi-wallet')) {
    // ต้องขอ history=100 (ประวัติเต็ม) — ถ้า BFF เปลี่ยนพารามิเตอร์จนหาย ต้องแดงที่นี่
    if (!u.includes('history=100')) return { ok: false, status: 500, json: async () => ({}) }
    return { ok: walletStatus === 200, status: walletStatus, json: async () => walletPayload }
  }
  if (u.includes('/api/missions')) return { ok: true, status: 200, json: async () => BOARD }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import QiHistoryScreen from '@/features/v2-qi/components/QiHistoryScreen'

beforeEach(() => {
  walletStatus = 200
  walletPayload = WALLET
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอประวัติชี่', () => {
  it('โชว์ยอดรวม + ทุกแถวเป็นข้อความไทย เครื่องหมายตาม qiDelta', async () => {
    render(<QiHistoryScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-history-list')).toBeTruthy())
    expect(screen.getByTestId('qi-history-total').textContent).toBe('45 ชี่')
    // mission:<id> แปลงเป็นชื่อจริงจาก board
    expect(screen.getByText('ภารกิจเช็คอินมู')).toBeTruthy()
    expect(screen.getByText('แลก ถาม AI')).toBeTruthy()
    expect(screen.getByText('เช็คอินรายวัน')).toBeTruthy()
    // บวก/ลบตาม ledger
    const deltas = screen.getAllByTestId('qi-history-delta').map((el) => el.textContent)
    expect(deltas).toEqual(['+50 ชี่', '-30 ชี่', '+5 ชี่'])
  })

  it('ประวัติว่างจริง (engine ตอบ []) → โชว์ empty ไม่ใช่ error', async () => {
    walletPayload = { ...WALLET, history: [] }
    render(<QiHistoryScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-history-empty')).toBeTruthy())
    expect(screen.queryByTestId('qi-history-error')).toBeNull()
  })

  it('อ่านล้ม (500) → error + ลองใหม่ ❌ ไม่พูดว่ายังไม่มีรายการ', async () => {
    walletStatus = 500
    render(<QiHistoryScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-history-error')).toBeTruthy())
    expect(screen.queryByTestId('qi-history-empty')).toBeNull()
  })

  it('ไม่ล็อกอิน (401) → การ์ดเข้าสู่ระบบ', async () => {
    walletStatus = 401
    render(<QiHistoryScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-history-guard-auth')).toBeTruthy())
  })
})
