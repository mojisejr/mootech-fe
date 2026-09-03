// scripts/display-name.test.tsx — team.mp4 2026-09 "@name ไม่ซ้ำกัน โชว์จางๆ คู่ชื่อ"
//
// 🔴 MUTANT CONTRACT:
//   N1 หน้าสมัคร: พิมพ์ @name ที่ถูกใช้แล้ว (blur → check ว่างคืน available:false) → ต้องโชว์
//      "ชื่อนี้ถูกใช้แล้ว" และ ❌ ห้ามยิง POST profile/referral/display-name ใด ๆ หลังกดสมัคร
//      (ชื่อซ้ำต้องหยุดก่อน save — กัน save ซ้ำจากการกดใหม่หลังแก้ชื่อ)
//   N2 จอพลังชี่: GET display-name มีค่า → hero โชว์ "@name" จางๆ; ไม่มีค่า → ไม่แสดง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/register', isReady: true }),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

// fetch รวม: จำแนกด้วย URL — check=NAME → available:false (ชื่อซ้ำ), อื่น ๆ ตอบ ok
const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
  if (String(url).includes('check=')) {
    const taken = decodeURIComponent(String(url).split('check=')[1] ?? '') === 'taken_name'
    return { ok: true, status: 200, json: async () => ({ available: !taken }) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

vi.mock('@/features/auth/hooks/useV2AuthGate', () => ({
  useV2AuthGate: () => ({ status: 'authed', showLoading: false, identityStuck: false }),
}))
vi.mock('@/features/auth/hooks/useV2ProfileForm', () => ({
  useV2ProfileForm: () => ({
    fields: { name: '', surname: '', gender: null, birthDay: '', isRememberTimeBirth: false, timeHourBirth: '', timeMinuteBirth: '' },
    isTimeValid: true, error: null, submitting: false, canSubmit: true,
    onSubmit: vi.fn(async () => undefined),
  }),
}))

import V2RegisterPage from '@/pages/v2/register'

describe('#team-mp4 · @name บนหน้าสมัคร — ชื่อซ้ำต้องหยุดก่อนบันทึก', () => {
  const postCalls = () => fetchMock.mock.calls.filter((c) => String(c[1]?.method ?? '') === 'POST')

  beforeEach(() => { fetchMock.mockClear() })
  afterEach(() => cleanup())

  it('N1 พิมพ์ชื่อที่ถูกใช้แล้ว (blur เช็ค) → โชว์ error และกดสมัครแล้วไม่มี POST ใด ๆ', async () => {
    render(<CookiesProvider><V2RegisterPage /></CookiesProvider>)
    const input = await waitFor(() => screen.getByPlaceholderText('เช่น somchai_j — 4-24 ตัวอักษร'))
    fireEvent.change(input, { target: { value: 'taken_name' } })
    fireEvent.blur(input) // เช็คซ้ำตอน blur
    await waitFor(() => expect(screen.getByText('ชื่อนี้ถูกใช้แล้ว ลองชื่ออื่น')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    await waitFor(() => expect(postCalls().length).toBe(0))
    // และต้องมีข้อความซ้ำยังค้างอยู่ (ผู้ใช้เห็นเหตุผลว่าทำไมกดแล้วเกิดอะไรไม่ขึ้น)
    expect(screen.getByText('ชื่อนี้ถูกใช้แล้ว ลองชื่ออื่น')).toBeTruthy()
  })
})
