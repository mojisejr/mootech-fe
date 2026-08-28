// #376 — ฟันของ "v1 ขายไม่ได้แล้ว" ชั้น CTA (จุด ③ แชต และ ④ โปรไฟล์)
//
// 🔴 ฟันนี้วัดว่า **กดแล้วมีคำตอบออกมาบนจอ** ❌ ไม่ใช่ "ปุ่มไม่พาไปหน้าขาย"
// เหตุผล: การเอา href ออกเฉย ๆ ทำให้ DoD ข้อ "ไม่ใช่เงียบ" ล้มโดยที่ทุก assertion เรื่อง navigation ยังเขียว
// (features/v2-shell/components/ComingSoon.tsx:10 เขียนกฎนี้ไว้เอง: "It does not pretend to succeed" —
//  ปุ่มที่กดแล้วไม่เกิดอะไร ผู้ใช้อ่านว่าแอปพัง ไม่ได้อ่านว่าปิดการขาย)
//
// 🔴 ทำไมไม่ใช้ ComingSoonAction ตามที่ใบเสนอ — และทำไมเรื่องนี้ต้องมีฟัน:
// toast ของมัน render ที่ z-[60] ส่วนโมดัลแชตอยู่ที่ z-[9999] (bazi-chat-modal.tsx:250)
// ⇒ toast จะ mount จริง ผ่านทุก assertion เรื่อง announce() แล้ว **วาดอยู่ใต้โมดัล** ⇒ ผู้ใช้กดแล้วเห็นความเงียบ
// เคส "ข้อความอยู่ในซับทรีเดียวกับโมดัล" ข้างล่างคือฟันที่กันการเปลี่ยนกลับไปใช้ toast ระดับ document
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/' }) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { name: 'ทดสอบ' } }, status: 'authenticated' }) }))
vi.mock('@/lib/chat/use-chat-sessions', () => ({
  useChatSessions: () => ({
    sessions: [], activeId: null, ready: true,
    newSession: vi.fn(), switchTo: vi.fn(), rename: vi.fn(), remove: vi.fn(), persist: vi.fn(),
  }),
}))
vi.mock('@/lib/chat/use-bazi-chat-stream', () => ({ useBaziChatStream: () => ({ streamChat: vi.fn(), abort: vi.fn() }) }))
vi.mock('@/components/chat/use-keyboard-inset', () => ({ useKeyboardInset: () => 0 }))
vi.mock('@/components/chat/use-body-scroll-lock', () => ({ useBodyScrollLock: () => {} }))

// ---- จุด ④ โปรไฟล์: หน้านี้ต้องเดินผ่านชั้นตัวตน/คุกกี้/API ก่อนถึงการ์ดเครดิต ----
vi.mock('react-cookie', () => ({ useCookies: () => [{}, vi.fn(), vi.fn()] }))
// สัญญาจริงของ hook คือ { userId, status } และหน้าจะไม่ยิงอะไรเลยจนกว่า status === 'authed'
// (pages/profile/index.tsx:53,100) — mock ที่เดารูปทรงเองจะทำให้เทสต์เขียวบนจอที่ไม่เคย render
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ userId: 'u1', status: 'authed' }) }))
vi.mock('@/lib/what-if/storage', () => ({ WHATIF_CARD_FILENAME: 'x.png', getWhatIfCardBlob: async () => null }))
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: async () => ({ data: { id: 'u1', display_name: 'ทดสอบ' } }) }))
// หน้าเก็บผลลัพธ์ดิบลง state แล้ว .map มันตรง ๆ (pages/profile/index.tsx:169) ⇒ ของจริงคือ "อาเรย์"
// ไม่ใช่ { data: [...] } — mock ที่เดารูปทรงเองทำให้หน้า throw กลางคัน แล้วปุ่มไม่มีวันถูก render
vi.mock('@/constants/api/api-log-survey-get', () => ({ LogSurveyGet: async () => [] }))
vi.mock('@/constants/api/api-member-payment-code-check', () => ({ MemberPaymentCodeCheckApi: async () => ({ data: null }) }))
vi.mock('@/components/header', () => ({ default: () => null }))
vi.mock('@/components/header-v2', () => ({ default: () => null }))
vi.mock('@/components/modal-image-crop', () => ({ default: () => null }))
vi.mock('@/components/survey-card', () => ({ default: () => null }))
vi.mock('@/components/screen-loading', () => ({ default: () => null }))

