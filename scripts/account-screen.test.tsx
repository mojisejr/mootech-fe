// scripts/account-screen.test.tsx — teeth for จอ "สิทธิ์ของฉัน" (#365).
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   A1  TierBadge drops its href                        → "the badge navigates" red   ← the ticket asked for this one by name
//   A2a HeaderTools ignores tierLink                     → "ไม่ใช่ลิงก์" red   (RENDERED)
//   A2b AccountScreen stops passing tierLink={false}      → the wiring test red (SOURCE-LEVEL — see below)
//   A3  planFor stops reading tier and always says Free  → the legacy + PRO cases red
//   A4  toHistoryItems drops the APPROVED filter         → the history filter case red
//   A5  formatThaiDateAbbr uses CE instead of BE         → the date case red
//   A6  toHistoryItems slices the ISO string again        → the 00:00–06:59 Thai cases red   (ตู๋ ①, 8cbe56b)
//   A7  historyState folds `errored` into empty           → the "our failure is not their fact" case red (ตู๋ ②)
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'
import { HeaderTools } from '@/features/v2-shell/components/AppHeader'
import { planFor } from '@/features/v2-account/plan'
import { toHistoryItems, historyState, bkkCivilDate, type PaymentRow } from '@/features/v2-account/payment-history'
import { HistoryCard } from '@/features/v2-account/components/HistoryCard'
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'
import { ACCOUNT_HREF } from '@/features/v2-account/account-cta'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 🔴 WHAT THIS FILE DOES AND DOES NOT GUARD (same split scripts/header-tier-badge.test.tsx documents):
//   HeaderTools / planFor / toHistoryItems / formatThaiDateAbbr   RENDERED or PURE — real teeth.
//   "AccountScreen passes tierLink={false}"                       SOURCE-LEVEL grep only. It catches
//       "somebody deleted the wire"; it CANNOT catch "the wire carries the wrong value". The rendered proof
//       is the viewport strip in the PR. Writing this as if it were a render test would be a tooth named
//       for a class it does not guard — worse than no tooth, because the name stops anyone looking again.

// Same setup as scripts/header-tier-badge.test.tsx: HeaderTools mounts the real avatar, which reads cookies.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, isReady: true, push: vi.fn() }) }))
afterEach(cleanup)

const renderTools = (props: Record<string, unknown>) =>
  render(<CookiesProvider>{React.createElement(HeaderTools, props)}</CookiesProvider>)

