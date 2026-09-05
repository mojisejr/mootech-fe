// scripts/edit-profile-screen.test.tsx — /v2/settings/edit-profile (เฟรม edit-personal-info)
//
// 🔴 MUTANT CONTRACT:
//   EP1 บันทึกชื่อ/เพศต้องยิง PATCH ไป /api/profile ❌ เรียก endpoint สมัครเก่า (ทับโควตาวันเกิด)
//   EP2 @name โชว์จาก engine ❌ ให้แก้ในจอนี้ (แก้ @name มีเส้น unique ของตัวเองที่หน้าสมัคร)
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/settings/edit-profile', isReady: true }),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

const PROFILE = {
  anonId: 'u',
  profile: { displayName: 'somsri_m', firstName: 'สมศรี', lastName: null, gender: 'FEMALE', birthDate: '1995-06-15', timeUnknown: true },
  quota: { birthEditFreeUsed: false, birthEditPriceQi: 100, pendingCorrection: null },
}
let patchStatus = 200
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/profile') && (init?.method ?? 'GET') === 'GET') {
    return { ok: true, status: 200, json: async () => PROFILE }
  }
  if (u.includes('/api/profile')) {
    return { ok: patchStatus === 200, status: patchStatus, json: async () => ({ ok: true }) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import EditProfileScreen from '@/features/v2-account/components/EditProfileScreen'

const patchBodies = () =>
  fetchMock.mock.calls
    .filter((c) => (c[1]?.method ?? '') === 'PATCH')
    .map((c) => JSON.parse(String(c[1]?.body)))

beforeEach(() => {
  patchStatus = 200
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('จอแก้ข้อมูลส่วนตัว (edit-personal-info)', () => {
  it('prefill ชื่อ/เพศจาก engine + @name โชว์แบบอ่านอย่างเดียว', async () => {
    render(<CookiesProvider><EditProfileScreen /></CookiesProvider>)
    const first = await waitFor(() => screen.getByTestId('ep-first-name') as HTMLInputElement)
    expect(first.value).toBe('สมศรี')
    // เพศ = dropdown (prefill FEMALE)
    expect((screen.getByTestId('ep-gender') as HTMLSelectElement).value).toBe('FEMALE')
    // @name แก้ได้ในจอนี้แล้ว (prefill จาก engine)
    expect((screen.getByTestId('ep-handle') as HTMLInputElement).value).toBe('somsri_m')
    // ช่อง text = @name/ชื่อ/นามสกุล/อีเมล = 4
    expect(screen.getAllByRole('textbox').length).toBe(4)
    // avatar อัปโหลดได้ (มีปุ่ม + input file)
    expect(screen.getByTestId('ep-avatar-input')).toBeTruthy()
  })

  it('EP1 แก้ชื่อ+เพศ แล้วบันทึก → PATCH /api/profile ไม่มี field birth ❌ แตะโควตา', async () => {
    render(<CookiesProvider><EditProfileScreen /></CookiesProvider>)
    const last = await waitFor(() => screen.getByTestId('ep-last-name') as HTMLInputElement)
    fireEvent.change(last, { target: { value: 'ใจดี' } })
    fireEvent.change(screen.getByTestId('ep-gender'), { target: { value: 'OTHER' } })
    fireEvent.click(screen.getByTestId('ep-save'))
    await waitFor(() => expect(screen.getByTestId('ep-msg').textContent).toBe('บันทึกแล้ว'))
    const bodies = patchBodies()
    expect(bodies.length).toBe(1)
    expect(bodies[0]).toEqual({ firstName: 'สมศรี', lastName: 'ใจดี', gender: 'OTHER', email: '' })
    expect(bodies[0].birth).toBeUndefined()
  })

  it('EP2 แก้ @name เป็นชื่อซ้ำ → 409 โชว์ error + ไม่ยิง PATCH โปรไฟล์', async () => {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const u = String(url)
      if (u.includes('/api/profile') && (init?.method ?? 'GET') === 'GET') return { ok: true, status: 200, json: async () => PROFILE }
      if (u.includes('/api/v2/display-name')) return { ok: false, status: 409, json: async () => ({ error: 'display_name_taken' }) }
      if (u.includes('/api/profile')) return { ok: true, status: 200, json: async () => ({ ok: true }) }
      return { ok: true, status: 200, json: async () => ({}) }
    })
    render(<CookiesProvider><EditProfileScreen /></CookiesProvider>)
    const handle = await waitFor(() => screen.getByTestId('ep-handle') as HTMLInputElement)
    fireEvent.change(handle, { target: { value: 'taken_name' } })
    fireEvent.click(screen.getByTestId('ep-save'))
    await waitFor(() => expect(screen.getByTestId('ep-handle-err').textContent).toContain('มีคนใช้แล้ว'))
    // display-name ไม่ผ่าน → ต้องไม่ยิง PATCH โปรไฟล์
    expect(patchBodies().length).toBe(0)
  })

  it('EP3 อัปโหลด avatar → POST /api/v2/avatar + รูปโชว์', async () => {
    render(<CookiesProvider><EditProfileScreen /></CookiesProvider>)
    const input = await waitFor(() => screen.getByTestId('ep-avatar-input') as HTMLInputElement)
    const file = new File(['x'], 'me.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/v2/avatar') && (c[1]?.method ?? '') === 'POST')).toBe(true),
    )
    await waitFor(() => expect(screen.getByAltText('รูปโปรไฟล์')).toBeTruthy())
  })

  it('บันทึกล้ม → ข้อความของ engine โชว์ตรง ๆ', async () => {
    patchStatus = 409
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      if (String(url).includes('/api/profile') && (init?.method ?? 'GET') === 'GET') {
        return { ok: true, status: 200, json: async () => PROFILE }
      }
      return { ok: false, status: 409, json: async () => ({ error: 'ยังไม่มีโปรไฟล์ — ตั้ง @name ก่อน (หน้าสมัคร)' }) }
    })
    render(<CookiesProvider><EditProfileScreen /></CookiesProvider>)
    fireEvent.click(await waitFor(() => screen.getByTestId('ep-save')))
    await waitFor(() => expect(screen.getByTestId('ep-msg').textContent).toContain('ตั้ง @name ก่อน'))
  })
})
