// ANCHOR: best-worst-by-key — the /v2 "ควรเลี่ยง" (worst) card must read summaryItems by KEY, never by
// position. bazi sends 5 keyed items (best · worst · strength · element · officer); the old code took
// summaryItems[last] = 'officer' ("ดูแลเอาใจใส่"), so "ควรเลี่ยง" showed the OPPOSITE of key==='worst'
// ("อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง") — a daily inverted message. Falls back to facets-by-percent when the
// keyed items are absent. Run: npx tsx scripts/home-fortune-best-worst.test.ts
import assert from 'node:assert/strict'
import { bestWorstText } from '../pages/api/home-fortune'

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

// The REAL bazi /api/home summaryItems shape (บอง verified live): keyed, order best·worst·strength·element·officer.
const OFFICER_TEXT = 'ดูแลเอาใจใส่'
const WORST_TEXT = 'อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง'
const BEST_TEXT = 'อยู่กับเพื่อน / พี่น้อง / คู่ครอง'
const baziItems = [
  { key: 'best', icon: '⭐', label: 'เหมาะกับวันนี้', text: BEST_TEXT },
  { key: 'worst', icon: '⚠️', label: 'ควรเลี่ยง', text: WORST_TEXT },
  { key: 'strength', icon: '💪', label: 'จุดแข็ง', text: 'xxx' },
  { key: 'element', icon: '🌱', label: 'ธาตุ', text: 'yyy' },
  { key: 'officer', icon: '📅', label: 'ดูแล', text: OFFICER_TEXT },
]

t('worst reads key===worst, NOT the last item (officer) — the core bug', () => {
  const { best, worst } = bestWorstText({ summaryItems: baziItems })
  assert.equal(worst, WORST_TEXT, 'worst must be key===worst')
  assert.equal(best, BEST_TEXT, 'best must be key===best')
  // neg-control: the old summaryItems[last] behaviour returned the officer text — prove we do NOT.
  assert.notEqual(worst, OFFICER_TEXT, 'worst must NOT be the last item (officer) — the inverted bug')
})

t('order-independent: worst still found when officer is not last', () => {
  const shuffled = [baziItems[4], baziItems[1], baziItems[0]] // officer, worst, best
  const { best, worst } = bestWorstText({ summaryItems: shuffled })
  assert.equal(worst, WORST_TEXT)
  assert.equal(best, BEST_TEXT)
})

t('fallback to facets-by-percent when summaryItems absent', () => {
  const facets = [
    { key: 'a', label: 'สูงสุด', percent: 90, grade: 'A', isMain: false },
    { key: 'b', label: 'ต่ำสุด', percent: 10, grade: 'D', isMain: false },
  ]
  const { best, worst } = bestWorstText({ facets })
  assert.equal(best, 'สูงสุด')
  assert.equal(worst, 'ต่ำสุด')
})

t('per-field fallback: worst key missing → facet worst; best key present → keyed', () => {
  const items = [{ key: 'best', icon: '⭐', label: '', text: 'KEYED BEST' }]
  const facets = [
    { key: 'a', label: 'FACET HIGH', percent: 80, grade: 'A', isMain: false },
    { key: 'b', label: 'FACET LOW', percent: 20, grade: 'D', isMain: false },
  ]
  const { best, worst } = bestWorstText({ summaryItems: items, facets })
  assert.equal(best, 'KEYED BEST')
  assert.equal(worst, 'FACET LOW')
})

t('empty everything → empty strings (graceful, never throws)', () => {
  assert.deepEqual(bestWorstText({}), { best: '', worst: '' })
})

console.log(`\n  best-worst-by-key: ${pass} passed`)
