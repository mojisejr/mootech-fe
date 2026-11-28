// scripts/newyear-solution.test.tsx — แผนชีวิตปีใหม่ 2570 /v2/newyear (team meeting 2026-11-24, item 13).
//   NY1 the production switch — the same contract as ปีชง: dark on bazichart.mumate.co until NEWYEAR_LIVE
//   NY2 the reading — everyone gets the preview, only a yearly member gets the full plan, nothing is invented
//   NY3 the offers — the two yearly packages, the price from payment_package, the code from env, never typed
//   NY4 come back — the return marker (login) and the typed birth (login + checkout): one use, thirty minutes
//   NY5 /api/newyear/reading — a typed birth needs the nonce, a saved birth needs a login, the gate fails closed
//   NY6 isYearlyMember — the winning row decides, by its package: monthly, FREE and unknown answer false
//   NY7 the screen — type → loading → preview + unlock; a yearly member sees the plan and the save button
//   NY8 the payment success screen offers the plan as the next step, only for someone who came from the page
//   NY9 call-site teeth (source) — the page reads the prices, passes the env codes, registers its events
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   M1  assembleNewYear includes `full` for a locked viewer            → NY2, NY5.3, NY7a RED
//   M2  the route stops asking for the nonce on a typed birth          → NY5.4 RED
//   M3  isYearlyMember answers true for a live MONTHLY row             → NY6, NY5.7 RED
//   M4  the page types a price, or forgets an env code                 → NY9 RED
//   M5  the success screen shows the plan link for everyone            → NY8 RED
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => {
  process.env.CALC_NONCE_SECRET = 'test-secret'
  process.env.BAZI_BASE_URL = 'http://engine.test'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  return {
    yearFactsFor: vi.fn(), savedBirth: vi.fn(), resolveOptionalRouteMember: vi.fn(),
    select: vi.fn(), resolveMembership: vi.fn(), onLine: vi.fn(), track: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ db: { execute: vi.fn(), select: h.select } }))
vi.mock('@/lib/usage', () => ({ resolveMembership: h.resolveMembership }))
vi.mock('@/pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveOptionalRouteMember: h.resolveOptionalRouteMember }))
vi.mock('@/lib/taisui/server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/taisui/server')>('@/lib/taisui/server')
  return { ...actual, yearFactsFor: h.yearFactsFor, savedBirth: h.savedBirth }
})
vi.mock('@/features/auth/hooks/useV2Login', () => ({ useV2Login: () => ({ loading: false, onLine: h.onLine, onGoogle: vi.fn() }) }))
vi.mock('@/features/auth/hooks/useV2User', () => ({ useV2User: () => ({ user: null }) }))
vi.mock('@/features/v2-shell/components/Menubar', () => ({ Menubar: () => null }))
vi.mock('@/features/v2-account/components/OrdersScreen', () => ({ bahtOf: (n: number) => String(n), methodWord: () => 'บัตร' }))
vi.mock('@/features/v2-shop/components/PlanShareInvite', () => ({ PlanShareInvite: () => null }))
vi.mock('@/lib/analytics/track', () => ({ track: h.track }))
vi.mock('next/image', () => ({ default: ({ src, alt = '' }: { src: string; alt?: string }) => React.createElement('img', { src, alt }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode } & Record<string, unknown>) => React.createElement('a', { href, ...rest }, children) }))

import handler from '@/pages/api/newyear/reading'
import { NewYearScreen } from '@/features/v2-newyear/components/NewYearScreen'
import { PlanPaySuccess } from '@/features/v2-shop/components/PlanPaySuccess'
import { assembleNewYear, NEWYEAR_PREVIEW_MONTHS } from '@/lib/newyear/assemble'
import { NEWYEAR_LIVE, isNewYearOpen, PRODUCTION_HOST } from '@/lib/newyear/live'
import { NEWYEAR_PLUS_PACKAGE, NEWYEAR_PRO_PACKAGE, newYearOffer } from '@/lib/newyear/offer'
import { NEWYEAR_PATH, leaveNewYearAfterPay, leaveNewYearBirth, leaveNewYearReturn, takeNewYearAfterPay, takeNewYearBirth, takeNewYearReturn } from '@/lib/newyear/return'
import { isYearlyMember } from '@/lib/v2/subscription'
import { APPROVED, AREA, planLine } from '@/features/v2-taisui/content/readings'
import { MONTH_LABEL } from '@/features/v2-taisui/content/animals'
import { ANALYTICS_EVENTS, FORBIDDEN_PARAM_KEY } from '@/lib/analytics/events'
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce'
import type { TaisuiFacts } from '@/lib/taisui/types'

