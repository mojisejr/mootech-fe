// scripts/home-v3-round1.test.tsx — หน้าหลัก v3 รอบแรก (ประชุม 24 พ.ย. 2569 ข้อ 1)
//   ชิป QI ข้างป้ายระดับ · ทางลัด 4 ช่อง · ป๊อปอัป "Limited time" · analytics
//
// 🔴 MUTANT CONTRACT:
//   H1  ชิป QI: undefined = บล็อกเทา · null = ไม่โชว์ (ไม่โชว์ 0 ปลอม) · number = ยอดจริง → ลิงก์ /v2/qi
//   H2  ทางลัด: ก่อนอ่าน storage ต้องเป็นบล็อกเทา (SSR/client เฟรมแรกเหมือนกัน) · ค่าเริ่มต้น 4 ช่อง · เลือกแล้วบันทึก + สลับไม่ให้ซ้ำ
//   H3  ป๊อปอัปโปร: ราคามาจาก BFF เท่านั้น (ไม่มี offer → ทำงานแบบเดิม) · "ซื้อเลย" → href ของ offer · "ไว้ก่อน" → ปิด
//   H4  BFF: ไม่ตั้ง env / โค้ดใช้ไม่ได้ / ไม่มีส่วนลด → offer:null (ไม่ปั้นข้อความลดราคา)
//   H5  analytics: event ใหม่อยู่ใน allowlist และ key ไม่ชนรายการต้องห้าม
//   H6  การต่อสาย: หน้าหลักส่ง qi เข้า Greeting + วาง ShortcutBar · /v2 ดึงกระเป๋าหลัง user row มาแล้ว
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const auth = vi.hoisted(() => ({ status: 'anon' as 'anon' | 'loading' | 'authed' }))
const nav = vi.hoisted(() => ({ pathname: '/v2', push: vi.fn() }))
const tracks = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>)

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: nav.pathname, push: nav.push }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next/link', () => ({ default: ({ href, children, onClick, 'data-testid': tid }: { href: string; children: React.ReactNode; onClick?: () => void; 'data-testid'?: string }) => (
  <a href={href} data-testid={tid} onClick={(e) => { e.preventDefault(); onClick?.() }}>{children}</a>
) }))
vi.mock('@/lib/auth/use-current-user', () => ({
  useCurrentUser: () => ({ userId: auth.status === 'authed' ? 'u-1' : '', status: auth.status }),
}))
vi.mock('@/lib/analytics/track', () => ({ track: (name: string, params: Record<string, unknown> = {}) => { tracks.push([name, params]); return { ok: true } } }))

import { QiChip } from '@/features/v2-home/components/QiChip'
import { ShortcutBar, withShortcut } from '@/features/v2-home/components/ShortcutBar'
import { parseShortcuts, DEFAULT_SHORTCUTS, SHORTCUT_CATALOG, SHORTCUT_KEY, SHORTCUT_SLOTS } from '@/features/v2-home/shortcuts'
import { formatCountdown, limitedOfferConfig, limitedOfferFrom, parseOffer } from '@/features/v2-home/limited-offer'
import { PromoPopup } from '@/features/v2-home/components/PromoPopup'
import { ANALYTICS_EVENTS, FORBIDDEN_PARAM_KEY } from '@/lib/analytics/events'

