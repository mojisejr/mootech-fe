// scripts/qi-screen.test.tsx — จอ "คู่มือพลังชี่" (/v2/qi) = read-mostly guide (เฟรม 55399:7219):
//   earn list = ข้อมูล (ไม่มีปุ่มรับรายบรรทัด — รับจริงที่เช็คอิน/ภารกิจ) · spend list = แตะเพื่อแลก (ชีตยืนยัน)
//   · ปุ่มท้าย = เช็คอิน/ภารกิจ · ลิงก์ออกจอย่อย missions/history/referral
//
// 🔴 MUTANT CONTRACT:
//   Q1 เช็คอินแล้ววันนี้ → ปุ่มท้ายเป็นลิงก์ (ไม่ยิง POST ซ้ำ); ยังไม่เช็คอิน → กดยิง daily_login
//   Q2 earn list เป็นข้อมูลล้วน — ห้ามมีปุ่ม "รับ" รายบรรทัด (รับจริงที่จอเช็คอิน/ภารกิจ)
//   Q3 ชี่ไม่พอ → เปิด InsufficientQiSheet ❌ ยิง spend ให้ engine ตบ 409
//   Q4 แลกสำเร็จ → ยอดชี่อัปเดตตามค่าที่ engine ตอบ
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/qi', isReady: true }),
}))

// ตัดรอบ "วันนี้" ที่ 2026-09-03 (ไทย) — กันเทสต์เฟลตอนรันข้ามเที่ยงคืน
vi.mock('@/features/v2-qi/qi-model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/v2-qi/qi-model')>()
  return { ...actual, todayBangkok: () => '2026-09-03' }
})

// catalog ตรงจาก engine (src/lib/bazi/qi/catalog.ts) — จอห้าม hardcode ราคาทับ
const CATALOG = {
  earn: [
    { code: 'signup', qi: 50, limit: 'once', title: 'สมัครใหม่', note: 'โบนัสตั้งต้นครั้งแรกที่สมัครบัญชี — ได้ครั้งเดียวตลอดชีพ' },
    { code: 'daily_login', qi: 5, limit: 'daily', title: 'เข้าใช้งานรายวัน', note: 'ล็อกอิน/เปิดแอปในแต่ละวัน — รับได้วันละ 1 ครั้ง' },
    { code: 'share', qi: 10, limit: 'daily', title: 'แชร์คอนเทนต์', note: 'แชร์เนื้อหาออกโซเชียล — เพดานวันละ 1 ครั้ง' },
    { code: 'referral_free', qi: 50, limit: 'per_referral', title: 'ชวนเพื่อนสมัครฟรี', note: 'ผู้ถูกชวนสมัครบัญชีฟรีสำเร็จ — ผู้ชวนได้ 50 Qi ต่อ 1 คน' },
    { code: 'referral_pro', qi: 1000, limit: 'per_referral', title: 'ชวนเพื่อนอัปเกรด PRO', note: 'ผู้ถูกชวนอัปเกรดแพ็กเกจ PRO (1,590.-) — ผู้ชวนได้ 1,000 Qi ต่อ 1 คน' },
  ],
  spend: [
    { code: 'card_use', qi: 10, grant: { type: 'credit', kind: 'card_use', credits: 1 }, title: 'เปิดการ์ด/เสี่ยงทาย +1 ครั้ง', note: 'แลกสิทธิ์เปิดไพ่/เสี่ยงทายเพิ่ม 1 ครั้ง (divine/oracle/fortune-sage)' },
    { code: 'chat_question', qi: 30, grant: { type: 'credit', kind: 'chat_question', credits: 1 }, title: 'ถาม AI +1 คำถาม', note: 'แลกสิทธิ์ถามแชท AI เพิ่ม 1 คำถาม' },
    { code: 'matching_slot', qi: 150, grant: { type: 'credit', kind: 'matching_slot', credits: 1 }, title: '+1 ช่องจับคู่สมพงษ์ (ถาวร)', note: 'เพิ่มช่องบันทึกดวงสำหรับจับคู่/สมพงษ์อย่างถาวร 1 ช่อง' },
  ],
}
const REFERRAL = { anonId: 'u', code: 'MUMATE725', inviteUrl: 'mumate.com/invite/MUMATE725', invitedCount: 2, rewardPerInvite: 50 }