// The same facts ปีชง reads for one chart (scripts/taisui-2570.test.ts keeps the twin).
const FACTS: TaisuiFacts = {
  year: { gregorian: 2027, stem: '丁', branch: '未', element: 'fire', lichun: '2027-02-04T01:46:18.000Z' },
  chart: { hasHour: true },
  pillars: [
    { key: 'hour', stem: '庚', branch: '辰', element: 'metal', relation: 'heng', relations: ['刑'], flow: 'controls' },
    { key: 'day', stem: '己', branch: '卯', element: 'earth', relation: 'phua', relations: ['破', '半三合'], flow: 'feeds' },
    { key: 'month', stem: '己', branch: '卯', element: 'earth', relation: 'phua', relations: ['破', '半三合'], flow: 'feeds' },
    { key: 'year', stem: '庚', branch: '午', element: 'metal', relation: 'six', relations: ['六合'], flow: 'controls' },
  ],
  reactions: [
    { kind: 'heng', name: '刑', pillar: 'hour', at: 'bottom', mine: '辰', year: '未' },
    { kind: 'phua', name: '破', pillar: 'day', at: 'bottom', mine: '卯', year: '丁', pair: '丁卯', group: 'poison' },
    { kind: 'phua', name: '破', pillar: 'month', at: 'bottom', mine: '卯', year: '丁', pair: '丁卯', group: 'poison' },
    { kind: 'six', name: '六合', pillar: 'year', at: 'bottom', mine: '午', year: '未' },
  ],
  role: { dayMaster: '己', dayElement: 'earth', role: 'resource', th: 'ส่งเสริมดิถี' },
  luck: { favorable: ['น้ำ', 'ไม้'], avoid: ['ไฟ'] },
  mine: ['辰', '卯', '午'],
  months: Object.keys(MONTH_LABEL).map((b) => ({ branch: b, startsAt: '2027-02-04T01:46:18.000Z', state: b === '亥' ? 'peak' as const : b === '丑' ? 'care' as const : 'normal' as const, because: [] })),
}

const EVENTS = ['newyear_form_submit', 'newyear_result', 'newyear_unlock_click', 'newyear_login_click', 'newyear_download']
const read = (p: string) => readFileSync(resolve(p), 'utf8')

const realLocation = window.location
let assigned: string[]
const assign = vi.fn((url: string) => { assigned.push(url) })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  assigned = []
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } })
  h.resolveMembership.mockResolvedValue({ isFree: true, reason: 'NO_PLAN', memberPayment: null })
})
afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('NY1 — the production switch', () => {
  it('is closed on the production host until NEWYEAR_LIVE, open everywhere else', () => {
    expect(isNewYearOpen(`https://${PRODUCTION_HOST}`, false)).toBe(false)
    expect(isNewYearOpen(`https://${PRODUCTION_HOST}`, true)).toBe(true)
    expect(isNewYearOpen('https://app.staging.mumate.co', false)).toBe(true)
    expect(isNewYearOpen('http://localhost:3000', false)).toBe(true)
  })
  it('ships closed: the Sinse has not approved the wording yet', () => {
    expect(NEWYEAR_LIVE).toBe(APPROVED)
  })
})

