// ปีชง 2570 page (ciel-os workstream mumate-taisui-2570-001): the production switch, birth parsing, the
// gate in the assembled reading, content coverage, and the return-after-login marker.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isTaisuiOpen, PRODUCTION_HOST } from '@/lib/taisui/live'
import { parseBirth } from '@/lib/taisui/server'
import { assembleReading } from '@/lib/taisui/assemble'
import type { TaisuiFacts } from '@/lib/taisui/types'
import { APPROVED, PREVIEW, RELATIONS, RELATION_IN_SENTENCE, readingFor, type PillarKey, type ReactionFact } from '@/features/v2-taisui/content/readings'
import { animalImage, MONTH_LABEL } from '@/features/v2-taisui/content/animals'
import { leaveReturnMarker, takeReturnPath, TAISUI_RETURN_KEY } from '@/features/v2-taisui/return'
import { withFreshPass } from '@/features/v2-taisui/fresh-pass'
import { oaClaimFrom } from '@/features/v2-taisui/oa-claim'
import { ANALYTICS_EVENTS, FORBIDDEN_PARAM_KEY } from '@/lib/analytics/events'
import { TAISUI_MARKUP } from '@/features/v2-taisui/components/taisui-markup'
import { TAISUI_CSS } from '@/features/v2-taisui/components/taisui-css'

const KEYS: PillarKey[] = ['hour', 'day', 'month', 'year']

describe('production switch', () => {
  it('is closed on the production host until TAISUI_2570_LIVE, open everywhere else', () => {
    expect(isTaisuiOpen(`https://${PRODUCTION_HOST}`, false)).toBe(false)
    expect(isTaisuiOpen(`https://${PRODUCTION_HOST}`, true)).toBe(true)
    expect(isTaisuiOpen('https://app.staging.mumate.co', false)).toBe(true)
    expect(isTaisuiOpen('http://localhost:3000', false)).toBe(true)
  })
  it('ships closed: the Sinse has not approved the content yet', async () => {
    const live = await import('@/lib/taisui/live')
    expect(live.TAISUI_2570_LIVE).toBe(APPROVED)
  })
})

describe('parseBirth', () => {
  it('takes a Gregorian date, a time or null, and a gender', () => {
    expect(parseBirth({ date: '1990-03-15', time: '08:30', gender: 'male' })).toEqual({ birthDate: '1990-03-15', birthTime: '08:30', gender: 'male' })
    expect(parseBirth({ date: '1990-03-15', time: null, gender: 'female' })?.birthTime).toBeNull()
  })
  it('refuses B.E. years, bad times, a missing gender and the future', () => {
    expect(parseBirth({ date: '2533-03-15', time: null, gender: 'male' })).toBeNull()
    expect(parseBirth({ date: '1990-3-15', time: null, gender: 'male' })).toBeNull()
    expect(parseBirth({ date: '1990-03-15', time: '24:00', gender: 'male' })).toBeNull()
    expect(parseBirth({ date: '1990-03-15', time: null })).toBeNull()
    expect(parseBirth({ date: `${new Date().getFullYear() + 1}-01-01`, time: null, gender: 'male' })).toBeNull()
    expect(parseBirth('1990-03-15')).toBeNull()
  })
})

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
    { kind: 'half3', name: '半三合', pillar: 'day', at: 'bottom', mine: '卯', year: '未' },
    { kind: 'half3', name: '半三合', pillar: 'month', at: 'bottom', mine: '卯', year: '未' },
  ],
  role: { dayMaster: '己', dayElement: 'earth', role: 'resource', th: 'ส่งเสริมดิถี' },
  mine: ['辰', '卯', '午'],
  months: Object.keys(MONTH_LABEL).map((b) => ({ branch: b, startsAt: '2027-02-04T01:46:18.000Z', state: b === '亥' ? 'peak' as const : b === '丑' ? 'care' as const : 'normal' as const, because: b === '亥' ? ['三合:亥卯未'] : [] })),
  partner: { yearBranch: '未', relation: 'six' },
}

