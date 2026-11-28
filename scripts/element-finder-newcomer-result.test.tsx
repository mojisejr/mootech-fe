// scripts/element-finder-newcomer-result.test.tsx — ผลธาตุของคนใหม่ต้องโชว์เต็มจอ ไม่ล็อกไปล็อกอิน (gafiw 2026-11-27)
//
// 🔴 THE BUG, in the reporter's words: "หน้ามาหาธาตุแท้ พอคำนวณแล้วมันบังคับล็อคอินเลยค่ะ · ไม่ขึ้นแสดงผลค่ะ"
//    คนใหม่ (?newcomer=1) กดคำนวณ → ผลออก → ไกด์ขั้น "signup" (Spotlight mode="pass") ราดจอดำ 72% + ฉากกันแตะ
//    4 ชิ้น เหลือช่องแตะได้แค่แถว CTA "สมัครฟรี → /v2/login" — wallpaper เลยมืดและกดอะไรไม่ได้ ทางออกเดียวคือล็อกอิน
//    ทุกคนที่ยังไม่มีบัญชีและเข้าจากหน้าแรกเจออันนี้ (pages/v2/index.tsx ส่งมา /v2/element-finder?newcomer=1)
//
// ไฟล์นี้เปิดหน้าจริงแล้วกดปุ่มจริง — เทสต์ของ newcomerStepFor อย่างเดียวมองไม่เห็นหน้าที่ส่งขั้นผิด
// (บทเรียนเดียวกับ scripts/checkout-page-holds-no-decisions.test.ts)
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   M1  หน้าส่งขั้นไกด์ตอนผลออก (คืนขั้น "signup" เดิม)              → "หน้าผลไม่มีชั้นล็อก" RED
//   M2  หน้าผลไม่ render wallpaper                                    → "หน้าผลไม่มีชั้นล็อก" RED
//   M3  CTA คนใหม่เลิกไป /v2/login หรือเลิกพูดว่าสมัครฟรี              → "สมัครฟรียังเป็น CTA ธรรมดา" RED
//   M4  ปุ่มในหน้าผลกดแล้วไม่ทำงาน (เช่น "เช็คธาตุคนอื่นอีกครั้ง")     → "ปุ่มอื่นในหน้าผลยังใช้ได้" RED
//   M5  ไกด์หายไปทั้งหน้า (เกินขอบเขต — ขั้นกรอกต้องยังไกด์)           → "ขั้นกรอกยังไกด์อยู่" RED
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/router', () => ({ useRouter: () => ({ push, query: { newcomer: '1' }, pathname: '/v2/element-finder' }) }))
vi.mock('next/head', () => ({ default: ({ children }: { children?: React.ReactNode }) => <>{children}</> }))
vi.mock('next/image', () => ({ default: ({ src, alt = '' }: { src: string; alt?: string }) => React.createElement('img', { src, alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('a', { href, ...rest }, children),
}))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-profile/components/kit', () => ({ SkyScreen: ({ children }: { children?: React.ReactNode }) => <div>{children}</div> }))
// ภารกิจมือใหม่ของคนที่มีบัญชี — ไม่เกี่ยวกับคนใหม่ (หน้าเรียกเฉพาะ !newcomer) ให้เงียบไป
vi.mock('@/features/v2-guide/useGuideProgress', () => ({ useGuideProgress: () => ({ markDone: vi.fn() }), reportGuideMission: vi.fn() }))

import ElementFinderPage from '@/pages/v2/element-finder'

const OG = { ogImage: '/og.png', ogTitle: 'มาหาธาตุแท้กันเถอะ', ogDesc: 'd', pageUrl: 'https://bazichart.mumate.co/v2/element-finder?newcomer=1' }
// สิ่งที่ /api/calculator/compute ตอบ (toElementFinderData): นักษัตรลำดับ 8 · ธาตุน้ำ → การ์ด 60 ตัวหนึ่ง + ELEMENT_CONTENT["น้ำ"]
const COMPUTE = { data: { yearOfZodiac: { below: '未' }, detail: { yearBelow: { id: 8, constellation: 'GOAT' } }, enrichment: { dayMasterElement: 'น้ำ' } } }

const realRect = Element.prototype.getBoundingClientRect
beforeEach(() => {
  sessionStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  // jsdom ไม่มี layout (rect = 0 หมด) — ไกด์ส่องเฉพาะ element ที่กว้าง > 0 จึงต้องให้ทุกตัวมีขนาด
  Element.prototype.getBoundingClientRect = function () { return { top: 300, left: 40, width: 200, height: 40, bottom: 340, right: 240, x: 40, y: 300, toJSON: () => ({}) } as DOMRect }
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => COMPUTE })))
})
afterEach(() => { cleanup(); Element.prototype.getBoundingClientRect = realRect; vi.unstubAllGlobals(); vi.clearAllMocks() })

