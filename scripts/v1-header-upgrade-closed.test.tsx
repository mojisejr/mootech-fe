// #427 — ฟันของป้าย "อัพเกรด" บน header (จุดที่ 5 · ทางเข้าที่กว้างที่สุด)
//
// 🔴 ทำไมจุดนี้ต่างจากอีก 4 จุด: header-v2 ถูกใช้ใน **16 ไฟล์** และ `setIsShowUpgrade(true)` ยิงเมื่อผู้ใช้
// **ไม่มี payment หรือหมดอายุ** (header-v2.tsx:86-90) ⇒ ผู้ใช้ฟรีทุกคนเห็นป้ายนี้เกือบทุกหน้าของแอป
// ⇒ ทางเข้านี้กว้างกว่า 4 จุดแรกรวมกัน (บองไล่เจอและยืนยันเลข 16 · ผมนับได้ 12 เพราะใส่ `head -12` เอง)
//
// 🔴 ที่นี่ใช้ toast ของ ComingSoon **ได้** ต่างจากในโมดัลแชต — เหตุผลเดียวกันทั้งคู่คือ z:
//      ComingSoon toast z-[60] · header z-50           ⇒ toast อยู่เหนือ ✅
//      ComingSoon toast z-[60] · โมดัลแชต z-[9999]     ⇒ toast อยู่ใต้  ❌ (#376)
// เคส "toast อยู่เหนือ header" ข้างล่างคือฟันที่กันการย้าย header ไปอยู่ z สูงกว่า 60 แล้วไม่มีใครรู้ว่า
// คำตอบหายไปอยู่ข้างใต้
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

  it('toast ต้องอยู่ชั้นเหนือ header — กันการย้าย header ไป z สูงกว่า 60 แล้วคำตอบหายไปอยู่ข้างใต้', async () => {
    await mount()
    fireEvent.click(await screen.findByTestId('header-upgrade'))
    const toastZ = Number(
      (screen.getByTestId('coming-soon-toast').className.match(/z-\[(\d+)\]/) || [])[1],
    )
    const bar = screen.getByTestId('header-upgrade').closest('div[class*="z-"]')
    const barZ = Number((bar?.className.match(/z-(\d+)/) || [])[1])
    expect(toastZ).toBeGreaterThan(barZ)
  })
})
