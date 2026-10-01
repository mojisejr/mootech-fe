// scripts/login-escape-page.test.tsx — slice 7c (2026-10-02): /v2/login ใน Facebook/Instagram.
//
// 🔴 MUTANT CONTRACT:
//   E1 Facebook/Instagram → หน้า "เปิดใน Chrome/Safari" ไม่ใช่ปุ่ม LINE/Google  ❌ เริ่ม OAuth ใน webview ที่ LINE ต้องกรอกรหัส
//   E2 กดเปิด → พาออกด้วย URL /v2/login?ref=<โค้ดเชิญ>                        ❌ โค้ดเชิญหายในเบราว์เซอร์จริง
//   E3 "เข้าสู่ระบบต่อในแอปนี้" → ปุ่มล็อกอินปกติ (ไม่ขังผู้ใช้)                    ❌ ทางตันถ้าเปิดเบราว์เซอร์ไม่ได้
//   E4 เบราว์เซอร์จริง → ปุ่มล็อกอินปกติทันที; ?ref= ถูกเก็บลง localStorage       ❌ หน้าสมัครไม่เห็นโค้ด
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const routerState = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('next/router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), query: routerState.query, isReady: true, pathname: '/v2/login' }),
}))
vi.mock('@/features/auth/hooks/useV2AuthGate', () => ({
  useV2AuthGate: () => ({ status: 'anon', showLoading: false, identityStuck: false, redirecting: false }),
}))
vi.mock('@/features/auth/hooks/useV2Login', () => ({
  useV2Login: () => ({ loading: false, onLine: vi.fn(), onGoogle: vi.fn() }),
}))
const openInExternalBrowser = vi.fn(async (_url: string) => {})
vi.mock('@/lib/browser/open-external', () => ({ openInExternalBrowser: (u: string) => openInExternalBrowser(u) }))
vi.mock('@/features/v2-shell/components/FullBleedScreen', () => ({
  FullBleedScreen: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import V2LoginPage from '@/pages/v2/login'

const FB_ANDROID =
  'Mozilla/5.0 (Linux; Android 16; SM-F766B; wv) AppleWebKit/537.36 Version/4.0 Chrome/154.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]'
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

function setUA(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

beforeEach(() => {
  routerState.query = {}
  window.localStorage.clear()
  window.sessionStorage.clear()
  openInExternalBrowser.mockClear()
})
afterEach(() => cleanup())

describe('/v2/login — slice 7c in-app escape', () => {
  it('E1+E2: Facebook Android → หน้าเปิดใน Chrome; กดแล้วพาออกพร้อม ?ref', async () => {
    setUA(FB_ANDROID)
    window.localStorage.setItem('v2:referral', 'MUMATE190')
    render(<V2LoginPage />)
    const open = await screen.findByRole('button', { name: 'เปิดใน Chrome' })
    expect(screen.queryByText('ลงทะเบียนด้วย LINE')).toBeNull()
    fireEvent.click(open)
    expect(openInExternalBrowser).toHaveBeenCalledWith(`${window.location.origin}/v2/login?ref=MUMATE190`)
  })

  it('E3: เลือกเข้าสู่ระบบต่อในแอป → ปุ่มล็อกอินปกติ และไม่ถามซ้ำในแท็บนี้', async () => {
    setUA(FB_ANDROID)
    render(<V2LoginPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'เข้าสู่ระบบต่อในแอปนี้' }))
    expect(await screen.findByText('ลงทะเบียนด้วย LINE')).toBeTruthy()
    cleanup()
    render(<V2LoginPage />)
    expect(await screen.findByText('ลงทะเบียนด้วย LINE')).toBeTruthy()
  })

  it('E4: เบราว์เซอร์จริง → ปุ่มล็อกอินทันที; ?ref= เก็บลง localStorage', async () => {
    setUA(CHROME)
    routerState.query = { ref: 'MUMATE190' }
    render(<V2LoginPage />)
    expect(await screen.findByText('ลงทะเบียนด้วย LINE')).toBeTruthy()
    await waitFor(() => expect(window.localStorage.getItem('v2:referral')).toBe('MUMATE190'))
    expect(screen.queryByRole('button', { name: 'เปิดใน Chrome' })).toBeNull()
  })
})
