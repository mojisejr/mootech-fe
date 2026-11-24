// ปีชง 2570 page (ciel-os workstream mumate-taisui-2570-001): the production switch, birth parsing, the
// gate in the assembled reading, content coverage, and the return-after-login marker.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isTaisuiOpen, PRODUCTION_HOST } from '@/lib/taisui/live'
import { parseBirth } from '@/lib/taisui/server'
import { assembleReading } from '@/lib/taisui/assemble'
import type { TaisuiFacts } from '@/lib/taisui/types'
import { APPROVED, CAPTION_MAX, PREVIEW, RELATIONS, RELATION_IN_SENTENCE, fireLine, heOf, pillarCaption, readingFor, type PillarKey, type ReactionFact } from '@/features/v2-taisui/content/readings'
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
  it('judges a ฮะ by the engine: its outcome from bazi, its help from 用神', () => {
    const luck = { favorable: ['ไฟ', 'ดิน'], avoid: ['ไม้'] }
    expect(heOf({ into: { element: 'fire', status: 'detected', source: 'sinse' } }, luck)).toMatchObject({ element: 'ไฟ', tone: 'good', gets: 'ได้ธาตุไฟเพิ่ม', short: 'ช่วยหนุนคุณ' })
    expect(heOf({ into: { element: 'wood', status: 'supported', source: 'engine' } }, luck)).toMatchObject({ element: 'ไม้', tone: 'care', short: 'แต่ไม่ใช่ธาตุที่ช่วยคุณ' })
    expect(heOf({ into: { element: 'wood', status: 'transformed', source: 'engine' } }, null)?.gets).toBe('รวมเป็นธาตุไม้เต็มตัว')
    expect(heOf({}, luck)).toBeNull() // an older bazi sends no outcome: the page says nothing of its own
    const half: ReactionFact = { kind: 'half3', name: '半三合', pillar: 'day', at: 'bottom', mine: '卯', year: '未', into: { element: 'wood', status: 'supported', source: 'engine' } }
    expect(readingFor('half3', 'day', [half], luck).headline).toBe('ตัวเองและคู่ครอง: มีคนรวมกลุ่มด้วย ได้ธาตุไม้เพิ่ม แต่ไม่ใช่ธาตุที่ช่วยคุณ')
  })
  it('names ฮะ the Sinse way and says what it turns into', () => {
    const six: ReactionFact = { kind: 'six', name: '六合', pillar: 'year', at: 'bottom', mine: '午', year: '未', into: { element: 'fire', status: 'detected', source: 'sinse' } }
    const half: ReactionFact = { kind: 'half3', name: '半三合', pillar: 'day', at: 'bottom', mine: '卯', year: '未' }
    expect(readingFor('six', 'year', [six]).details[0]).toMatchObject({ name: 'ฮะ (六合)', why: '未 ของปี ฮะ 午 ของคุณ รวมเป็นธาตุไฟ (ตามคำอธิบายของซินแส) · ราศีล่างเสาปี' })
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
    for (const id of ['stage', 'cine', 'medal', 'start', 'member', 'row', 'next', 'sheet', 'bdD', 'bdM', 'bdY', 'bt', 'noT', 'months', 'moPrev', 'moNext', 'reads', 'lock', 'pkSec', 'seal', 'meds', 'sendPk', 'adPro', 'adPrice', 'adProList', 'adOff', 'toFull', 'toFullT', 'toShort', 'two', 'adPlan', 'adHint', 'statN'])
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
    for (const name of ['taisui_open', 'taisui_form_submit', 'taisui_result', 'taisui_login_click', 'taisui_share', 'taisui_packet_open', 'taisui_shop']) {
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
    // bazi /api/qi/earn's real answer: awarded is a boolean, the amount is earnedQi
    expect(oaClaimFrom(200, { awarded: true, capped: false, earnedQi: 100 })).toEqual({ state: 'paid', qi: 100 })
    expect(oaClaimFrom(200, { awarded: false, capped: true, earnedQi: 0 })).toEqual({ state: 'already' })
    expect(oaClaimFrom(409, { reason: 'not_friend' })).toEqual({ state: 'not_friend' })
    for (const [status, body] of [[400, { reason: 'not_line' }], [401, { reason: 'relogin' }], [502, null], [409, { reason: 'other' }]] as const) {
      expect(oaClaimFrom(status, body)).toEqual({ state: 'skip' })
    }
  })
  it('sends the red packet through LINE only', () => {
    expect(TAISUI_MARKUP).toContain('ส่งอั่งเปาทาง LINE')
  })
})

