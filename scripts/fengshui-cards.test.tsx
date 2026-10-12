// scripts/fengshui-cards.test.tsx — ไพ่อาถรรพ์ฮวงจุ้ย (FengshuiScreen) · ซินแสนุ้ย 2026-10-07
// 🔴 CONTRACT:
//   FG1 intro: ปุ่มสุ่ม 3 ใบ / 1 ใบ ใช้ได้โดยไม่ต้องพิมพ์คำถาม
//   FG2 สุ่ม 3 → POST /api/fortune/fengshui {count:3, persona} → ผล 3 ใบ พร้อมรูปไพ่
//   FG3 มีคำถาม → ส่ง question + แสดง "สรุปคำทำนายนี้" (summary แบบไพ่อื่น ไม่ใช่แบบแชท) ก่อนรายใบ
//   FG4 สุ่ม 1 → count:1 → ผล 1 ใบ
//   FG5 402 → โควตาหมด + ปุ่มแลก QI (ไม่โชว์ผล) → แลกแล้วเปิดต่อได้
//   FG6 พักบริการ (owner 2026-10-12, mumate-fengshui-hold-001): ไม่มีการ์ดในฮับ · เข้า URL ตรงแล้วถูกส่งไป coming-soon
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ userId: 'test-user-id', status: 'authed' }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/fortune/fengshui', isReady: true }),
}))

const CARDS = [
  { no: 1, name: 'กระจกซ้อนกัน', meaning: 'ความหมาย 1', caution: 'ระวัง 1', advice: 'แก้ 1', imageUrl: 'https://img.example/1.jpg' },
  { no: 11, name: 'แจกันดอกไม้', meaning: 'ความหมาย 11', caution: 'ระวัง 11', advice: 'แก้ 11', imageUrl: 'https://img.example/11.jpg' },
  { no: 40, name: 'มังกรเขียว', meaning: 'ความหมาย 40', caution: 'ระวัง 40', advice: 'แก้ 40', imageUrl: 'https://img.example/40.jpg' },
]

let status = 200
let summaryOut: string | undefined
let lastBody: Record<string, unknown> = {}
let spendBodies: Array<Record<string, unknown>> = []
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/fortune/fengshui')) {
    lastBody = JSON.parse(String(init?.body ?? '{}'))
    const count = lastBody.count === 1 ? 1 : 3
    return status === 200
      ? { ok: true, status: 200, json: async () => ({ source: summaryOut ? 'llm' : 'engine', cards: CARDS.slice(0, count), ...(summaryOut ? { summary: summaryOut } : {}) }) }
      : { ok: false, status: 402, json: async () => ({ error: { message: 'quota' } }) }
  }
  if (u.includes('/api/qi-spend')) {
    spendBodies.push(JSON.parse(String(init?.body ?? '{}')))
    status = 200
    return { ok: true, status: 200, json: async () => ({ code: 'card_use', spentQi: 10, qi: 90 }) }
  }
  if (u.includes('/api/qi-wallet')) return { ok: true, status: 200, json: async () => ({ qi: 120 }) }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import { FengshuiScreen } from '@/features/v2-fortune/components/FengshuiScreen'

beforeEach(() => { status = 200; summaryOut = undefined; lastBody = {}; spendBodies = []; fetchMock.mockClear(); try { localStorage.clear() } catch { /* cooldown ต่อเคส */ } })
afterEach(() => cleanup())