describe('assembleReading', () => {
  it('gives a visitor the free part only: characters and months, no full reading', () => {
    const r = assembleReading(FACTS, { member: false, source: 'typed' })
    expect(r.locked).toBe(true)
    expect(r.full).toBeUndefined()
    expect(r.pillars.map((p) => p.animal)).toEqual(['มะโรง', 'เถาะ', 'เถาะ', 'มะเมีย'])
    expect(r.pillars[3].image).toBe('/images/v2/characters/07_มะเมีย-ทอง.webp')
    expect(r.pillars[3].preview).toEqual(PREVIEW.six)
    expect(r.role).toMatchObject({ th: 'ดินหยิน', picture: 'ดินสวน', roleTh: 'ส่งเสริมดิถี' })
    expect(r.marks.map((m) => m.name)).toContain('ผั่ว (破)')
    expect(r.marks.find((m) => m.name === 'ผั่ว (破)')?.where).toContain('丁卯')
    expect(r.hits.find((h) => h.kind === 'phua')).toMatchObject({ pillar: 'day', at: 'bottom', mine: '卯', year: '丁', tone: 'care' })
    expect(JSON.stringify(r.hits)).not.toMatch(/วาระซ่อน/) // the Sinse's stories stay in the member reading
    expect(r.months).toHaveLength(12)
    expect(JSON.stringify(r)).not.toMatch(/because|startsAt|yearBranch/) // internals stay on the server
  })
  it('gives a member the full reading, month tips and plan', () => {
    const r = assembleReading(FACTS, { member: true, source: 'saved' })
    expect(r.locked).toBe(false)
    expect(r.full?.readings).toHaveLength(4)
    expect(r.full?.monthTips['亥']).toContain('ไตรภาคีครบชุด')
    expect(r.full?.plan).toHaveLength(4)
    expect(r.draft).toBe(!APPROVED)
    expect(r.partner).toEqual({ relation: 'six' })
    const month = r.full!.readings.find((x) => x.key === 'month')!
    expect(month.details.map((d) => d.name)).toEqual(['ผั่ว (破)', 'ภาคี (半三合)'])
    expect(month.details[0].story).toContain('วาระซ่อน') // the Sinse's ผั่ว 丁卯 story: help with poison inside
    expect(month.details[0].why).toBe('丁卯 · 丁 ของปีมาเจอ 卯 ของคุณ · ราศีล่างเสาเดือน')
    expect(month.headline).toBe('การงานและพ่อแม่: มีรอยรั่วเงียบๆ ที่ต้องรีบอุด')
    expect(month.story).toBe(month.details[0].story)
  })
})

