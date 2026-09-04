// scripts/invite-landing.test.tsx — หน้าคำเชิญ (/invite/[code], เฟรม invite-landing — friend opens the link)
//
// 🔴 MUTANT CONTRACT:
//   I1 กด "ยอมรับคำเชิญ" ต้องเก็บโค้ดลง localStorage (REFERRAL_STORAGE_KEY) ก่อนพาไป /v2/register?ref=
//      ❌ พาไปหน้าสมัครโดยโค้ดหลุดหายในรอบล็อกอิน
//   I2 โค้ดไม่พบ (404) → หน้าบอกตรง ๆ + ทางสมัครปกติ ❌ แสดง landing ราวกับโค้ดใช้ได้
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const replace = vi.fn()
// โค้ดที่ router ส่งมา — เปลี่ยนได้รายเคส (vi.mock ถูก hoist จึงต้องเก็บ state ผ่าน vi.hoisted)
const routerState = vi.hoisted(() => ({ code: 'MUMATE725' as string | undefined }))
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace, query: { code: routerState.code }, pathname: '/invite', isReady: true }),
}))

let lookStatus = 200
let lookPayload: Record<string, unknown> = { code: 'MUMATE725', inviterName: 'somsri_m' }
const fetchMock = vi.fn(async (url: string) => {
  if (String(url).includes('/api/invite-look')) {
    return { ok: lookStatus === 200, status: lookStatus, json: async () => lookPayload }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import InvitePage, { REFERRAL_STORAGE_KEY } from '@/pages/invite/[code]'

beforeEach(() => {
  lookStatus = 200
  lookPayload = { code: 'MUMATE725', inviterName: 'somsri_m' }
  routerState.code = 'MUMATE725'
  window.localStorage.clear()
  fetchMock.mockClear()
  replace.mockClear()
})
afterEach(() => cleanup())

describe('หน้าคำเชิญ (invite-landing)', () => {
  it('โค้ดใช้ได้ → landing โชว์ชื่อผู้ชวน + โค้ด + โบนัสคู่', async () => {
    render(<InvitePage />)
    await waitFor(() => expect(screen.getByTestId('invite-title').textContent).toContain('somsri_m'))
    expect(screen.getByTestId('invite-code').textContent).toBe('MUMATE725')
    expect(screen.getByText(/เพื่อนที่ชวนได้ \+250/)).toBeTruthy()
  })

  it('I1 กดยอมรับ → เก็บโค้ดลง localStorage แล้วพาไป /v2/register?ref=', async () => {
    render(<InvitePage />)
    fireEvent.click(await waitFor(() => screen.getByTestId('invite-accept')))
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe('MUMATE725')
    expect(replace).toHaveBeenCalledWith('/v2/register?ref=MUMATE725')
  })

  it('I2 โค้ดไม่พบ (404) → แจ้งตรง ๆ + ปุ่มไปสมัครปกติ (ไม่มี landing ปลอม)', async () => {
    lookStatus = 404
    render(<InvitePage />)
    await waitFor(() => expect(screen.getByTestId('invite-invalid-title')).toBeTruthy())
    expect(screen.queryByTestId('invite-accept')).toBeNull()
    fireEvent.click(screen.getByTestId('invite-accept-anyway'))
    expect(replace).toHaveBeenCalledWith('/v2/register')
    expect(window.localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull()
  })

  it('โค้ดผิดรูปแบบใน URL → invalid ทันที ไม่ยิง invite-look', async () => {
    routerState.code = '!!!bad!!!'
    render(<InvitePage />)
    await waitFor(() => expect(screen.getByTestId('invite-invalid-title')).toBeTruthy())
    expect(fetchMock.mock.calls.length).toBe(0)
  })
})