const code = (rel: string) =>
  readFileSync(join(process.cwd(), rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  tracks.length = 0
  nav.push.mockClear()
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('H1 ชิป QI', () => {
  it('undefined = บล็อกเทา · null = ไม่โชว์ · number = ยอดจริง + ลิงก์ศูนย์ชี + track', () => {
    const a = render(<QiChip />)
    expect(screen.getByTestId('home-qi-skeleton')).toBeTruthy()
    expect(screen.queryByTestId('home-qi-chip')).toBeNull()
    a.unmount()
    const b = render(<QiChip qi={null} />)
    expect(b.container.firstChild).toBeNull()
    b.unmount()
    render(<QiChip qi={1250} />)
    const chip = screen.getByTestId('home-qi-chip')
    expect(chip.tagName).toBe('A')
    expect(chip.getAttribute('href')).toBe('/v2/qi')
    expect(chip.textContent).toBe('1,250')
    fireEvent.click(chip)
    expect(tracks).toEqual([['home_qi_chip_click', {}]])
  })

  it('ยอด 0 เป็นยอดจริง (โชว์ 0) — null ต่างจาก 0', () => {
    render(<QiChip qi={0} />)
    expect(screen.getByTestId('home-qi-chip').textContent).toBe('0')
  })
})

describe('H2 ทางลัด 4 ช่อง', () => {
  it('parseShortcuts: ค่าว่าง/พัง → ค่าเริ่มต้น · key ไม่รู้จัก/ซ้ำ → ตัดแล้วเติม · เกิน → ตัดเหลือ 4', () => {
    expect(SHORTCUT_SLOTS).toBe(4)
    expect(DEFAULT_SHORTCUTS.length).toBe(4)
    expect(parseShortcuts(null)).toEqual([...DEFAULT_SHORTCUTS])
    expect(parseShortcuts('{oops')).toEqual([...DEFAULT_SHORTCUTS])
    expect(parseShortcuts('["qi"]')).toEqual(['qi', 'destiny', 'calendar', 'love'])
    expect(parseShortcuts('["qi","destiny","destiny","ghost-key","calendar","shop"]')).toEqual(['qi', 'destiny', 'calendar', 'shop'])
    for (const k of DEFAULT_SHORTCUTS) expect(SHORTCUT_CATALOG.some((s) => s.key === k), k).toBe(true)
  })

  it('🔴 เฟรม SSR = บล็อกเทา 4 ก้อน ไม่มีลิงก์ (ไม่อ่าน storage ฝั่ง server) → หลัง mount = ทางลัดเริ่มต้น', async () => {
    const ssr = renderToString(<ShortcutBar />)
    expect(ssr.match(/home-shortcut-skeleton-/g)?.length).toBe(4)
    expect(ssr).not.toContain('href=')
    render(<ShortcutBar />)
    const first = await screen.findByTestId('home-shortcut-0')
    expect(first.getAttribute('href')).toBe('/v2/destiny')
    expect(screen.getByTestId('home-shortcut-1').getAttribute('href')).toBe('/v2/calendar')
    expect(screen.getByTestId('home-shortcut-2').getAttribute('href')).toBe('/v2/service/compatibility/love')
    expect(screen.getByTestId('home-shortcut-3').getAttribute('href')).toBe('/v2/shop')
    expect(screen.queryAllByTestId(/^home-shortcut-skeleton-/)).toEqual([])
    fireEvent.click(screen.getByTestId('home-shortcut-0'))
    expect(tracks).toEqual([['home_shortcut_open', { slot: '0', target: 'destiny' }]])
  })

  it('อ่านค่าที่เคยตั้งไว้จาก storage · กดแก้ไข → เลือก → บันทึก + สลับไม่ให้ช่องซ้ำ + ชีตอยู่ที่ body', async () => {
    window.localStorage.setItem(SHORTCUT_KEY, JSON.stringify(['qi', 'calendar', 'love', 'shop']))
    render(<ShortcutBar />)
    expect((await screen.findByTestId('home-shortcut-0')).getAttribute('href')).toBe('/v2/qi')
    fireEvent.click(screen.getByTestId('home-shortcut-toggle-edit'))
    fireEvent.click(screen.getByTestId('home-shortcut-edit-0'))
    // เลือก "shop" ให้ช่อง 0 ทั้งที่ shop อยู่ช่อง 3 → สลับ: ช่อง 0 = shop, ช่อง 3 = qi
    const dialog = screen.getByRole('dialog', { name: 'เลือกทางลัด' })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    fireEvent.click(screen.getByTestId('home-shortcut-pick-shop'))
    expect(JSON.parse(window.localStorage.getItem(SHORTCUT_KEY) ?? '[]')).toEqual(['shop', 'calendar', 'love', 'qi'])
    expect(screen.queryByRole('dialog')).toBeNull()
    // เลือกแล้วออกจากโหมดแก้ไขอัตโนมัติ → ไทล์กลับเป็นลิงก์
    expect(screen.getByTestId('home-shortcut-0').getAttribute('href')).toBe('/v2/shop')
    expect(screen.getByTestId('home-shortcut-3').getAttribute('href')).toBe('/v2/qi')
    expect(tracks).toContainEqual(['home_shortcut_set', { slot: '0', target: 'shop' }])
  })

  it('withShortcut (pure): ไม่มีช่องซ้ำหลังสลับ · เลือกของใหม่ = แทนที่ตรง ๆ', () => {
    expect(withShortcut(['a', 'b', 'c', 'd'], 0, 'd')).toEqual(['d', 'b', 'c', 'a'])
    expect(withShortcut(['a', 'b', 'c', 'd'], 1, 'a')).toEqual(['b', 'a', 'c', 'd'])
    expect(withShortcut(['a', 'b', 'c', 'd'], 2, 'z')).toEqual(['a', 'b', 'z', 'd'])
  })

  it('storage เสีย (private mode) → ใช้ค่าเริ่มต้นได้ ไม่ล้ม', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    render(<ShortcutBar />)
    expect((await screen.findByTestId('home-shortcut-0')).getAttribute('href')).toBe('/v2/destiny')
    spy.mockRestore()
  })
})

describe('ป๊อปอัป Limited time (pure helpers)', () => {
  const priced = { tierCode: 'PRO', expire: '1M', listSatang: 19900, discountSatang: 10000, amountSatang: 9900, code: { endsAt: '2027-01-31T17:00:00.000Z' } }

  it('limitedOfferConfig: ต้องตั้งครบสองตัวและรูปแบบถูก', () => {
    expect(limitedOfferConfig('V2_PRO_MONTHLY', 'NY2027')).toEqual({ pkg: 'V2_PRO_MONTHLY', code: 'NY2027' })
    expect(limitedOfferConfig(undefined, 'NY2027')).toBeNull()
    expect(limitedOfferConfig('V2_PRO_MONTHLY', '')).toBeNull()
    expect(limitedOfferConfig('drop table', 'NY2027')).toBeNull()
    expect(limitedOfferConfig('V2_PRO_MONTHLY', 'a b')).toBeNull()
  })

  it('limitedOfferFrom: ราคา/ส่วนลด/เวลาหมด จาก priceFor · ไม่มีส่วนลดหรือไม่ใช่แพ็กสมาชิก → null', () => {
    const o = limitedOfferFrom(priced, 'V2_PRO_MONTHLY', 'NY2027')
    expect(o).toMatchObject({ name: 'Mumate Pro', period: 'รายเดือน', listBaht: 199, priceBaht: 99, percentOff: 50, endsAt: '2027-01-31T17:00:00.000Z' })
    expect(o?.href).toBe('/v2/shop/checkout?package_code=V2_PRO_MONTHLY&code=NY2027')
    expect(limitedOfferFrom({ ...priced, discountSatang: 0, amountSatang: 19900 }, 'V2_PRO_MONTHLY', 'NY2027')).toBeNull()
    expect(limitedOfferFrom({ ...priced, tierCode: 'QI' }, 'QI_200', 'NY2027')).toBeNull()
    expect(limitedOfferFrom({ ...priced, code: null }, 'V2_PRO_MONTHLY', 'NY2027')?.endsAt).toBeNull()
  })

  it('parseOffer: ร่างไม่ครบ/ราคาเพี้ยน → null', () => {
    const good = { offer: { packageCode: 'V2_PRO_MONTHLY', name: 'Mumate Pro', period: 'รายเดือน', listBaht: 199, priceBaht: 99, percentOff: 50, endsAt: null, href: '/v2/shop/checkout?package_code=V2_PRO_MONTHLY&code=X' } }
    expect(parseOffer(good)?.priceBaht).toBe(99)
    expect(parseOffer({ offer: null })).toBeNull()
    expect(parseOffer(null)).toBeNull()
    expect(parseOffer({ offer: { ...good.offer, href: 'https://evil.example' } })).toBeNull()
    expect(parseOffer({ offer: { ...good.offer, priceBaht: 199 } })).toBeNull()
    expect(parseOffer({ offer: { ...good.offer, name: undefined } })).toBeNull()
  })

  it('formatCountdown: ไม่เกินวัน = HH:MM:SS · เกิน = "N วัน HH:MM:SS" · หมด/เพี้ยน = ว่าง', () => {
    expect(formatCountdown(3_723_000)).toBe('01:02:03')
    expect(formatCountdown(90_061_000)).toBe('1 วัน 01:01:01')
    expect(formatCountdown(0)).toBe('')
    expect(formatCountdown(-5)).toBe('')
    expect(formatCountdown(NaN)).toBe('')
  })
})

describe('H4 BFF /api/v2/limited-offer', () => {
  const h = vi.hoisted(() => ({ priced: null as unknown }))
  vi.mock('@/lib/discount/preview-flow', () => ({ priceFor: vi.fn(async () => h.priced) }))
  // import หลัง mock
  const load = () => import('@/pages/api/v2/limited-offer')

  async function call() {
    const mod = await load()
    const out = { status: 200, body: undefined as unknown, cache: '' }
    const res: Record<string, unknown> = {
      statusCode: 200,
      status(c: number) { out.status = c; return res },
      json(b: unknown) { out.body = b; return res },
      setHeader(k: string, v: string) { if (k === 'Cache-Control') out.cache = v; return res },
    }
    await mod.default({ method: 'GET', headers: {}, query: {}, cookies: {} } as never, res as never)
    return out
  }
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    saved.pkg = process.env.LIMITED_OFFER_PACKAGE
    saved.code = process.env.LIMITED_OFFER_CODE
    h.priced = { ok: true, tierCode: 'PRO', expire: '1M', listSatang: 19900, discountSatang: 10000, amountSatang: 9900, code: { endsAt: '2027-01-31T17:00:00.000Z' } }
  })
  afterEach(() => {
    process.env.LIMITED_OFFER_PACKAGE = saved.pkg
    process.env.LIMITED_OFFER_CODE = saved.code
  })

  it('🔴 ไม่ตั้ง env → offer:null และไม่แตะ DB', async () => {
    delete process.env.LIMITED_OFFER_PACKAGE
    delete process.env.LIMITED_OFFER_CODE
    const out = await call()
    expect(out.status).toBe(200)
    expect(out.body).toEqual({ offer: null })
    expect(out.cache).toContain('s-maxage=120')
  })

  it('ตั้งครบ + มีส่วนลด → offer พร้อมราคาและลิงก์ checkout ใส่โค้ด', async () => {
    process.env.LIMITED_OFFER_PACKAGE = 'V2_PRO_MONTHLY'
    process.env.LIMITED_OFFER_CODE = 'NY2027'
    const out = await call()
    expect(out.body).toEqual({ offer: expect.objectContaining({ packageCode: 'V2_PRO_MONTHLY', name: 'Mumate Pro', listBaht: 199, priceBaht: 99, percentOff: 50, href: '/v2/shop/checkout?package_code=V2_PRO_MONTHLY&code=NY2027' }) })
  })

  it('🔴 โค้ดใช้ไม่ได้ (priceFor ปฏิเสธ) หรือไม่มีส่วนลด → offer:null', async () => {
    process.env.LIMITED_OFFER_PACKAGE = 'V2_PRO_MONTHLY'
    process.env.LIMITED_OFFER_CODE = 'NY2027'
    h.priced = { ok: false, status: 400, error: 'code cannot be used', codeError: 'WINDOW' }
    expect((await call()).body).toEqual({ offer: null })
    h.priced = { ok: true, tierCode: 'PRO', expire: '1M', listSatang: 19900, discountSatang: 0, amountSatang: 19900, code: { endsAt: null } }
    expect((await call()).body).toEqual({ offer: null })
  })

  it('method อื่น → 405', async () => {
    const mod = await load()
    const out = { status: 0 }
    const res: Record<string, unknown> = { status(c: number) { out.status = c; return res }, json() { return res } }
    await mod.default({ method: 'POST', headers: {}, query: {}, cookies: {}, body: {} } as never, res as never)
    expect(out.status).toBe(405)
  })
})

