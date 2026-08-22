// #316 — ฟันของ "ปุ่มเพิ่มปฏิทินรายยามเป็นของสมาชิก"
//
// 🔴 ฟันนี้วัด **client ไม่ยิง POST เลยเมื่อไม่ใช่สมาชิก** ❌ ไม่ใช่ "ไม่มีแถวเกิดในฐาน"
// เหตุผล: เซิร์ฟเวอร์กัน free อยู่ก่อนแล้วและ fail-closed (pages/api/v2/reminders.ts:40-43 ·
// lib/usage-core.ts:94) ⇒ "ไม่มีแถวเกิด" **เขียวอยู่แล้วก่อนใบนี้แตะอะไร** = ฟันที่เขียวได้ด้วยเหตุที่
// ไม่ใช่งานของใบนี้ ⇒ retarget มาที่บรรทัดที่ใบนี้เป็นคนตัดสินจริง: หน้าเพจเรียก onAdd หรือไม่
//
// 🔴 NEGATIVE CONTROL สองทิศในไฟล์นี้: locked → onAdd ไม่ถูกเรียก · ไม่ locked → ถูกเรียก 1 ครั้ง
// พร้อม args เดิม · ถ้าเหลือแต่ทิศแรก ฟันจะยังเขียวเมื่อมีคนทำให้ปุ่มตายทั้งสองสถานะ
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { YamTimes, YAM_ADD_LABEL, YAM_ADDED_LABEL, YAM_PAST_LABEL } from '@/features/v2-calendar/components/day-detail/YamTimes'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'
import { remindersLocked, yamReminderStatus, type YamReminderStatus } from '@/features/v2-calendar/tier-lock'
import type { YamSlot } from '@/features/v2-calendar/types'

// #323 — ก่อนหน้านี้ไฟล์นี้ต้องวาง assert "ยังไม่มี toast" ไว้ในเคสแรกเท่านั้น เพราะ `current` ของ
// ComingSoon เป็น state ระดับโมดูล และตัวจับเวลาที่จะล้างมันเคยเป็นของคอมโพเนนต์ ⇒ `cleanup()` ฆ่า
// ตัวจับเวลาทิ้ง แล้วข้อความค้างข้ามเคส · ตอนนี้ตัวจับเวลาอยู่ที่โมดูลแล้ว ⇒ เดินนาฬิกาให้หมดอายุได้จริง
const TOAST_MS = 2200
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.advanceTimersByTime(TOAST_MS * 2)
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const YAMS: YamSlot[] = [
  { id: 'y1', label: 'ยามมหาสิทธิโชค', window: '05:00-06:59' },
  { id: 'y2', label: 'ยามราชาโชค', window: '07:00-08:59' },
]

const mount = (locked: boolean) => {
  const onAdd = vi.fn()
  render(<YamTimes yams={YAMS} onAdd={onAdd} locked={locked} statusFor={() => 'addable'} onViewList={() => {}} />)
  return onAdd
}

