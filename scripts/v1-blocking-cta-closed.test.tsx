// #427 — ฟันของ "ปุ่มที่ชวนไปซื้อ ต้องตอบตรงที่กด ไม่ใช่พาเดินไปอีกจอเพื่อไปรู้ว่าซื้อไม่ได้"
//
// 🔴 ฟันนี้วัด **กดแล้วมีคำตอบโผล่ในซับทรีเดียวกับตัวปุ่ม** ❌ ไม่ใช่ "ปุ่มไม่ navigate แล้ว"
// เหตุผล: การเอา navigation ออกเฉย ๆ ทำให้ปุ่มเงียบ — ซึ่ง "แก้" อาการ replace ทับ history ได้จริง
// แต่สร้างอาการที่แย่กว่าเดิมแทน (ปุ่มที่กดแล้วไม่เกิดอะไร ผู้ใช้อ่านว่าแอปพัง) ⇒ assertion ที่ดูแค่
// router.replace ไม่ถูกเรียก จะเขียวทั้งบนทางแก้ที่ถูกและทางแก้ที่ผิด
//
// 🔴 และวัด **ที่ซับทรี** เพราะทั้งสองที่อยู่ในกล่องที่ z สูง (ModalBlocking z-[9999]) — คำตอบที่ render
// นอกกล่องจะผ่าน assertion ทุกข้อแล้วไปวาดอยู่ข้างใต้ · บทเรียนตรงจาก #376 (ComingSoon toast z-[60])
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
const replace = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ replace, push: vi.fn(), query: {}, pathname: '/' }) }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('#427 ① ModalBlocking — ปุ่ม "ไปหน้าสมัครสมาชิก"', () => {
  it('ปุ่มยังอยู่ และยังเป็นปุ่มที่กดได้ (negative control ของ selector)', async () => {
    const Modal = (await import('@/components/modal-blocking')).default
    render(<Modal onSubmitOK={vi.fn()} onGoSubscribe={vi.fn()} />)
    const btn = screen.getByTestId('blocking-subscribe')
    expect(btn.tagName).toBe('BUTTON')
    expect(btn.textContent).toContain('ไปหน้าสมัครสมาชิก')
  })

  it('กดแล้วบอกว่าปิดการขาย ❌ ไม่ใช่เงียบ', async () => {
    const Modal = (await import('@/components/modal-blocking')).default
    render(<Modal onSubmitOK={vi.fn()} onGoSubscribe={vi.fn()} />)
    expect(screen.queryByTestId('blocking-subscribe-notice')).toBeNull()
    fireEvent.click(screen.getByTestId('blocking-subscribe'))
    const t = screen.getByTestId('blocking-subscribe-notice').textContent || ''
    expect(t).toContain('ปิดการขายชั่วคราว')
    expect(t).toContain('ยังใช้งานได้ตามปกติ')
  })

  it('ไม่พาผู้ใช้ออกจากหน้าที่เขากำลังดู — ทั้ง onGoSubscribe และ router ต้องไม่ถูกเรียก', async () => {
    const Modal = (await import('@/components/modal-blocking')).default
    const onGoSubscribe = vi.fn()
    render(<Modal onSubmitOK={vi.fn()} onGoSubscribe={onGoSubscribe} />)
    fireEvent.click(screen.getByTestId('blocking-subscribe'))
    expect(onGoSubscribe).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('คำตอบอยู่ในซับทรีของโมดัล — กันคำตอบที่ render นอกกล่อง z สูง', async () => {
    const Modal = (await import('@/components/modal-blocking')).default
    render(<Modal onSubmitOK={vi.fn()} onGoSubscribe={vi.fn()} />)
    fireEvent.click(screen.getByTestId('blocking-subscribe'))
    const dialog = screen.getByTestId('blocking-subscribe').closest('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog!.contains(screen.getByTestId('blocking-subscribe-notice'))).toBe(true)
  })

  it('onGoSubscribe ยังอยู่ในสัญญาของคอมโพเนนต์ (Principle 1) — ส่งมาแล้วไม่ throw', async () => {
    const Modal = (await import('@/components/modal-blocking')).default
    expect(() => render(<Modal onSubmitOK={vi.fn()} onGoSubscribe={vi.fn()} />)).not.toThrow()
  })
})

// ---- จุด ② ปุ่ม "ปลดล็อค" ในการ์ดปฏิทินจีน ----
// ปุ่มนี้ render ก็ต่อเมื่อ API ตอบว่า is_allow=false (calendar-chinese.tsx:575) ⇒ mock ที่ชั้น API
vi.mock('@/constants/api/api-chinese-calendar-get-month', () => ({
  ChineseCalendarGetMonthAPI: vi.fn(async () => ({ is_allow: false, data: [] })),
}))

describe('#427 ② ปุ่ม "ปลดล็อค" ในการ์ดปฏิทินจีน', () => {
  const mount = async () => {
    const Card = (await import('@/components/calendar-chinese')).default
    return render(<Card userId="u1" initMonth={8} initYear={2026} onChangeDate={vi.fn()} />)
  }

  it('ปุ่มโผล่จริงตอนยังไม่มีสิทธิ์ — negative control ของเครื่องมือวัด', async () => {
    await mount()
    expect(await screen.findByTestId('calendar-unlock')).toBeTruthy()
  })

  it('กดแล้วบอกว่าปิดการขาย ❌ ไม่ใช่เงียบ', async () => {
    await mount()
    const btn = await screen.findByTestId('calendar-unlock')
    expect(screen.queryByTestId('calendar-unlock-notice')).toBeNull()
    fireEvent.click(btn)
    const t = screen.getByTestId('calendar-unlock-notice').textContent || ''
    expect(t).toContain('ปิดการขายชั่วคราว')
    expect(t).toContain('ยังใช้งานได้ตามปกติ')
  })

  it('ไม่พาผู้ใช้ออกจากปฏิทินที่กำลังดู — router.replace ต้องไม่ถูกเรียก', async () => {
    await mount()
    fireEvent.click(await screen.findByTestId('calendar-unlock'))
    expect(replace).not.toHaveBeenCalled()
  })
})

// ---- จุด ③ ปุ่ม "ปลดล็อค" ในการ์ดปฏิทิน **รายวัน** ----
// 🔑 จุดนี้เกือบหลุดจาก PR ทั้งใบ: ผมไล่ผู้เรียกด้วย grep คำว่า "calendar-chinese" ซึ่งไม่ match ชื่อไฟล์
// `calendar-dairy-chinese.tsx` แล้วสรุปว่า prop `gotoPayment` ที่ `chinese-calendar:321` ส่งมาไม่มีใครรับ
// = dead code · ของจริงมันมารับที่นี่ และผู้ใช้กดได้จริงในมุมมองรายวัน (บองเปิดไฟล์แล้วชี้ให้เห็น)
// ⇒ เคสชุดนี้คือฟันที่ทำให้ "จุดที่ 4 หายไป" กลายเป็นสิ่งที่ล้มดัง แทนที่จะเป็นสิ่งที่ไม่มีใครสังเกต
vi.mock('@/constants/api/api-chinese-calendar-get-dairy', () => ({
  ChineseCalendarGetDairyAPI: vi.fn(async () => ({ is_allow: false, data: [] })),
}))

describe('#427 ③ ปุ่ม "ปลดล็อค" ในการ์ดปฏิทินรายวัน', () => {
  const mount = async () => {
    const Card = (await import('@/components/calendar-dairy-chinese')).default
    return render(
      <Card userId="u1" initDay={24} initMonth={8} initYear={2026} onChangeDate={vi.fn()} gotoPayment={vi.fn()} />,
    )
  }

  it('ปุ่มโผล่จริงตอนยังไม่มีสิทธิ์ — negative control ของเครื่องมือวัด', async () => {
    await mount()
    expect(await screen.findByTestId('dairy-unlock')).toBeTruthy()
  })

  it('กดแล้วบอกว่าปิดการขาย ❌ ไม่ใช่เงียบ', async () => {
    await mount()
    const btn = await screen.findByTestId('dairy-unlock')
    expect(screen.queryByTestId('dairy-unlock-notice')).toBeNull()
    fireEvent.click(btn)
    const t = screen.getByTestId('dairy-unlock-notice').textContent || ''
    expect(t).toContain('ปิดการขายชั่วคราว')
    expect(t).toContain('ยังใช้งานได้ตามปกติ')
  })

  it('ไม่พาผู้ใช้ออกจากวันที่กำลังดู — gotoPayment ที่หน้าส่งมาต้องไม่ถูกเรียก', async () => {
    const Card = (await import('@/components/calendar-dairy-chinese')).default
    const gotoPayment = vi.fn()
    render(<Card userId="u1" initDay={24} initMonth={8} initYear={2026} onChangeDate={vi.fn()} gotoPayment={gotoPayment} />)
    fireEvent.click(await screen.findByTestId('dairy-unlock'))
    expect(gotoPayment).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })
})
