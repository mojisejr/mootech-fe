// scripts/self-heal-retry.test.ts — #? "login ไม่สำเร็จ" บน localhost (2026-09-03): OAuth ผ่านทั้ง Google
// และ LINE (log พิสูจน์) แต่ self-heal ยิง register-login ไป Render ด้วยหน้าต่าง 10 วิ — free tier
// ตื่นช้า 30-60 วิ → timeout → เดิมโค้ด "ไม่มี retry" และผู้ใช้ติด login วนกลับ
//
// 🔴 MUTANT CONTRACT:
//   H1 ถอด retry (throw ครั้งแรกแล้ววาง) → "cold start ยิงซ้ำแล้วสำเร็จ" แดง
//   H2 ให้ attempt 2 ก็ timeout แล้ว signOut → "timeout ❌ ไม่ signOut" แดง (signOut เฉพาะ BE ปฏิเสธจริง)
//   H3 BE ปฏิเสธจริง (ok:false) → ต้อง signOut เหมือนเดิม (negative control ของ H2)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { session, registerCall, userGet, signOutMock, setCookieMock, removeCookieMock } = vi.hoisted(() => ({
  session: { status: 'authenticated', data: { user: { name: 'ทดสอบ', image: '' }, lineProfile: { sub: 'U123' } } },
  registerCall: vi.fn(),
  userGet: vi.fn(),
  signOutMock: vi.fn(),
  setCookieMock: vi.fn(),
  removeCookieMock: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: session.data, status: session.status }),
  signOut: signOutMock,
}))
vi.mock('react-cookie', () => ({
  useCookies: () => [{}, setCookieMock, removeCookieMock],
}))
vi.mock('@/lib/auth/use-current-user', () => ({
  useCurrentUser: () => ({ status: 'loading' }),
}))
vi.mock('@/constants/api/api-user-register-or-login', () => ({
  UserRegisterOrLogin: registerCall,
}))
vi.mock('@/constants/api/api-user-get', () => ({
  UserGetById: userGet,
}))

import { useSelfHealIdentity } from '@/lib/auth/use-self-heal-identity'

const OK_RESULT = { user_id: 'u-heal-1', ref_code: '', name: 'ทดสอบ', picture_url: '' }

beforeEach(() => {
  registerCall.mockReset()
  userGet.mockReset()
  signOutMock.mockReset()
  setCookieMock.mockReset()
  removeCookieMock.mockReset()
  userGet.mockResolvedValue({ refer_code: 'REF9' })
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

async function arm() {
  renderHook(() => useSelfHealIdentity())
  await vi.advanceTimersByTimeAsync(3_000 + 1) // SELF_HEAL_DELAY_MS — attempt 1 ออกตัว
}

async function waitUntil(fn: () => boolean, maxFakeMs = 5000) {
  // waitFor ของ testing-library พึ่ง timer จริง — ห้ามใช้คู่ fake timers; poll ด้วยเวลาปลอมแทน
  for (let t = 0; t <= maxFakeMs; t += 50) {
    if (fn()) return
    await vi.advanceTimersByTimeAsync(50)
  }
  expect(fn()).toBe(true)
}

describe('#login · self-heal register-login ทน Render cold start', () => {
  it('H1 attempt 1 ค้างเกิน 10 วิ → ยิงซ้ำ (หน้าต่าง 70 วิ) และสำเร็จ — ไม่ signOut', async () => {
    // attempt 1: promise ที่ไม่ resolve เลย (จบด้วย withTimeout ที่ 10 วิเท่านั้น)
    let release2: (v: unknown) => void = () => {}
    registerCall.mockImplementationOnce(() => new Promise(() => {}))
    registerCall.mockImplementationOnce(() => new Promise((res) => { release2 = res }))

    await arm()
    await vi.advanceTimersByTimeAsync(10_000 + 1) // attempt 1 timeout → retry ออกตัว
    expect(registerCall).toHaveBeenCalledTimes(2)

    release2(OK_RESULT)
    await waitUntil(() => setCookieMock.mock.calls.length > 0)

    // ไม่มีการพาออกจากระบบ — OAuth session ยังอยู่ครบ
    expect(signOutMock).not.toHaveBeenCalled()
    const cookieNames = setCookieMock.mock.calls.map((c: unknown[]) => c[0])
    expect(cookieNames).toContain('cookie-mumate-id')
  })

  it('H2 attempt 2 ก็ timeout → ❌ ไม่ signOut (timeout ไม่ใช่การถูกปฏิเสธ)', async () => {
    registerCall.mockImplementation(() => new Promise(() => {}))
    await arm()
    await vi.advanceTimersByTimeAsync(10_000 + 70_000 + 2)
    expect(registerCall).toHaveBeenCalledTimes(2)
    expect(signOutMock).not.toHaveBeenCalled()
    expect(setCookieMock).not.toHaveBeenCalled()
  })

  it('H3 🔴 CONTROL — BE ปฏิเสธจริง (ok:false) → signOut ตามเดิม', async () => {
    registerCall.mockResolvedValue({ ok: false, error: 'rejected' })
    await arm()
    await waitUntil(() => signOutMock.mock.calls.length > 0)
  })
})

async function actRelease(release: (v: unknown) => void, value: unknown) {
  await vi.advanceTimersByTimeAsync(0)
  release(value)
}
