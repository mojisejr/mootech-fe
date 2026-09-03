// scripts/missions-screen.test.tsx — จอภารกิจ (/v2/qi/missions, ก้อน 1.2) — จอเป็นกระจกของ
// GET /api/missions ของ engine เท่านั้น: ความคืบหน้า/สถานะรางวัลต้องตามข้อมูล ไม่เดาเอง
// ❌ การอ่านล้ม (500) ต้องไม่ถูก render เป็น "ภารกิจ 0/1" — error ต้องแยกจากข้อมูลจริง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi/missions', isReady: true }),
}))

const BOARD = {
  anonId: '11111111-1111-1111-1111-111111111111',
  date: '2026-09-03',
  missions: [
    {
      id: 'checkin_mu', title: 'ภารกิจเช็คอินมู', description: 'เช็คอินสถานที่มงคลตามคำแนะนำประจำวัน',
      period: 'daily', target: 1, rewardCoins: 50, rewardXp: 20, count: 1, completed: true,
      claimedAt: '2026-09-03T02:00:00.000Z',
    },
    {
      id: 'send_energy', title: 'ส่งพลังใจให้เพื่อน', description: 'แบ่งปันพลังงานบวกให้เพื่อน 5 คน',
      period: 'daily', target: 5, rewardCoins: 120, rewardXp: 40, count: 2, completed: false, claimedAt: null,
    },
    {
      id: 'streak_7', title: 'สายมู 7 วัน', description: 'เข้าใช้งานแอป Mumate ติดต่อกัน 7 วัน',
      period: 'once', target: 7, rewardCoins: 500, rewardXp: 200, count: 0, completed: false, claimedAt: null,
    },
  ],
}

let boardStatus = 200
const fetchMock = vi.fn(async (url: string) => {
  if (String(url).includes('/api/missions')) {
    return { ok: boardStatus === 200, status: boardStatus, json: async () => BOARD }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import MissionsScreen from '@/features/v2-qi/components/MissionsScreen'

beforeEach(() => {
  boardStatus = 200
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอภารกิจ — กระจกของ GET /api/missions', () => {
  it('โชว์ภารกิจครบทุกแถว ตามความคืบหน้า/สถานะที่ engine บอก', async () => {
    render(<MissionsScreen />)
    await waitFor(() => expect(screen.getByTestId('mission-checkin_mu')).toBeTruthy())
    // ครบเป้า + จ่ายรางวัลแล้ว (claimedAt มีค่า)
    expect(screen.getByTestId('mission-state-checkin_mu').textContent).toContain('รับรางวัลแล้ว')
    expect(screen.getByTestId('mission-progress-checkin_mu').style.width).toBe('100%')
    // ยังไม่ครบ — โชว์ตัวเลข count/target ตามจริง
    expect(screen.getByTestId('mission-state-send_energy').textContent).toBe('2/5')
    expect(screen.getByTestId('mission-progress-send_energy').style.width).toBe('40%')
    // ภารกิจระยะยาว (once) ก็โชว์ + รางวัลเหรียญตาม engine
    expect(screen.getByText('สายมู 7 วัน')).toBeTruthy()
    expect(screen.getByText('+500 เหรียญ')).toBeTruthy()
    // ป้ายรอบ (daily/once) — daily มี 2 แถว
    expect(screen.getAllByText('ทุกวัน').length).toBe(2)
    expect(screen.getByText('จบครั้งเดียว')).toBeTruthy()
  })

  it('engine ล้ม (500) → จอโชว์ error + ปุ่มลองใหม่ ❌ ไม่โชว์ภารกิจเป็น 0', async () => {
    boardStatus = 500
    render(<MissionsScreen />)
    await waitFor(() => expect(screen.getByTestId('missions-error')).toBeTruthy())
    expect(screen.getByText('โหลดภารกิจไม่สำเร็จ')).toBeTruthy()
    expect(screen.queryByTestId('mission-checkin_mu')).toBeNull()
  })

  it('ไม่ล็อกอิน (401) → การ์ดเข้าสู่ระบบ ไม่ใช่ error', async () => {
    boardStatus = 401
    render(<MissionsScreen />)
    await waitFor(() => expect(screen.getByTestId('missions-guard-auth')).toBeTruthy())
  })
})
