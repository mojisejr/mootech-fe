// scripts/ai-training-consent.test.tsx — ความยินยอมใช้คำถามพัฒนา AI (เอ็ม 2026-10-22)
//   AT1 หน้าสมัคร (plan 0.3 ของ CIEL mumate-pdpa-reconsent-001, owner 2026-10-23): ไม่มีช่อง AI · ยอมรับนโยบาย = เปิด ai_training
//       เว้นแต่คำตอบล่าสุดคือ "ไม่" หรืออ่านคำตอบเดิมไม่ได้
//   AT2 ป็อปอัปแชท: ยังไม่เคยตอบ → ถาม · ตอบแล้ว/ยังไม่ล็อกอิน → ไม่ถาม · กดยินยอม → POST kind=ai_training
//   AT3 จัดการความยินยอม: มีสวิตช์ ai_training ค่าเริ่มต้นปิด
//   AT4 รุ่น 2026-10.2 (CIEL mumate-bdash-v2-001 slice 4): ตอบรุ่นเดิม → ถามอีกครั้งเดียว · สวิตช์เปิดเฉพาะยินยอมรุ่นนี้
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { AiTrainingAsk } from '@/features/v2-privacy/AiTrainingAsk'
import { AI_TRAINING_ASKED_KEY, AI_TRAINING_KIND, AI_TRAINING_VERSION, aiTrainingOn, turnOnAiTrainingOnAcceptance } from '@/features/v2-privacy/aiTraining'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('หน้าสมัคร', () => {
  it('AT1a ไม่มีช่อง AI บนหน้านโยบาย', () => {
    render(<PdpaConsentScreen consent={true} onConsentChange={() => {}} />)
    expect(screen.queryByTestId('pdpa-ai-training')).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  type Row = { kind: string; version: string; accepted: boolean }
  function stubConsent(rows: Row[] | 'down') {
    const posts: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)))
          return { ok: true, json: async () => ({ ok: true }) }
        }
        if (rows === 'down') return { ok: false, json: async () => ({}) }
        return { ok: true, json: async () => ({ consents: rows }) }
      }),
    )
    return posts
  }

  it('AT1b ยอมรับนโยบาย: ยังไม่เคยตอบ หรือเคยยินยอมรุ่นเดิม → บันทึกยินยอมรุ่นนี้ แล้วคืน true', async () => {
    let posts = stubConsent([])
    expect(await turnOnAiTrainingOnAcceptance()).toBe(true)
    expect(posts).toEqual([{ kind: AI_TRAINING_KIND, version: AI_TRAINING_VERSION, accepted: true }])
    posts = stubConsent([{ kind: AI_TRAINING_KIND, version: '2026-10', accepted: true }])
    expect(await turnOnAiTrainingOnAcceptance()).toBe(true)
    expect(posts).toHaveLength(1)
  })

  it('AT1c เปิดอยู่แล้ว → ไม่บันทึกซ้ำ · เคยตอบ "ไม่" (รุ่นไหนก็ตาม) หรืออ่านไม่ได้ → ไม่เปิด', async () => {
    let posts = stubConsent([{ kind: AI_TRAINING_KIND, version: AI_TRAINING_VERSION, accepted: true }])
    expect(await turnOnAiTrainingOnAcceptance()).toBe(true)
    expect(posts).toHaveLength(0)
    posts = stubConsent([{ kind: AI_TRAINING_KIND, version: '2026-10', accepted: false }])
    expect(await turnOnAiTrainingOnAcceptance()).toBe(false)
    expect(posts).toHaveLength(0)
    posts = stubConsent('down')
    expect(await turnOnAiTrainingOnAcceptance()).toBe(false)
    expect(posts).toHaveLength(0)
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
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ consents: [{ kind: 'ai_training', version: AI_TRAINING_VERSION, accepted: false }] }) })))
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

describe('รุ่น 2026-10.2', () => {
  const consents = (version: string, accepted: boolean) => [{ kind: AI_TRAINING_KIND, version, accepted }, { kind: 'pdpa', version: '2026-09', accepted: true }]

  it('AT4a ตอบรุ่นเดิม (ยินยอมหรือไม่) → ถามอีกครั้ง พร้อมบอกว่าเพิ่มอะไร', async () => {
    for (const accepted of [true, false]) {
      localStorage.clear()
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ consents: consents('2026-10', accepted) }) })))
      render(<AiTrainingAsk />)
      await waitFor(() => expect(screen.getByTestId('ai-training-again')).toBeTruthy())
      cleanup()
    }
  })

  it('AT4b เครื่องที่เคยกด "ไว้ก่อน" ของรุ่นเดิม ยังถูกถามรุ่นนี้ · กดรุ่นนี้แล้วไม่ถามซ้ำ', async () => {
    localStorage.setItem('mumate:ai-training-asked', '1')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ consents: [] }) })))
    render(<AiTrainingAsk />)
    await waitFor(() => expect(screen.getByTestId('ai-training-ask')).toBeTruthy())
    cleanup()
    localStorage.setItem(AI_TRAINING_ASKED_KEY, '1')
    render(<AiTrainingAsk />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('ai-training-ask')).toBeNull()
  })

  it('AT4c สวิตช์เปิดเฉพาะเมื่อคำตอบล่าสุดยินยอมรุ่นนี้', () => {
    expect(aiTrainingOn(consents(AI_TRAINING_VERSION, true))).toBe(true)
    expect(aiTrainingOn(consents('2026-10', true))).toBe(false)
    expect(aiTrainingOn(consents(AI_TRAINING_VERSION, false))).toBe(false)
    expect(aiTrainingOn([{ kind: 'pdpa', version: '2026-09', accepted: true }])).toBe(false)
  })
})
