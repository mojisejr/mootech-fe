// scripts/missions-screen.test.tsx — จอภารกิจ (/v2/qi/missions, ก้อน 1.2) — จอเป็นกระจกของ
// GET /api/missions (missions + goals) ของ engine + /api/qi-wallet (ยอด+เช็คอิน).
// ❌ การอ่านล้ม (500) ต้องไม่ถูก render เป็นภารกิจว่าง — error ต้องแยกจากข้อมูลจริง
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
    { id: 'read_fortune', title: 'อ่านดวงวันนี้', description: 'เปิดอ่านคำทำนายประจำวันให้จบ', period: 'daily', category: 'daily', target: 1, rewardCoins: 5, rewardXp: 10, count: 0, completed: false, claimedAt: null, actionHref: '/v2' },
    { id: 'share_fortune', title: 'แชร์ดวงวันนี้', description: 'แชร์ได้วันละ 1 ครั้ง', period: 'daily', category: 'daily', target: 1, rewardCoins: 10, rewardXp: 15, count: 0, completed: false, claimedAt: null, actionHref: '/v2/qi/referral' },
    { id: 'first_reading', title: 'ดูดวงครั้งแรก', description: 'ลองใช้บริการดูดวง', period: 'once', category: 'once', target: 1, rewardCoins: 60, rewardXp: 30, count: 1, completed: true, claimedAt: '2026-09-03T02:00:00.000Z', actionHref: '/v2' },
    { id: 'streak_7', title: 'เช็คอิน 7 วันติด', description: 'นับใหม่ทุกสัปดาห์', period: 'once', category: 'longterm', target: 7, rewardCoins: 30, rewardXp: 40, count: 4, completed: false, claimedAt: null },
  ],
  goals: {
    referral: { invited: 3, rewardPerInviteQi: 50, earnedQi: 150 },
    element: {
      target: 5, collected: 3, bonusQi: 1000,
      elements: [
        { key: 'wood', collected: true }, { key: 'metal', collected: true }, { key: 'fire', collected: true },
        { key: 'earth', collected: false }, { key: 'water', collected: false },
      ],
    },
  },
}
const WALLET = { anonId: BOARD.anonId, qi: 590, coins: 0, xp: 40, level: 1, history: [] }

let boardStatus = 200
const fetchMock = vi.fn(async (url: string) => {
  const u = String(url)
  if (u.includes('/api/missions')) return { ok: boardStatus === 200, status: boardStatus, json: async () => BOARD }
  if (u.includes('/api/qi-wallet')) return { ok: true, status: 200, json: async () => WALLET }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import MissionsScreen from '@/features/v2-qi/components/MissionsScreen'

beforeEach(() => {
  boardStatus = 200
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอภารกิจ — กระจกของ GET /api/missions + goals', () => {
  it('โชว์ 3 กลุ่ม + ปุ่มทำเลย + progress + เป้า referral/5 ธาตุ ตาม engine', async () => {
    render(<MissionsScreen />)
    await waitFor(() => expect(screen.getByTestId('mission-read_fortune')).toBeTruthy())

    // ยอด QI บนหัวจอ (จาก wallet)
    expect(screen.getByTestId('missions-balance').textContent).toBe('590 QI')

    // กลุ่มครบ 3
    expect(screen.getByText('ทำได้ทุกวัน')).toBeTruthy()
    expect(screen.getByText('ทำครั้งเดียวจบ')).toBeTruthy()
    expect(screen.getByText('เป้าหมายระยะยาว')).toBeTruthy()

    // ยังไม่เสร็จ + มี actionHref → ปุ่ม "ทำเลย" ลิงก์ถูก
    expect(screen.getByTestId('mission-read_fortune-cta').getAttribute('href')).toBe('/v2')
    // เสร็จ + จ่ายรางวัลแล้ว → "รับแล้ว"
    expect(screen.getByTestId('mission-first_reading-state').textContent).toContain('รับแล้ว')
    // ระยะยาว (target>1) → progress bar 4/7 = 57%
    expect(screen.getByTestId('mission-streak_7-progress').style.width).toBe('57%')

    // รางวัลเป็น QI (ไม่ใช่เหรียญ)
    expect(screen.getByText('+60 QI')).toBeTruthy()
    expect(screen.getByText('+30 QI')).toBeTruthy()

    // เป้า referral + 5 ธาตุ
    expect(screen.getByTestId('mission-goal-referral').textContent).toContain('ชวนสำเร็จแล้ว 3 คน')
    expect(screen.getByTestId('mission-goal-referral').textContent).toContain('150 QI')
    expect(screen.getByTestId('mission-goal-element').textContent).toContain('เก็บได้ 3 จาก 5 ธาตุ')
    expect(screen.getByTestId('mission-goal-element').textContent).toContain('+1,000 QI')
  })

  it('engine ล้ม (500) → จอโชว์ error + ปุ่มลองใหม่ ❌ ไม่โชว์ภารกิจ', async () => {
    boardStatus = 500
    render(<MissionsScreen />)
    await waitFor(() => expect(screen.getByTestId('missions-error')).toBeTruthy())
    expect(screen.getByText('โหลดภารกิจไม่สำเร็จ')).toBeTruthy()
    expect(screen.queryByTestId('mission-read_fortune')).toBeNull()
  })

  it('ไม่ล็อกอิน (401) → การ์ดเข้าสู่ระบบ ไม่ใช่ error', async () => {
    boardStatus = 401
    render(<MissionsScreen />)
    await waitFor(() => expect(screen.getByTestId('missions-guard-auth')).toBeTruthy())
  })
})