// The Sinse's check of 2026-11-23, on facts exactly as bazi 0d54694 sends them for a 辛酉 year and
// 辛卯 month (birth 1981-03-15 10:00, female): the month pillar carries three reactions.
const SINSE_81 = {"pillars":[{"key":"hour","stem":"乙","branch":"巳","element":"wood","relation":"none","relations":[],"flow":"fed-by"},{"key":"day","stem":"壬","branch":"辰","element":"water","relation":"heng","relations":["刑","天干合"],"flow":"controlled-by"},{"key":"month","stem":"辛","branch":"卯","element":"metal","relation":"phua","relations":["破","天干冲","半三合"],"flow":"controls"},{"key":"year","stem":"辛","branch":"酉","element":"metal","relation":"stemClash","relations":["天干冲"],"flow":"controls"}],"reactions":[{"kind":"heng","name":"刑","pillar":"day","at":"bottom","mine":"辰","year":"未"},{"kind":"phua","name":"破","pillar":"month","at":"bottom","mine":"卯","year":"丁","pair":"丁卯","group":"poison"},{"kind":"stemClash","name":"天干冲","pillar":"month","at":"top","mine":"辛","year":"丁"},{"kind":"stemClash","name":"天干冲","pillar":"year","at":"top","mine":"辛","year":"丁"},{"kind":"half3","name":"半三合","pillar":"month","at":"bottom","mine":"卯","year":"未","into":{"element":"wood","status":"detected","source":"engine"}},{"kind":"stemCombine","name":"天干合","pillar":"day","at":"top","mine":"壬","year":"丁","into":{"element":"wood","status":"supported","source":"engine"}}],"role":{"dayMaster":"壬","dayElement":"water","role":"wealth","th":"โชคลาภ"},"luck":{"favorable":["ทอง","น้ำ"],"avoid":["ดิน","ไม้","ไฟ"]},"mine":["巳","辰","卯","酉"],"year":{"gregorian":2027,"stem":"丁","branch":"未","element":"fire","lichun":"2027-02-04T01:46:18.000Z"},"chart":{"hasHour":true}} as const