describe('NY2 — the reading', () => {
  it('locked: the preview only — no plan, no stories, no month tips; the months after the preview are the page\u2019s to blur', () => {
    const r = assembleNewYear(FACTS, { unlocked: false, source: 'typed', signedIn: false })
    expect(r.locked).toBe(true)
    expect(r.full).toBeUndefined()
    expect(r.chart).toEqual({ source: 'typed', hasHour: true, signedIn: false })
    expect(r.pillars.map((p) => p.name)).toEqual(['เฮ้ง (刑)', 'ผั่ว (破)', 'ผั่ว (破)', 'ฮะ (六合)'])
    expect(r.months).toHaveLength(12)
    expect(r.previewMonths).toBe(NEWYEAR_PREVIEW_MONTHS)
    expect(r.headline?.th).toBeTruthy()
    expect(r.headline?.fire).toContain('ไฟของปี')
    expect(r.draft).toBe(!APPROVED)
  })
  it('unlocked: the plan for all four pillars, twelve month tips, and a focus line per pillar', () => {
    const r = assembleNewYear(FACTS, { unlocked: true, source: 'saved', signedIn: true })
    expect(r.locked).toBe(false)
    expect(r.full?.readings.map((x) => x.key)).toEqual(['hour', 'day', 'month', 'year'])
    for (const x of r.full?.readings ?? []) {
      expect(x.story.length).toBeGreaterThan(10)
      expect(x.actions).toHaveLength(3)
    }
    expect(Object.keys(r.full?.monthTips ?? {})).toHaveLength(12)
    // the focus lines are the ปีชง page's own (planLine over the same pillar) — not a second wording
    expect(r.full?.plan).toEqual(FACTS.pillars.map((p) => ({ key: p.key, label: AREA[p.key].label, line: planLine(p.relation, p.key) })))
    expect(r.full?.plan.every((p) => p.line.startsWith(AREA[p.key as keyof typeof AREA].noun + ': '))).toBe(true)
  })
  it('a bazi with no role and no luck still gives a page (no headline, luck null)', () => {
    const r = assembleNewYear({ ...FACTS, role: undefined, luck: undefined, reactions: undefined }, { unlocked: true, source: 'typed', signedIn: false })
    expect(r.headline).toBeNull()
    expect(r.luck).toBeNull()
    expect(r.full?.readings).toHaveLength(4)
  })
})

describe('NY3 — the offers', () => {
  it('are the two yearly packages, priced by payment_package', () => {
    const plus = newYearOffer({ amount: 790, is_active: true }, undefined, NEWYEAR_PLUS_PACKAGE)
    expect(plus).toEqual({ packageCode: NEWYEAR_PLUS_PACKAGE, price: 790, discounted: false, href: '/v2/shop/checkout?package_code=V2_PLUS_YEARLY' })
    expect(newYearOffer({ amount: 1590, is_active: true }, undefined, NEWYEAR_PRO_PACKAGE).href).toBe('/v2/shop/checkout?package_code=V2_PRO_YEARLY')
  })
  it('carry the owner\u2019s code when the env has one, and never sell a package that is off sale or unpriced', () => {
    const o = newYearOffer({ amount: 395, is_active: true }, ' NY50 ', NEWYEAR_PLUS_PACKAGE)
    expect(o).toMatchObject({ price: 395, discounted: true, href: '/v2/shop/checkout?package_code=V2_PLUS_YEARLY&code=NY50' })
    for (const row of [null, { amount: 0, is_active: true }, { amount: 790, is_active: false }, { amount: 'abc', is_active: true }]) {
      expect(newYearOffer(row, undefined).price).toBeNull()
    }
    expect(newYearOffer({ amount: 790, is_active: true }, 'bad code with spaces').discounted).toBe(false)
  })
})

describe('NY4 — come back to the page', () => {
  it('the return marker is one use and lasts thirty minutes; home gets the path', () => {
    expect(takeNewYearReturn(1_000)).toBeNull()
    leaveNewYearReturn(1_000)
    expect(takeNewYearReturn(2_000)).toBe(NEWYEAR_PATH)
    expect(takeNewYearReturn(2_000)).toBeNull()
    leaveNewYearReturn(0)
    expect(takeNewYearReturn(31 * 60 * 1000)).toBeNull()
  })
  it('the typed birth rides along, once; a stored birth that is not well-formed is dropped', () => {
    const birth = { date: '1993-08-20', time: '08:30', gender: 'female' as const }
    leaveNewYearBirth(birth, 1_000)
    expect(takeNewYearBirth(2_000)).toEqual(birth)
    expect(takeNewYearBirth(2_000)).toBeNull()
    leaveNewYearBirth({ date: '1993-08-20', time: null, gender: 'male' }, 1_000)
    expect(takeNewYearBirth(2_000)).toEqual({ date: '1993-08-20', time: null, gender: 'male' })
    localStorage.setItem('newyear:birth', JSON.stringify({ at: 1, birth: { date: '2536-08-20', time: null, gender: 'male' } }))
    expect(takeNewYearBirth(2)).toBeNull()
    localStorage.setItem('newyear:birth', JSON.stringify({ at: 1, birth: { date: '1993-08-20', time: '25:00', gender: 'male' } }))
    expect(takeNewYearBirth(2)).toBeNull()
    localStorage.setItem('newyear:birth', 'not json')
    expect(takeNewYearBirth(2)).toBeNull()
  })
  it('the after-pay marker is true once, inside the thirty minutes', () => {
    expect(takeNewYearAfterPay(1_000)).toBe(false)
    leaveNewYearAfterPay(1_000)
    expect(takeNewYearAfterPay(2_000)).toBe(true)
    expect(takeNewYearAfterPay(2_000)).toBe(false)
    leaveNewYearAfterPay(0)
    expect(takeNewYearAfterPay(31 * 60 * 1000)).toBe(false)
  })
})

