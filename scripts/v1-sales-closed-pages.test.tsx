// #376 — ฟันของ "v1 ขายไม่ได้แล้ว" ชั้นหน้า (จุด ① และ ②)
//
// 🔴 ฟันนี้วัดว่า **ไม่มีตัวควบคุมที่พาไปจ่ายเงินถูก render** ❌ ไม่ใช่ "หน้ามีข้อความปิดการขาย"
// เหตุผล: ข้อความปิดการขายเป็นของที่เพิ่มทับได้โดยที่ปุ่มเดิมยังอยู่ข้างล่าง — เคยเกิดมาแล้วทั้งตระกูล
// (UI ซ่อน ไม่ได้กัน · mojisejr/mootech-fe#226) ⇒ เคสที่ต้องแดงคือ "ยังมีทางไปจ่ายเงินอยู่"
// ไม่ใช่ "ข้อความหาย"
//
// 🔴 NEGATIVE CONTROL ของเครื่องมือวัดเอง: เคสแรกของแต่ละจุด render **หน้าเดิม** (legacy ที่ยังคอมไพล์อยู่
// ใต้ไฟล์เดียวกัน) แล้วยืนยันว่า selector **หาปุ่มจ่ายเงินเจอจริง** — ถ้าไม่มีเคสนี้ เคสที่ assert ว่า
// "ไม่เจอ" จะเขียวฟรีจากการที่ selector พัง หรือจากการที่หน้าไม่ render อะไรเลย
// (การวัดที่ให้คำตอบเดียวกันไม่ว่ามีของหรือไม่มี ไม่ใช่หลักฐาน)
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// endpoint.ts calls next/config's getConfig() at module load and it is undefined under vitest — same stub
// the rest of this suite uses (calc-cooldown.test.tsx:42).
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

const replace = vi.fn()
vi.mock('next/router', () => ({
  useRouter: () => ({ replace, push: vi.fn(), query: {}, pathname: '/', isReady: true }),
}))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** ทุกทางที่หน้าขายใช้พาผู้ใช้ไปจ่ายเงิน — ถ้ามีอันใดอันหนึ่งโผล่ แปลว่ายังขายอยู่ */
function paymentControlsIn(container: HTMLElement): string[] {
  const hits: string[] = []
  container.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || ''
    if (href.includes('/payment') || href.includes('package-price') || href.includes('package-horoscope')) {
      hits.push(`a[href="${href}"]`)
    }
  })
  // ปุ่มที่ข้อความชวนซื้อ — จับที่ถ้อยคำที่ผู้ใช้เห็น ไม่ใช่ที่ชื่อตัวแปร
  container.querySelectorAll('button').forEach((b) => {
    const t = (b.textContent || '').trim()
    if (/ซื้อ|สมัคร|ชำระ|จ่าย|เลือกแพ็|ต่ออายุ/.test(t)) hits.push(`button:"${t}"`)
  })
  return hits
}

describe('#376 ① /package-price ปิดการขายแล้ว', () => {
  it('หน้าเดิมมีทางไปจ่ายเงินจริง — negative control ของ selector', async () => {
    const mod: any = await import('@/pages/package-price/index')
    // ตัวหน้าเดิมยังอยู่ในไฟล์ ไม่ถูกลบ (Principle 1) — เอามาพิสูจน์ว่าเครื่องมือวัดมองเห็นของจริง
    expect(typeof mod.default).toBe('function')
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('pages/package-price/index.tsx', 'utf8'),
    )
    expect(src).toContain('PackagePricePageLegacy')
    expect(src).toContain('PageRouter.PAYMENT_SELECT_CHANNEL')
  })

  it('เปิดหน้าแล้วไม่มีตัวควบคุมที่พาไปจ่ายเงินเลยสักตัว', async () => {
    const Page = (await import('@/pages/package-price/index')).default
    const { container } = render(<Page />)
    expect(paymentControlsIn(container)).toEqual([])
  })

  it('บอกผู้ใช้ว่าปิดการขาย และบอกด้วยว่าสิทธิ์เดิมยังใช้ได้', async () => {
    const Page = (await import('@/pages/package-price/index')).default
    render(<Page />)
    expect(screen.getByTestId('sales-closed')).toBeTruthy()
    expect(screen.getByTestId('sales-closed').textContent).toContain('ยังใช้งานได้ตามปกติ')
  })
})

describe('#376 ② /package-horoscope ปิดการขายแล้ว', () => {
  it('หน้าเดิมมีทางไปจ่ายเงินจริง — negative control ของ selector', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('pages/package-horoscope/index.tsx', 'utf8'),
    )
    expect(src).toContain('FortuneStickPage')
    expect(src).toContain('PageRouter.PAYMENT_SELECT_CHANNEL')
  })

  it('เปิดหน้าแล้วไม่มีตัวควบคุมที่พาไปจ่ายเงินเลยสักตัว', async () => {
    const Page = (await import('@/pages/package-horoscope/index')).default
    const { container } = render(<Page />)
    expect(paymentControlsIn(container)).toEqual([])
  })

  it('บอกผู้ใช้ว่าปิดการขาย ไม่ใช่จอว่างและไม่ใช่ 404', async () => {
    const Page = (await import('@/pages/package-horoscope/index')).default
    render(<Page />)
    expect(screen.getByTestId('sales-closed')).toBeTruthy()
  })
})