describe('the four-animal scene (the Sinse, revision 0.11)', () => {
  const facts = { ...SINSE_81, months: FACTS.months } as unknown as TaisuiFacts
  const reading = assembleReading(facts, { member: true, source: 'typed' })
  const cap = (key: PillarKey) => pillarCaption(reading.pillars.find((p) => p.key === key)!, reading.hits, reading.luck)

  it('reads the 辛卯 month as he does: top ปะทะ the fire, bottom ผั่ว with the fire, bottom ฮะ with มะแม', () => {
    expect(cap('month').split('\n')).toEqual([
      'เดือนเกิดของคุณคือเถาะ',
      'ราศีบนปะทะไฟของปี · คิดก่อนพูด',
      'ราศีล่างผั่วกับไฟของปี · อุดก่อนจะลาม',
      'ราศีล่างฮะกับมะแม · ได้ธาตุไม้นิดหน่อย แต่ไม่ช่วยคุณ',
    ])
    expect(cap('month')).not.toContain('ผั่วกับปีมะแม')
  })
  it('names the fire on the top character only when no reaction already names that top', () => {
    expect(cap('year')).not.toContain('ไฟของปีคุมราศีบน')
    expect(cap('hour')).toContain('ราศีบนของเสานี้ส่งแรงให้ไฟของปี')
  })
  it('shows every reaction bazi sends for a pillar, up to the cap, for every pillar', () => {
    for (const p of reading.pillars) {
      const n = reading.hits.filter((h) => h.pillar === p.key).length
      const lines = cap(p.key).split('\n').slice(1).filter((l) => /^ราศี(บน|ล่าง)\S* · /.test(l))
      expect(lines.length).toBe(Math.min(n, n > CAPTION_MAX ? CAPTION_MAX - 1 : n))
    }
  })
  it('points to the chart when a pillar has more than the cap', () => {
    const many = (['chong', 'heng', 'hai', 'stemClash'] as const).map((kind, i) => ({ pillar: 'month' as const, at: (i === 3 ? 'top' : 'bottom') as 'top' | 'bottom', kind, year: i === 3 ? '丁' : '未' }))
    const c = pillarCaption({ key: 'month', animal: 'วัว', flow: 'feeds' }, many, null).split('\n')
    expect(c).toHaveLength(1 + CAPTION_MAX)
    expect(c[CAPTION_MAX]).toBe('และอีก 2 จุด ดูในผังดวงด้านล่าง')
  })
  it('words the year fire from the role and 用神, never as "ส่งเสริม … แต่ไม่ช่วย"', () => {
    expect(reading.role?.fire).toBe('ไฟของปีมีโอกาสเรื่องเงิน แต่ดวงคุณต้องการแรงหนุนก่อน อย่ารับเกินตัว')
    expect(fireLine('resource', { favorable: ['ไม้'], avoid: ['ไฟ'] })).toBe('ไฟของปีหล่อเลี้ยงตัวคุณ แต่ดวงคุณมีพลังพออยู่แล้ว ไฟปีนี้จึงไม่ใช่ตัวช่วยหลัก')
    expect(fireLine('resource', null)).toBe('ไฟของปีหล่อเลี้ยงตัวคุณ')
    for (const role of ['resource', 'companion', 'output', 'wealth', 'power'] as const)
      for (const luck of [{ favorable: ['ไฟ'], avoid: [] }, { favorable: [], avoid: ['ไฟ'] }, null])
        expect(fireLine(role, luck)).not.toMatch(/ส่งเสริม.*แต่ไม่/)
  })
})

describe('the page after the team review (revision 0.11)', () => {
  const order = [...TAISUI_MARKUP.matchAll(/<(?:section|footer)[^>]*?(?:id|aria-labelledby)="(\w+)"/g)].map((m) => m[1])
  it('puts the year before the months, then the packet, the shop, the share card and the footer (revision 0.14)', () => {
    expect(order).toEqual(['cine', 'readT', 'moT', 'pkT', 'shop', 'share'])
    expect(TAISUI_MARKUP.indexOf('<footer')).toBeGreaterThan(TAISUI_MARKUP.indexOf('id="share"'))
  })
  it('has no wish lanterns and one LINE send, on the share card', async () => {
    expect(TAISUI_MARKUP).not.toMatch(/wishform|wishsky|ปล่อยโคม/)
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(TAISUI_MARKUP.match(/ทาง LINE<\/button>/g)).toHaveLength(1)
    expect(motion).not.toMatch(/ทาง LINE`|'ส่งอั่งเปาทาง LINE'|line_pillar|api\.lantern/)
  })
  it('types no price into the page: the shop prices come from the server (revision 0.14)', () => {
    const shop = TAISUI_MARKUP.slice(TAISUI_MARKUP.indexOf('id="shop"'), TAISUI_MARKUP.indexOf('</section>', TAISUI_MARKUP.indexOf('id="shop"')))
    expect(shop).not.toMatch(/฿|\d+\s*บาท/)
    // the 50% badge is the owner's offer and stays hidden unless the server has the owner's code
    expect(shop).toMatch(/<span class="off" id="adOff" hidden>ลด 50%<\/span>/)
  })
})


describe('the 100 QI celebration (revision 0.12)', () => {
  it('sends the deeper reading to the chat for a saved chart and to registration for a typed one', async () => {
    const { deeperHref } = await import('@/features/v2-taisui/deeper')
    expect(deeperHref('saved')).toBe('/v2/chat')
    expect(deeperHref('typed')).toBe('/v2/register')
  })
  it('has no deeper strip and no เสี่ยวมู่ card in the shop any more (revision 0.14)', () => {
    expect(TAISUI_MARKUP).not.toMatch(/deepStrip|id="adMu"|id="adPkg"/)
  })
  it('celebrates only a payment, once, with both ways on and no HTML from strings', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    const calls = motion.split('\n').filter((l) => /celebrateQi\(r\.qi, 'paid'\)/.test(l))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("r.state === 'paid'")
    expect(motion).toMatch(/if \(celDone\) return/)
    expect(motion).toMatch(/onSend: \(\) => \{[^\n]*\$\('sendPk'\)\.click\(\)/)
    expect(motion).toMatch(/onRead: \(\) => \{[^\n]*toSection\('yearSec'\)/)
    const cel = fs.readFileSync('features/v2-taisui/components/taisui-celebrate.ts', 'utf8')
    expect(cel).not.toMatch(/innerHTML|insertAdjacentHTML/)
    expect(cel).toContain('ส่งอั่งเปาให้เพื่อน')
    expect(cel).toContain('อ่านคำทำนายเต็มของฉัน')
  })
  it('drops confetti and coins under reduced motion', async () => {
    const { TAISUI_CSS_EXTRA } = await import('@/features/v2-taisui/components/taisui-css-extra')
    expect(TAISUI_CSS_EXTRA).toMatch(/prefers-reduced-motion:reduce\)\{[^`]*\.ts2570 \.cel \.celFx\{display:none\}/)
  })
  it('registers its analytics events', () => {
    expect(ANALYTICS_EVENTS.taisui_oa_cel).toEqual(['action'])
    expect(ANALYTICS_EVENTS.taisui_deeper).toEqual(['from'])
  })
})

