// ดวงสมพงศ์ Slice 2C — result-parse seam teeth (goo logic contract → μุน's result screen).
// Bug-class this guards:
//  (1) defaulting an ABSENT field to '' / 0 / [] instead of undefined — the screen can no longer tell
//      "no data" from "zero", so it renders an empty/fake block instead of hiding it (FROZEN rule 4 + D13);
//  (2) dimensions not passed through VERBATIM — cut/added/reordered/defaulted (love=5 vs colleague=4 must
//      ride as-is, D12);
//  (3) a malformed / legacy / non-bazi result throwing or being treated as a valid blank result instead
//      of resolving to null (the hook must show a fallback, never strand or fabricate).
// Run: npx tsx scripts/compatibility-result.test.ts
//
// ANCHOR: scripts/compatibility-result.test.ts#compatibility-result-parse-seam
import assert from 'node:assert/strict'
import {
  parseCompatibilityResult,
  applyCarriedBirth,
  mascotGanzhiPair,
  type CompatibilityResult,
} from '../features/v2-service/compatibility-result'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

// The BE (2B) stores the whole blob as a JSON STRING under get-detail's `.result`.
const pairMatch = {
  overall: { percent: 62, grade: 'C', gradeLabel: 'ดี', hearts: 3, emoji: '💛', ratingText: 'เข้ากันดี' },
  dimensions: [
    { key: 'day', label: 'เสาวัน', pairingLabel: 'ดิถีคู่', percent: 62, grade: 'C', ratingText: 'เข้าใจกัน', isMain: true, sising: { code: 'WT', nameTh: 'เสือขาว', summary: '...' } },
    { key: 'month', label: 'เสาเดือน', pairingLabel: 'เดือนคู่', percent: 40, grade: 'D', ratingText: 'ปรับจูน', isMain: false, sising: null },
    { key: 'year', label: 'เสาปี', pairingLabel: 'ปีคู่', percent: 55, grade: 'C-', ratingText: 'พอได้', isMain: false, sising: null },
  ],
  persons: {
    a: { displayName: 'เอ', dayGanzhi: '己巳', elementTh: 'ดิน', timeKnown: true, fourPillars: { year: { stem: '庚', branch: '午', element: 'ทอง' }, month: { stem: '辛', branch: '巳', element: 'ทอง' }, day: { stem: '己', branch: '巳', element: 'ดิน' }, hour: { stem: '戊', branch: '辰', element: 'ดิน' } } },
    b: { displayName: 'บี', dayGanzhi: '丙午', elementTh: 'ไฟ', timeKnown: false, fourPillars: { year: { stem: '戊', branch: '辰', element: 'ดิน' }, month: { stem: '壬', branch: '戌', element: 'น้ำ' }, day: { stem: '丙', branch: '午', element: 'ไฟ' }, hour: { stem: '甲', branch: '午', element: 'ไม้' } } },
  },
  elementInteraction: { aElementTh: 'ดิน', bElementTh: 'ไฟ', summaryTh: 'ธาตุเสริมกัน', aToB: { relation: 'resource', labelTh: 'ส่งเสริมดิถี', meaningTh: 'เขาส่งเสริมเรา' }, bToA: { relation: 'wealth', labelTh: 'ดิถีพิฆาต', meaningTh: 'เราคุมเขา' } },
}
const getDetailResponse = { result: JSON.stringify({ me: pairMatch.persons.a, you: pairMatch.persons.b, result: { score: 62 }, pairMatch }), user: {}, friend: {}, type: 'LOVE' }

// ── parse extracts the rich fields from the stored JSON string ──
t('parses pairMatch overall/persons/elementInteraction from the get-detail string', () => {
  const r = parseCompatibilityResult(getDetailResponse) as CompatibilityResult
  assert.equal(r.overall?.percent, 62)
  assert.equal(r.persons.a?.dayGanzhi, '己巳')
  assert.equal(r.persons.b?.timeKnown, false)
  assert.equal(r.elementInteraction?.aToB?.relation, 'resource')
  assert.equal(r.persons.a?.fourPillars?.day.element, 'ดิน')
})

// ── D12: dimensions VERBATIM — same length, same order, not reshaped ──
t('dimensions pass through verbatim (length + order preserved, colleague=4/love=5 as-is)', () => {
  const r = parseCompatibilityResult(getDetailResponse) as CompatibilityResult
  assert.equal(r.dimensions?.length, 3)
  assert.deepEqual(r.dimensions?.map((d) => d.key), ['day', 'month', 'year'])
  assert.equal(r.dimensions?.[0].sising?.nameTh, 'เสือขาว') // symbolic hint rides through untouched
})

