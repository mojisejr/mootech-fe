// harness ของ scripts/register-referral.test.tsx — แยกไว้เพื่อไม่ให้ชุด mock บังตัว assertion
import React from 'react'
import { vi } from 'vitest'
import { render, renderHook, waitFor, screen } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

// fetch ตัวเดียวทั้งไฟล์ — assertion อ่านยอดจากตัวนี้
export const refetch = vi.fn()
vi.stubGlobal('fetch', refetch)

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: h.query, pathname: '/v2/register', isReady: true }),
}))

// identity — authed เสมอ (หน้าสมัคร gate อยู่หลังล็อกอิน)
vi.mock('@/features/auth/hooks/useV2AuthGate', () => ({
  useV2AuthGate: () => ({ status: 'authed', showLoading: false, identityStuck: false }),
}))

// form — ลอจิกจริงของ profile-save ไม่อยู่ในขอบเขตไฟล์นี้ (อยู่ที่ useV2ProfileForm ของมันเอง);
// ของไฟล์นี้คือ "บันทึกแล้ว → ยิง referral" จึงสตับเป็น onSubmit ที่ resolve ทันที
vi.mock('@/features/auth/hooks/useV2ProfileForm', () => ({
  useV2ProfileForm: () => ({
    fields: { name: '', surname: '', gender: null, birthDay: '', isRememberTimeBirth: false, timeHourBirth: '', timeMinuteBirth: '' },
    isTimeValid: true, error: null, submitting: false, canSubmit: true,
    onSubmit: vi.fn(async () => undefined),
  }),
}))

const h = vi.hoisted(() => ({ query: {} as Record<string, string | string[]> }))

import { useReferralApply } from '@/features/auth/hooks/use-referral-apply'
import V2RegisterPage from '@/pages/v2/register'

/** รัน useReferralApply ภายใต้ fetch ที่ถูก mock (refetch) */
export function mountHook() {
  const rendered = renderHook(() => useReferralApply())
  return { apply: rendered.result.current }
}

/** รอช่องโค้ดผู้แนะนำโผล่ (หาด้วย placeholder — Field ผูก label ไม่ครบทุกเคส) */
export async function waitForField() {
  return await waitFor(
    () => screen.getByPlaceholderText('เช่น MUMATE123'),
    { timeout: 3000 },
  )
}

/** mount หน้าสมัครจริงพร้อม query ที่กำหนด */
export function mountRegister({ query }: { query: Record<string, string | string[]> }) {
  h.query = query
  render(<CookiesProvider><V2RegisterPage /></CookiesProvider>)
}

