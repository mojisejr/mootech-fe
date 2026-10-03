// เอ็ม 2026-10-03: เสี่ยวมู่/เสี่ยวมี่ แยกประวัติแชท — สลับ persona แล้วเห็นเฉพาะบทสนทนาของตัวนั้น
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBaziChatStream } from '@/features/v2-chat/useBaziChatStream'

const turn = (id: string, content: string) => ({ id, role: 'assistant' as const, content })

describe('useBaziChatStream · ประวัติแยกต่อ persona', () => {
  beforeEach(() => localStorage.clear())

  it('สลับ mu → mi → mu แล้วโหลดประวัติของแต่ละตัว ไม่ปนกัน', async () => {
    localStorage.setItem('mumate-chat-history-mu', JSON.stringify([turn('a', 'ตอบโดยเสี่ยวมู่ครับ')]))
    localStorage.setItem('mumate-chat-history-mi', JSON.stringify([turn('b', 'ตอบโดยเสี่ยวมี่ค่ะ')]))
    const { result, rerender } = renderHook(({ p }) => useBaziChatStream(p), { initialProps: { p: 'mu' as 'mu' | 'mi' } })
    await waitFor(() => expect(result.current.turns.map((t) => t.content)).toEqual(['ตอบโดยเสี่ยวมู่ครับ']))
    rerender({ p: 'mi' })
    await waitFor(() => expect(result.current.turns.map((t) => t.content)).toEqual(['ตอบโดยเสี่ยวมี่ค่ะ']))
    rerender({ p: 'mu' })
    await waitFor(() => expect(result.current.turns.map((t) => t.content)).toEqual(['ตอบโดยเสี่ยวมู่ครับ']))
    // สลับไปมาแล้วต้องไม่เขียนทับข้ามกัน
    expect(JSON.parse(localStorage.getItem('mumate-chat-history-mi') ?? '[]')[0].content).toBe('ตอบโดยเสี่ยวมี่ค่ะ')
  })

  it('ประวัติเดิมก่อนแยก (key เก่า) ย้ายเป็นของเสี่ยวมู่ครั้งเดียว', async () => {
    localStorage.setItem('mumate-chat-history', JSON.stringify([turn('c', 'ประวัติเก่า')]))
    const { result } = renderHook(() => useBaziChatStream('mu'))
    await waitFor(() => expect(result.current.turns.map((t) => t.content)).toEqual(['ประวัติเก่า']))
    expect(localStorage.getItem('mumate-chat-history')).toBeNull()
    expect(localStorage.getItem('mumate-chat-history-mu')).not.toBeNull()
  })
})
