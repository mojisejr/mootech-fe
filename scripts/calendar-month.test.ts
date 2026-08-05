// Unit gate for the v2 calendar-month BFF pure logic. Plain tsx + node:assert (matches ci.yml `for f in
// scripts/*.test.ts`). Fixtures are REAL almanac rows curl'd from bazi-sft-dataset.vercel.app 2026-08.
//
// ANCHOR: scripts/calendar-month.test.ts#calendar-month-wanphra-category
// Bug-class this owns: วันพระ MISCATEGORISATION — the almanac specialDays[] mixes RELIGIOUS วันพระ
// (thai-buddhist · chinese-religious) with government holidays and secular festivals. A naive
// "any special day ⇒ วันพระ" flags Mother's Day (government) as วันพระ, and a single-category check
// misses วันพระ when it co-occurs with สารทจีน (festival). The mutant checks below prove the anchor bites.
import assert from 'node:assert'
import {
  almanacWanPhraDays,
  fortuneCacheKey,
  isWanPhraDay,
  mergeCalendarMonth,
  parseMonth,
} from '../lib/v2-calendar/month' // #calendar-month-wanphra-category

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

// ── parseMonth ──
ok('parseMonth valid + yearBE=+543', (() => {
  const p = parseMonth('2026-08')
  return !!p && p.year === 2026 && p.month === 8 && p.yearBE === 2569
})())
ok('parseMonth rejects bad shape', parseMonth('2026/08') === null && parseMonth('202608') === null)
ok('parseMonth rejects month out of range', parseMonth('2026-13') === null && parseMonth('2026-00') === null)
ok('parseMonth rejects non-string', parseMonth(undefined) === null && parseMonth(202608) === null)

// ── isWanPhraDay — REAL 2026-08 specialDays fixtures ──
const GOVERNMENT = [{ id: 'mother-day', name: 'วันแม่แห่งชาติ', category: 'government' }] // 2026-08-12
const RELIGIOUS = [{ id: 'wan-phra-chinese', name: 'วันพระจีน (初一/十五)', category: 'chinese-religious' }] // 08-13
const FESTIVAL_PLUS_RELIGIOUS = [
  { id: 'ghost', name: 'เทศกาลสารทจีน (ตงง้วน)', category: 'festival-chinese' },
  { id: 'wan-phra-chinese', name: 'วันพระจีน', category: 'chinese-religious' },
] // 2026-08-27 — วันพระ hides behind a festival; a single-category check would MISS it
const FESTIVAL_ONLY = [{ id: 'ghost', name: 'เทศกาลสารทจีน', category: 'festival-chinese' }]
const THAI_BUDDHIST = [{ id: 'wan-phra-thai', name: 'วันพระ', category: 'thai-buddhist' }]

ok('government holiday is NOT วันพระ (mutant: any-special-day) ', isWanPhraDay(GOVERNMENT) === false)
ok('chinese-religious IS วันพระ', isWanPhraDay(RELIGIOUS) === true)
ok('thai-buddhist IS วันพระ', isWanPhraDay(THAI_BUDDHIST) === true)
ok('festival+religious IS วันพระ (mutant: single-category misses it)', isWanPhraDay(FESTIVAL_PLUS_RELIGIOUS) === true)
ok('festival-only is NOT วันพระ', isWanPhraDay(FESTIVAL_ONLY) === false)
ok('empty / non-array → false', isWanPhraDay([]) === false && isWanPhraDay(undefined) === false && isWanPhraDay(null) === false)

// ── mergeCalendarMonth — join BY DATE, strip, clamp ──
const MVD = [
  { date: '2026-08-01', dayOfMonth: 1, dayGanzhi: '丁未', overallPercent: 61.66, grade: 'B', dayStrength: 0.48, junk: 'x' },
  { date: '2026-08-13', dayOfMonth: 13, dayGanzhi: '己未', overallPercent: 40, grade: 'C-', dayStrength: 0.5 },
  { date: '2026-08-27', dayOfMonth: 27, dayGanzhi: '癸酉', overallPercent: 150, grade: 'A+', dayStrength: 0.6 }, // >100 → clamp
  { date: '2026-08-28', dayOfMonth: 28, dayGanzhi: '甲戌', overallPercent: null, grade: null, dayStrength: 0.6 }, // null passes through
]
const ALMANAC = [
  { date: '2026-08-01', specialDays: [] },
  { date: '2026-08-12', specialDays: GOVERNMENT }, // present in almanac, ABSENT in mvd → must not leak in
  { date: '2026-08-13', specialDays: RELIGIOUS },
  { date: '2026-08-27', specialDays: FESTIVAL_PLUS_RELIGIOUS },
]
const merged = mergeCalendarMonth(MVD, ALMANAC)

