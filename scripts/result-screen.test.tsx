// #363 — teeth for the arrangement of the states. MAIN lane.
// #466 — nine now: ALREADY_ON_THIS_TIER and CANNOT_DOWNGRADE joined. They are the first states that are
// neither a success nor a failure — the purchase was refused before any money moved — so this file also
// pins that they render as a refusal (no tick) and offer exactly one way out: back to the package list.
// #423 — seven then: RECONCILING sits between PAYING and QR_MAYBE_EXPIRED. The count assertion below is what
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
import { RESULT_COPY, REFUSED_STATES, type ResultState } from '@/features/v2-shop/result-state'

afterEach(cleanup)
const STATES = Object.keys(RESULT_COPY) as ResultState[]
const all = { onRetrySame: vi.fn(), onTryAnother: vi.fn(), onDone: vi.fn() }

describe('#363 the screen cannot contradict the table', () => {
  it('🔴 the success mark appears on exactly the states where money moved — all ten checked', () => {
    expect(STATES).toHaveLength(10) // #455 — QR_EXPIRED joined the table
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

  // ── #466 — a refusal is not a failure, and the way out is not "try again" ──────────────────────────
  it('🔴 a refusal shows no success mark and never claims money moved', () => {
    for (const s of REFUSED_STATES) {
      render(<ResultScreen state={s} {...all} />)
      expect(screen.getByTestId('result-screen').getAttribute('data-paid'), s).toBe('0')
      expect(screen.getByTestId('result-mark').textContent, `${s} mark`).toBe('!')
      cleanup()
    }
  })

  it('🔴 a refusal offers ONE way out — back to the package list (ฟีมเคาะ 2026-08-26)', () => {
    for (const s of REFUSED_STATES) {
      render(<ResultScreen state={s} {...all} />)
      // retry:'none' ⇒ neither retry button may be drawn: pressing again cannot change a refusal, and
      // "เลือกวิธีชำระเงินอื่น" would send a member who already owns the plan back to buy it again.
      expect(screen.queryByTestId('result-retry-same'), s).toBeNull()
      expect(screen.queryByTestId('result-try-another'), s).toBeNull()
      expect(screen.getByTestId('result-done').textContent, s).toBe('กลับหน้าแพ็กเกจ')
      cleanup()
    }
  })

  it('MU8 — the plan is named when the screen is told which one, and never a raw code when it is not', () => {
    render(<ResultScreen state="ALREADY_ON_THIS_TIER" planName="Mumate +" {...all} />)
    expect(screen.getByTestId('result-title').textContent).toContain('Mumate +')
    cleanup()

    render(<ResultScreen state="ALREADY_ON_THIS_TIER" {...all} />)
    const title = screen.getByTestId('result-title').textContent ?? ''
    expect(title).toBe(RESULT_COPY.ALREADY_ON_THIS_TIER.title) // the truthful tier-less fallback
    expect(title).not.toMatch(/PLUS|PRO|FREE/)
    cleanup()
  })

  it('planName changes nothing for the other seven states', () => {
    for (const s of STATES.filter((x) => !REFUSED_STATES.includes(x as never))) {
      render(<ResultScreen state={s} planName="Mumate Pro" {...all} />)
      expect(screen.getByTestId('result-title').textContent, s).toBe(RESULT_COPY[s].title)
      cleanup()
    }
  })
})