describe('ไพ่อาถรรพ์ฮวงจุ้ย (FengshuiScreen)', () => {
  it('FG1 intro: สุ่ม 3 / 1 ใบ กดได้เลยโดยไม่ต้องพิมพ์คำถาม', () => {
    render(<FengshuiScreen />)
    expect((screen.getByTestId('fengshui-draw-3') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('fengshui-draw-1') as HTMLButtonElement).disabled).toBe(false)
  })

  it('FG2 สุ่ม 3 ใบ → POST count:3 → ผล 3 ใบ พร้อมรูปไพ่', async () => {
    render(<FengshuiScreen />)
    fireEvent.click(screen.getByTestId('fengshui-draw-3'))
    await waitFor(() => expect(screen.getByTestId('fengshui-result')).toBeTruthy(), { timeout: 4000 })
    expect(lastBody.count).toBe(3)
    expect(screen.getAllByTestId('fengshui-card').length).toBe(3)
    expect(screen.getByText('แจกันดอกไม้')).toBeTruthy()
    expect(document.querySelector('img[src="https://img.example/40.jpg"]')).toBeTruthy()
    // LLM ไม่ส่งสรุป → ยังมีกล่องสรุป (ใช้ความหมายใบแรก) ไม่ว่าง
    expect(screen.getByTestId('fengshui-summary').textContent).toContain('ความหมาย 1')
  })

  it('FG3 มีคำถาม → ส่ง question + แสดงสรุปคำทำนาย (ไม่ใช่แบบแชท)', async () => {
    summaryOut = 'ห้องนี้ต้องปรับตรงกระจกก่อน'
    render(<FengshuiScreen />)
    fireEvent.change(screen.getByTestId('fengshui-question'), { target: { value: 'ห้องนอนหันทิศตะวันตกดีไหม' } })
    fireEvent.click(screen.getByTestId('fengshui-draw-3'))
    await waitFor(() => expect(screen.getByTestId('fengshui-result')).toBeTruthy(), { timeout: 4000 })
    expect(lastBody.question).toBe('ห้องนอนหันทิศตะวันตกดีไหม')
    const box = screen.getByTestId('fengshui-summary').textContent ?? ''
    expect(box).toContain('สรุปคำทำนายนี้')
    expect(box).toContain('ห้องนี้ต้องปรับตรงกระจกก่อน')
  })

  it('FG4 สุ่ม 1 ใบ → count:1 → ผล 1 ใบ', async () => {
    render(<FengshuiScreen />)
    fireEvent.click(screen.getByTestId('fengshui-draw-1'))
    await waitFor(() => expect(screen.getByTestId('fengshui-result')).toBeTruthy(), { timeout: 4000 })
    expect(lastBody.count).toBe(1)
    expect(screen.getAllByTestId('fengshui-card').length).toBe(1)
  })

  it('FG5 402 → โควตาหมด ไม่โชว์ผล → แลก QI แล้วเปิดต่อ', async () => {
    status = 402
    render(<FengshuiScreen />)
    fireEvent.click(screen.getByTestId('fengshui-draw-3'))
    await waitFor(() => expect(screen.getByTestId('fengshui-quota')).toBeTruthy(), { timeout: 4000 })
    expect(screen.queryByTestId('fengshui-result')).toBeNull()
    fireEvent.click(screen.getByTestId('fengshui-redeem'))
    await waitFor(() => expect(screen.getByTestId('fengshui-result')).toBeTruthy(), { timeout: 4000 })
    expect(spendBodies[0]).toEqual({ code: 'card_use' })
    expect(screen.getAllByTestId('fengshui-card').length).toBe(3)
  })
})

describe('ไพ่อาถรรพ์ฮวงจุ้ย — พักบริการ (FG6)', () => {
  const saved = process.env.V2_PREVIEW_KEY
  beforeEach(() => { delete process.env.V2_PREVIEW_KEY }) // launched gate: every signed-in visitor passes it
  afterEach(() => { if (saved === undefined) delete process.env.V2_PREVIEW_KEY; else process.env.V2_PREVIEW_KEY = saved })

  it('FG6a ฮับไม่โชว์การ์ด แต่ catalog ยังเก็บไว้ (เปิดคืน = ลบ flag เดียว)', async () => {
    const { SERVICES, VISIBLE_SERVICES } = await import('@/features/v2-service/services')
    expect(VISIBLE_SERVICES.some((s) => s.id === 'fengshui-cards')).toBe(false)
    expect(SERVICES.some((s) => s.id === 'fengshui-cards')).toBe(true)
  })

  it('FG6b เข้า /v2/fortune/fengshui ตรง → redirect ไป coming-soon พร้อมชื่อบริการ', async () => {
    const { getServerSideProps } = await import('@/pages/v2/fortune/fengshui')
    const ctx = { req: { cookies: {} }, res: { setHeader: () => {} }, query: {}, resolvedUrl: '/v2/fortune/fengshui' }
    const out = await getServerSideProps(ctx as unknown as Parameters<typeof getServerSideProps>[0])
    expect(out).toEqual({
      redirect: { destination: `/v2/service/coming-soon?service=${encodeURIComponent('ไพ่อาถรรพ์ฮวงจุ้ย')}`, permanent: false },
    })
  })
})
