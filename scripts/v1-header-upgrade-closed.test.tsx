// #427 — ฟันของป้าย "อัพเกรด" บน header (จุดที่ 5 · ทางเข้าที่กว้างที่สุด)
//
// 🔴 ทำไมจุดนี้ต่างจากอีก 4 จุด: header-v2 ถูกใช้ใน **16 ไฟล์** และ `setIsShowUpgrade(true)` ยิงเมื่อผู้ใช้
// **ไม่มี payment หรือหมดอายุ** (header-v2.tsx:86-90) ⇒ ผู้ใช้ฟรีทุกคนเห็นป้ายนี้เกือบทุกหน้าของแอป
// ⇒ ทางเข้านี้กว้างกว่า 4 จุดแรกรวมกัน (บองไล่เจอและยืนยันเลข 16 · ผมนับได้ 12 เพราะใส่ `head -12` เอง)
//
// 🔴 ที่นี่ใช้ toast ของ ComingSoon **ได้** ต่างจากในโมดัลแชต (#376)
//   เหตุผลเดิมตรงนี้เทียบเลข z ตรงๆ — **ผิด**: toast เคย render เป็นลูกของแถบ z-50 ⇒ เลขของมันถูก
//   ตีความในกรงนั้น ไม่ใช่ระดับหน้า (ตู๋จับ · บองพิสูจน์ด้วยพิกเซล) · ตอนนี้ toast portal ไป
//   document.body แล้ว — ดู ComingSoon.tsx
// ⇒ เคสสุดท้ายในไฟล์นี้จึงปัก **คุณสมบัติ** (ไม่ถูกขังในกรงของใคร) ก่อน แล้วค่อยเทียบเลข
//   ซึ่งเพิ่งจะแปลว่าอะไรได้ *หลัง* หลุดจากกรง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
const replace = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ replace, push: vi.fn(), query: {}, pathname: '/' }) }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn(), useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('react-cookie', () => ({ useCookies: () => [{}, vi.fn(), vi.fn()] }))
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ userId: 'u1', status: 'authed' }) }))
vi.mock('@/lib/hooks/use-has-mounted', () => ({ useHasMounted: () => true }))
vi.mock('@/components/menu', () => ({ default: () => null }))
vi.mock('@/constants/api/api-otp-get', () => ({ OTPGet: vi.fn() }))
vi.mock('@/constants/api/api-otp-verify', () => ({ OTPVerify: vi.fn() }))
// ผู้ใช้ที่ยังไม่จ่าย = สภาพเดียวที่ป้าย "อัพเกรด" ถูก render (header-v2.tsx:86-90)
vi.mock('@/constants/api/api-user-get', () => ({
  UserGetById: vi.fn(async () => ({ user_id: 'u1', payment: null })),
}))

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.advanceTimersByTime(5000); cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

const mount = async () => {
  const Header = (await import('@/components/header-v2')).default
  return render(<Header isShowMenu={true} isLogin={true} image="" />)
}

describe('#427 ⑤ ป้าย "อัพเกรด" บน header', () => {
  it('ป้ายโผล่จริงสำหรับผู้ใช้ที่ยังไม่จ่าย — negative control ของเครื่องมือวัด', async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId('header-upgrade')).toBeTruthy())
  })

  it('เป็นตัวควบคุมที่โฟกัสด้วยคีย์บอร์ดได้ — ของเดิมเป็น <span onClick>', async () => {
    await mount()
    const el = await screen.findByTestId('header-upgrade')
    expect(el.tagName).toBe('BUTTON')
  })

  it('กดแล้วบอกว่าปิดการขาย ❌ ไม่ใช่เงียบ', async () => {
    await mount()
    const el = await screen.findByTestId('header-upgrade')
    expect(screen.queryByTestId('coming-soon-toast')).toBeNull()
    fireEvent.click(el)
    const t = screen.getByTestId('coming-soon-toast').textContent || ''
    expect(t).toContain('ปิดการขายชั่วคราว')
    expect(t).toContain('ยังใช้งานได้ตามปกติ')
  })

  it('ไม่พาผู้ใช้ออกจากหน้าที่เขากำลังดู — router.replace ต้องไม่ถูกเรียก', async () => {
    await mount()
    fireEvent.click(await screen.findByTestId('header-upgrade'))
    expect(replace).not.toHaveBeenCalled()
  })

  // 🔴 ฟันตัวนี้เขียนใหม่ทั้งอัน — ของเดิมเทียบ `toastZ > barZ` (60 > 50) แล้วเขียวตลอด
  // **ทั้งตอนที่ถูกและตอนที่ผิด** เพราะ toast อยู่ *ข้างใน* bar นั้น ⇒ z ของมันถูกตีความภายใน
  // stacking context ของ bar ⇒ ตัวเลขที่เอามาเทียบไม่ได้ตัดสินอะไรเลยว่าใครทับใครบนหน้าจอ
  // ตู๋จับได้ในรีวิว · บองพิสูจน์ด้วยพิกเซลบนเบราว์เซอร์จริง (overlay z-60 → กรอบ toast ขาวล้วน)
  //
  // ของใหม่ปัก **คุณสมบัติ** แทน **สูตร**: toast ต้องไม่มีบรรพบุรุษที่ถือ z เลย และต้องอยู่ที่ body
  // สองบรรทัดนี้ไม่ผูกกับเลข z ใดๆ ⇒ ย้าย header ไป z เท่าไหร่ก็ไม่ทำให้มันตอบผิด
  it('toast ต้องไม่ถูกขังใน stacking context ของใคร — ไม่มีบรรพบุรุษที่ถือ z และอยู่ที่ body', async () => {
    await mount()
    fireEvent.click(await screen.findByTestId('header-upgrade'))
    const toast = screen.getByTestId('coming-soon-toast')
    // ⚠️ ถามจาก parentElement ขึ้นไป ❌ ไม่ใช่ toast.closest(...) — `closest` เริ่มนับที่ตัวเอง
    // และตัว toast ถือ z-[9000] ของมันเอง ⇒ เขียนแบบนั้นจะแดงตลอดไม่ว่าโค้ดถูกหรือผิด
    // (สูตรที่เสนอกันไว้ในรีวิวเป็นแบบนั้นพอดี — จับได้ตอนยิงจริง ไม่ใช่ตอนอ่าน)
    expect(toast.parentElement?.closest('[class*="z-"]')).toBeNull()
    expect(toast.parentElement).toBe(document.body)

    // และ *หลังจาก* หลุดจากกรงแล้วเท่านั้น การเทียบตัวเลขถึงจะแปลว่าอะไร: ตอนนี้แถบ header กับ toast
    // อยู่คนละกิ่งใต้ root context เดียวกัน ⇒ เลขที่ใหญ่กว่าทับจริง (ก่อนแก้ ทั้งคู่อยู่กรงเดียวกัน
    // เลขจึงไม่ตัดสินอะไร) ⇒ บรรทัดนี้กันคนลดเลข z ของ toast ลงมาต่ำกว่า chrome
    const bar = screen.getByTestId('header-upgrade').closest('div[class*="z-"]')
    expect(bar?.contains(toast)).toBe(false) // เงื่อนไขที่ทำให้บรรทัดถัดไปมีความหมาย
    const zOf = (el: Element | null | undefined) =>
      Number((el?.className.match(/z-\[?(\d+)\]?/) || [])[1])
    expect(zOf(toast)).toBeGreaterThan(zOf(bar))
  })
})