// ── the route ────────────────────────────────────────────────────────────────────────────────────────────────
type Res = { statusCode: number; body: any; headers: Record<string, string>; status: (c: number) => Res; json: (b: unknown) => Res; setHeader: (k: string, v: string) => void }
function mockRes(): Res {
  const res = { statusCode: 0, body: undefined, headers: {} } as Res
  res.status = (c) => ((res.statusCode = c), res)
  res.json = (b) => ((res.body = b), res)
  res.setHeader = (k, v) => void (res.headers[k] = v)
  return res
}
let ip = 0
const post = (body: unknown, o: { member?: string; nonce?: boolean; origin?: string } = {}) => ({
  method: 'POST', body,
  headers: { origin: o.origin ?? 'http://app.test', host: 'app.test', 'x-forwarded-for': `10.9.${++ip % 250}.${ip % 250}` },
  cookies: o.nonce === false ? {} : { [NONCE_COOKIE]: issueNonce() },
}) as never
const TYPED = { date: '1993-08-20', time: '08:30', gender: 'male' }
type SubRow = { id: string; tierCode: string; packageCode: string; status: string; expireAt: string; createdAt: string }
const sub = (over: Partial<SubRow> = {}): SubRow => ({ id: 's1', tierCode: 'PLUS', packageCode: NEWYEAR_PLUS_PACKAGE, status: 'ACTIVE', expireAt: '2099-01-01', createdAt: '2026-01-01T00:00:00.000Z', ...over })
const subs = (...rows: SubRow[]) => h.select.mockImplementation(() => ({ from: () => ({ where: async () => rows }) }))
const YEARLY = { birthDate: '1993-08-20', birthTime: '08:30', gender: 'male' as const }

