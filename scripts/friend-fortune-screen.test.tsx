// scripts/friend-fortune-screen.test.tsx — จอ "ดูดวงเพื่อน" /v2/friends/[id] (ประชุม 24 พ.ย. ข้อ 2)
//
// 🔴 MUTANT CONTRACT:
//   FF1 เปิดหน้า = ถามราคาเท่านั้น ยังไม่ POST (ไม่มีการคำนวณ/หักชีก่อนผู้ใช้กด)
//   FF2 ฟรี (สล็อต Pro): กดดู → POST ทันที → ดวง + "ไม่หักชี"
//   FF3 ราคา 30 ชี: ต้องผ่านชีตยืนยันก่อน — ยกเลิก = ไม่ POST · ยืนยัน = POST 1 ครั้ง → "หัก 30 QI"
//   FF4 ยอดไม่พอ: รู้ยอดล่วงหน้า → เปิดชีตชีไม่พอเลยไม่ POST · server ตอบ 402 → ชีตชีไม่พอยอดจาก server
//   FF5 คำนวณล้ม (502) → บอกว่าไม่สำเร็จ + "ไม่หักชี" + มีปุ่มลองใหม่ (ไม่โชว์ดวง)
//   FF6 ไม่พบเพื่อน (404) → บอกผู้ใช้ + ทางกลับรายชื่อ
//   FF7 ไม่ทราบเวลาเกิด → ไม่แสดงเสาชั่วโมง (ไม่ปั้น)
//   FF8 ชีต (ยืนยัน/ชีไม่พอ) ต้องอยู่นอกคอลัมน์เนื้อหา ไม่ให้แถบเมนูล่างทับ
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { priceText, chargeText } from '@/features/v2-friends/components/FriendFortuneScreen'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: { id: 'f1' }, pathname: '/v2/friends/f1', asPath: '/v2/friends/f1', isReady: true }),
}))

import { FriendFortuneScreen } from '@/features/v2-friends/components/FriendFortuneScreen'

const QUOTE_FREE = {
  friend: { id: 'f1', name: 'สมศรี', pictureUrl: null }, hasBirthTime: true, canCompute: true,
  plan: { basis: 'new_slot', priceQi: 0, freeUsedAfter: 4 }, balance: null, freeSlots: { used: 3, max: 10 },
}
const QUOTE_PAID = {
  friend: { id: 'f1', name: 'สมศรี', pictureUrl: null }, hasBirthTime: true, canCompute: true,
  plan: { basis: 'qi', priceQi: 30, freeUsedAfter: null }, balance: 120, freeSlots: null,
}
const RESULT = {
  ok: true,
  friend: { id: 'f1', name: 'สมศรี', pictureUrl: null },
  birth: { date: '1995-06-15', hasBirthTime: true },
  chart: { yearOfZodiac: { below: '亥' }, summary: { element: 'WATER', power: 'YIN', yearBelow: '亥', dayAbove: '癸' } },
  pillars: {
    year: { stem: '丁', branch: '亥', stemElement: 'ไฟ', branchElement: 'น้ำ' },
    month: { stem: '壬', branch: '子', stemElement: 'น้ำ', branchElement: 'น้ำ' },
    day: { stem: '癸', branch: '丑', stemElement: 'น้ำ', branchElement: 'ดิน' },
    hour: { stem: '戊', branch: '午', stemElement: 'ดิน', branchElement: 'ไฟ' },
  },
  reading: { prediction: { personality: 'ใจความบุคลิก', habit: 'ใจความนิสัย', love: 'ใจความความรัก' }, cautions: ['ข้อควรระวัง 1', 'ข้อควรระวัง 2'], deity: 'เทพประจำตัว', luck: { year: { label: 'Y', text: 'จังหวะปี' }, month: { label: 'M', text: 'จังหวะเดือน' } } },
  charge: { basis: 'qi', qi: 30 },
  balance: 90,
  freeSlots: null,
}

type Opt = { quote?: unknown; quoteStatus?: number; postStatus?: number; result?: unknown; postBalance?: number }
function stub({ quote = QUOTE_FREE, quoteStatus = 200, postStatus = 200, result = RESULT, postBalance = 12 }: Opt = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    const u = String(url)
    const method = init?.method ?? 'GET'
    const json = (b: unknown) => async () => b
    if (u.includes('/api/v2/friends/reading') && method === 'GET') return { ok: quoteStatus < 400, status: quoteStatus, json: json(quote) }
    if (u.includes('/api/v2/friends/reading') && method === 'POST') {
      if (postStatus === 200) return { ok: true, status: 200, json: json(result) }
      return { ok: false, status: postStatus, json: json(postStatus === 402 ? { code: 'insufficient_qi', priceQi: 30, balance: postBalance } : { error: 'x' }) }
    }
    return { ok: false, status: 404, json: json({}) }
  }))
}
const posts = () => (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'POST')

