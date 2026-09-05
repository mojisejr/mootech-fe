// scripts/fortune-sage.test.tsx — เซียมซีเสี่ยงทาย (/v2/fortune/sage)
// 🔴 CONTRACT:
//   FS1 intro ไม่มี topic chips (ตาม Figma) + ปุ่ม "กดเพื่อเสี่ยงโพ"
//   FS2 กดเสี่ยง → POST /api/fortune/sage → ผล: pillar + 6 หมวด + toggle รัก หญิง/ชาย
//   FS3 402 (โควตา/ชี่หมด) → โชว์ quota ไม่โชว์ผล
//   FS4 แชร์ → ยิง /api/qi-earn code=share (รับ +10 QI)
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/fortune/sage', isReady: true }),
}))

const STICK = {
  no: 48, stem: '辛', branch: '亥', pillar: '辛亥', nayin: 'ทองเครื่องประดับ',
  personality: 'บุคคลที่มีคุณค่า...', deity: 'องค์เทพพระพิฆเนศ คุ้มครองดวงชะตา',
  topics: { career: 'งานดี', finance: 'เงินดี', health: 'สุขภาพดี', love: 'ชาย : รักเก่าปัญหา / หญิง : รักแท้แพ้ระยะทาง', family: 'ครอบครัวอบอุ่น' },
  imageUrl: null,
}

let sageStatus = 200
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/fortune/sage')) {
    return sageStatus === 200
      ? { ok: true, status: 200, json: async () => ({ stick: STICK, question: null, topic: null }) }
      : { ok: false, status: 402, json: async () => ({ error: { message: 'quota' } }) }
  }
  if (u.includes('/api/qi-earn')) return { ok: true, status: 200, json: async () => ({ ok: true }) }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import FortuneSagePage from '@/pages/v2/fortune/sage'

beforeEach(() => { sageStatus = 200; fetchMock.mockClear() })
afterEach(() => cleanup())

describe('เซียมซีเสี่ยงทาย', () => {
  it('FS1 intro: มีปุ่มเสี่ยงโพ ไม่มี topic chips', () => {
    render(<FortuneSagePage />)
    expect(screen.getByTestId('sage-draw').textContent).toContain('กดเพื่อเสี่ยงโพ')
    expect(screen.queryByTestId('sage-topics')).toBeNull()
  })

  it('FS2 กดเสี่ยง → ผลเซียมซี: pillar + หมวด + toggle รักหญิง/ชาย', async () => {
    render(<FortuneSagePage />)
    fireEvent.click(screen.getByTestId('sage-draw'))
    await waitFor(() => expect(screen.getByTestId('sage-result')).toBeTruthy(), { timeout: 3000 })
    expect(screen.getByTestId('sage-pillar').textContent).toBe('辛亥')
    // ใบเซียมซีดึงจาก engine (proxy) ตามเลขหัว ไม่พึ่ง stick.imageUrl (supabase)
    const slip = screen.getByTestId('sage-slip').querySelector('img[src="/api/fortune/card-image/sage/48"]')
    expect(slip).toBeTruthy()
    expect(screen.getByText('นิสัยและพฤติกรรม')).toBeTruthy()
    expect(screen.getByText('การงาน')).toBeTruthy()
    // toggle ความรัก: ค่าเริ่ม = หญิง
    expect(screen.getByText('สำหรับผู้หญิง')).toBeTruthy()
    expect(screen.getByText(/รักแท้แพ้ระยะทาง/)).toBeTruthy()
    fireEvent.click(screen.getByText('สำหรับผู้ชาย'))
    expect(screen.getByText(/รักเก่าปัญหา/)).toBeTruthy()
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
})