describe('NY5 — /api/newyear/reading', () => {
  it('1 · answers 404 while the page is closed on production', async () => {
    vi.stubEnv('NEXTAUTH_URL', `https://${PRODUCTION_HOST}`)
    const res = mockRes()
    await handler(post({ birth: TYPED }), res as never)
    expect(res.statusCode).toBe(404)
  })
  it('2 · POST only, and only from this site', async () => {
    let res = mockRes()
    await handler({ ...post({}), method: 'GET' } as never, res as never)
    expect(res.statusCode).toBe(405)
    res = mockRes()
    await handler(post({ birth: TYPED }, { origin: 'https://evil.example' }), res as never)
    expect(res.statusCode).toBe(403)
  })
  it('3 · a typed birth, anonymous: the preview, locked, and the member tables are never asked', async () => {
    subs()
    h.resolveOptionalRouteMember.mockResolvedValue('')
    h.yearFactsFor.mockResolvedValue(FACTS)
    const res = mockRes()
    await handler(post({ birth: TYPED }), res as never)
    expect(res.statusCode).toBe(200)
    expect(h.yearFactsFor).toHaveBeenCalledWith({ birthDate: '1993-08-20', birthTime: '08:30', gender: 'male' })
    expect(res.body).toMatchObject({ locked: true, chart: { source: 'typed', signedIn: false } })
    expect(res.body.full).toBeUndefined()
    expect(h.select).not.toHaveBeenCalled()
    expect(res.headers['Cache-Control']).toBe('no-store')
  })
  it('4 · a typed birth needs the page\u2019s nonce, and must be a real birth', async () => {
    let res = mockRes()
    await handler(post({ birth: TYPED }, { nonce: false }), res as never)
    expect(res.statusCode).toBe(403)
    expect(h.yearFactsFor).not.toHaveBeenCalled()
    res = mockRes()
    await handler(post({ birth: { date: '2536-08-20', time: null, gender: 'male' } }), res as never)
    expect(res.statusCode).toBe(400)
  })
  it('5 · the saved birth needs a login', async () => {
    h.resolveOptionalRouteMember.mockResolvedValue('')
    const res = mockRes()
    await handler(post({}), res as never)
    expect(res.statusCode).toBe(401)
    expect(res.body.code).toBe('not_authenticated')
    expect(h.savedBirth).not.toHaveBeenCalled()
  })
  it('6 · a yearly member: the full plan from the saved birth', async () => {
    subs(sub())
    h.resolveOptionalRouteMember.mockResolvedValue('m-1')
    h.savedBirth.mockResolvedValue(YEARLY)
    h.yearFactsFor.mockResolvedValue(FACTS)
    const res = mockRes()
    await handler(post({}), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ locked: false, chart: { source: 'saved', signedIn: true } })
    expect(res.body.full.readings).toHaveLength(4)
  })
  it('7 · a MONTHLY member is not yearly: the preview, like everyone else', async () => {
    subs(sub({ packageCode: 'V2_PLUS_MONTHLY' }))
    h.resolveOptionalRouteMember.mockResolvedValue('m-2')
    h.savedBirth.mockResolvedValue(YEARLY)
    h.yearFactsFor.mockResolvedValue(FACTS)
    const res = mockRes()
    await handler(post({}), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body.locked).toBe(true)
    expect(res.body.full).toBeUndefined()
  })
  it('8 · the saved birth that is missing or incomplete asks for one; a failed read is 502', async () => {
    h.resolveOptionalRouteMember.mockResolvedValue('m-3')
    for (const [saved, status, code] of [['incomplete', 409, 'profile_incomplete'], ['none', 401, 'not_authenticated'], [null, 502, undefined]] as const) {
      h.savedBirth.mockResolvedValue(saved)
      const res = mockRes()
      await handler(post({}), res as never)
      expect(res.statusCode).toBe(status)
      if (code) expect(res.body.code).toBe(code)
    }
  })
  it('9 · engine down is 502; a member lookup that fails only locks the plan (never 500, never unlocked)', async () => {
    h.yearFactsFor.mockResolvedValue(null)
    let res = mockRes()
    await handler(post({ birth: TYPED }), res as never)
    expect(res.statusCode).toBe(502)
    h.yearFactsFor.mockResolvedValue(FACTS)
    h.select.mockRejectedValue(new Error('db down'))
    h.resolveOptionalRouteMember.mockResolvedValue('m-4')
    h.savedBirth.mockResolvedValue(YEARLY)
    res = mockRes()
    await handler(post({}), res as never)
    expect(res.statusCode).toBe(200)
    expect(res.body.locked).toBe(true)
  })
})

describe('NY6 — isYearlyMember', () => {
  // [name, the member's v2 rows, is the legacy member free?, want, is the legacy verdict consulted?]. A live
  // paid row answers on its own; an unknown tier_code fails closed without asking; everything else falls through.
  const cases: Array<[string, SubRow[], boolean, boolean, boolean]> = [
    ['a live PLUS yearly row', [sub()], true, true, false],
    ['a live PRO yearly row', [sub({ tierCode: 'PRO', packageCode: NEWYEAR_PRO_PACKAGE })], true, true, false],
    ['a live MONTHLY row, even over a paid legacy member', [sub({ packageCode: 'V2_PLUS_MONTHLY' })], false, false, false],
    ['a yearly row that expired, over a free legacy', [sub({ expireAt: '2000-01-01' })], true, false, true],
    ['a yearly row that expired, over a PAID legacy member (the legacy verdict decides, as everywhere)', [sub({ expireAt: '2000-01-01' })], false, true, true],
    ['a live FREE row over a paid legacy member', [sub({ tierCode: 'FREE', packageCode: 'FREE' })], false, true, true],
    ['a live FREE row over a free legacy', [sub({ tierCode: 'FREE', packageCode: 'FREE' })], true, false, true],
    ['a row with a tier_code nobody knows (fails closed, the legacy is not consulted)', [sub({ tierCode: 'WHATEVER' })], false, false, false],
  ]
  for (const [name, rows, legacyFree, want, consulted] of cases) {
    it(`${name} → ${want}`, async () => {
      subs(...rows)
      h.resolveMembership.mockResolvedValue({ isFree: legacyFree, reason: 'NO_PLAN', memberPayment: null })
      expect(await isYearlyMember('m-1', new Date('2026-12-01T03:00:00Z'))).toBe(want)
      expect(h.resolveMembership).toHaveBeenCalledTimes(consulted ? 1 : 0)
    })
  }
  it('no v2 row at all → the legacy verdict decides (a legacy member is yearly)', async () => {
    subs()
    h.resolveMembership.mockResolvedValue({ isFree: false, reason: 'MEMBER', memberPayment: null })
    expect(await isYearlyMember('m-1')).toBe(true)
  })
})