const mount = () => render(<FriendFortuneScreen friendId="f1" />)
const gateReady = () => waitFor(() => screen.getByTestId('friend-fortune-gate'))

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('priceText / chargeText (pure)', () => {
  it('ป้ายราคาบอกตามฐานสิทธิ์', () => {
    expect(priceText(QUOTE_PAID)).toBe('ดู 1 ครั้งใช้ 30 QI · คงเหลือ 120 QI')
    expect(priceText({ ...QUOTE_PAID, balance: null })).toBe('ดู 1 ครั้งใช้ 30 QI')
    expect(priceText(QUOTE_FREE)).toBe('สิทธิ์สมาชิก Pro — ฟรี 10 คนแรก (ใช้ไป 3/10 คน)')
    expect(priceText({ ...QUOTE_FREE, plan: { basis: 'slot', priceQi: 0, freeUsedAfter: 3 } })).toContain('อยู่ในสล็อตฟรีของคุณแล้ว')
  })
  it('ป้ายหลังดู: จ่ายชี / ฟรี — บอกตาม server ตอบ', () => {
    expect(chargeText({ basis: 'qi', qi: 30 }, 90)).toBe('หัก 30 QI · คงเหลือ 90 QI')
    expect(chargeText({ basis: 'qi', qi: 30 }, null)).toBe('หัก 30 QI')
    expect(chargeText({ basis: 'new_slot', qi: 0 }, null)).toBe('ใช้สิทธิ์สมาชิก Pro — ไม่หักชี')
  })
})

