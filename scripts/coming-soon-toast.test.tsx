// #323 — ฟันของ "toast เร็วๆ นี้ ค้างข้ามหน้า"
//
// 🔴 ฟันนี้วัด **อายุของข้อความใน store โมดูล** ❌ ไม่ใช่ "ปุ่มกดแล้วมี toast"
// เหตุผล: อาการที่ผู้ใช้เจอไม่ได้เกิดตอนกด มันเกิดบน**หน้าถัดไป** — ผู้ใช้กดปุ่ม coming-soon แล้วออกจาก
// หน้านั้นภายใน VISIBLE_MS ⇒ ตัวจับเวลาที่เคยเป็นของคอมโพเนนต์ถูกยกเลิกตอน unmount ⇒ `current` ค้าง
// ทั้งอายุแท็บ ⇒ ComingSoonToast ตัวถัดไปที่ mount อ่านมันใน useState(current) แล้ววาด toast ที่ผู้ใช้
// ไม่ได้กด ⇒ เคสที่ต้องแดงคือ "mount ใหม่หลังจากออกจากหน้าไปแล้ว" ไม่ใช่ "กดแล้วเห็นไหม"
//
// 🔴 NEGATIVE CONTROL ของเครื่องมือวัด (เคส 1): ถ้าไม่มีเคสที่ toast **โผล่จริง** เคสที่ assert ว่ามันไม่โผล่
// จะเขียวได้ฟรีจากการที่ selector หาอะไรไม่เจอเลย — เขียวเพราะวัดของว่าง ไม่ใช่เพราะของถูก
//
// 🔴 เคส 3 กันทางแก้ที่เร็วที่สุดแต่ผิด: "ล้าง current ตอน unmount" จะทำให้เคสนี้แดง เพราะ toast ที่ควร
// ถูกส่งต่อให้ตัวถัดไป (elect · ComingSoon.tsx) จะหายกลางคัน — บั๊กที่ตู๋จับไว้ 2026-08-06
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ComingSoonAction, COMING_SOON_MESSAGE } from '@/features/v2-shell/components/ComingSoon'

const VISIBLE_MS = 2200

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  // ไล่ตัวจับเวลาที่ยังค้างให้หมดอายุก่อนเคสถัดไป — ตอนนี้ทำได้เพราะตัวจับเวลาอยู่ที่โมดูล
  // (ก่อน #323 การ unmount ใน cleanup() จะฆ่ามันทิ้ง แล้ว current จะค้างข้ามเคสอย่างที่ #316 บันทึกไว้)
  vi.advanceTimersByTime(VISIBLE_MS * 2)
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const Action = ({ testId = 'cs-a' }: { testId?: string }) => (
  <ComingSoonAction testId={testId} label="ทดสอบ" className="px-2">
    ปุ่ม
  </ComingSoonAction>
)

describe('#323 · อายุของ toast เป็นของ store ไม่ใช่ของปุ่ม', () => {
  it('เครื่องมือวัดเห็น toast ได้จริง — กดแล้วข้อความโผล่ (negative control)', () => {
    render(<Action />)
    expect(screen.queryByTestId('coming-soon-toast')).toBeNull()
    fireEvent.click(screen.getByTestId('cs-a'))
    expect(screen.getByTestId('coming-soon-toast').textContent).toContain(COMING_SOON_MESSAGE)
  })

  it('กดแล้วออกจากหน้าภายใน 2.2 วิ → หน้าถัดไปต้องไม่มี toast เด้งเอง', () => {
    const first = render(<Action />)
    fireEvent.click(screen.getByTestId('cs-a'))
    expect(screen.queryByTestId('coming-soon-toast')).not.toBeNull()

    // ผู้ใช้ออกจากหน้า "ก่อน" ข้อความหมดอายุ — นี่คือจังหวะที่เคยฆ่าตัวจับเวลาทิ้ง
    first.unmount()
    vi.advanceTimersByTime(VISIBLE_MS + 1)

    // หน้าถัดไป
    render(<Action testId="cs-b" />)
    expect(screen.queryByTestId('coming-soon-toast')).toBeNull()
  })

  it('ยังไม่หมดอายุ + เจ้าของ unmount → toast ถูกส่งต่อ ไม่ใช่หายไปเลย (elect ต้องไม่พัง)', () => {
    const Two = ({ showFirst }: { showFirst: boolean }) => (
      <>
        {showFirst && <Action testId="cs-1" />}
        <Action testId="cs-2" />
      </>
    )
    const view = render(<Two showFirst />)
    fireEvent.click(screen.getByTestId('cs-2'))
    expect(screen.queryByTestId('coming-soon-toast')).not.toBeNull()

    // เจ้าของสิทธิ์ (ตัวแรกที่ mount) หายไป ระหว่างที่ข้อความยังไม่หมดอายุ
    view.rerender(<Two showFirst={false} />)
    expect(screen.getByTestId('coming-soon-toast').textContent).toContain(COMING_SOON_MESSAGE)
  })
})