// ── the screen ───────────────────────────────────────────────────────────────────────────────────────────────
const OFFERS = {
  plus: newYearOffer({ amount: 790, is_active: true }, undefined, NEWYEAR_PLUS_PACKAGE),
  pro: newYearOffer({ amount: 1590, is_active: true }, 'NY50', NEWYEAR_PRO_PACKAGE),
}
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })
const reading = (unlocked: boolean, source: 'saved' | 'typed') => assembleNewYear(FACTS, { unlocked, source, signedIn: source === 'saved' })
const fetchMock = () => vi.mocked(fetch)

describe('NY7 — the screen', () => {
  it('a · a visitor types a birth → the preview with the two offers, the months after the third hidden, and no plan', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json(401, { code: 'not_authenticated' }))
      .mockResolvedValue(json(200, reading(false, 'typed'))))
    render(<NewYearScreen offers={OFFERS} />)
    await screen.findByTestId('newyear-input', {}, { timeout: 6000 })
    expect((screen.getByTestId('newyear-submit') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('newyear-date'), { target: { value: '1993-08-20' } })
    fireEvent.change(screen.getByTestId('newyear-time'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByRole('radio', { name: 'หญิง' }))
    fireEvent.click(screen.getByTestId('newyear-submit'))
    await screen.findByTestId('newyear-result', {}, { timeout: 6000 })
    expect(JSON.parse((fetchMock().mock.calls[1] as any)[1].body)).toEqual({ birth: { date: '1993-08-20', time: '08:30', gender: 'female' } })
    expect(screen.getAllByTestId('newyear-pillar')).toHaveLength(4)
    expect(screen.getAllByTestId('newyear-month').filter((m) => m.dataset.state === 'hidden')).toHaveLength(12 - NEWYEAR_PREVIEW_MONTHS)
    expect(screen.queryByTestId('newyear-full')).toBeNull()
    expect(screen.queryByTestId('newyear-download')).toBeNull()
    expect(screen.getByTestId('newyear-buy-plus').textContent).toContain('฿790')
    expect(screen.getByTestId('newyear-buy-pro').textContent).toContain('฿1,590')
    expect(h.track).toHaveBeenCalledWith('newyear_form_submit', { time_known: true })
    expect(h.track).toHaveBeenCalledWith('newyear_result', { member: false, unlocked: false })
  })
  it('b · "buy" goes to that package\u2019s checkout and leaves the plan as the next step', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, reading(false, 'typed'))))
    render(<NewYearScreen offers={OFFERS} />)
    await screen.findByTestId('newyear-buy-pro', {}, { timeout: 6000 })
    fireEvent.click(screen.getByTestId('newyear-buy-pro'))
    expect(assigned).toEqual(['/v2/shop/checkout?package_code=V2_PRO_YEARLY&code=NY50'])
    expect(takeNewYearAfterPay()).toBe(true)
    expect(h.track).toHaveBeenCalledWith('newyear_unlock_click', { plan: 'pro' })
  })
  it('c · "already yearly? log in" leaves the return marker and the typed birth, then starts LINE login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, reading(false, 'typed'))))
    render(<NewYearScreen offers={OFFERS} />)
    await screen.findByTestId('newyear-login', {}, { timeout: 6000 })
    fireEvent.click(screen.getByTestId('newyear-login'))
    expect(h.onLine).toHaveBeenCalledTimes(1)
    expect(takeNewYearReturn()).toBe(NEWYEAR_PATH)
    expect(h.track).toHaveBeenCalledWith('newyear_login_click', { from: 'plan' })
  })
  it('d · a yearly member opens the page and gets the plan, every month, and the save button — no unlock card', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, reading(true, 'saved'))))
    render(<NewYearScreen offers={OFFERS} />)
    await screen.findByTestId('newyear-full', {}, { timeout: 6000 })
    expect(screen.getAllByTestId('newyear-month').some((m) => m.dataset.state === 'hidden')).toBe(false)
    expect(screen.queryByTestId('newyear-unlock')).toBeNull()
    expect(screen.getByTestId('newyear-download')).toBeTruthy()
    expect(screen.getByTestId('newyear-draft')).toBeTruthy() // the wording is still the Sinse's to approve
    expect(h.track).toHaveBeenCalledWith('newyear_result', { member: true, unlocked: true })
  })
  it('e · back from checkout or login: the stored birth is what the page asks for, not the saved one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, reading(true, 'typed'))))
    leaveNewYearBirth({ date: '1990-01-01', time: null, gender: 'male' }, Date.now())
    render(<NewYearScreen offers={OFFERS} />)
    await screen.findByTestId('newyear-result', {}, { timeout: 6000 })
    expect(JSON.parse((fetchMock().mock.calls[0] as any)[1].body)).toEqual({ birth: { date: '1990-01-01', time: null, gender: 'male' } })
    expect(takeNewYearBirth()).toBeNull() // one use
  })
  it('f · the engine failing says so on the form instead of a blank page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(502, { error: 'upstream' })))
    render(<NewYearScreen offers={OFFERS} />)
    await screen.findByTestId('newyear-error', {}, { timeout: 6000 })
    expect(screen.getByTestId('newyear-error').textContent).toContain('คำนวณแผนไม่สำเร็จ')
  })
})