describe('content', () => {
  it('flies the year stem for ผั่ว on a bottom character, as bazi sends it (year = the branch)', () => {
    const asBazi: ReactionFact = { kind: 'phua', name: '破', pillar: 'day', at: 'bottom', mine: '卯', year: '未', pair: '丁卯', group: 'poison' }
    expect(readingFor('phua', 'day', [asBazi]).details[0].why).toBe('丁卯 · 丁 ของปีมาเจอ 卯 ของคุณ · ราศีล่างเสาวัน')
    const top: ReactionFact = { kind: 'phua', name: '破', pillar: 'month', at: 'top', mine: '癸', year: '未', pair: '癸未', group: 'self' }
    expect(readingFor('phua', 'month', [top]).details[0].why).toBe('癸未 · 癸 ของคุณมาเจอ 未 ของปี · ราศีบนเสาเดือน')
  })
  it('names ฮะ the Sinse way and says what it turns into', () => {
    const six: ReactionFact = { kind: 'six', name: '六合', pillar: 'year', at: 'bottom', mine: '午', year: '未' }
    const half: ReactionFact = { kind: 'half3', name: '半三合', pillar: 'day', at: 'bottom', mine: '卯', year: '未' }
    expect(readingFor('six', 'year', [six]).details[0]).toMatchObject({ name: 'ฮะ (六合)', why: '未 ของปี ฮะ 午 ของคุณ แปรสภาพเป็นธาตุไฟ · ราศีล่างเสาปี' })
    expect(readingFor('half3', 'day', [half]).details[0].story).toContain('คลังไม้')
  })
  it('never repeats a card line across two pillars with the same reaction', () => {
    const reacts: ReactionFact[] = (['day', 'month'] as PillarKey[]).map((k) => ({ kind: 'stemClash', name: '天干冲', pillar: k, at: 'top', mine: '癸', year: '丁' }))
    const [d, m] = (['day', 'month'] as PillarKey[]).map((k) => readingFor('stemClash', k, reacts))
    expect(d.actions.filter((a) => m.actions.includes(a))).toEqual([])
    expect(d.headline).not.toBe(m.headline)
  })
  it('covers every relation for every pillar', () => {
    for (const rel of RELATIONS) {
      expect(RELATION_IN_SENTENCE[rel]).toBeTruthy()
      expect(PREVIEW[rel]).toHaveLength(2)
      for (const k of KEYS) {
        const reacts: ReactionFact[] = rel === 'none' ? [] : [{ kind: rel, name: '', pillar: k, at: 'bottom', mine: '丑', year: '未', group: 'vault' }]
        const rd = readingFor(rel, k, reacts)
        expect(rd.actions).toHaveLength(3)
        expect(rd.headline.length).toBeGreaterThan(10)
        expect(new Set(rd.actions).size).toBe(3)
      }
    }
  })
  it('uses "ชง" for 冲 alone (the Sinse, plan revision 0.9)', async () => {
    const fs = await import('node:fs')
    const lines = fs.readFileSync('features/v2-taisui/content/readings.ts', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    for (const l of lines.filter((x) => x.includes('ชง'))) expect([l.trim(), l.includes('chong')]).toEqual([l.trim(), true])
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//'))
    // the one line that names all five reactions (ชง เฮ้ง ไห่ ผั่ว ซำเฮ้ง) is the method note
    expect(motion.filter((l) => /['`][^'`]*ชง/.test(l) && !/ปีชง/.test(l) && !/ชง เฮ้ง ไห่ ผั่ว/.test(l))).toEqual([])
  })
  it('names no AI provider and makes no ritual or purchase promise', async () => {
    const fs = await import('node:fs')
    const text = fs.readFileSync('features/v2-taisui/content/readings.ts', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(text).not.toMatch(/\bAI\b|GPT|Gemini|Claude|OpenAI|เอไอ/i)
    expect(text).not.toMatch(/ซื้อ|บูชา|แก้ชง|ไหว้|เครื่องราง|รับประกัน/)
  })
  it('has a character image for every branch the wheel uses', () => {
    for (const b of ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']) expect(animalImage(b, 'ไฟ')).toMatch(/^\/images\/v2\/characters\/\d\d_.+-ไฟ\.webp$/)
  })
})

describe('the ported page frame', () => {
  it('keeps every element the motion script looks up', () => {
    for (const id of ['stage', 'cine', 'medal', 'start', 'member', 'row', 'next', 'sheet', 'bdD', 'bdM', 'bdY', 'bt', 'noT', 'months', 'reads', 'lock', 'pkSec', 'seal', 'wishform', 'meds', 'sendPk', 'statN'])
      expect(TAISUI_MARKUP).toContain(`id="${id}"`)
    expect(TAISUI_MARKUP).not.toMatch(/img\//)
  })
  it('scopes every rule under .ts2570 and prefixes keyframes', () => {
    const rules = TAISUI_CSS.split('}').map((r) => r.trim()).filter((r) => r.includes('{'))
    for (const r of rules) {
      const sel = r.slice(0, r.indexOf('{')).trim()
      if (sel.startsWith('@') || /^((\d+(\.\d+)?%|from|to)\s*,?\s*)+$/.test(sel) || sel.startsWith('.ts2570')) continue
      throw new Error(`unscoped rule: ${sel}`)
    }
    expect(TAISUI_CSS).not.toMatch(/@keyframes (?!ts-)/)
  })
})

describe('page events', () => {
  it('are allowlisted and carry no forbidden key', () => {
    for (const name of ['taisui_open', 'taisui_form_submit', 'taisui_result', 'taisui_login_click', 'taisui_share', 'taisui_packet_open', 'taisui_lantern']) {
      const keys = (ANALYTICS_EVENTS as Record<string, readonly string[]>)[name]
      expect(keys).toBeDefined()
      for (const k of keys) expect(FORBIDDEN_PARAM_KEY.test(k)).toBe(false)
    }
  })
})

describe('return after login', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('returns once, with the packet code, while fresh', () => {
    leaveReturnMarker('MUMATE12345', 1_000)
    expect(takeReturnPath(2_000)).toBe('/taisui-2570?ref=MUMATE12345')
    expect(takeReturnPath(3_000)).toBeNull()
  })
  it('drops a stale or malformed marker and never carries a foreign path', () => {
    leaveReturnMarker(null, 0)
    expect(takeReturnPath(31 * 60 * 1000)).toBeNull()
    store.set(TAISUI_RETURN_KEY, JSON.stringify({ at: 1, ref: 'https://evil.example' }))
    expect(takeReturnPath(2)).toBe('/taisui-2570')
    store.set(TAISUI_RETURN_KEY, 'not json')
    expect(takeReturnPath(2)).toBeNull()
  })
})

describe('an expired form pass', () => {
  const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  it('takes a fresh pass and sends the same request once more', async () => {
    const send = vi.fn().mockResolvedValueOnce(res(403, { error: 'nonce' })).mockResolvedValueOnce(res(200, { ok: 1 }))
    const refresh = vi.fn().mockResolvedValue(undefined)
    expect((await withFreshPass(send, refresh)).status).toBe(200)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('leaves every other failure alone, and retries at most once', async () => {
    for (const [status, body] of [[403, { error: 'forbidden' }], [429, { error: 'rate_limited' }], [502, { error: 'upstream' }]] as const) {
      const send = vi.fn().mockResolvedValue(res(status, body))
      const refresh = vi.fn()
      expect((await withFreshPass(send, refresh)).status).toBe(status)
      expect(refresh).not.toHaveBeenCalled()
    }
    const stuck = vi.fn().mockResolvedValue(res(403, { error: 'nonce' }))
    expect((await withFreshPass(stuck, vi.fn().mockResolvedValue(undefined))).status).toBe(403)
    expect(stuck).toHaveBeenCalledTimes(2)
  })
})

describe('the LINE OA reward after login', () => {
  it('shows a payment, offers the add button to a non-friend, and stays quiet otherwise', () => {
    expect(oaClaimFrom(200, { awarded: 100 })).toEqual({ state: 'paid', qi: 100 })
    expect(oaClaimFrom(200, { capped: true })).toEqual({ state: 'already' })
    expect(oaClaimFrom(409, { reason: 'not_friend' })).toEqual({ state: 'not_friend' })
    for (const [status, body] of [[400, { reason: 'not_line' }], [401, { reason: 'relogin' }], [502, null], [409, { reason: 'other' }]] as const) {
      expect(oaClaimFrom(status, body)).toEqual({ state: 'skip' })
    }
  })
  it('sends the red packet through LINE only', () => {
    expect(TAISUI_MARKUP).toContain('ส่งอั่งเปาทาง LINE')
  })
})