describe('after a login from the page (revision 0.13)', () => {
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('says "just logged in" once, only while fresh', async () => {
    const { leaveQiAsk, takeQiAsk } = await import('@/features/v2-taisui/return')
    expect(takeQiAsk(5)).toBe(false)
    leaveQiAsk(1_000)
    expect(takeQiAsk(2_000)).toBe(true)
    expect(takeQiAsk(3_000)).toBe(false)
    leaveQiAsk(0)
    expect(takeQiAsk(31 * 60 * 1000)).toBe(false)
  })
  it('says an already-claimed reward once after that login, and promises the sender nothing', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    expect(motion).toMatch(/r\.state === 'already'\) \{[^\n]*if \(fromLogin\) \{ fromLogin = false; celebrateQi\(100, 'already'\)/)
    const screen = fs.readFileSync('features/v2-taisui/components/TaisuiScreen.tsx', 'utf8')
    expect(screen).toMatch(/leaveReturnMarker\(refCode\)\n\s*leaveQiAsk\(\)/)
    const cel = fs.readFileSync('features/v2-taisui/components/taisui-celebrate.ts', 'utf8')
    expect(cel).toContain('คุณรับ ${o.qi} ชี่จากการแอด LINE ไปแล้ว')
    expect(cel).toContain('เพื่อนเปิดซองได้ชี่ 5–10 ชี่')
    expect(cel).not.toMatch(/คุณได้(รับ)?(อั่งเปา|ชี่)/)
    expect(cel).toMatch(/if \(o\.still \|\| already\) return remove/)
  })
  it('shows a loading screen on home instead of home while the return marker is set', async () => {
    const fs = await import('node:fs')
    const home = fs.readFileSync('pages/v2/index.tsx', 'utf8')
    // from the very first frame: the server reads the cookie, so the pre-mount skeleton is not home's either
    expect(home).toMatch(/returning: ctx\.req\.cookies\?\.\[TAISUI_RETURN_COOKIE\] === '1'/)
    expect(home).toMatch(/if \(showLoading\) return returning \? <ReturnLoading \/> : <HomeSkeleton \/>/)
    expect(home).toMatch(/useState\(\(\) => fromServer \|\| hasReturnMarker\(\)\)/)
    expect(home).toMatch(/if \(returning\) return <ReturnLoading \/>/)
    expect(home.indexOf('if (returning) return <ReturnLoading />')).toBeLessThan(home.indexOf('<V2HomeScreen'))
    expect(home).toMatch(/if \(returning\) clearReturnCookie\(\)/) // a login that did not finish forgets the way back
  })
})

