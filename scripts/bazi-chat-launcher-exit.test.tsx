// #376 A2 — ปุ่มลอยแชทค้างใน DOM แล้วกินคลิกของปุ่ม "ซื้อเพิ่ม"
//
// 🔴 อ่านตรงนี้ก่อนเชื่อว่าไฟล์นี้เฝ้า A2 — **มันไม่ได้เฝ้า**
//
// ผมเขียนไฟล์นี้ก่อนแก้โค้ด แล้วยิงมันบนโค้ดที่ยังมีบั๊กเต็มๆ ตามลำดับของ /ggg §0
//   บนโค้ดที่ยังไม่แก้            →  **เขียว** (1 passed)
//   ใส่มิวแทนต์ `{!open ?` → `{true ?`  →  **แดง**
// ⇒ ฟันนี้กัด "ใครลบเงื่อนไข `!open` ทิ้ง" ได้จริง แต่ **มองไม่เห็นบั๊กที่ทำให้ใบนี้ถูกตีกลับ**
//   เพราะ jsdom ไม่ได้เดินแอนิเมชันจริง — AnimatePresence จึงถอด node ทุกครั้ง
//   ไม่ว่า exit transition จะมี `repeat: Infinity` ค้างอยู่หรือไม่
//
// 🔑 **มิวแทนต์ที่รอดจากไฟล์นี้ (เขียนไว้ให้คนถัดไปเห็น ไม่ใช่ซ่อน)**:
//     ถอด `exit.transition` ใน bazi-chat-launcher.tsx ออก ⇒ บั๊กกลับมาเต็มรูป ⇒ **ไฟล์นี้ยังเขียว**
//     ⇒ ด่านจริงของ A2 อยู่บนเบราว์เซอร์เท่านั้น (Playwright · elementFromPoint / คลิกจริง)
//
// เก็บไฟล์นี้ไว้เพราะมันเฝ้าคนละคลาส (โครงสร้าง) ❌ ไม่ใช่เพราะมันเป็นหลักฐานของ A2
// ชื่อของมันจึงต้องพูดสิ่งที่มันเฝ้าจริง — ฟันที่ตั้งชื่อตามคลาสที่มันไม่ได้เฝ้า แย่กว่าไม่มีฟัน
//
// อาการจริงที่บองวัดบนเบราว์เซอร์ (สนามซ้อม · 2026-08-25):
//   launcher  opacity 0  t760 l301 w65 h65  z-[10000]   ← ค้าง วัดที่ 1/4/8 วินาที ค้างทั้งสามครั้ง
//   ซื้อเพิ่ม   opacity 1  t762 l315 w58 h28
//   elementFromPoint กึ่งกลาง "ซื้อเพิ่ม" → "เปิดแชทซินแส Mumate"
//   Playwright ปฏิเสธคลิกเอง: "<div aria-label=เปิดแชทซินแส Mumate> intercepts pointer events"
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/chat/use-bazi-chat-access', () => ({
  useBaziChatAccess: () => ({ enabled: true, userId: 'u1', loading: false }),
}))
// โมดัลจริงลาก stream/localStorage/VisualViewport มาทั้งพวง — ข้อนี้ไม่ได้ถามถึงมัน
vi.mock('@/components/bazi-chat-modal', () => ({
  default: () => <div data-testid="chat-modal-stub" />,
}))

const LAUNCHER = 'เปิดแชทซินแส Mumate'

afterEach(cleanup)

describe('#376 A2 — โครงสร้างของปุ่มลอยแชท (❌ ไม่ใช่ด่านของ A2 · ด่านจริงอยู่บนเบราว์เซอร์)', () => {
  it('เงื่อนไข !open ต้องยังอยู่: เปิดแชทแล้วต้องไม่มี node ปุ่มลอยเหลือใน DOM', async () => {
    const { default: BaziChatLauncher } = await import('@/components/bazi-chat-launcher')
    render(<BaziChatLauncher />)

    const launcher = screen.getByLabelText(LAUNCHER)
    fireEvent.click(launcher)

    // โมดัลขึ้นแล้วจริง — ถ้าไม่ยืนยันข้อนี้ เทสต์จะเขียวได้ด้วยการที่ "ไม่มีอะไรเกิดขึ้นเลย"
    expect(screen.getByTestId('chat-modal-stub')).toBeTruthy()

    await waitFor(
      () => expect(screen.queryByLabelText(LAUNCHER)).toBeNull(),
      { timeout: 3000 },
    )
  })
})
