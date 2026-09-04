// scripts/edit-birth-screen.test.tsx — /v2/settings/edit-birth (เฟรม edit-birth-data ×4)
//
// 🔴 MUTANT CONTRACT:
//   EB1 โควตาตัดสินที่ engine: ฟรีหมดแล้วปุ่มต้องบอกราคา (ใช้ 100 ชี่) ❌ ปุ่มฟรี
//   EB2 409 (ชี่ไม่พอ) → ชีตชี่ไม่พอด้วยยอดจริง ❌ ข้อความ generic
//   EB3 คำขอพิจารณา (correction sheet) ส่งเหตุผลถึง engine ❌ เงียบ
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/settings/edit-birth', isReady: true }),
}))

let freeUsed = false
let patchStatus = 200
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  const method = init?.method ?? 'GET'
  if (u.includes('/api/profile') && method === 'GET') {
    return {
      ok: true, status: 200,
      json: async () => ({
        anonId: 'u',
        profile: { displayName: 'x', birthDate: '1995-06-15', birthTime: null, timeUnknown: true },
        quota: { birthEditFreeUsed: freeUsed, birthEditPriceQi: 100, pendingCorrection: null },
      }),
    }
  }
  if (u.includes('/api/profile') && method === 'PATCH') {
    return { ok: patchStatus === 200, status: patchStatus, json: async () => ({ birthEditMode: freeUsed ? 'qi' : 'free' }) }
  }
  if (u.includes('/api/profile') && method === 'POST') {
    return { ok: true, status: 200, json: async () => ({ ok: true, requestId: 'r1' }) }
  }
  if (u.includes('/api/qi-wallet')) {
    return { ok: true, status: 200, json: async () => ({ qi: 30, coins: 0, xp: 0, level: 1, history: [] }) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import EditBirthScreen from '@/features/v2-account/components/EditBirthScreen'

beforeEach(() => {
  freeUsed = false
  patchStatus = 200
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอแก้วันเกิด (edit-birth-data ×4)', () => {
  it('สถานะฟรี: ป้าย "ยังไม่ได้ใช้" + ปุ่มยืนยันธรรมดา + ส่ง birth/timeUnknown ไป PATCH', async () => {
    render(<CookiesProvider><EditBirthScreen /></CookiesProvider>)
    const date = await waitFor(() => screen.getByTestId('eb-date') as HTMLInputElement)
    expect(date.value).toBe('1995-06-15')
    expect(screen.getByTestId('eb-quota').textContent).toContain('ยังไม่ได้ใช้')
    expect(screen.getByTestId('eb-save').textContent).toBe('ยืนยันแก้วันเกิด')
    const unknown = screen.getByTestId('eb-time-unknown') as HTMLInputElement
    expect(unknown.checked).toBe(true)
    fireEvent.click(screen.getByTestId('eb-save'))
    await waitFor(() => expect(screen.getByTestId('eb-msg').textContent).toContain('ใช้สิทธิ์แก้ฟรี'))
    const bodies = fetchMock.mock.calls.filter((c) => (c[1]?.method ?? '') === 'PATCH').map((c) => JSON.parse(String(c[1]?.body)))
    expect(bodies[0]).toMatchObject({ birth: '1995-06-15', timeUnknown: true })
  })

  it('EB1 สิทธิ์ฟรีหมด → ป้ายใช้แล้ว + ปุ่มบอกราคา 100 ชี่', async () => {
    freeUsed = true
    render(<CookiesProvider><EditBirthScreen /></CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId('eb-quota').textContent).toContain('ใช้สิทธิ์แก้ฟรีไปแล้ว'))
    expect(screen.getByTestId('eb-save').textContent).toBe('ยืนยันแก้ (ใช้ 100 QI)')
  })

  it('EB2 หักชี่ไม่สำเร็จ (409) → ชีตชี่ไม่พอโชว์ยอดขาจากยอดจริง (30 ชี่)', async () => {
    freeUsed = true
    patchStatus = 409
    render(<CookiesProvider><EditBirthScreen /></CookiesProvider>)
    fireEvent.click(await waitFor(() => screen.getByTestId('eb-save')))
    await waitFor(() => expect(screen.getByTestId('qi-insufficient-title')).toBeTruthy())
    expect(screen.getByTestId('qi-insufficient-title').textContent).toContain('ขาดอีก 70 QI')
    expect(screen.getByTestId('qi-insufficient-buy').getAttribute('href')).toBe('/v2/qi/buy')
  })

  it('EB3 correction request sheet → POST เหตุผลถึง engine + สถานะรอพิจารณาโชว์หลังโหลดใหม่', async () => {
    render(<CookiesProvider><EditBirthScreen /></CookiesProvider>)
    fireEvent.click(await waitFor(() => screen.getByTestId('eb-correction-open')))
    fireEvent.change(screen.getByTestId('eb-correction-reason'), { target: { value: 'กรอกผิดวัน' } })
    fireEvent.click(screen.getByTestId('eb-correction-send'))
    await waitFor(() => expect(screen.getByTestId('eb-correction-msg').textContent).toContain('ส่งคำขอแล้ว'))
    const posts = fetchMock.mock.calls.filter((c) => (c[1]?.method ?? '') === 'POST').map((c) => JSON.parse(String(c[1]?.body)))
    expect(posts[0]).toMatchObject({ reason: 'กรอกผิดวัน' })
  })
})
