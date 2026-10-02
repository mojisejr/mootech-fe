// scripts/self-heal-liff-carry.test.ts — slice 7g (2026-10-02).
//
// 🔴 MUTANT CONTRACT:
//   S1 session ยุค LIFF "ที่มี MEMBER_ID แล้ว" ต้องถูกจบด้วย (เดิม #860 จบเฉพาะตอนไม่มี MEMBER_ID → ค้างบัญชีซ้ำ 7 วัน)
//   S2 ก่อนจบต้องขอใบส่งต่อ (POST /api/auth/liff-carry) แล้วล้าง MEMBER_* → signOut, ไม่เรียก register
//   S3 ขอใบล้ม → ยังจบ session อยู่ดี
//   S4 session ช่อง Login (มี iss) + MEMBER_ID → ไม่แตะ
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { session, auth, registerCall, signOutMock, removeCookieMock } = vi.hoisted(() => ({
  session: { status: 'authenticated', data: { user: { name: 'ทดสอบ', image: '' }, lineProfile: { sub: 'U-LIFF' } as Record<string, unknown> } },
  auth: { status: 'authed' },
  registerCall: vi.fn(),
  signOutMock: vi.fn(async () => {}),
  removeCookieMock: vi.fn(),
}))

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/v2' }) }))
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: session.data, status: session.status }),
  signOut: signOutMock,
}))
vi.mock('react-cookie', () => ({ useCookies: () => [{}, vi.fn(), removeCookieMock] }))
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ status: auth.status }) }))
vi.mock('@/constants/api/api-user-register-or-login', () => ({ UserRegisterOrLogin: registerCall }))

import { useSelfHealIdentity } from '@/lib/auth/use-self-heal-identity'

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))

beforeEach(() => {
  signOutMock.mockClear()
  removeCookieMock.mockClear()
  registerCall.mockClear()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  session.data.lineProfile = { sub: 'U-LIFF' }
  auth.status = 'authed'
})

describe('self-heal · session ยุค LIFF + ใบส่งต่อ', () => {
  it('S1+S2: มี MEMBER_ID แล้วก็ต้องจบ — ขอใบก่อน ล้าง MEMBER_ID แล้ว signOut', async () => {
    renderHook(() => useSelfHealIdentity())
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalledWith({ redirect: false }))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/liff-carry', { method: 'POST', credentials: 'same-origin' })
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(signOutMock.mock.invocationCallOrder[0])
    expect(removeCookieMock).toHaveBeenCalledWith('cookie-mumate-id', { path: '/' })
    expect(registerCall).not.toHaveBeenCalled()
  })

  it('S3: ขอใบล้ม → ยังจบ session', async () => {
    fetchMock.mockImplementation(async () => { throw new Error('offline') })
    renderHook(() => useSelfHealIdentity())
    await vi.waitFor(() => expect(signOutMock).toHaveBeenCalled())
  })

  it('S4: session ช่อง Login (มี iss) ที่มี MEMBER_ID → ไม่ขอใบ ไม่ signOut', async () => {
    session.data.lineProfile = { sub: 'U-LOGIN', iss: 'https://access.line.me' }
    renderHook(() => useSelfHealIdentity())
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
