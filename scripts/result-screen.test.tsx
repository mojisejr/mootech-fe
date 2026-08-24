// #363 — teeth for the arrangement of the states. MAIN lane.
// #423 — seven now: RECONCILING sits between PAYING and QR_MAYBE_EXPIRED. The count assertion below is what
// forced this file to be opened when it was added — keep it exact, never `toBeGreaterThan`.
//
// 🔴 MUTANT CONTRACT:
//   MU1  derive the tick from the state NAME instead of `paid`  → "the mark follows paid" reddens
//   MU2  offer "ลองอีกครั้ง" on a declined card                  → "no circular advice" reddens
//   MU3  show the retry button while still in flight            → "nothing to press mid-flight" reddens
//   MU4  drop role=status from the headline                     → "the outcome is announced" reddens
//
// 🔑 result-state.test.ts audits the WORDS. This file audits whether the SCREEN can contradict them — the
// two failures are different: a correct table rendered with a green tick on a failure is still a screen that
// tells someone their money moved when it did not.
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultScreen } from '@/features/v2-shop/components/ResultScreen'
import { RESULT_COPY, type ResultState } from '@/features/v2-shop/result-state'

afterEach(cleanup)
const STATES = Object.keys(RESULT_COPY) as ResultState[]
const all = { onRetrySame: vi.fn(), onTryAnother: vi.fn(), onDone: vi.fn() }

describe('#363 the screen cannot contradict the table', () => {
  it('🔴 the success mark appears on exactly the states where money moved — all seven checked', () => {
    expect(STATES).toHaveLength(7)
    for (const s of STATES) {
      render(<ResultScreen state={s} {...all} />)
      const paid = RESULT_COPY[s].paid
      expect(screen.getByTestId('result-screen').getAttribute('data-paid'), s).toBe(paid ? '1' : '0')
      expect(screen.getByTestId('result-mark').textContent, `${s} mark`).toBe(s === 'PAYING' ? '…' : paid ? '✓' : '!')
      cleanup()
    }
  })

  it('every state renders its own words from the table, not a paraphrase', () => {
    for (const s of STATES) {
      render(<ResultScreen state={s} {...all} />)
      expect(screen.getByTestId('result-title').textContent).toBe(RESULT_COPY[s].title)
      expect(screen.getByTestId('result-body').textContent).toBe(RESULT_COPY[s].body)
      cleanup()
    }
  })

  it('🔴 a declined card is never offered the SAME road again', () => {
    render(<ResultScreen state="CARD_DECLINED" {...all} />)
    expect(screen.queryByTestId('result-retry-same')).toBeNull()
    expect(screen.getByTestId('result-try-another').textContent).toBe('เลือกวิธีชำระเงินอื่น')
    expect(document.body.textContent).not.toContain('ลองอีกครั้ง')
  })

  it('states where pressing again can genuinely work do offer it', () => {
    for (const s of ['OFFLINE', 'QR_MAYBE_EXPIRED'] as ResultState[]) {
      render(<ResultScreen state={s} {...all} />)
      expect(screen.getByTestId('result-retry-same'), s).toBeTruthy()
      cleanup()
    }
  })

  it('mid-flight there is nothing to press — no retry, no exit', () => {
    render(<ResultScreen state="PAYING" {...all} />)
    expect(screen.queryByTestId('result-retry-same')).toBeNull()
    expect(screen.queryByTestId('result-try-another')).toBeNull()
    expect(screen.queryByTestId('result-done')).toBeNull()
  })

  it('the outcome is announced, not just drawn', () => {
    render(<ResultScreen state="APPROVED" {...all} />)
    const t = screen.getByTestId('result-title')
    expect(t.getAttribute('role')).toBe('status')
    expect(t.getAttribute('aria-live')).toBe('polite')
    // the mark is decoration; a screen reader must not read "✓" as the message
    expect(screen.getByTestId('result-mark').getAttribute('aria-hidden')).toBe('true')
  })

  it('the exit label matches whether they own something now', () => {
    render(<ResultScreen state="APPROVED" {...all} />)
    expect(screen.getByTestId('result-done').textContent).toBe('เริ่มใช้งาน')
    cleanup()
    render(<ResultScreen state="CARD_DECLINED" {...all} />)
    expect(screen.getByTestId('result-done').textContent).toBe('กลับหน้าแพ็กเกจ')
  })
})
