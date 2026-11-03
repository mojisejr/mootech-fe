// scripts/fortune-sage.test.tsx — เซียมซีโป๊ยเซียน (/v2/fortune/sage)
// 🔴 CONTRACT:
//   FS1 intro ไม่มี topic chips (ตาม Figma) + ปุ่ม "กดเพื่อเสี่ยงทาย" กดได้เลย ไม่มีกล่องคำถาม
//   FS2 กดเสี่ยง → POST /api/fortune/sage → ผลโป๊ยเซียน: ชื่อใบ + หมวด + รูป + toggle รัก มีคู่/โสด
//   FS3 402 (โควตา/ชี่หมด) → โชว์ quota ไม่โชว์ผล
//   FS4 แชร์ → ยิง /api/qi-earn code=share (รับ +10 QI)
//   FS5 ป้ายที่มาของการเสี่ยงตาม qi.source
//   FS6 มือถือเขย่า → เสี่ยงทันที
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
// useV2Tier → useV2User → useCookies ต้องมี CookiesProvider; เทสนี้ไม่ได้วัด tier → mock เป็น non-PRO
vi.mock('@/features/auth/hooks/useV2Tier', () => ({ useV2Tier: () => ({ tier: null, isPaid: null, loading: false }) }))
// useCurrentUser → useSession ต้องมี SessionProvider; เทสนี้ไม่ได้วัด auth gate → mock เป็น login แล้ว (authed)
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ userId: 'test-user-id', status: 'authed' }) }))
// พิธีเขย่า (~6 วิ) ทดสอบแยกใน FS7 — เคสอื่นข้ามไปผลทันทีเมื่อ API ตอบ
vi.mock('@/features/v2-fortune/components/SiamsiRitual', async (orig) => {
  const real = await orig<typeof import('@/features/v2-fortune/components/SiamsiRitual')>()
  return {
    ...real,
    SiamsiRitual: (p: { ready: boolean; onDone: () => void }) => {
      const { ready, onDone } = p
      React.useEffect(() => { if (ready && !(globalThis as { __realRitual?: boolean }).__realRitual) onDone() }, [ready, onDone])
      return (globalThis as { __realRitual?: boolean }).__realRitual ? React.createElement(real.SiamsiRitual, p as never) : React.createElement('div', { 'data-testid': 'sage-loading' })
    },
  }
})
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/fortune/sage', isReady: true }),
}))

const CARD = {
  no: 6, name: 'ฮั่นเจ็งหลีตีกลอง', category: 'ดี', deity: 'ฮั่นเจ็งหลี', keywords: 'ชัยชนะ',
  overall: 'ภาพรวมดี', work: 'งานดี', money: 'เงินดี', health: 'สุขภาพดี', mind: 'ใจสงบ', family: 'ครอบครัวอบอุ่น',
  loveCouple: 'คู่รักหวานชื่น', loveSingle: 'โสดเจอคนใหม่', advice: 'ทำต่อไป',
  imageUrl: 'https://x.supabase.co/immortal-cards/poysian/6.webp',
}

let sageStatus = 200
let sageQi: { source: 'free' | 'credit' | 'qi'; cost: number } | null = null
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  void init
  const u = String(url)
  if (u.includes('/api/fortune/sage')) {
    return sageStatus === 200
      ? { ok: true, status: 200, json: async () => ({ card: CARD, question: null, qi: sageQi }) }
      : { ok: false, status: 402, json: async () => ({ error: { message: 'quota' } }) }
  }
  if (u.includes('/api/qi-earn')) return { ok: true, status: 200, json: async () => ({ ok: true }) }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import FortuneSagePage from '@/pages/v2/fortune/sage'

beforeEach(() => { sageStatus = 200; sageQi = null; fetchMock.mockClear(); try { localStorage.clear() } catch { /* cooldown ต่อเคส */ } })
afterEach(() => cleanup())