let walletQi = 25
let walletHistory: Array<{ id: number; qiDelta: number; reason: string; createdAt: string }> = []
let earnStatus = 200
let earnPayload: Record<string, unknown> = { capped: false, awarded: true, qi: 5 }
let spendStatus = 200
let spendPayload: Record<string, unknown> = { code: 'card_use', spentQi: 10, qi: 15 }

const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  const method = init?.method ?? 'GET'
  if (u.includes('/api/qi-wallet')) {
    return {
      ok: true, status: 200,
      json: async () => ({ anonId: 'u', qi: walletQi, coins: 100, xp: 40, level: 1, history: walletHistory }),
    }
  }
  if (u.includes('/api/qi-catalog')) return { ok: true, status: 200, json: async () => CATALOG }
  if (u.includes('/api/referral') && method === 'GET') return { ok: true, status: 200, json: async () => REFERRAL }
  if (u.includes('/api/qi-earn')) return { ok: earnStatus === 200, status: earnStatus, json: async () => earnPayload }
  if (u.includes('/api/qi-spend')) {
    // จำลองฝั่ง engine เปลี่ยนยอดจริง: สำเร็จ → หักตาม spentQi · 409 → ยอดจริงเหลือ 5 (จอ stale)
    walletQi = spendStatus === 200 ? Number(spendPayload.qi ?? walletQi) : 5
    return { ok: spendStatus === 200, status: spendStatus, json: async () => spendPayload }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import QiScreen from '@/features/v2-qi/components/QiScreen'

const posts = () => fetchMock.mock.calls.filter((c) => (c[1]?.method ?? 'GET') === 'POST' && String(c[0]).includes('/api/qi-'))
const postBodies = () => posts().map((c) => JSON.parse(String(c[1]?.body)))

beforeEach(() => {
  walletQi = 25
  walletHistory = []
  earnStatus = 200
  earnPayload = { capped: false, awarded: true, qi: 5 }
  spendStatus = 200
  spendPayload = { code: 'card_use', spentQi: 10, qi: 15 }
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('เช็คอินจากปุ่มท้ายคู่มือ (ก้อน 1.4)', () => {
  it('ยังไม่เช็คอิน → ปุ่มท้ายกดแล้วยิง POST /api/qi-earn code=daily_login', async () => {
    render(<QiScreen />)
    const btn = await waitFor(() => screen.getByTestId('qi-cta-checkin'))
    expect(btn.tagName).toBe('BUTTON')
    fireEvent.click(btn)
    await waitFor(() => expect(postBodies()).toContainEqual({ code: 'daily_login' }))
  })

  it('Q1 เช็คอินแล้ววันนี้ → ปุ่มท้ายเป็นลิงก์ไปภารกิจ ไม่ยิง POST', async () => {
    walletHistory = [{ id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: '2026-09-02T18:30:00.000Z' }]
    render(<QiScreen />)
    const cta = await waitFor(() => screen.getByTestId('qi-cta-checkin'))
    expect(cta.tagName).toBe('A')
    expect(cta.getAttribute('href')).toBe('/v2/qi/missions')
    await waitFor(() => expect(posts().length).toBe(0))
  })
})

describe('คู่มือ earn/spend + ทางเข้าจอย่อย (ก้อน 1.1)', () => {
  it('Q2 earn list เป็นข้อมูลล้วน (ไม่มีปุ่ม "รับ") + จำนวนจาก engine', async () => {
    render(<QiScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-earn-signup')).toBeTruthy())
    expect(screen.getByTestId('qi-earn-signup').textContent).toContain('+50 QI')
    expect(screen.getByTestId('qi-earn-referral_pro').textContent).toContain('+1,000 QI')
    // คู่มือ = อ่านอย่างเดียว: ห้ามมีปุ่ม "รับ" รายบรรทัด (รับจริงที่เช็คอิน/ภารกิจ)
    expect(screen.queryAllByRole('button', { name: 'รับ' }).length).toBe(0)
  })

  it('ทางเข้าจอย่อย: ภารกิจ / ประวัติ / ชวนเพื่อน', async () => {
    render(<QiScreen />)
    await waitFor(() => expect(screen.getByTestId('qi-missions-link')).toBeTruthy())
    expect(screen.getByTestId('qi-missions-link').getAttribute('href')).toBe('/v2/qi/missions')
    expect(screen.getByTestId('qi-history-link').getAttribute('href')).toBe('/v2/qi/history')
    expect(screen.getByTestId('qi-referral-link').getAttribute('href')).toBe('/v2/qi/referral')
  })
})

describe('ชีตใช้ชี่ / ชี่ไม่พอ (ก้อน 1.5)', () => {
  it('Q3 ชี่ไม่พอ (25 < 150) → เปิดชีตชี่ไม่พอบอกยอดขา ❌ ไม่ยิง /api/qi-spend', async () => {
    render(<QiScreen />)
    const btn = await waitFor(() => screen.getByTestId('qi-redeem-matching_slot'))
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('qi-insufficient-title')).toBeTruthy())
    expect(screen.getByTestId('qi-insufficient-title').textContent).toContain('ขาดอีก 125 QI')
    expect(screen.getByTestId('qi-insufficient-share').getAttribute('href')).toBe('/v2/qi/missions')
    expect(posts().filter((c) => String(c[0]).includes('qi-spend')).length).toBe(0)
  })

  it('Q4 ชี่พอ → ชีตยืนยัน แสดงราคา/ยอดคงเหลือ → ยืนยันแล้วยอดอัปเดตตาม engine ตอบ', async () => {
    render(<QiScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('qi-redeem-card_use')))
    await waitFor(() => expect(screen.getByTestId('qi-spend-title')).toBeTruthy())
    expect(screen.getByTestId('qi-spend-price').textContent).toContain('10 QI')
    expect(screen.getByTestId('qi-spend-breakdown').textContent).toContain('15 QI')
    fireEvent.click(screen.getByTestId('qi-spend-confirm'))
    await waitFor(() =>
      expect(postBodies().filter((b) => b.code === 'card_use').length).toBe(1),
    )
    // ยอดบนการ์ดเปลี่ยนเป็นค่าที่ engine ตอบ (qi=15)
    await waitFor(() => expect(screen.getByTestId('qi-balance').textContent).toContain('15'))
  })

  it('engine ตอบ 409 (แต้มไม่พอช่วงยิงจริง) → เปลี่ยนเป็นชีตชี่ไม่พอ + ดึงยอดจริงมาโชว์ยอดขา', async () => {
    walletQi = 40 // ยอดบนจอพอ (40 ≥ 10) — แต่ engine เห็นยอดจริง 5 → 409
    spendStatus = 409
    spendPayload = { error: 'แต้ม Qi ไม่พอ' }
    render(<QiScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('qi-redeem-card_use')))
    await waitFor(() => expect(screen.getByTestId('qi-spend-title')).toBeTruthy())
    fireEvent.click(screen.getByTestId('qi-spend-confirm'))
    await waitFor(() => expect(screen.getByTestId('qi-insufficient-title')).toBeTruthy())
    // onInsufficient reload ยอด → โชว์ยอดขาตามยอดจริงล่าสุด (10 - 5)
    await waitFor(() => expect(screen.getByTestId('qi-insufficient-title').textContent).toContain('ขาดอีก 5 QI'))
  })
})
