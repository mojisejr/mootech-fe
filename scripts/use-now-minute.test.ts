// #586 — ฟันของ useNowMinute: `now` บนจอปฏิทินต้องเดินต่อ ไม่ค้างจาก render แรก
//
// อาการที่ใบ #586 รายงาน ("ยาม 23:00-00:59 ผ่านไปแล้วยังกดได้") ตรรกะ anchor จับถูกอยู่แล้ว
// (ฟันอยู่ที่ scripts/reminder-cta.test.tsx หัว #586) — สิ่งที่ขาดคือหน้าไม่เคยอ่านนาฬิกาใหม่หลัง mount
// ⇒ หน้าค้างข้ามช่วงเวลาแล้วปุ่มเก่าแสดงผิด ตัวนี้ทำให้ `now` เดินทุก 30 วิ + ตอนกลับมาดูแท็บ
//
// 🔴 MUTANT CONTRACT:
//   N1 ถอด setInterval ทิ้ง → "เดินตามเวลาจริง" แดง (ข้าม 31 วิ แล้วนาฬิกาไม่ขยับ)
//   N2 ถอด visibilitychange tick ทิ้ง → "กลับมาดูแท็บแล้วอ่านใหม่" แดง
//   N3 ใช้ useState(new Date()) โดยไม่มี effect → N1 แดงเหมือนกัน (ค่าค้างตลอดชีวิต component)
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useNowMinute } from '@/features/v2-calendar/hooks/use-now-minute'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('#586 · useNowMinute', () => {
  it('N1 ให้ค่าเวลาใหม่เมื่อเวลาเดินข้าม interval', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T21:00:00+07:00'))
    const { result } = renderHook(() => useNowMinute())
    const first = result.current.getTime()

    await act(async () => { vi.advanceTimersByTime(31_000) })
    expect(result.current.getTime()).toBeGreaterThan(first)
  })

  it('N2 แท็บกลับมาโชว์ (visibilitychange) → อ่านนาฬิกาใหม่ทันที ไม่รอ interval', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T21:00:00+07:00'))
    const { result } = renderHook(() => useNowMinute(60 * 60_000)) // interval ยาวมาก — ไม่มีทางทันเดินเอง
    const first = result.current.getTime()

    vi.setSystemTime(new Date('2026-09-03T23:30:00+07:00'))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.getTime()).toBeGreaterThan(first)
  })
})
