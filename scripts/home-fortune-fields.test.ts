// ANCHOR: fortune-fields-complete — the Zone-1 daily-fortune card must never render with a SILENTLY
// missing field. This pins the full DailyFortune contract (completeness-pass, omission→test): every
// field the card needs must be populated from a complete bazi fortune, and each source path (bazi
// summaryItems vs facets fallback, verdict clamp, headline fallback) is enumerated. DB/React-free.
// Run: npx tsx scripts/home-fortune-fields.test.ts   or:  bun scripts/home-fortune-fields.test.ts
import assert from 'node:assert/strict'
import { normalize, type DailyFortune } from '../pages/api/home-fortune'

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

// A COMPLETE bazi /api/home fortune (after PR#13 forwards grade/summaryHeadline/summaryItems).
const complete = {
  date: '2026-07-25',
  dayGanzhi: 'x',
  percent: 75,
  grade: 'C+',
  verdict: 'good',
  summary: 'สรุปยาว',
  summaryHeadline: 'วันนี้ดวงดีมาก',
  // Real bazi shape: KEYED items (best · worst · strength · element · officer), NOT positional. `officer`
  // sits AFTER `worst` so a positional [last] read would wrongly grab it — this fixture guards that.
  summaryItems: [
    { key: 'best', icon: '⭐', label: 'การเงิน', text: 'เหมาะลงทุน' },
    { key: 'worst', icon: '⚠️', label: 'สุขภาพ', text: 'ระวังพักผ่อน' },
    { key: 'officer', icon: '📅', label: 'หน้าที่', text: 'ดูแลเอาใจใส่' },
  ],
  facets: [
    { key: 'wealth', label: 'การเงิน', percent: 90, grade: 'A', isMain: true },
    { key: 'health', label: 'สุขภาพ', percent: 40, grade: 'D', isMain: false },
  ],
}

// The full contract the card binds to — every one must be present + non-empty, or the box shows a hole.
const REQUIRED: (keyof DailyFortune)[] = ['percent', 'grade', 'verdict', 'headline', 'date', 'best', 'worst']

t('fortune-fields-complete: a complete fortune → ALL 7 fields populated (no silent omission)', () => {
  const df = normalize(complete)
  assert.ok(df, 'normalize returned null for a complete fortune')
  for (const k of REQUIRED) {
    assert.ok(k in df, `MISSING field: ${k}`)
  }
  assert.equal(df.percent, 75)
  assert.equal(df.grade, 'C+')
  assert.equal(df.verdict, 'good')
  assert.equal(df.headline, 'วันนี้ดวงดีมาก') // summaryHeadline preferred over summary
  assert.equal(df.date, '2026-07-25')
  assert.ok(df.best.text.length > 0, 'best.text empty')
  assert.ok(df.worst.text.length > 0, 'worst.text empty')
})

t('best ⭐ / worst ⚠️ from summaryItems matched BY KEY (not position — officer is last)', () => {
  const df = normalize(complete)!
  assert.equal(df.best.text, 'เหมาะลงทุน') // key==='best'
  assert.equal(df.worst.text, 'ระวังพักผ่อน') // key==='worst' — NOT the last item 'ดูแลเอาใจใส่' (officer)
})

t('fallback: no summaryItems → best/worst derived from facets by %-max/%-min', () => {
  const df = normalize({ ...complete, summaryItems: undefined })!
  assert.equal(df.best.text, 'การเงิน') // facet 90% → best
  assert.equal(df.worst.text, 'สุขภาพ') // facet 40% → worst
})

t('fallback: no summaryHeadline → headline uses summary', () => {
  const df = normalize({ ...complete, summaryHeadline: undefined })!
  assert.equal(df.headline, 'สรุปยาว')
})

t('verdict clamp: unknown verdict → neutral (never leaks a bad value to the ring colour)', () => {
  const df = normalize({ ...complete, verdict: 'weird' })!
  assert.equal(df.verdict, 'neutral')
})

t('grade absent (pre-PR#13 response) → grade "" (card degrades, never crashes)', () => {
  const df = normalize({ ...complete, grade: undefined })!
  assert.equal(df.grade, '')
})

t('no percent → null (card cannot render without the score; hook shows fallback)', () => {
  assert.equal(normalize({ ...complete, percent: null }), null)
  assert.equal(normalize(null), null)
})

t('pct-bounds (Lamun รู1, at source): percent >100 → 100, <0 → 0, NaN → null', () => {
  assert.equal(normalize({ ...complete, percent: 150 })!.percent, 100)
  assert.equal(normalize({ ...complete, percent: -5 })!.percent, 0)
  assert.equal(normalize({ ...complete, percent: NaN }), null)
})

t('empty-facet (Lamun รู2): no summaryItems AND no scorable facets → best/worst text "" (card shows —)', () => {
  const df = normalize({ ...complete, summaryItems: undefined, facets: [] })!
  assert.equal(df.best.text, '')
  assert.equal(df.worst.text, '') // Lamun renders '—' for empty — the data layer reports it honestly, not a fake value
})

console.log(`\n  ${pass} passed${process.exitCode ? ' · SOME FAILED' : ''}`)
