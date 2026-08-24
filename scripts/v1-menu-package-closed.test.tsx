// #427 — ฟันของเมนู 2 รายการที่พาไปหน้าขาย (จุดที่ 6 · 7)
//
// 🔑 จุดนี้หลุดจากการกวาด **สองรอบของสองคน** ด้วยกลไกเดียวกัน:
//   ผม  — ไล่ 11 จุดเจอเมนูตั้งแต่ต้น แล้วโฟกัสแค่ 4 จุดที่ *ใบ* เขียนไว้ ⇒ มีข้อมูลแล้วแต่ไม่ได้ใช้
//   บอง — กวาดทั้งรีโปแล้ว filter ด้วย `push|replace|href|Link` ⇒ เมนูเก็บปลายทางไว้ใน key `to:`
//         แล้วค่อย navigate ที่บรรทัดอื่น ⇒ filter กินมันทิ้งเงียบ ๆ
// ⇒ ทั้งคู่คือ "เลขจากกรอบที่เราวาดเอง" · เคสชุดนี้ทำให้การถอยกลับล้มดัง แทนที่จะเงียบอีกครั้ง
//
// 📌 ยืนยันแล้วว่า items[5] (บรรทัด 253) และ items[7] (300) อยู่ **นอก** บล็อกคอมเมนต์ JSX
//    (คอมเมนต์อยู่ที่ 188-219 · 283-298 · 315-330 · 335-338) ⇒ render จริง กดได้จริง
//    ส่วน menus[2] "แพ็คเกจราคา" ระดับบนสุด **ไม่ถูกอ้างเลยแม้แต่ครั้งเดียว** และไฟล์นี้ไม่มี .map
//    ⇒ ไม่ render ไม่ต้องแก้ (บองฝากให้ไล่ — นี่คือคำตอบ)
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
const replace = vi.fn()
vi.mock('next/router', () => ({ useRouter: () => ({ replace, push: vi.fn(), query: {}, pathname: '/' }) }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn(), useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('react-cookie', () => ({ useCookies: () => [{}, vi.fn(), vi.fn()] }))
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ userId: 'u1', status: 'authed' }) }))
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: vi.fn(async () => ({ user_id: 'u1', payment: null })) }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const mount = async () => {
  const Menu = (await import('@/components/menu')).default
  return render(<Menu isShowMenu={true} />)
}

const cases: Array<[string, string, string]> = [
  ['menu-horoscope', 'menu-horoscope-notice', 'ดูดวง → หน้าขายดวง'],
  ['menu-price', 'menu-price-notice', 'แพ็คเกจราคา'],
]

describe.each(cases)('#427 เมนู "%s"', (testId, noticeId, label) => {
  it(`${label} — รายการยังอยู่จริง (negative control ของเครื่องมือวัด)`, async () => {
    await mount()
    await waitFor(() => expect(screen.getByTestId(testId)).toBeTruthy())
  })

  it(`${label} — กดแล้วบอกว่าปิดการขาย ❌ ไม่ใช่เงียบ`, async () => {
    await mount()
    const row = await screen.findByTestId(testId)
    expect(screen.queryByTestId(noticeId)).toBeNull()
    fireEvent.click(row)
    const t = screen.getByTestId(noticeId).textContent || ''
    expect(t).toContain('ปิดการขายชั่วคราว')
    expect(t).toContain('ยังใช้งานได้ตามปกติ')
  })

  it(`${label} — ไม่พาผู้ใช้ออกจากหน้าที่เขากำลังดู`, async () => {
    await mount()
    fireEvent.click(await screen.findByTestId(testId))
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('#427 · คำตอบต้องผูกกับแถวที่กด ไม่ใช่โผล่ทุกแถวพร้อมกัน', () => {
  it('กด "ดูดวง" แล้วคำตอบของ "แพ็คเกจราคา" ต้องไม่โผล่ด้วย', async () => {
    await mount()
    fireEvent.click(await screen.findByTestId('menu-horoscope'))
    expect(screen.getByTestId('menu-horoscope-notice')).toBeTruthy()
    expect(screen.queryByTestId('menu-price-notice')).toBeNull()
  })
})