describe('เซียมซีโป๊ยเซียน', () => {
  it('FS1 intro: ปุ่มเสี่ยงทายกดได้เลย ไม่มีกล่องคำถาม ไม่มี topic chips', () => {
    render(<FortuneSagePage />)
    const btn = screen.getByTestId('sage-draw') as HTMLButtonElement
    expect(btn.textContent).toContain('กดเพื่อเสี่ยงทาย')
    expect(btn.disabled).toBe(false)
    expect(screen.queryByTestId('sage-topics')).toBeNull()
    expect(screen.queryByTestId('sage-question')).toBeNull()
  })

  it('FS2 กดเสี่ยง → ผลโป๊ยเซียน: ชื่อใบ + หมวด + รูป + toggle รักมีคู่/โสด', async () => {
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    await waitFor(() => expect(screen.getByTestId('sage-result')).toBeTruthy(), { timeout: 3000 })
    expect(screen.getByTestId('sage-name').textContent).toBe('ฮั่นเจ็งหลีตีกลอง')
    expect(screen.getByTestId('sage-category').textContent).toBe('หมวดดี')
    expect(screen.getByTestId('sage-slip').querySelector(`img[src="${CARD.imageUrl}"]`)).toBeTruthy()
    expect(screen.getByText('การงาน')).toBeTruthy()
    expect(screen.getByText('คู่รักหวานชื่น')).toBeTruthy()
    fireEvent.click(screen.getByText('โสด'))
    expect(screen.getByText('โสดเจอคนใหม่')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api/fortune/sage', expect.objectContaining({ method: 'POST' }))
  })

  it('FS3 402 โควตา/ชี่หมด → quota ไม่โชว์ผล', async () => {
    sageStatus = 402
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    await waitFor(() => expect(screen.getByTestId('sage-quota')).toBeTruthy(), { timeout: 3000 })
    expect(screen.queryByTestId('sage-result')).toBeNull()
  })

  it('FS4 แชร์ผล → ยิง /api/qi-earn code=share', async () => {
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    await waitFor(() => expect(screen.getByTestId('sage-share')).toBeTruthy(), { timeout: 3000 })
    fireEvent.click(screen.getByTestId('sage-share'))
    const earn = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/qi-earn'))
    expect(earn).toBeTruthy()
    expect(JSON.parse(String(earn![1]?.body)).code).toBe('share')
  })

  // บั๊ก prod 2026-09-07: header เคย hardcode "ใช้ไป 10 QI" ทั้งที่ engine ตัดโควตาฟรี — ป้ายต้องตาม qi.source
  it('FS5 ป้ายที่มาของการเสี่ยง: free → "ฟรีวันนี้", qi → "ใช้ไป N QI", ไม่มี qi → ไม่มีป้าย', async () => {
    sageQi = { source: 'free', cost: 0 }
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    expect((await screen.findByTestId('sage-qi-source', {}, { timeout: 4000 })).textContent).toBe('ฟรีวันนี้')
    cleanup(); try { localStorage.clear() } catch { /* รีเซ็ตคูลดาวน์ก่อน draw รอบถัดไป */ }

    sageQi = { source: 'qi', cost: 10 }
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    expect((await screen.findByTestId('sage-qi-source', {}, { timeout: 4000 })).textContent).toBe('ใช้ไป 10 QI')
    cleanup(); try { localStorage.clear() } catch { /* รีเซ็ตคูลดาวน์ */ }

    sageQi = null
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    await screen.findByTestId('sage-name', {}, { timeout: 4000 })
    expect(screen.queryByTestId('sage-qi-source')).toBeNull()
  })

  it('FS6 มือถือ: เขย่าเครื่อง → เสี่ยงทันที', async () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true })
    ;(window as unknown as { DeviceMotionEvent: unknown }).DeviceMotionEvent = function DeviceMotionEvent() {}
    render(<FortuneSagePage />)
    await screen.findByTestId('sage-shake-hint')
    const fire = (x: number) => window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x, y: 0, z: 9.8 } }))
    fire(0)
    fire(25)
    await waitFor(() => expect(screen.getByTestId('sage-result')).toBeTruthy(), { timeout: 3000 })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true })
  })

  it('FS7 พิธีเขย่า: เขย่า ≥3.2 วิ → ไม้หล่น → แสงระเบิด+พลิกไพ่ → ผล', async () => {
    ;(globalThis as { __realRitual?: boolean }).__realRitual = true
    try {
      render(<FortuneSagePage />)
      fireEvent.click(screen.getByTestId('sage-draw'))
      const box = await screen.findByTestId('sage-loading')
      await new Promise((r) => setTimeout(r, 1500))
      expect(box.getAttribute('data-stage')).toBe('shake') // ยังเขย่าอยู่แม้ API ตอบแล้ว
      await waitFor(() => expect(screen.getByTestId('sage-loading').getAttribute('data-stage')).toBe('burst'), { timeout: 4000 })
      expect(screen.getByTestId('sage-loading').querySelector(`img[src="${CARD.imageUrl}"]`)).toBeTruthy()
      await waitFor(() => expect(screen.getByTestId('sage-result')).toBeTruthy(), { timeout: 4000 })
    } finally {
      ;(globalThis as { __realRitual?: boolean }).__realRitual = false
    }
  }, 15000)
})
