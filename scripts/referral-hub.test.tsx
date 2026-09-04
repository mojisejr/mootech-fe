// scripts/referral-hub.test.tsx — จอชวนเพื่อนเต็ม (/v2/qi/referral, ก้อน 5.1)
//
// 🔴 MUTANT CONTRACT:
//   R1 ลิงก์แชร์ LINE ต้องพาไป /invite/<โค้ดจริงของผู้ใช้> ❌ โค้ดคนอื่น/โค้ดว่าง
//   R2 ใช้โค้ดเพื่อนสำเร็จ/ล้ม → ข้อความต้องตรงสิ่งที่ engine ตอบ (409 ใช้โค้ดตัวเอง ไม่ใช่ "สำเร็จ")
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi/referral', isReady: true }),
}))

const REFERRAL = { anonId: 'u', code: 'MUMATE725', inviteUrl: 'mumate.com/invite/MUMATE725', invitedCount: 2, rewardPerInvite: 250 }
const CATALOG = {
  earn: [
    { code: 'referral_free', qi: 50, limit: 'per_referral', title: 'ชวนเพื่อนสมัครฟรี', note: 'ผู้ถูกชวนสมัครบัญชีฟรีสำเร็จ' },
    { code: 'referral_plus', qi: 500, limit: 'per_referral', title: 'ชวนเพื่อนอัปเกรด PLUS', note: 'ผู้ถูกชวนอัปเกรด PLUS' },
    { code: 'referral_pro', qi: 1000, limit: 'per_referral', title: 'ชวนเพื่อนอัปเกรด PRO', note: 'ผู้ถูกชวนอัปเกรด PRO' },
  ],
  spend: [],
}

let referralStatus = 200
let applyStatus = 200
let applyPayload: Record<string, unknown> = { redeemed: 'MUMATE111', referrerReward: { coins: 250 }, refereeReward: { coins: 100 } }
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/referral') && (init?.method ?? 'GET') === 'GET') {
    return { ok: referralStatus === 200, status: referralStatus, json: async () => REFERRAL }
  }
  if (u.includes('/api/referral')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as { code?: string }
    if (body.code === REFERRAL.code) {
      // engine: ใช้โค้ดตัวเอง → 409 "ใช้โค้ดของตัวเองไม่ได้"
      return { ok: false, status: 409, json: async () => ({ error: 'ใช้โค้ดของตัวเองไม่ได้' }) }
    }
    return { ok: applyStatus === 200, status: applyStatus, json: async () => applyPayload }
  }
  if (u.includes('/api/qi-catalog')) return { ok: true, status: 200, json: async () => CATALOG }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import ReferralHubScreen from '@/features/v2-qi/components/ReferralHubScreen'

beforeEach(() => {
  referralStatus = 200
  applyStatus = 200
  applyPayload = { redeemed: 'MUMATE111', referrerReward: { coins: 250 }, refereeReward: { coins: 100 } }
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอชวนเพื่อน (referral hub)', () => {
  it('โชว์โค้ด + จำนวนเพื่อน (ชวนสำเร็จ) + ยอดที่ได้รับเป็น QI (50 QI/คน)', async () => {
    render(<ReferralHubScreen />)
    await waitFor(() => expect(screen.getByTestId('referral-code').textContent).toBe('MUMATE725'))
    expect(screen.getByTestId('referral-invited-count').textContent).toBe('2 คน')
    // ได้รับแล้ว = 2 คน × 50 QI = 100 QI (ไม่มี goals จาก missions → คิดจาก invitedCount) — สกุลเงินเป็น QI ไม่ใช่ "เหรียญ"
    expect(screen.getByTestId('referral-per-invite').textContent).toBe('100 QI')
  })

  it('R1 ลิงก์แชร์ LINE ต้องพาไป /invite/MUMATE725 พร้อมข้อความที่มีโค้ด', async () => {
    render(<ReferralHubScreen />)
    const a = await waitFor(() => screen.getByTestId('referral-share-line'))
    const href = decodeURIComponent(a.getAttribute('href') ?? '')
    expect(href).toContain('line.me/R/msg/text/')
    expect(href).toContain('/invite/MUMATE725')
    expect(href).toContain('MUMATE725')
  })

  it('R2 ใช้โค้ดเพื่อนสำเร็จ → ข้อความสำเร็จ · ใช้โค้ดตัวเอง → ข้อความปฏิเสธของ engine', async () => {
    render(<ReferralHubScreen />)
    const input = await waitFor(() => screen.getByTestId('referral-hub-input') as HTMLInputElement)
    fireEvent.change(input, { target: { value: 'MUMATE725' } })
    fireEvent.click(screen.getByTestId('referral-hub-apply'))
    await waitFor(() => expect(screen.getByTestId('referral-hub-msg').textContent).toContain('ใช้โค้ดของตัวเองไม่ได้'))

    fireEvent.change(input, { target: { value: 'MUMATE111' } })
    fireEvent.click(screen.getByTestId('referral-hub-apply'))
    await waitFor(() => expect(screen.getByTestId('referral-hub-msg').textContent).toContain('รับโบนัสสำเร็จ'))
  })

  it('อ่านโค้ดล้ม (500) → error + ลองใหม่', async () => {
    referralStatus = 500
    render(<ReferralHubScreen />)
    await waitFor(() => expect(screen.getByTestId('referral-hub-error')).toBeTruthy())
    expect(screen.queryByTestId('referral-hero')).toBeNull()
  })
})