describe('H3 ป๊อปอัปโปรบนหน้าแรก', () => {
  const AFTER_NOTICE = new Date('2026-10-12T12:00:00+07:00')
  const OFFER = { packageCode: 'V2_PRO_MONTHLY', name: 'Mumate Pro', period: 'รายเดือน', listBaht: 199, priceBaht: 99, percentOff: 50, endsAt: new Date(AFTER_NOTICE.getTime() + 3_723_000).toISOString(), href: '/v2/shop/checkout?package_code=V2_PRO_MONTHLY&code=NY2027' }
  let offer: unknown
  const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(1500) })

  function stubFetch() {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/api/v2/limited-offer')) return { ok: true, json: async () => ({ offer }) }
      if (u.includes('/api/qi-wallet')) return { ok: true, json: async () => ({ qi: 10, history: [] }) } // ยังไม่เช็กอินวันนี้
      return { ok: false, status: 404, json: async () => ({}) }
    }))
  }
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AFTER_NOTICE)
    offer = OFFER
    auth.status = 'authed'
    nav.pathname = '/v2'
    stubFetch()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('🔴 มีโปร → เด้งป๊อปอัปโปรก่อนป๊อปอัปเช็กอิน ราคาตาม BFF + นาฬิกาเวลาจริง', async () => {
    render(<PromoPopup />)
    await settle()
    expect(screen.getByTestId('promo-offer-card')).toBeTruthy()
    expect(screen.queryByTestId('promo-popup-scrim')).toBeNull()
    expect(screen.getByTestId('promo-offer-title').textContent).toBe('Mumate Pro รายเดือน')
    expect(screen.getByTestId('promo-offer-off').textContent).toBe('ลด 50% จาก ฿199')
    expect(screen.getByTestId('promo-offer-price').textContent).toBe('฿99')
    expect(screen.getByTestId('promo-offer-countdown').textContent).toBe('เหลือเวลาอีก 01:02:03 น.')
    expect(tracks).toContainEqual(['promo_offer_view', { offer: 'V2_PRO_MONTHLY' }])
    // นาฬิกาเดินจริงทุกวินาที (ป๊อปอัปเปิดหลังดีเลย์ 1.2 วิ · เดินอีก 2 วิ → เหลือ 3721 วิ)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByTestId('promo-offer-countdown').textContent).toBe('เหลือเวลาอีก 01:01:59 น.')
  })

  it('"ซื้อเลย" → ไป href ของ offer + track buy · "ไว้ก่อน" → ปิด + track later', async () => {
    const a = render(<PromoPopup />)
    await settle()
    fireEvent.click(screen.getByTestId('promo-offer-buy'))
    expect(nav.push).toHaveBeenCalledWith(OFFER.href)
    expect(tracks).toContainEqual(['promo_offer_click', { offer: 'V2_PRO_MONTHLY', action: 'buy' }])
    a.unmount()
    window.sessionStorage.clear()
    tracks.length = 0
    render(<PromoPopup />)
    await settle()
    fireEvent.click(screen.getByTestId('promo-offer-later'))
    expect(screen.queryByTestId('promo-offer-card')).toBeNull()
    expect(tracks).toContainEqual(['promo_offer_click', { offer: 'V2_PRO_MONTHLY', action: 'later' }])
  })

  it('หมดเวลาแล้ว (cache เก่า) → ปุ่มซื้อใช้ไม่ได้ ไปร้านแทน', async () => {
    offer = { ...OFFER, endsAt: new Date(AFTER_NOTICE.getTime() - 1000).toISOString() }
    render(<PromoPopup />)
    await settle()
    expect(screen.getByTestId('promo-offer-countdown').textContent).toBe('โปรนี้หมดเวลาแล้ว')
    expect(screen.queryByTestId('promo-offer-buy')).toBeNull()
    fireEvent.click(screen.getByTestId('promo-offer-shop'))
    expect(nav.push).toHaveBeenCalledWith('/v2/shop')
  })

  it('🔴 ไม่มีโปร (BFF ตอบ null / อ่านไม่ได้ / ร่างเพี้ยน) → ป๊อปอัปเช็กอินแบบเดิม ไม่ปั้นราคา', async () => {
    for (const bad of [{ offer: null }, { offer: { packageCode: 'X' } }]) {
      offer = bad
      window.sessionStorage.clear()
      const a = render(<PromoPopup />)
      await settle()
      expect(screen.queryByTestId('promo-offer-card'), JSON.stringify(bad)).toBeNull()
      expect(screen.getByTestId('promo-popup-scrim'), JSON.stringify(bad)).toBeTruthy()
      a.unmount()
    }
  })

  it('โค้ดไม่มีวันหมด → ไม่โชว์นาฬิกา ซื้อได้ปกติ', async () => {
    offer = { ...OFFER, endsAt: null }
    render(<PromoPopup />)
    await settle()
    expect(screen.queryByTestId('promo-offer-countdown')).toBeNull()
    expect(screen.getByTestId('promo-offer-buy')).toBeTruthy()
  })
})

