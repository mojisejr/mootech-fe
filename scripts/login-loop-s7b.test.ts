// scripts/login-loop-s7b.test.ts — mumate-login-identity slice 7b (2026-10-01).
// login loop จากลิงก์แชร์: (1) OAuth พลาดแล้วกลับ /v2/login?error= แบบเงียบ → ต้องแสดงข้อความ;
// (2) ปุ่มยิง OAuth รอบสองเองหลัง 6 วิ → เขียน state cookie ทับรอบแรก → state mismatch → ต้องยิงครั้งเดียว.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const startOAuthRedirect = vi.fn(async () => {})
vi.mock('@/lib/auth/oauth-redirect', () => ({ startOAuthRedirect: (...a: unknown[]) => startOAuthRedirect(...(a as [])) }))
vi.mock('@/lib/line/liff', () => ({ openInExternalBrowser: vi.fn(async () => {}) }))
vi.mock('react-cookie', () => ({ useCookies: () => [{}, vi.fn(), vi.fn()] }))

import { isSocialInAppBrowser, loginErrorNotice } from '@/lib/auth/login-error'
import { useV2Login } from '@/features/auth/hooks/useV2Login'

const FB_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]'
const FB_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]'
const IG = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0'
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36'
const LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Line/13.5.0'

describe('isSocialInAppBrowser', () => {
  it('Facebook (Android/iOS) และ Instagram → true', () => {
    expect(isSocialInAppBrowser(FB_ANDROID)).toBe(true)
    expect(isSocialInAppBrowser(FB_IOS)).toBe(true)
    expect(isSocialInAppBrowser(IG)).toBe(true)
  })
  it('Chrome ปกติ และ LINE → false (LINE มีทางของตัวเองใน 7c)', () => {
    expect(isSocialInAppBrowser(CHROME)).toBe(false)
    expect(isSocialInAppBrowser(LINE)).toBe(false)
  })
})

describe('loginErrorNotice — OAuth ที่พลาดต้องไม่เงียบ', () => {
  it('ไม่มี error → null (หน้า login ปกติ)', () => {
    expect(loginErrorNotice(undefined, CHROME)).toBeNull()
    expect(loginErrorNotice('', CHROME)).toBeNull()
  })
  it('OAuthCallback (state cookie หาย / state mismatch / code ใช้ไม่ได้) → บอกให้ลองอีกครั้ง', () => {
    expect(loginErrorNotice('OAuthCallback', CHROME)).toBe('เข้าสู่ระบบไม่สำเร็จ ลองกดอีกครั้งนะคะ')
  })
  it('ใน Facebook/Instagram → เพิ่มวิธีเปิดในเบราว์เซอร์', () => {
    const msg = loginErrorNotice('OAuthCallback', FB_ANDROID)
    expect(msg).toContain('เข้าสู่ระบบไม่สำเร็จ')
    expect(msg).toContain('เปิดในเบราว์เซอร์')
  })
  it('query ซ้ำเป็น array → ใช้ตัวแรก; code ที่ไม่รู้จัก → ข้อความกลาง', () => {
    expect(loginErrorNotice(['OAuthSignin', 'x'], CHROME)).toBe('เข้าสู่ระบบไม่สำเร็จ ลองกดอีกครั้งนะคะ')
    expect(loginErrorNotice('Weird', CHROME)).toBe('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ')
  })
  it('AccessDenied → บอกว่าถูกยกเลิก', () => {
    expect(loginErrorNotice('AccessDenied', CHROME)).toContain('ถูกยกเลิก')
  })
})

describe('useV2Login — ยิง OAuth ครั้งเดียว ไม่ยิงซ้ำเอง', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    startOAuthRedirect.mockClear()
  })

  it('กด LINE แล้วหน้ายัง visible นาน 20 วิ → startOAuthRedirect ถูกเรียกครั้งเดียว และปุ่มปลดล็อกหลัง 14 วิ', () => {
    const { result } = renderHook(() => useV2Login())
    act(() => result.current.onLine())
    expect(result.current.loading).toBe(true)
    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(startOAuthRedirect).toHaveBeenCalledTimes(1)
    expect(startOAuthRedirect).toHaveBeenCalledWith('line', '/v2')
    expect(result.current.loading).toBe(false)
  })
})