describe('NY8 — the payment success screen', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ payments: [] }) }))))
  it('offers the plan as the next step only for someone who came from /v2/newyear', async () => {
    render(<PlanPaySuccess packageCode="V2_PLUS_YEARLY" charge="ch_1" order="" />)
    await screen.findByTestId('plan-pay-success-home')
    expect(screen.queryByTestId('plan-pay-success-newyear')).toBeNull()
    cleanup()
    leaveNewYearAfterPay()
    render(<PlanPaySuccess packageCode="V2_PLUS_YEARLY" charge="ch_1" order="" />)
    await waitFor(() => expect(screen.getByTestId('plan-pay-success-newyear').getAttribute('href')).toBe(NEWYEAR_PATH))
    expect(screen.getByTestId('plan-pay-success-newyear').textContent).toContain('แผนชีวิตปีใหม่')
  })
})

describe('NY9 — call-site teeth (source)', () => {
  const page = read('pages/v2/newyear.tsx')
  const home = read('pages/v2/index.tsx')
  it('the page reads both prices from payment_package and passes both env codes — no price is typed', () => {
    expect(page).toContain('FROM payment_package')
    expect(page).toContain('process.env.NEWYEAR_PLUS_CODE')
    expect(page).toContain('process.env.NEWYEAR_PRO_CODE')
    expect(page).toContain('isNewYearOpen()')
    expect(page).not.toMatch(/฿\s?\d|\b(790|1590)\b/)
  })
  it('home sends the member back to the plan when the marker is set', () => {
    expect(home).toMatch(/if \(takeNewYearReturn\(\)\) window\.location\.assign\(NEWYEAR_PATH\)/)
  })
  it('every event the screen sends is on the one list, with no key GA must never see', () => {
    const screen = read('features/v2-newyear/components/NewYearScreen.tsx')
    for (const name of EVENTS) {
      expect(ANALYTICS_EVENTS, name).toHaveProperty(name)
      expect(screen).toMatch(new RegExp(`track\\(["']${name}["']`))
      for (const key of ANALYTICS_EVENTS[name as keyof typeof ANALYTICS_EVENTS]) expect(FORBIDDEN_PARAM_KEY.test(key), `${name}.${key}`).toBe(false)
    }
    // every event on the list is sent, and nothing off the list is (the download fires on both save paths)
    const sent = [...screen.matchAll(/track\(["'](newyear_[a-z_]+)["']/g)].map((m) => m[1])
    expect([...new Set(sent)].sort()).toEqual([...EVENTS].sort())
  })
  it('the plan is engine facts and prose tables — the feature never calls an AI provider', () => {
    for (const p of ['lib/newyear/assemble.ts', 'lib/newyear/offer.ts', 'lib/newyear/live.ts', 'lib/newyear/return.ts', 'features/v2-newyear/components/NewYearScreen.tsx']) {
      expect(read(p), p).not.toMatch(/openai|anthropic|gemini|open-webui|\/api\/v2\/narrate/i)
    }
    expect(read('lib/newyear/assemble.ts')).not.toMatch(/\bfetch\(/)
  })
})