beforeEach(() => {
  // jsdom ไม่มี scrollIntoView — โมดัลเรียกมันทุกครั้งที่ historyChat เปลี่ยน (bazi-chat-modal.tsx:129)
  Element.prototype.scrollIntoView = vi.fn()
  // ยอดเหลือ 0 = สภาพเดียวที่ปุ่ม "ซื้อเพิ่ม" ถูก render (bazi-chat-modal.tsx:380)
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ balance: 0, unlimited: false, enforced: true }),
  })) as any)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('#376 ③ CTA เติมเครดิตในแชต', () => {
  it('ปุ่มยังอยู่จริงตอนโควตาหมด — negative control ของเครื่องมือวัด', async () => {
    const Modal = (await import('@/components/bazi-chat-modal')).default
    render(<Modal userId="u1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('chat-topup')).toBeTruthy())
  })

  it('กดแล้วบอกว่าปิดการขาย ❌ ไม่ใช่เงียบ', async () => {
    const Modal = (await import('@/components/bazi-chat-modal')).default
    render(<Modal userId="u1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('chat-topup')).toBeTruthy())
    expect(screen.queryByTestId('chat-topup-notice')).toBeNull()
    fireEvent.click(screen.getByTestId('chat-topup'))
    expect(screen.getByTestId('chat-topup-notice').textContent).toContain('ปิดการขายชั่วคราว')
  })

  it('ปุ่มไม่ใช่ลิงก์ไปหน้าขายอีกต่อไป', async () => {
    const Modal = (await import('@/components/bazi-chat-modal')).default
    const { container } = render(<Modal userId="u1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('chat-topup')).toBeTruthy())
    const links = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || '')
    expect(links.filter((h) => h.includes('package-price'))).toEqual([])
  })

  it('ข้อความคำตอบอยู่ในซับทรีเดียวกับโมดัล — กัน toast ที่ z ต่ำกว่าโมดัลกลับมา', async () => {
    const Modal = (await import('@/components/bazi-chat-modal')).default
    render(<Modal userId="u1" onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('chat-topup')).toBeTruthy())
    fireEvent.click(screen.getByTestId('chat-topup'))
    const notice = screen.getByTestId('chat-topup-notice')
    const button = screen.getByTestId('chat-topup')
    // ปุ่มกับข้อความต้องอยู่ใต้ container เดียวกัน ⇒ อยู่ใน stacking context เดียวกับโมดัลโดยอัตโนมัติ
    const modalRoot = button.closest('[class*="z-[9999]"]')
    expect(modalRoot).not.toBeNull()
    expect(modalRoot!.contains(notice)).toBe(true)
  })
})

describe('#376 ④ CTA เติมเครดิตในโปรไฟล์', () => {
  it('ปุ่มยังอยู่จริงตอนโควตาหมด — negative control ของเครื่องมือวัด', async () => {
    const Page = (await import('@/pages/profile/index')).default
    render(<Page />)
    await waitFor(() => expect(screen.getByTestId('profile-topup')).toBeTruthy())
  })

  it('กดแล้วบอกว่าปิดการขาย และบอกว่าเครดิตเดิมยังใช้ได้', async () => {
    const Page = (await import('@/pages/profile/index')).default
    render(<Page />)
    await waitFor(() => expect(screen.getByTestId('profile-topup')).toBeTruthy())
    expect(screen.queryByTestId('profile-topup-notice')).toBeNull()
    fireEvent.click(screen.getByTestId('profile-topup'))
    const t = screen.getByTestId('profile-topup-notice').textContent || ''
    expect(t).toContain('ปิดการขายชั่วคราว')
    expect(t).toContain('ยังใช้ได้ตามปกติ')
  })
})
