// scripts/ai-training-consent.test.tsx — ความยินยอมใช้คำถามพัฒนา AI (เอ็ม 2026-10-22)
//   AT1 หน้าสมัคร: ช่องแยก ไม่ติ๊กไว้ก่อน · ไม่ติ๊กก็กดยอมรับได้ (ไม่ผูกกับ PDPA หลัก)
//   AT2 ป็อปอัปแชท: ยังไม่เคยตอบ → ถาม · ตอบแล้ว/ยังไม่ล็อกอิน → ไม่ถาม · กดยินยอม → POST kind=ai_training
//   AT3 จัดการความยินยอม: มีสวิตช์ ai_training ค่าเริ่มต้นปิด
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { AiTrainingAsk } from '@/features/v2-privacy/AiTrainingAsk'
import { AI_TRAINING_KIND, AI_TRAINING_VERSION } from '@/features/v2-privacy/aiTraining'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('หน้าสมัคร', () => {
  it('AT1 ช่องยินยอมใช้คำถาม แยก ไม่ติ๊กไว้ก่อน และไม่ล็อกปุ่มยอมรับ', () => {
    const onAi = vi.fn()
    render(<PdpaConsentScreen consent={true} onConsentChange={() => {}} aiTraining={false} onAiTrainingChange={onAi} />)
    const box = screen.getByTestId('pdpa-ai-training')
    expect(box.textContent).toContain('ไม่บังคับ')
    expect(screen.getByRole('button', { name: 'ยอมรับและดำเนินการต่อ' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByText(/ไม่บังคับ/))
    expect(onAi).toHaveBeenCalledWith(true)
  })
})

describe('ป็อปอัปแชท', () => {
  it('AT2a ยังไม่เคยตอบ → ถาม · กดยินยอม → บันทึก ai_training แล้วไม่ถามซ้ำ', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? { ok: true, json: async () => ({ ok: true }) } : { ok: true, json: async () => ({ consents: [{ kind: 'pdpa', accepted: true }] }) },
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<AiTrainingAsk />)
    await waitFor(() => expect(screen.getByTestId('ai-training-ask')).toBeTruthy())
    fireEvent.click(screen.getByTestId('ai-training-yes'))
    await waitFor(() => expect(screen.queryByTestId('ai-training-ask')).toBeNull())
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ kind: AI_TRAINING_KIND, version: AI_TRAINING_VERSION, accepted: true })
    cleanup()
    fetchMock.mockClear()
    render(<AiTrainingAsk />)
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('AT2b เคยตอบแล้ว (แม้ไม่ยินยอม) หรือยังไม่ล็อกอิน → ไม่ถาม', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ consents: [{ kind: 'ai_training', accepted: false }] }) })))
    render(<AiTrainingAsk />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('ai-training-ask')).toBeNull()
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    render(<AiTrainingAsk />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('ai-training-ask')).toBeNull()
  })
})
