// mumate-chat-failed-answer-001 slice 3 — a reply that is not an answer is shown, never saved or replayed.
//
// 🔴 MUTANT CONTRACT:
//   M1  keep failed turns                → "failed flag" reddens
//   M2  keep legacy error texts on restore → "legacy texts" reddens
//   M3  drop real answers                → "real answers" reddens
import { describe, expect, it } from 'vitest'

import { CHAT_FAILED_REPLY_TEXT, isFailedReplyText, keepableTurns } from '@/lib/chat/failed-reply'

const u = (content: string) => ({ role: 'user', content })
const a = (content: string, extra: Record<string, unknown> = {}) => ({ role: 'assistant', content, ...extra })

describe('keepableTurns', () => {
  it('failed flag: a failed reply is dropped', () => {
    const turns = [u('q1'), a('ตอบจริง'), u('q2'), a('partial', { failed: true })]
    expect(keepableTurns(turns).map((t) => t.content)).toEqual(['q1', 'ตอบจริง', 'q2'])
  })

  it('legacy texts: error texts older builds saved are dropped on restore', () => {
    const legacy = [
      'ขออภัยค่ะ ตอนนี้การเชื่อมต่อ Gemini ใช้เวลานานหรือมีปัญหา กรุณาลองใหม่อีกครั้ง',
      'ขออภัย ตอนนี้ยังตอบคำถามนี้ไม่ได้ ลองถามใหม่อีกครั้งนะ รอบนี้ไม่หักชี่',
      'การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้งนะครับ',
      'การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้งนะคะ',
      'ไม่ได้รับคำตอบจากเสี่ยวมู่ ลองใหม่อีกครั้งนะครับ',
      'เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะคะ',
      CHAT_FAILED_REPLY_TEXT,
    ]
    for (const text of legacy) expect(keepableTurns([u('q'), a(text)]).map((t) => t.content)).toEqual(['q'])
  })

  it('real answers: an answer that merely mentions a phrase is kept, and loading or empty turns are not', () => {
    const answer = 'ช่วงนี้การเชื่อมต่อกับคนรอบตัวมีปัญหาบ้าง ลองใหม่อีกครั้งในเดือนหน้านะครับ'
    expect(isFailedReplyText(answer)).toBe(false)
    expect(keepableTurns([u('q'), a(answer), a('', {}), a('x', { loading: true })]).map((t) => t.content)).toEqual(['q', answer])
  })

  it('the failed-reply text names no AI provider and points to LINE OA', () => {
    expect(CHAT_FAILED_REPLY_TEXT).not.toMatch(/gemini|openai|gpt|claude|llm|google/i)
    expect(CHAT_FAILED_REPLY_TEXT).toContain('@mumate')
  })
})