ok('merge keeps only mvd days (4, not 5)', merged.length === 4)
ok('merge strips heavy/junk fields to 6 keys (incl grade)', (() => {
  const keys = Object.keys(merged[0]).sort()
  return JSON.stringify(keys) === JSON.stringify(['date', 'dayGanzhi', 'dayOfMonth', 'grade', 'overallPercent', 'wanPhra'])
})())
// #b4-grade-passthrough
ok('grade passes through from bazi (B-4): 08-01 B · 08-13 C- · 08-27 A+', (() => {
  const g = (d: string) => merged.find((x) => x.date === d)?.grade
  return g('2026-08-01') === 'B' && g('2026-08-13') === 'C-' && g('2026-08-27') === 'A+'
})())
ok('grade null passes through (คิดไม่ได้, not "-"): 08-28', merged.find((x) => x.date === '2026-08-28')?.grade === null)
ok('grade absent/non-string → null (guard)', mergeCalendarMonth([{ date: '2026-08-09', overallPercent: 50 }], []).at(0)?.grade === null)
ok('merge joins wanPhra BY DATE not index', (() => {
  const d13 = merged.find((x) => x.date === '2026-08-13')
  const d1 = merged.find((x) => x.date === '2026-08-01')
  const d27 = merged.find((x) => x.date === '2026-08-27')
  // index join would have put 08-12's government flag onto mvd[1]=08-13; date join keeps 08-13 religious=true
  return d13?.wanPhra === true && d1?.wanPhra === false && d27?.wanPhra === true
})())
ok('merge clamps percent >100 → 100', merged.find((x) => x.date === '2026-08-27')?.overallPercent === 100)
ok('merge keeps null percent', merged.find((x) => x.date === '2026-08-28')?.overallPercent === null)
ok('merge day absent in almanac → wanPhra false (08-28)', merged.find((x) => x.date === '2026-08-28')?.wanPhra === false)
ok('merge non-array mvd → []', mergeCalendarMonth(undefined, ALMANAC).length === 0)

// ── almanacWanPhraDays — free overlay shape ──
const free = almanacWanPhraDays(ALMANAC)
ok('almanacWanPhraDays maps date→{date,dayOfMonth,wanPhra}', (() => {
  const d12 = free.find((x) => x.date === '2026-08-12')
  const d13 = free.find((x) => x.date === '2026-08-13')
  return d12?.dayOfMonth === 12 && d12?.wanPhra === false && d13?.wanPhra === true
    && JSON.stringify(Object.keys(free[0]).sort()) === JSON.stringify(['date', 'dayOfMonth', 'wanPhra'])
})())

// ── fortuneCacheKey — must include the birth signature, not userId+month alone (μุน's dob-staleness) ──
const dobA = { birthDate: '1990-01-15', birthTime: '08:30', gender: 'male', province: 'Bangkok' }
const dobB = { birthDate: '1991-02-20', birthTime: '08:30', gender: 'male', province: 'Bangkok' } // edited dob
ok('cacheKey stable for same (user, birth, month)', fortuneCacheKey('u1', dobA, '2026-08') === fortuneCacheKey('u1', dobA, '2026-08'))
ok('cacheKey CHANGES when dob changes (no stale)', fortuneCacheKey('u1', dobA, '2026-08') !== fortuneCacheKey('u1', dobB, '2026-08'))
ok('cacheKey differs per user and per month', (() => {
  return fortuneCacheKey('u1', dobA, '2026-08') !== fortuneCacheKey('u2', dobA, '2026-08')
    && fortuneCacheKey('u1', dobA, '2026-08') !== fortuneCacheKey('u1', dobA, '2026-09')
})())

console.log(`✅ calendar-month.test.ts — ${pass} assertions passed`)