const fillAndSubmit = () => {
  fireEvent.change(screen.getByTestId('finder-date'), { target: { value: '2000-09-07' } })
  fireEvent.change(screen.getByTestId('finder-time'), { target: { value: '08:30' } })
  fireEvent.click(screen.getByTestId('finder-submit'))
}

describe('element-finder คนใหม่: ผลธาตุโชว์เต็มจอ ไม่บังคับล็อกอิน', () => {
  it('ขั้นกรอกยังไกด์อยู่ — เริ่มที่วันเกิด', async () => {
    render(<ElementFinderPage {...OG} />)
    await waitFor(() => expect(screen.getByTestId('newcomer-coach')).toBeTruthy())
    expect(screen.getByTestId('newcomer-coach').textContent).toContain('1/3')
    expect(screen.getByTestId('newcomer-text').textContent).toContain('วันเกิด')
  })

  it('หน้าผลไม่มีชั้นล็อก — wallpaper โชว์เต็มจอ ไม่มีฉากกันแตะ', async () => {
    render(<ElementFinderPage {...OG} />)
    fillAndSubmit()
    await screen.findByTestId('finder-result', {}, { timeout: 8000 }) // run() รอ 2.6s ให้ขั้นคำนวณไล่จบ
    expect(screen.getByTestId('finder-wallpaper')).toBeTruthy()
    expect(screen.queryByTestId('newcomer-coach')).toBeNull()
    expect(screen.queryAllByTestId('newcomer-coach-block')).toHaveLength(0)
    expect(screen.queryByTestId('newcomer-spotlight')).toBeNull()
  })

  it('สมัครฟรียังเป็น CTA ธรรมดา — กดเองไป /v2/login ไม่ใช่ทางออกเดียว', async () => {
    render(<ElementFinderPage {...OG} />)
    fillAndSubmit()
    await screen.findByTestId('finder-result', {}, { timeout: 8000 })
    const cta = screen.getByTestId('finder-cta')
    expect(cta.getAttribute('href')).toBe('/v2/login')
    expect(cta.textContent).toContain('สมัครฟรี')
    // ยังอยู่หน้าผล: การ render ผลไม่ได้พาไปล็อกอินเอง
    expect(push).not.toHaveBeenCalled()
  })

  it('ปุ่มอื่นในหน้าผลยังใช้ได้ — สุ่มลุคใหม่ และกลับไปเช็คคนอื่นได้', async () => {
    render(<ElementFinderPage {...OG} />)
    fillAndSubmit()
    await screen.findByTestId('finder-result', {}, { timeout: 8000 })
    // การ์ด 2 ใบ = preview บนจอ + ใบซ่อนสำหรับ html2canvas — สุ่มแล้วยังอยู่หน้าผลครบสองใบ
    expect(screen.getAllByTestId('wallpaper-card')).toHaveLength(2)
    await act(async () => { fireEvent.click(screen.getByTestId('finder-shuffle')) })
    expect(screen.getAllByTestId('wallpaper-card')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('finder-again'))
    expect(screen.getByTestId('finder-input')).toBeTruthy()
    expect(screen.queryByTestId('finder-result')).toBeNull()
  })
})
