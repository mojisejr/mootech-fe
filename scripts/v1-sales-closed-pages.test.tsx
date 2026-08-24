// #376 — ฟันของ "v1 ขายไม่ได้แล้ว" ชั้นหน้า (จุด ① และ ②)
//
// 🔴 ฟันนี้วัดว่า **ไม่มีตัวควบคุมที่พาไปจ่ายเงินถูก render** ❌ ไม่ใช่ "หน้ามีข้อความปิดการขาย"
// เหตุผล: ข้อความปิดการขายเป็นของที่เพิ่มทับได้โดยที่ปุ่มเดิมยังอยู่ข้างล่าง — เคยเกิดมาแล้วทั้งตระกูล
// (UI ซ่อน ไม่ได้กัน · mojisejr/mootech-fe#226) ⇒ เคสที่ต้องแดงคือ "ยังมีทางไปจ่ายเงินอยู่"
// ไม่ใช่ "ข้อความหาย"
//
// 🔴 NEGATIVE CONTROL ของเครื่องมือวัดเอง — **ต้องเรียก `paymentControlsIn` จริง** ใส่ต้นไม้ที่มันต้องรายงาน
// ท่า fixture สังเคราะห์ มีแบบอย่างในรีโปแล้วที่ `scripts/env-example-drift.test.ts` ข้อ ④
//
// ⛔ รอบแรกผมเขียนข้อนี้ผิด และตู๋เจาะทะลุ (รีวิว #426 · 2026-08-24): control เดิม "อ่านซอร์สเป็นสตริง"
// แล้ว assert ว่ามีคำว่า PackagePricePageLegacy / PAYMENT_SELECT_CHANNEL อยู่ในไฟล์ ⇒ **มันไม่เคยเรียก
// `paymentControlsIn` เลยสักครั้ง** ⇒ เขาทำ selector ให้ตาบอดสนิท (`return []`) แล้วยังเขียว 6/6 ทั้งสอง head
// ⇒ ประโยคที่ assert ว่า "ไม่มีตัวควบคุมพาไปจ่ายเงิน" — ข้อกล่าวอ้างหลักของทั้งใบ — วางอยู่บนเครื่องมือ
//   ที่ไม่มีอะไรยืนยันว่ามันมองเห็นอะไรได้เลย
// 🔑 และคอมเมนต์บล็อกนี้เองที่เคยเขียนว่า "ถ้าไม่มีเคสนี้ เคสที่ assert ว่าไม่เจอจะเขียวฟรี" ⇒ **ฟันที่ตั้งชื่อ
//   ตามคลาสที่มันไม่ได้เฝ้า** — ชื่อนั่นแหละที่อันตราย เพราะคนอ่าน (ผมด้วย) เชื่อชื่อแล้วไม่ยิงซ้ำ
/* eslint-disable @next/next/no-html-link-for-pages --
   fixture ข้างล่างเป็น DOM ดิบโดยตั้งใจ: มันมีไว้ให้ `paymentControlsIn` (ซึ่งอ่าน `a[href]` จาก DOM) ได้เห็นของ
   ที่มันต้องรายงาน · ใช้ <Link/> ที่นี่จะเพิ่มชั้น next/router เข้ามาระหว่างเครื่องมือวัดกับสิ่งที่มันวัด
   ซึ่งเป็นสิ่งเดียวกับที่ทำให้ control ตัวเก่าล้มไม่ได้ (มันวัดผ่านชั้นที่ไม่ใช่ของจริง) */
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

describe('#376 · เครื่องมือวัดต้องมองเห็นของก่อน จึงจะเชื่อคำว่า "ไม่เจอ" ได้', () => {
  it('เห็น a[href] ที่พาไปจ่ายเงิน', () => {
    const { container } = render(
      <div>
        <a href="/payment">ชำระเงิน</a>
        <a href="/package-price?tab=PAYASUSE">แพ็คเกจ</a>
        <a href="/profile">โปรไฟล์</a>
      </div>,
    )
    expect(paymentControlsIn(container).sort()).toEqual([
      'a[href="/package-price?tab=PAYASUSE"]',
      'a[href="/payment"]',
    ])
  })

  it('เห็นปุ่มที่ถ้อยคำชวนซื้อ และไม่เก็บปุ่มที่ไม่ชวน', () => {
    const { container } = render(
      <div>
        <button>สมัครสมาชิก</button>
        <button>ซื้อเพิ่ม</button>
        <button>ยกเลิก</button>
      </div>,
    )
    expect(paymentControlsIn(container).sort()).toEqual(['button:"ซื้อเพิ่ม"', 'button:"สมัครสมาชิก"'])
  })

  it('ต้นไม้ที่ไม่มีทางจ่ายเงิน ต้องได้อาเรย์ว่าง — กันเครื่องมือที่รายงานทุกอย่างว่าเป็นทางจ่ายเงิน', () => {
    const { container } = render(
      <div>
        <a href="/profile">โปรไฟล์</a>
        <button>กลับไปหน้าหลัก</button>
      </div>,
    )
    expect(paymentControlsIn(container)).toEqual([])
  })
})

describe('#376 ① /package-price ปิดการขายแล้ว', () => {
  it('หน้าเดิมยังอยู่ในไฟล์ ไม่ถูกลบ (Principle 1) — คนละข้ออ้างกับ negative control ข้างบน', async () => {
    // ⚠️ ชื่อเคสนี้บอกสิ่งที่มันวัดจริง: "ตัวอักษรยังอยู่ในไฟล์" ❌ ไม่ได้พิสูจน์ว่าเครื่องมือวัดมองเห็นปุ่มจ่ายเงิน
    const mod: any = await import('@/pages/package-price/index')
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
  it('หน้าเดิมยังอยู่ในไฟล์ ไม่ถูกลบ (Principle 1)', async () => {
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