describe('the return cookie (revision 0.13)', () => {
  const store = new Map<string, string>()
  let cookies: string[] = []
  beforeEach(() => {
    store.clear(); cookies = []
    vi.stubGlobal('window', { location: { protocol: 'https:' }, localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } })
    vi.stubGlobal('document', { set cookie(v: string) { cookies.push(v) } })
  })
  afterEach(() => vi.unstubAllGlobals())
  it('is set with the marker, short-lived and Lax, and cleared when the way back is taken', async () => {
    const { leaveReturnMarker, takeReturnPath, TAISUI_RETURN_COOKIE } = await import('@/features/v2-taisui/return')
    leaveReturnMarker(null, 1_000)
    expect(cookies[0]).toBe(`${TAISUI_RETURN_COOKIE}=1; Path=/; Max-Age=1800; SameSite=Lax; Secure`)
    expect(takeReturnPath(2_000)).toBe('/taisui-2570')
    expect(cookies[1]).toBe(`${TAISUI_RETURN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`)
  })
  it('the already-claimed sheet links to the app', async () => {
    const fs = await import('node:fs')
    const cel = fs.readFileSync('features/v2-taisui/components/taisui-celebrate.ts', 'utf8')
    expect(cel).toContain("already ? 'ไปถามเสี่ยวมู่ต่อในแอป ›'")
  })
})

describe('the guide button never lands on the same stop twice (owner, 2026-11-23)', () => {
  it('leads from every stop to the following one, even when the address bar shifts progress by about 1%', async () => {
    const { RESTS, REST_SLACK, nextRestAfter } = await import('@/features/v2-taisui/components/taisui-motion')
    for (let i = 0; i < RESTS.length - 1; i++) {
      const at = RESTS[i][0]
      for (const drift of [-0.01, -0.005, 0, 0.005, 0.01].map((d) => d * at)) {
        expect(nextRestAfter(at + drift)?.[0]).toBe(RESTS[i + 1][0])
      }
    }
    // the slack must stay under half the tightest gap, or a stop could be skipped
    const gaps = RESTS.slice(1).map((r, i) => r[0] - RESTS[i][0])
    expect(REST_SLACK * 2).toBeLessThan(Math.min(...gaps))
  })
})

describe('the guide glide and the scene measure progress the same way', () => {
  it('glides with the stage height, as frame() measures, not the window height', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    expect(motion).toMatch(/const vh = stage\.clientHeight \|\| innerHeight/)
    expect(motion).toMatch(/const glideTo = [^\n]*cine\.offsetHeight - \(stage\.clientHeight \|\| innerHeight\)\) \* pp/)
  })
})

