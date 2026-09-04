// scripts/register-referral.test.tsx — team.mp4 "หน้าสมัครเพิ่มช่องโค้ดผู้แนะนำ" + deep link /invite
//
// 🔴 MUTANT CONTRACT:
//   R1 สมัครสำเร็จ + มีโค้ด → POST /api/referral พร้อมโค้ดนั้น                      → "ยิงหลังบันทึก" แดง
//   R2 โค้ดว่าง → ❌ ไม่ยิง (โค้ดไม่บังคับ)                                      → "โค้ดว่างไม่ยิง" แดง
//   R3 useReferralApply กับโค้ดผิดรูปแบบ → ❌ ไม่ยิง (กันด้วย regex ก่อนถึง BFF)   → "กรองรูปแบบ" แดง
//   R4 fetch ล่ม → return false และ ❌ ไม่ throw (การสมัครต้องไม่พังตาม)            → "ล่มไม่พัง" แดง
//   R5 หน้าสมัครรับ ?ref= มาเติมช่องให้เอง (deep link /invite/CODE → /v2/register?ref=CODE)
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { refetch, mountHook, mountRegister, waitForField } from './register-referral-harness'

describe('#team-mp4 · useReferralApply (ยิงโค้ดหลังบันทึกสำเร็จ)', () => {
  beforeEach(() => { refetch.mockReset() })
  afterEach(() => cleanup())

  it('R1 โค้ดถูกแบบ → POST /api/referral พร้อม body {code}', async () => {
    refetch.mockResolvedValue({ ok: true })
    const { apply } = mountHook()
    const ok = await apply(' MUMATE123 ')
    expect(ok).toBe(true)
    expect(refetch).toHaveBeenCalledWith('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MUMATE123' }),
    })
  })

  it('R2 โค้ดว่าง/ช่องว่าง → ไม่ยิง', async () => {
    refetch.mockResolvedValue({ ok: true })
    const { apply } = mountHook()
    expect(await apply('   ')).toBe(false)
    expect(refetch).not.toHaveBeenCalled()
  })

  it('R3 โค้ดผิดรูปแบบ (สั้นเกิน/มีสัญลักษณ์) → ไม่ยิง', async () => {
    refetch.mockResolvedValue({ ok: true })
    const { apply } = mountHook()
    expect(await apply('ab')).toBe(false)
    expect(await apply('มี-สเปซ!!')).toBe(false)
    expect(refetch).not.toHaveBeenCalled()
  })

  it('R4 fetch ล่ม → false ไม่ throw (การสมัครต้องไม่พังตาม)', async () => {
    refetch.mockRejectedValue(new Error('offline'))
    const { apply } = mountHook()
    await expect(apply('MUMATE123')).resolves.toBe(false)
  })
})

describe('#team-mp4 · หน้าสมัครรับ ?ref= มาเติมช่องโค้ดให้เอง', () => {
  beforeEach(() => { refetch.mockReset(); refetch.mockResolvedValue({ ok: true }) })
  afterEach(() => cleanup())

  it('R5 เปิดด้วย ?ref=MUMATE123 → ช่องโค้ดถูกเติมค่านั้น', async () => {
    mountRegister({ query: { ref: 'MUMATE123' } })
    const input = await waitForField()
    expect((input as HTMLInputElement).value).toBe('MUMATE123')
  })

  it('R5b เปิดปกติ (ไม่มี ref) → ช่องว่าง และพิมพ์เองได้', async () => {
    mountRegister({ query: {} })
    const input = await waitForField()
    expect((input as HTMLInputElement).value).toBe('')
    fireEvent.change(input, { target: { value: 'MUMATE777' } })
    expect((input as HTMLInputElement).value).toBe('MUMATE777')
  })

  it('R5c โค้ดรอใน localStorage (จากหน้า /invite ตอนยังไม่ล็อกอิน) → เติมให้เอง', async () => {
    window.localStorage.setItem('v2:referral', 'MUMATE555')
    mountRegister({ query: {} })
    const input = await waitForField()
    expect((input as HTMLInputElement).value).toBe('MUMATE555')
    window.localStorage.removeItem('v2:referral')
  })})