describe('#316 · ปุ่มเพิ่มปฏิทินรายยาม — ด่านสมาชิก', () => {
  it('locked → กดแล้ว onAdd ไม่ถูกเรียกเลย (client ไม่ยิง POST) · และก่อนกดยังไม่มี toast', () => {
    const onAdd = mount(true)
    expect(screen.queryByTestId('coming-soon-toast')).toBeNull()
    fireEvent.click(screen.getByTestId('yam-add-locked-y1'))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('locked → ทุกแถวเป็นปุ่มล็อก ไม่มีปุ่มปกติหลงเหลือสักแถว', () => {
    mount(true)
    // นับทั้งสองฝั่ง ไม่ใช่ยืนยันแต่ฝั่งล็อก — ถ้าใครทำให้แถวที่ 2 หลุดด่าน ฟันนี้ต้องแดง
    expect(screen.getAllByTestId(/^yam-add-locked-/)).toHaveLength(YAMS.length)
    expect(screen.queryAllByTestId(/^yam-add-y/)).toHaveLength(0)
  })

  // #359 — คำตอบเปลี่ยนจาก toast "เร็วๆ นี้" เป็นลิงก์ไปหน้าแพ็กเกจ (ปลายทางมีแล้ว)
  // 🔴 หลักของ #316 ที่ห้ามหาย: ปุ่มยัง **กดได้และยังตอบ** ❌ ไม่ใช่ disabled ที่กดแล้วเงียบ
  it('locked → เป็นลิงก์ไปหน้าแพ็กเกจ ❌ ไม่ใช่ปุ่มที่เงียบ', () => {
    mount(true)
    const el = screen.getByTestId('yam-add-locked-y1')
    // assert ปลายทางจริงที่ผู้ใช้จะไปถึง ไม่ใช่แค่ว่ามี element โผล่มา
    expect(el.tagName).toBe('A')
    expect(el.getAttribute('href')).toBe(SHOP_HREF)
    // และมันต้องไม่ใช่ของที่ถูกปิดไว้ — disabled/aria-disabled = กลับไปเป็นปุ่มที่เงียบ
    expect(el.getAttribute('aria-disabled')).toBeNull()
  })

  it('NEGATIVE CONTROL · ไม่ locked → onAdd ถูกเรียก 1 ครั้ง ด้วย yam เดิม', () => {
    const onAdd = mount(false)
    fireEvent.click(screen.getByTestId('yam-add-y2'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(YAMS[1])
  })

  it('NEGATIVE CONTROL · ไม่ locked → ไม่มีปุ่มล็อกโผล่มาแม้แถวเดียว', () => {
    mount(false)
    expect(screen.queryAllByTestId(/^yam-add-locked-/)).toHaveLength(0)
    expect(screen.getAllByTestId(/^yam-add-y/)).toHaveLength(YAMS.length)
  })

  // #323 — เคสนี้อยู่ **ท้ายไฟล์ หลังเคสที่กดจน toast โผล่ไปแล้ว** และนั่นคือสิ่งที่มันพิสูจน์:
  // ข้อความไม่ค้างข้ามเคสอีกแล้ว ⇒ ข้อจำกัด "assert ต้องอยู่ในเคสแรกเท่านั้น" ถูกถอนออกได้จริง
  // ❌ ห้ามย้ายเคสนี้ขึ้นไปข้างบน — ถ้าย้าย มันจะเขียวโดยไม่ได้พิสูจน์อะไรเลย
  it('#323 · ไม่มี toast ค้างมาจากเคสก่อนหน้า (เคสนี้ต้องอยู่ท้ายไฟล์)', () => {
    mount(true)
    expect(screen.queryByTestId('coming-soon-toast')).toBeNull()
  })

  // ❌ ถอนเคส "ค่าเริ่มต้นของ locked คือ false" ออกแล้ว (ตู๋ #324 · request changes)
  // เหตุผลที่เคสนั้นอ้าง — "ผู้เรียกเดิมที่ยังไม่ส่ง prop" — **ไม่มีอยู่จริง**: ผู้เรียก `YamTimes`
  // ทั้ง repo มีตัวเดียวคือ [date].tsx:186 และมันส่ง prop อยู่แล้ว ⇒ เคสนั้นตรึง default ที่ไม่มีใครใช้
  // ไว้ว่า "ถูกต้อง" และปิดทางทำ `locked` ให้เป็น required
  // ⇒ ตอนนี้ `locked` เป็น required แล้ว ด่าน "ผู้เรียกต้องส่งค่ามา" อยู่ที่คอมไพเลอร์ (TS2741)
  //   ซึ่งเป็นที่เดียวที่จับได้ — unit test จับไม่ได้เพราะมันเรียก component เอง ไม่ได้เรียกผ่านหน้าเพจ
})

// tier มีสามค่า ไม่ใช่สองค่า — ฟันนี้อยู่แยกจาก component เพราะบรรทัดที่ตัดสินอยู่ใน tier-lock.ts
// (ไฟล์ page import ไม่ได้ใน unit — next/config) ⇒ ถ้าไม่แยก บรรทัดนี้จะไม่มีอะไรแตะได้เลย
describe('#316 · remindersLocked — fail-closed ทั้งสามค่า', () => {
  it('สมาชิก (true) → ปลดล็อก', () => {
    expect(remindersLocked(true)).toBe(false)
  })

  it('ฟรี (false) → ล็อก', () => {
    expect(remindersLocked(false)).toBe(true)
  })

  it('🔴 ยังไม่รู้ tier (null) → **ล็อก** ไม่ใช่ปลดล็อก', () => {
    // เคสนี้คือทั้งหมดของ DoD ข้อ "isPaid===null ไม่ถูกวาดเป็น free"
    // ถ้าใครเขียน `isPaid === false` แทน `!== true` เคสนี้จะแดง ส่วนอีกสองเคสยังเขียว
    expect(remindersLocked(null)).toBe(true)
  })
})


// ───────────────────────── #343 · 4 สถานะของปุ่มรายยาม ─────────────────────────
//
// 🔴 ฟันชุดนี้ **ไม่ assert ว่า "มีปุ่ม"** สักข้อ — ปุ่มอยู่ครบทุกสถานะอยู่แล้ว สิ่งที่พังคือมันพูดผิด
// ⇒ ทุกข้อ assert **ข้อความที่ผู้ใช้อ่านได้** + **กดแล้วเกิด/ไม่เกิดอะไร** และมีข้อ negative-control
// ที่แดงทันทีถ้าสองสถานะดันพูดเหมือนกัน
//
// ป้ายอ้างจากค่าที่ component export ❌ ไม่พิมพ์สตริงซ้ำ — เทสต์ที่พิมพ์เองจะเขียวต่อไปแม้ป้ายบนจอเปลี่ยน

function renderStatus(status: YamReminderStatus, over: { onAdd?: () => void; onViewList?: () => void } = {}) {
  const onAdd = vi.fn(over.onAdd)
  const onViewList = vi.fn(over.onViewList)
  render(<YamTimes yams={YAMS} onAdd={onAdd} locked={false} statusFor={() => status} onViewList={onViewList} />)
  return { onAdd, onViewList }
}

describe('#343 · ปุ่มรายยาม 4 สถานะ — แต่ละสถานะพูดคนละอย่าง และทำคนละอย่าง', () => {
  afterEach(cleanup)

  it('addable → "เพิ่มปฏิทิน" · กดแล้วเปิดชีท (onAdd) พร้อมยามตัวนั้น', () => {
    const { onAdd, onViewList } = renderStatus('addable')
    const btn = screen.getByTestId(`yam-add-${YAMS[0].id}`)
    expect(btn.textContent).toBe(YAM_ADD_LABEL)
    expect((btn as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(btn)
    expect(onAdd).toHaveBeenCalledWith(YAMS[0])
    expect(onViewList).not.toHaveBeenCalled()
  })

  it('added → "เพิ่มแล้ว" · กดแล้วไปหน้ารายการ ❌ ไม่ใช่เปิดชีทเพิ่มซ้ำ', () => {
    const { onAdd, onViewList } = renderStatus('added')
    const btn = screen.getByTestId(`yam-added-${YAMS[0].id}`)
    expect(btn.textContent).toBe(YAM_ADDED_LABEL)
    fireEvent.click(btn)
    expect(onViewList).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('🔴 past → "เลยเวลา" และ **กดไม่ได้จริง** (ถอด disabled ⇒ ข้อนี้แดง)', () => {
    const { onAdd, onViewList } = renderStatus('past')
    const btn = screen.getByTestId(`yam-past-${YAMS[0].id}`) as HTMLButtonElement
    expect(btn.textContent).toBe(YAM_PAST_LABEL)
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onAdd).not.toHaveBeenCalled()
    expect(onViewList).not.toHaveBeenCalled()
  })

  it('🔴 ทั้งสามสถานะยัง **เห็นยามอยู่ในรายการ** ❌ ไม่ถูกซ่อน (เหตุผลเดียวกับปุ่มล็อกของ #316)', () => {
    for (const st of ['addable', 'added', 'past'] as YamReminderStatus[]) {
      renderStatus(st)
      expect(screen.getByText(YAMS[0].window)).toBeTruthy()
      cleanup()
    }
  })

  it('🔴 NEGATIVE CONTROL · สามสถานะให้ป้ายไม่ซ้ำกันเลย', () => {
    // ⚠️ เลือกด้วย testid ต่อสถานะ ❌ ไม่ใช่ getByRole('button') — การ์ดมีปุ่ม info อยู่ด้วยและมี 2 ยาม
    //    selector ที่กว้างไปจะ **throw** ("found multiple") ซึ่งอ่านเป็น error ไม่ใช่ "ป้ายซ้ำกัน"
    //    = ฟันที่ล้มด้วยเหตุคนละอย่างกับที่มันตั้งใจเฝ้า (โดนตอนเขียนไฟล์นี้เอง)
    const byStatus: Record<string, string> = { addable: 'yam-add', added: 'yam-added', past: 'yam-past' }
    const labels: string[] = []
    for (const st of ['addable', 'added', 'past'] as YamReminderStatus[]) {
      renderStatus(st)
      labels.push(screen.getByTestId(`${byStatus[st]}-${YAMS[0].id}`).textContent ?? '')
      cleanup()
    }
    expect(new Set(labels).size).toBe(3)
  })

  it('locked (free) ชนะทุกสถานะ — ยามที่เลยเวลาแล้วก็ยังต้องเห็นป้าย "เฉพาะสมาชิก" ไม่ใช่ "เลยเวลา"', () => {
    render(<YamTimes yams={YAMS} onAdd={vi.fn()} locked statusFor={() => 'past'} onViewList={vi.fn()} />)
    expect(screen.getByTestId(`yam-add-locked-${YAMS[0].id}`)).toBeTruthy()
    expect(screen.queryByTestId(`yam-past-${YAMS[0].id}`)).toBeNull()
  })
})

// ── ตรรกะที่อยู่เบื้องหลัง — ยิงตรง ไม่ผ่านเพจ (นาฬิกาป้อนเอง ไม่พึ่งนาฬิกาผนัง) ──
describe('#343 · yamReminderStatus — เวลาเป็นค่าที่ป้อน ไม่ใช่ค่าที่รันเจอ', () => {
  const yam = YAMS[0]
  const date = '2026-08-20'

  it('เพิ่มแล้ว ชนะ เลยเวลา เสมอ (ฟีมเคาะ) — ไม่งั้นผู้ใช้จะนึกว่าของที่ตั้งไว้หายไป', () => {
    const wayPast = new Date('2027-01-01T00:00:00Z')
    expect(yamReminderStatus({ yam, date, addedYamIds: [yam.id], now: wayPast })).toBe('added')
  })

  it('ยังไม่ถึงเวลา + ยังไม่เพิ่ม → addable', () => {
    expect(yamReminderStatus({ yam, date, addedYamIds: [], now: new Date('2026-08-19T00:00:00Z') })).toBe('addable')
  })
})