describe('H5/H6 analytics + การต่อสาย', () => {
  it('event ใหม่อยู่ใน allowlist และไม่มี key ต้องห้าม', () => {
    expect(ANALYTICS_EVENTS.home_shortcut_open).toEqual(['slot', 'target'])
    expect(ANALYTICS_EVENTS.home_shortcut_set).toEqual(['slot', 'target'])
    expect(ANALYTICS_EVENTS.home_qi_chip_click).toEqual([])
    expect(ANALYTICS_EVENTS.promo_offer_view).toEqual(['offer'])
    expect(ANALYTICS_EVENTS.promo_offer_click).toEqual(['offer', 'action'])
    for (const keys of [['slot', 'target'], ['offer'], ['offer', 'action']]) {
      for (const k of keys) expect(FORBIDDEN_PARAM_KEY.test(k), k).toBe(false)
    }
  })

  it('หน้าหลักส่ง qi เข้า Greeting + วางชิปในแถวเครื่องมือ (ไม่เบียดชื่อ) + ShortcutBar ใต้หัวจอ', () => {
    const s = code('features/v2-home/components/V2HomeScreen.tsx')
    expect(s).toMatch(/<Greeting [^>]*qi=\{qi\} \/>\s*\{?\}?\s*<ShortcutBar \/>/)
    const g = s.indexOf('<QiChip qi={qi} />')
    const name = s.indexOf('data-testid="greeting-name"')
    const tools = s.indexOf('<' + 'HeaderTools', g) // ต่อคำกันไม่ให้ walk ของ header-tier-badge นับไฟล์นี้เป็นจอที่ render header
    expect(g).toBeGreaterThan(-1)
    expect(g).toBeLessThan(name) // ชิปอยู่แถวเครื่องมือ (แถว 1) ไม่ใช่ข้างชื่อ (แถว 2)
    expect(g).toBeLessThan(tools)
  })

  it('/v2 ดึงกระเป๋าหลัง user row มาแล้ว และ HomeSkeleton ไม่ส่ง qi (เฟรมแรกเป็นบล็อกเทาเหมือน SSR)', () => {
    const page = code('pages/v2/index.tsx')
    expect(page).toMatch(/useHomeQi\(!!user && !loading\.profile\)/)
    expect(page).toMatch(/qi=\{qi\}/)
    const skel = code('features/v2-home/components/HomeSkeleton.tsx')
    expect(skel).not.toMatch(/qi=/)
  })
})