// ── D13: an ABSENT field is undefined, NOT '' / 0 / [] ──
t('absent dimensions → undefined (NOT default [])', () => {
  const noDims = { result: JSON.stringify({ pairMatch: { overall: { percent: 10 }, persons: {} } }) }
  const r = parseCompatibilityResult(noDims) as CompatibilityResult
  assert.equal(r.dimensions, undefined) // teeth: a default [] here would hide "no data" from the screen
})

t('absent overall / elementInteraction → undefined (screen decides to hide)', () => {
  const bare = { result: JSON.stringify({ pairMatch: { persons: { a: { dayGanzhi: '甲子' } } } }) }
  const r = parseCompatibilityResult(bare) as CompatibilityResult
  assert.equal(r.overall, undefined)
  assert.equal(r.elementInteraction, undefined)
  assert.equal(r.persons.b, undefined)
})

// ── (3) malformed / legacy / non-bazi → null, never throw, never a fake blank ──
t('result not a string → null', () => {
  assert.equal(parseCompatibilityResult({ result: { score: 1 } }), null)
  assert.equal(parseCompatibilityResult(null), null)
  assert.equal(parseCompatibilityResult({}), null)
})

t('malformed JSON string → null (no throw)', () => {
  assert.equal(parseCompatibilityResult({ result: '{not json' }), null)
})

t('legacy result with no pairMatch → null (hook shows fallback, not a blank rich screen)', () => {
  const legacy = { result: JSON.stringify({ me: {}, you: {}, result: { score: 7, rating: { rating: 4 } } }) }
  assert.equal(parseCompatibilityResult(legacy), null)
})

// ── mascotGanzhiPair — extract day-ganzhi, skip absent/empty (never fabricate) ──
t('mascotGanzhiPair extracts both dayGanzhi', () => {
  const r = parseCompatibilityResult(getDetailResponse)
  assert.deepEqual(mascotGanzhiPair(r), { a: '己巳', b: '丙午' })
})

t('mascotGanzhiPair → undefined for absent / empty ganzhi (no fabricated ganzhi)', () => {
  assert.deepEqual(mascotGanzhiPair(null), { a: undefined, b: undefined })
  const oneEmpty = { result: JSON.stringify({ pairMatch: { persons: { a: { dayGanzhi: '甲子' }, b: { dayGanzhi: '  ' } } } }) }
  assert.deepEqual(mascotGanzhiPair(parseCompatibilityResult(oneEmpty)), { a: '甲子', b: undefined })
})

// ── carry-through: birthDate/time carried from the form onto the header (no re-fetch) ──
t('applyCarriedBirth merges dob/time onto persons (position-aligned a↔a, b↔b)', () => {
  const r = parseCompatibilityResult(getDetailResponse) as CompatibilityResult
  const merged = applyCarriedBirth(r, {
    a: { name: 'เอ', dob: '1994-06-14', time: '09:30' },
    b: { name: 'บี', dob: '1992-08-01', time: '05:30' },
  }) as CompatibilityResult
  assert.equal(merged.persons.a?.birthDate, '1994-06-14')
  assert.equal(merged.persons.a?.time, '09:30')
  assert.equal(merged.persons.b?.birthDate, '1992-08-01')
  // pairMatch fields survive the merge (dayGanzhi still there)
  assert.equal(merged.persons.a?.dayGanzhi, '己巳')
})

t('carried empty / whitespace dob·time → undefined (rule 4: hide the line, not blank)', () => {
  const r = parseCompatibilityResult(getDetailResponse) as CompatibilityResult
  const merged = applyCarriedBirth(r, { a: { name: 'เอ', dob: '1994-06-14', time: '' }, b: { dob: '   ', time: '  ' } }) as CompatibilityResult
  assert.equal(merged.persons.a?.time, undefined) // unknown birth time → "—", not ''
  assert.equal(merged.persons.b?.birthDate, undefined) // whitespace → undefined, not a blank line
})

t('no carry (direct-link / parked flow) → persons unchanged, birthDate undefined', () => {
  const r = parseCompatibilityResult(getDetailResponse) as CompatibilityResult
  const merged = applyCarriedBirth(r, null) as CompatibilityResult
  assert.equal(merged.persons.a?.birthDate, undefined)
  assert.equal(merged.persons.a?.dayGanzhi, '己巳') // rich data intact
})

t('applyCarriedBirth on a null result stays null (no crash)', () => {
  assert.equal(applyCarriedBirth(null, { a: { dob: '1994-06-14' } }), null)
})

console.log(`\ncompatibility-result: ${pass} passed`)
