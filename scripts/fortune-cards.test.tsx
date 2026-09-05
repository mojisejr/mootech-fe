// scripts/fortune-cards.test.tsx — เสี่ยงไพ่ oracle/divine (CardReadingScreen)
// 🔴 CONTRACT:
//   FC1 intro: 2 ปุ่ม (กดเพื่อเสี่ยงโพ / เลือกเอง 3 ใบ)
//   FC2 เปิดการ์ด: เลือกเอง → กริดครบ deck → แตะ 3 ใบ → เปิด → POST cardNos → ผล 3 ใบ + น้ำหนัก%
//   FC3 หยิบสุ่ม → POST random → ผล
//   FC4 402 → quota ไม่โชว์ผล
//   FC5 น้ำหนักจาก engine (50) แสดง "50%" ไม่ใช่ "5000%"
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/fortune/oracle', isReady: true }),
}))

const CARDS = [
  { no: 11, name: 'ไพ่หนึ่ง', keyword: 'พลัง', meaning: 'สรุปใบหลัก', book1: 'รายละเอียดใบ 1', book2: '', imageUrl: null },
  { no: 22, name: 'ไพ่สอง', keyword: 'สมดุล', meaning: 'm2', book1: 'รายละเอียดใบ 2', book2: '', imageUrl: null },
  { no: 33, name: 'ไพ่สาม', keyword: 'ทิศทาง', meaning: 'm3', book1: 'รายละเอียดใบ 3', book2: '', imageUrl: null },
]
// engine ส่ง weight เป็นเปอร์เซ็นต์ (50/30/20) — จอต้องไม่ *100 ซ้ำ
const SLOTS = [
  { position: 1, weight: 50, role: 'lead', no: 11 },
  { position: 2, weight: 30, role: 'expand1', no: 22 },
  { position: 3, weight: 20, role: 'expand2', no: 33 },
]
const PROSE = 'ไพ่หลัก (น้ำหนัก 50%) — ...\n\nขยายชุดที่ 1 (30%) — ...\n\nขยายชุดที่ 2 (20%) — ...'

let predictStatus = 200
let lastBody: Record<string, unknown> = {}
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/fortune/oracle')) {
    lastBody = JSON.parse(String(init?.body ?? '{}'))
    return predictStatus === 200
      ? { ok: true, status: 200, json: async () => ({ source: 'engine', cards: CARDS, slots: SLOTS, engineProse: PROSE }) }
      : { ok: false, status: 402, json: async () => ({ error: { message: 'quota' } }) }
  }
  if (u.includes('/api/qi-earn')) return { ok: true, status: 200, json: async () => ({ ok: true }) }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import { CardReadingScreen } from '@/features/v2-fortune/components/CardReadingScreen'

const renderOracle = () =>
  render(
    <CardReadingScreen mode="oracle" title="เสี่ยงไพ่ออราเคิลเคี้ยงคุง" resultTitle="ผลไพ่ออราเคิล" introArt="/x.png" endpoint="/api/fortune/oracle" deckCount={12} />,
  )

beforeEach(() => { predictStatus = 200; lastBody = {}; fetchMock.mockClear() })
afterEach(() => cleanup())

describe('เสี่ยงไพ่ (oracle/divine)', () => {
  it('FC1 intro: 2 ปุ่ม เสี่ยงโพ / เลือกเอง 3 ใบ', () => {
    renderOracle()
    expect(screen.getByTestId('cards-random').textContent).toContain('กดเพื่อเสี่ยงโพ')
    expect(screen.getByTestId('cards-goto-pick').textContent).toContain('เลือกเอง 3 ใบ')
  })

  it('FC2 เปิดการ์ด: เลือกเอง → กริด → แตะ 3 → เปิด → POST cardNos(3) → ผล 3 ใบ', async () => {
    renderOracle()
    fireEvent.click(screen.getByTestId('cards-goto-pick'))
    expect(screen.getByTestId('cards-pick')).toBeTruthy()
    // กริด = deckCount ใบ
    expect(screen.getAllByTestId(/^cards-tile-/).length).toBe(12)
    fireEvent.click(screen.getByTestId('cards-tile-0'))
    fireEvent.click(screen.getByTestId('cards-tile-1'))
    fireEvent.click(screen.getByTestId('cards-tile-2'))
    expect(screen.getByTestId('cards-pick-count').textContent).toContain('3/3')
    const open = screen.getByTestId('cards-open') as HTMLButtonElement
    expect(open.disabled).toBe(false)
    fireEvent.click(open)
    await waitFor(() => expect(screen.getByTestId('cards-result')).toBeTruthy(), { timeout: 3000 })
    // ส่ง cardNos ครบ 3
    expect(Array.isArray(lastBody.cardNos)).toBe(true)
    expect((lastBody.cardNos as number[]).length).toBe(3)
    // ผลมี 3 ใบ + สรุป
    expect(screen.getByTestId('cards-summary').textContent).toContain('สรุปใบหลัก')
    expect(screen.getByText('#11 ไพ่หนึ่ง · พลัง')).toBeTruthy()
  })

  it('FC3 หยิบสุ่ม → POST random → ผล', async () => {
    renderOracle()
    fireEvent.click(screen.getByTestId('cards-random'))
    await waitFor(() => expect(screen.getByTestId('cards-result')).toBeTruthy(), { timeout: 3000 })
    expect(lastBody.random).toBe(true)
  })

  it('FC4 402 → quota ไม่โชว์ผล', async () => {
    predictStatus = 402
    renderOracle()
    fireEvent.click(screen.getByTestId('cards-random'))
    await waitFor(() => expect(screen.getByTestId('cards-quota')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByTestId('cards-result')).toBeNull()
  })

  it('FC5 น้ำหนัก 50 จาก engine → แสดง "50%" ไม่ใช่ "5000%"', async () => {
    renderOracle()
    fireEvent.click(screen.getByTestId('cards-random'))
    await waitFor(() => expect(screen.getByTestId('cards-result')).toBeTruthy(), { timeout: 3000 })
    const result = screen.getByTestId('cards-result')
    expect(within(result).getAllByText(/น้ำหนัก 50%/).length).toBeGreaterThan(0)
    expect(within(result).queryByText(/5000%/)).toBeNull()
  })
})