describe('the team meeting of 2026-11-24 (revision 0.14)', () => {
  it('sells Pro yearly from the server price and the owner code, and falls back to the list price', async () => {
    const { proOfferFrom } = await import('@/lib/taisui/pro-offer')
    expect(proOfferFrom({ amount: 1590, is_active: true }, 'ANY_CODE1')).toEqual({ href: '/v2/shop/checkout?package_code=V2_PRO_YEARLY&code=ANY_CODE1', price: 1590, discounted: true })
    expect(proOfferFrom({ amount: '1590', is_active: true }, undefined)).toEqual({ href: '/v2/shop/checkout?package_code=V2_PRO_YEARLY', price: 1590, discounted: false })
    expect(proOfferFrom({ amount: 1590, is_active: true }, 'bad code; drop')).toMatchObject({ discounted: false })
    expect(proOfferFrom({ amount: 1590, is_active: false }, 'ANY_CODE1').price).toBeNull()
    expect(proOfferFrom(null, undefined)).toMatchObject({ price: null, discounted: false })
  })
  it('reads the code from the server env, never from this repository', async () => {
    const fs = await import('node:fs')
    const page = fs.readFileSync('pages/taisui-2570.tsx', 'utf8')
    expect(page).toMatch(/process\.env\.TAISUI_PRO_CODE/)
    expect(page).toMatch(/FROM payment_package WHERE package_code = \$\{TAISUI_PRO_PACKAGE\}/)
    // no discount code is typed into the page's code: the link gets it only from proOfferFrom(…, env)
    for (const f of ['features/v2-taisui/components/taisui-motion.ts', 'features/v2-taisui/components/taisui-markup.ts', 'lib/taisui/pro-offer.ts', 'pages/taisui-2570.tsx']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/[?&]code=[A-Za-z0-9]/)
    }
  })
  it('offers อ่านแบบย่อ and อ่านแบบเต็ม on the count; อ่านแบบเต็ม lands on the shop', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    expect(TAISUI_MARKUP).toMatch(/id="toFull"[\s\S]*id="toShort">อ่านแบบย่อ · ฟรี</)
    expect(motion).toMatch(/on\(\$\('toFull'\), 'click', \(\) => \{[^\n]*toSection\('shop'\)/)
    // the short read is free for everyone: it glides to the year, and the login waits at the year's end
    expect(motion).toMatch(/on\(\$\('toShort'\), 'click', \(\) => \{[^\n]*toSection\(roleSec\.hidden \? 'readT' : 'yearSec'\)/)
    expect(motion).not.toMatch(/gate\('count'\)/)
    expect(motion).toMatch(/if \(!member\) \{ const lg = el\('button', 'btn yearLogin', 'เข้าสู่ระบบด้วย LINE · รับ 100 ชี่'\)[^\n]*gate\('year'\)/)
    expect(motion).toMatch(/document\.createTextNode\('ต่อไป: คำทำนายรายเสา'\)[^\n]*\n[^\n]*toSection\('readT'\)/)
    // a visitor's skip is quiet and goes to the shop; only members get the way to the share card
    expect(motion).toMatch(/el\('button', 'yearSkip', 'ไว้ทีหลัง · ดูของขวัญปีมะแม ›'\)[\s\S]{0,200}toSection\('shop'\)/)
    expect(motion).toMatch(/const syncShare = \(\) => \{ toShare\.hidden = !member \}/)
    // one login per box: the floating dock shows only before a reading
    expect(motion).toMatch(/dock\.classList\.toggle\('on', below && !sheetOpen && !member && !reading\)/)
  })
  it('cuts the Sinse chart and every card Sinse fold; the card ask goes to the shop', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    expect(motion).not.toMatch(/el\('details', 'sx'\)/)
    expect(motion).toMatch(/if \(false as boolean\) \{ const fold = el\('details', 'fold'\)/)
    expect(motion).toMatch(/const ask = el\('button', 'ask'\)[^\n]*\n[^\n]*toSection\('shop'\)/)
    expect(motion).not.toMatch(/ask\.href = '\/v2\/chat'/)
  })
  it('sends a visitor through the login page before Pro, and back to the shop afterwards', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    expect(motion).toMatch(/if \(!member\) \{ e\.preventDefault\(\); gate\('pro', 'shop'\) \}/)
    expect(motion).toMatch(/if \(member && api\.takeNext\(\) === 'shop'\) later\(\(\) => toSection\('shop'\)/)
    const screen = fs.readFileSync('features/v2-taisui/components/TaisuiScreen.tsx', 'utf8')
    expect(screen).toMatch(/if \(next\) \{ try \{ sessionStorage\.setItem\(NEXT_KEY, next\)/)
  })
  it('ends every part with a way on, in one style, and floats it while the cards fill the screen', async () => {
    const fs = await import('node:fs')
    const motion = fs.readFileSync('features/v2-taisui/components/taisui-motion.ts', 'utf8')
    expect(motion).toMatch(/\$\('moSec'\)\.appendChild\(toShop\); on\(toShop, 'click', \(\) => toSection\('shop'\)\)/)
    expect(motion).toMatch(/\$\('shop'\)\.appendChild\(toShare\); on\(toShare, 'click', \(\) => toSection\('share'\)\)/)
    expect(motion).toMatch(/fl\.hidden = !\(member && readsIn && !cueIn\)/)
    const { TAISUI_CSS_EXTRA } = await import('@/features/v2-taisui/components/taisui-css-extra')
    expect(TAISUI_CSS_EXTRA).toContain('.ts2570 .nextcue,.ts2570 .waynext,.ts2570 .floatnext,.ts2570 .read .cfoot .ask{')
  })
  it('registers its analytics events', () => {
    expect(ANALYTICS_EVENTS.taisui_way).toEqual(['pick'])
    expect(ANALYTICS_EVENTS.taisui_gate).toEqual(['from'])
  })
})
