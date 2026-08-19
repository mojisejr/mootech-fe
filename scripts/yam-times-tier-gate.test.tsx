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
import { YamTimes, YAM_LOCKED_MESSAGE } from '@/features/v2-calendar/components/day-detail/YamTimes'
import { remindersLocked } from '@/features/v2-calendar/tier-lock'
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
  render(<YamTimes yams={YAMS} onAdd={onAdd} locked={locked} />)
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

  it('locked → กดแล้วได้คำตอบว่าเป็นของสมาชิก ❌ ไม่ใช่เงียบ', () => {
    mount(true)
    fireEvent.click(screen.getByTestId('yam-add-locked-y1'))
    // assert ข้อความที่ผู้ใช้อ่านจริง ไม่ใช่แค่ว่ามี element โผล่มา
    expect(screen.getByTestId('coming-soon-toast').textContent).toBe(YAM_LOCKED_MESSAGE)
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