describe('จอดูดวงเพื่อน', () => {
  beforeEach(() => stub())

  it('🔴 FF1 เปิดหน้า: โหลดใบเสนอราคา โชว์ชื่อ+ราคา และไม่ POST จนกว่าจะกด', async () => {
    mount()
    await gateReady()
    expect(screen.getByTestId('friend-fortune-name').textContent).toBe('สมศรี')
    expect(screen.getByTestId('friend-fortune-price').textContent).toContain('ฟรี 10 คนแรก (ใช้ไป 3/10 คน)')
    expect(posts()).toEqual([])
    expect(screen.queryByTestId('friend-fortune-result')).toBeNull()
  })

  it('🔴 FF2 ฟรี: กดดู → POST {id} → ดวงครบทุกส่วน + ป้ายไม่หักชี', async () => {
    stub({ result: { ...RESULT, charge: { basis: 'new_slot', qi: 0 }, balance: null, freeSlots: { used: 4, max: 10 } } })
    mount()
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    await waitFor(() => expect(screen.getByTestId('friend-fortune-result')).toBeTruthy())
    expect(posts().length).toBe(1)
    expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({ id: 'f1' })
    expect(screen.getByTestId('friend-fortune-result-name').textContent).toBe('สมศรี')
    expect(screen.getByTestId('friend-fortune-personality').textContent).toContain('ใจความบุคลิก')
    expect(screen.getByTestId('friend-fortune-habit').textContent).toContain('ใจความนิสัย')
    expect(screen.getByTestId('friend-fortune-love').textContent).toContain('ใจความความรัก')
    expect(screen.getByTestId('friend-fortune-cautions').querySelectorAll('li').length).toBe(2)
    expect(screen.getByTestId('friend-fortune-deity').textContent).toContain('เทพประจำตัว')
    expect(screen.getByTestId('friend-fortune-luck-year').textContent).toContain('จังหวะปี')
    expect(screen.getByTestId('friend-fortune-luck-month').textContent).toContain('จังหวะเดือน')
    expect(screen.getByTestId('friend-fortune-tags').textContent).toContain('ธาตุน้ำ หยิน')
    expect(screen.getByTestId('friend-fortune-tags').textContent).toContain('ปีกุน')
    expect(screen.getByTestId('friend-fortune-pillars').textContent).toContain('癸丑')
    expect(screen.getByTestId('friend-fortune-charge').textContent).toContain('ไม่หักชี')
    // ปุ่มดูหายไปหลังดวงออก กันกดซ้ำหักซ้ำ
    expect(screen.queryByTestId('friend-fortune-read')).toBeNull()
  })

  it('🔴 FF3 ราคา 30 ชี: กด → ชีตยืนยันก่อน · ยกเลิก = ไม่ POST · ยืนยัน = POST 1 ครั้ง → หัก 30 QI', async () => {
    stub({ quote: QUOTE_PAID })
    mount()
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    const title = await waitFor(() => screen.getByTestId('friend-fortune-confirm-title'))
    expect(title.textContent).toContain('ดูดวงของสมศรี')
    expect(screen.getByTestId('friend-fortune-confirm-price').textContent).toBe('−30 QI')
    expect(posts()).toEqual([]) // ยังไม่หัก จนกว่าจะยืนยัน
    fireEvent.click(screen.getByTestId('friend-fortune-confirm-cancel'))
    expect(screen.queryByTestId('friend-fortune-confirm-title')).toBeNull()
    expect(posts()).toEqual([])
    fireEvent.click(screen.getByTestId('friend-fortune-read'))
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-confirm')))
    await waitFor(() => expect(screen.getByTestId('friend-fortune-result')).toBeTruthy())
    expect(posts().length).toBe(1)
    expect(screen.getByTestId('friend-fortune-charge').textContent).toBe('หัก 30 QI · คงเหลือ 90 QI')
  })

  it('🔴 FF4 รู้ล่วงหน้าว่าชีไม่พอ → เปิดชีตชีไม่พอเลย ไม่ POST', async () => {
    stub({ quote: { ...QUOTE_PAID, balance: 10 } })
    mount()
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    await waitFor(() => expect(screen.getByTestId('qi-insufficient-title').textContent).toContain('ขาดอีก 20 QI'))
    expect(screen.getByTestId('qi-insufficient-buy').getAttribute('href')).toBe('/v2/qi/buy')
    expect(posts()).toEqual([])
  })

  it('🔴 FF4 server ตอบ 402 → ชีตชีไม่พอด้วยยอดจาก server และไม่โชว์ดวง', async () => {
    stub({ quote: QUOTE_PAID, postStatus: 402, postBalance: 12 })
    mount()
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-confirm')))
    await waitFor(() => expect(screen.getByTestId('qi-insufficient-title').textContent).toContain('ขาดอีก 18 QI'))
    expect(screen.queryByTestId('friend-fortune-result')).toBeNull()
  })

  it('🔴 FF5 คำนวณล้ม (502) → "คำนวณดวงไม่สำเร็จ" + ไม่หักชี + ลองใหม่ได้', async () => {
    stub({ postStatus: 502 })
    mount()
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    const err = await waitFor(() => screen.getByTestId('friend-fortune-error'))
    expect(err.textContent).toContain('คำนวณดวงไม่สำเร็จ')
    expect(err.textContent).toContain('ยังไม่มีการหักชี')
    expect(screen.queryByTestId('friend-fortune-result')).toBeNull()
    fireEvent.click(screen.getByTestId('friend-fortune-error-retry'))
    await waitFor(() => expect(posts().length).toBe(2))
  })

  it('🔴 FF6 ไม่พบเพื่อน (404) → ข้อความ + ทางกลับรายชื่อ · ไม่มีปุ่มดู', async () => {
    stub({ quoteStatus: 404, quote: { error: 'friend not found' } })
    mount()
    const box = await waitFor(() => screen.getByTestId('friend-fortune-quote-error'))
    expect(box.textContent).toContain('ไม่พบเพื่อนคนนี้ในรายชื่อของคุณ')
    expect(box.getAttribute('data-status')).toBe('404')
    expect(screen.getByTestId('friend-fortune-back-list').getAttribute('href')).toBe('/v2/friends')
    expect(screen.queryByTestId('friend-fortune-read')).toBeNull()
    expect(posts()).toEqual([])
  })

  it('Pro แต่ตารางสล็อตยังไม่พร้อม (503) → บอกว่ายังใช้ไม่ได้ ไม่มีปุ่มดู', async () => {
    stub({ quoteStatus: 503, quote: { code: 'slots_unavailable' } })
    mount()
    const box = await waitFor(() => screen.getByTestId('friend-fortune-quote-error'))
    expect(box.textContent).toContain('ยังเปิดให้ใช้ไม่ได้')
    expect(screen.queryByTestId('friend-fortune-read')).toBeNull()
  })

  it('🔴 FF7 ไม่ทราบเวลาเกิด → ไม่แสดงเสาชั่วโมง · ปุ่มกดไม่ได้เมื่อวันเกิดใช้คำนวณไม่ได้', async () => {
    stub({ quote: { ...QUOTE_PAID, hasBirthTime: false }, result: { ...RESULT, birth: { date: '1995-06-15', hasBirthTime: false } } })
    mount()
    expect((await waitFor(() => screen.getByTestId('friend-fortune-gate'))).textContent).toContain('ไม่ทราบเวลาเกิด')
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-confirm')))
    await waitFor(() => expect(screen.getByTestId('friend-fortune-result')).toBeTruthy())
    expect(screen.getByTestId('friend-fortune-pillar-hour').textContent).toContain('—')
    expect(screen.getByTestId('friend-fortune-pillar-hour').textContent).not.toContain('戊')
    expect(screen.getByTestId('friend-fortune-pillar-day').textContent).toContain('癸丑')
    cleanup()
    stub({ quote: { ...QUOTE_FREE, canCompute: false } })
    mount()
    const btn = await waitFor(() => screen.getByTestId('friend-fortune-read') as HTMLButtonElement)
    expect(btn.disabled).toBe(true)
    expect(screen.getByTestId('friend-fortune-no-birth').textContent).toContain('ใช้คำนวณไม่ได้')
  })

  it('🔴 FF8 ชีตยืนยันอยู่นอกคอลัมน์เนื้อหา (portal → ฉากหลังเป็นลูกตรงของ body) ไม่ให้แถบเมนูล่างทับ', async () => {
    stub({ quote: QUOTE_PAID })
    mount()
    fireEvent.click(await waitFor(() => screen.getByTestId('friend-fortune-read')))
    const dlg = await waitFor(() => screen.getByRole('dialog', { name: 'ยืนยันการใช้ QI' }))
    expect(dlg.parentElement?.parentElement).toBe(document.body)
  })
})