// 🔴 CODE ONLY, NEVER PROSE. The first draft of this tooth matched the raw file — and AccountScreen.tsx
// mentions `tierLink={false}` twice in comments explaining WHY it is there. Deleting the real prop would
// have left the tooth green, guarded by its own documentation. Caught by firing the mutant and watching
// it survive; the same trap scripts/header-tier-badge.test.tsx:39 records for #384.
const code = (rel: string) =>
  readFileSync(join(process.cwd(), rel), 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // {/* jsx comment */}
    .replace(/\/\*[\s\S]*?\*\//g, '')                // /* block */
    .replace(/^\s*\/\/.*$/gm, '')                      // // line
const read = code

const PAID_PRO = { isPaid: true as const, tier: 'PRO' as const }

describe('#365 ป้ายระดับ — ปลายทางมีจริงแล้ว จึงต้องพาไป', () => {
  // 🔴 A1 — the mutant the ticket named: "เอา href ออก → เทสต์ต้องแดง ❌ ไม่ใช่เงียบ".
  // Asserted on the RENDERED anchor, not on a prop: a Link that renders without an href is exactly the
  // failure this is here to catch, and reading the prop back would pass in that case.
  it('🔴 A1 กดป้ายแล้วไปที่ /v2/account (ยืนยันจาก <a href> ที่ render จริง)', () => {
    renderTools({ membership: PAID_PRO })
    const badge = screen.getByTestId('header-tier')
    expect(badge.tagName).toBe('A')
    expect(badge.getAttribute('href')).toBe(ACCOUNT_HREF)
    expect(ACCOUNT_HREF).toBe('/v2/account') // the destination itself, so a silent re-point is also red
  })

  // 🔴 A2 — on the screen that IS the destination, the badge must still be VISIBLE but not navigate.
  // Two halves on purpose: "no anchor" alone would also pass if the badge vanished, which is a different bug
  // (a member loses sight of the level they paid for — #384's whole point).
  it('🔴 A2 บนจอ /v2/account เอง ป้ายยังเห็น แต่ไม่ใช่ลิงก์', () => {
    renderTools({ membership: PAID_PRO, tierLink: false })
    const badge = screen.getByTestId('header-tier')
    expect(badge.textContent).toBe('PRO')      // still shown
    expect(badge.tagName).not.toBe('A')        // but not a destination
    expect(badge.getAttribute('href')).toBeNull()
  })

  it('ป้าย 84×32 ใช้คลาสกล่องชุดเดียวกันทั้งสองแบบ (element ต่าง ไม่ใช่พิกเซลต่าง)', () => {
    const { container: linked } = renderTools({ membership: PAID_PRO })
    const a = linked.querySelector('[data-testid="header-tier"]')!.getAttribute('class')
    cleanup()
    const { container: plain } = renderTools({ membership: PAID_PRO, tierLink: false })
    const d = plain.querySelector('[data-testid="header-tier"]')!.getAttribute('class')
    expect(d).toBe(a)
  })
})

describe('#365 การต่อสาย (SOURCE-LEVEL — ไม่ใช่ render)', () => {
  const read = code

  // 🔴 A2b — the screen that IS the destination must opt out. Asserted on CODE because mounting AccountScreen
  // pulls the whole identity stack; the value it carries is proven by the viewport strip, not here.
  it('🔴 A2b AccountScreen ส่ง tierLink={false}', () => {
    expect(read('features/v2-account/components/AccountScreen.tsx')).toMatch(/tierLink=\{false\}/)
  })

  it('หน้า /v2/account มีจริง และผ่านด่าน v2 เหมือนจอพี่น้อง', () => {
    const page = read('pages/v2/account.tsx')
    expect(page).toMatch(/v2RedirectIfUnauthed/)
    expect(page).toMatch(/AccountScreen/)
  })
})

describe('#365 planFor — สามสัญญาณแยกกัน ไม่ยุบเป็นสถานะเดียว', () => {
  it('สมาชิกที่มีชื่อระดับ + มีวันหมดอายุ', () => {
    expect(planFor({ isPaid: true, tier: 'PRO', expireAt: '2570-07-14' }).heading).toBe('Mumate Pro')
    expect(planFor({ isPaid: true, tier: 'PRO', expireAt: '2027-07-14' }).sub).toBe('ใช้ได้ถึง 14 ก.ค. 2570')
  })

  // 🔴 A3 — the direction that costs a paying member their trust.
  // ⚠️ เดิมเขียนว่า "สมาชิกเก่า" — ตั้งแต่ #358 Phase 1 สมาชิกเก่าที่ยังไม่หมดอายุจะได้ชื่อ 'PRO'
  // (lib/v2/subscription.ts:26) พร้อมวันหมดอายุของตัวเอง อินพุตนี้จึงคือ "จ่ายแล้ว แต่ชื่อระดับมาไม่ถึง"
  it('🔴 A3 สมาชิกที่จ่ายแล้วแต่ชื่อระดับมาไม่ถึง ❌ ห้ามขึ้นคำว่า Free', () => {
    const p = planFor({ isPaid: true, tier: null, expireAt: null })
    expect(p.isFree).toBe(false)
    expect(p.heading).toBe('สมาชิก')
    expect(p.heading).not.toContain('Free')
    expect(p.sub).not.toContain('หมดอายุ') // they have not expired; we simply hold no v2 date for them
  })

  it('บัญชี free บอกว่าเป็น Free และไม่พูดว่าหมดอายุ', () => {
    const p = planFor({ isPaid: false, tier: null, expireAt: null })
    expect(p.isFree).toBe(true)
    expect(p.heading).toBe('Mumate Free')
    expect(p.sub).toBe('ยังไม่ได้เป็นสมาชิก')
  })

  it('tier ที่ขัดกับ isPaid (paid + FREE) ต้องไม่พ่นคำว่า Free', () => {
    expect(planFor({ isPaid: true, tier: 'FREE', expireAt: null }).heading).toBe('สมาชิก')
  })
})

describe('#365 ประวัติการซื้อ — เฉพาะรายการที่เงินออกจริง', () => {
  const row = (status: string, over: Partial<PaymentRow> = {}): PaymentRow => ({
    packageCode: 'PRO_ANNUAL', tierCode: 'PRO', amountSatang: 129000, status,
    createdAt: '2026-07-14T03:00:00.000Z', ...over,
  })

  // 🔴 A4 — REJECT means the money did NOT move; PENDING is a QR nobody ever finished.
  it('🔴 A4 APPROVED เท่านั้น — PENDING กับ REJECT ต้องไม่โผล่', () => {
    const items = toHistoryItems([row('PENDING'), row('APPROVED'), row('REJECT')])
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Mumate Pro · รายปี')
    expect(items[0].amountText).toContain('1,290')
    expect(items[0].dateText).toBe('14 ก.ค. 2569')
  })

  it('ไม่มีรายการที่จ่ายสำเร็จเลย → ลิสต์ว่าง (❌ ไม่ใช่โยน error)', () => {
    expect(toHistoryItems([row('REJECT'), row('PENDING')])).toEqual([])
  })

  it('รักษาลำดับที่ server ให้มา (ใหม่ก่อน) ❌ ไม่เรียงซ้ำเอง', () => {
    const items = toHistoryItems([
      row('APPROVED', { createdAt: '2026-08-01T00:00:00.000Z' }),
      row('APPROVED', { createdAt: '2026-06-01T00:00:00.000Z' }),
    ])
    expect(items.map((i) => i.dateText)).toEqual(['1 ส.ค. 2569', '1 มิ.ย. 2569'])
  })

  it('package_code ที่ยังไม่รู้จัก → บอกชื่อระดับไปก่อน ❌ ไม่เดารอบการชำระ', () => {
    expect(toHistoryItems([row('APPROVED', { packageCode: 'PRO_LIFETIME' })])[0].title).toBe('Mumate Pro')
  })
})

describe('#365 วันที่ในประวัติ อ่านปฏิทินไทย ไม่ใช่ปฏิทิน UTC (ตู๋ ① · 8cbe56b)', () => {
  const at = (iso: string): PaymentRow => ({
    packageCode: 'PRO_ANNUAL', tierCode: 'PRO', amountSatang: 129000, status: 'APPROVED', createdAt: iso,
  })
  const shown = (iso: string) => toHistoryItems([at(iso)])[0].dateText

  // 🔑 CONTROL FIRST. 03:00Z = 10:00 น. ไทย — the SAME civil day in both calendars, so this value cannot
  // tell a UTC reader from a Bangkok one. It was the only kind of timestamp the first version of this file
  // used, which is exactly why the bug shipped past it. Keep it: it proves the instrument still works.
  it('CONTROL · ซื้อ 10:00 น. ไทย — สองปฏิทินตอบเหมือนกัน (เคสนี้แยกบั๊กไม่ได้ และต้องเขียวเสมอ)', () => {
    expect(shown('2026-08-26T03:00:00.000Z')).toBe('26 ส.ค. 2569')
  })

  // 🔴 A6 — the 7-hours-in-24 window where the two calendars DISAGREE. UTC says the 25th, Bangkok the 26th.
  it('🔴 A6 ซื้อ 02:30 น. ไทย 26 ส.ค. → ต้องเป็น 26 ไม่ใช่ 25', () => {
    expect(shown('2026-08-25T19:30:00.000Z')).toBe('26 ส.ค. 2569')
  })

  // and it moves the MONTH too, which is what makes it read as a different purchase entirely.
  it('🔴 A6 ซื้อ 00:05 น. ไทย 1 ก.ย. → ต้องเป็น 1 ก.ย. ไม่ใช่ 31 ส.ค.', () => {
    expect(shown('2026-08-31T17:05:00.000Z')).toBe('1 ก.ย. 2569')
  })

  it('ปลายอีกด้านของวันไทยก็ต้องไม่เลื่อน — 23:59 น. ไทย ยังเป็นวันเดิม', () => {
    expect(shown('2026-08-26T16:59:00.000Z')).toBe('26 ส.ค. 2569')
  })
})

describe('#365 bkkCivilDate ต้องเป็นฟังก์ชัน total — โยนไม่ได้ (ตู๋ ข้อแถม · 2aac026)', () => {
  // 🔴 A8 — `bkkDateStr(new Date(junk))` throws RangeError out of Intl.DateTimeFormat.format. Reachable only
  // through a malformed createdAt, which the real API never sends (status.ts:23 always .toISOString()).
  // แต่มันชนกับเป้าที่ PR นี้ประกาศเอง: historyState() ถูกเรียกใน RENDER BODY ของจอ ❌ ไม่ใช่ในการ์ด
  // ⇒ throw ที่นี่ = ทั้งจอตาย ไม่ใช่แค่การ์ดตาย · ฟังก์ชัน total ถูกกว่าการจำว่าตรงไหนปลอดภัยที่จะ partial
  it('🔴 A8 createdAt ที่ parse ไม่ได้ → คืนค่าว่าง ❌ ไม่โยน RangeError', () => {
    for (const junk of ['', 'not-a-date', 'null', '2026-13-45T99:99:99Z']) {
      expect(() => bkkCivilDate(junk)).not.toThrow()
      expect(bkkCivilDate(junk)).toBe('')
    }
  })

  it('และ toHistoryItems ทั้งก้อนก็ต้องไม่โยน (นี่คือตัวที่จอเรียกจริง)', () => {
    const row: PaymentRow = { packageCode: 'PRO_ANNUAL', tierCode: 'PRO', amountSatang: 129000, status: 'APPROVED', createdAt: 'garbage' }
    expect(() => toHistoryItems([row])).not.toThrow()
    expect(toHistoryItems([row])[0].dateText).toBe('')
  })

  it('CONTROL · ค่าปกติยังทำงานเหมือนเดิม (กันไม่ให้ "ไม่โยน" ถูกทำให้จริงด้วยการคืนว่างเสมอ)', () => {
    expect(bkkCivilDate('2026-08-25T19:30:00.000Z')).toBe('26 ส.ค. 2569')
  })
})

describe('#365 "โหลดไม่ได้" ต้องไม่หน้าตาเหมือน "ยังไม่มีรายการ" (ตู๋ ② · 8cbe56b)', () => {
  const rows = (status: string): PaymentRow[] => [{
    packageCode: 'PRO_ANNUAL', tierCode: 'PRO', amountSatang: 129000, status, createdAt: '2026-07-14T03:00:00.000Z',
  }]

  // 🔴 A7 — the pure rule. `errored` outranks everything: it is OUR failure, not a fact about the person.
  it('🔴 A7 errored → kind "error" ❌ ไม่ใช่ "empty" แม้ rows จะว่าง', () => {
    expect(historyState({ done: true, errored: true, rows: [] }).kind).toBe('error')
    expect(historyState({ done: true, errored: true, rows: null }).kind).toBe('error')
  })

  it('คำขอสำเร็จแต่ไม่มีรายการที่จ่ายจริง → "empty" (ไม่ใช่ error — ระบบทำงานปกติ เขายังไม่ได้ซื้อ)', () => {
    expect(historyState({ done: true, errored: false, rows: rows('REJECT') }).kind).toBe('empty')
  })

  it('ยังไม่เสร็จ → "loading" ❌ ไม่ใช่ empty (ไม่งั้นจะกระพริบคำว่าไม่มีรายการก่อนข้อมูลมา)', () => {
    expect(historyState({ done: false, errored: false, rows: null }).kind).toBe('loading')
    expect(historyState({ done: true, errored: false, rows: null }).kind).toBe('loading')
  })

  // 🔴 RENDERED — the words a person actually reads. The pure rule above could be right while the card still
  // painted the same sentence for both, which is the bug that shipped.
  it('🔴 A7 การ์ดตอน error ต้องไม่มีคำว่า "ยังไม่มีรายการ" และต้องมีทางลองใหม่', () => {
    render(<HistoryCard state={{ kind: 'error' }} onRetry={() => {}} />)
    expect(screen.queryByTestId('account-history-empty')).toBeNull()
    expect(screen.getByTestId('account-history').textContent).not.toContain('ยังไม่มีรายการ')
    expect(screen.getByTestId('account-history-error').textContent).toContain('โหลดประวัติการซื้อไม่สำเร็จ')
    expect(screen.getByTestId('account-history-retry')).not.toBeNull()
  })

  it('การ์ดตอนว่างจริง ยังพูดว่าไม่มีรายการเหมือนเดิม (ไม่ได้แก้ด้วยการลบข้อความนั้นทิ้ง)', () => {
    render(<HistoryCard state={{ kind: 'empty' }} onRetry={() => {}} />)
    expect(screen.getByTestId('account-history-empty').textContent).toBe('ยังไม่มีรายการ')
    expect(screen.queryByTestId('account-history-error')).toBeNull()
  })

  // 🗑️ REMOVED, ON PURPOSE (ตู๋ R2, review of 2aac026). There was a source-level test here asserting
  //     expect(src).not.toMatch(/r\.ok \? r\.json\(\) : \{ payments: \[\] \}/)
  // ตู๋ put the old bug straight back with ONE extra pair of parentheses — `: ({ payments: [] })` — and the
  // whole suite stayed green while "ยังไม่มีรายการ" returned on every failure path. It was named for a
  // BEHAVIOUR and only ever checked a SPELLING, which is worse than no tooth: the name stops the next person
  // from looking. The real guard now mounts the screen and reads the words:
  //     scripts/account-screen-mount.test.tsx  (B1 · B2)
})

describe('#365 formatThaiDateAbbr — พ.ศ. และเดือนย่อ', () => {
  // 🔴 A5 — the whole string, not a fragment. A regex on the digits would read '14' from both a right and a
  // wrong month, which is an instrument that certifies its own bug.
  it('🔴 A5 ค.ศ. → พ.ศ. และเดือนถูกช่อง', () => {
    expect(formatThaiDateAbbr('2027-07-14')).toBe('14 ก.ค. 2570')
    expect(formatThaiDateAbbr('2026-01-01')).toBe('1 ม.ค. 2569')
    expect(formatThaiDateAbbr('2026-12-31')).toBe('31 ธ.ค. 2569')
  })

  it('ของที่ไม่ใช่วันที่ → คืนค่าว่าง ❌ ไม่แทนที่ด้วยวันนี้', () => {
    for (const bad of ['', 'not-a-date', '2026-13-01', '2026-00-10', '2026-07-32', '2026-7-4']) {
      expect(formatThaiDateAbbr(bad)).toBe('')
    }
  })
})
