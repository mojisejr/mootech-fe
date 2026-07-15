// Deterministic tests for the badge matching helpers (#calculator-badge-mood-FROZEN-v1).
// Run: bun scripts/calc-badges.test.ts   or: npx tsx scripts/calc-badges.test.ts
import assert from 'node:assert/strict'
import { badgeIcon, badgePopoverText, capBadges, findAnnualBadge, findDecadeBadge, findPillarBadge } from '../lib/calculator/badges'
import type { EnrichmentBadge } from '../pages/api/calculator/compute'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

function badge(point: string, role: 'wealth' | 'power' = 'wealth'): EnrichmentBadge {
  return { point, role, element: 'ไม้', qi: 'เชี่ยงแซ', clash: false }
}

function main() {
  t('findPillarBadge maps "pillar-hour" to column key "time" (naming mismatch reconciled)', () => {
    const badges = [badge('pillar-hour')]
    assert.deepEqual(findPillarBadge(badges, 'time'), badges[0])
    assert.equal(findPillarBadge(badges, 'hour'), undefined)
  })

  t('findPillarBadge: ascendant/month/year map 1:1 (no reordering, semantic names match)', () => {
    const badges = [badge('pillar-ascendant'), badge('pillar-month'), badge('pillar-year')]
    assert.equal(findPillarBadge(badges, 'ascendant'), badges[0])
    assert.equal(findPillarBadge(badges, 'month'), badges[1])
    assert.equal(findPillarBadge(badges, 'year'), badges[2])
  })

  // Regression guard: decades[] (mapDecadeLuck, mootech-be) renders OLDEST-first while
  // bazi-sft-dataset's decade-N badge ids are YOUNGEST-first (verified live 2026-07-15: decades[0]
  // showed age 87-91 while decade-0's badge corresponds to age 7-11) — matching by raw array
  // index would badge the wrong decade entirely. Must match via age against the daYun rows that
  // badges were actually computed from.
  t('findDecadeBadge matches by age via daYun rows, not raw decade array index', () => {
    const daYun = [
      { ageRange: '7-11 ปี' },
      { ageRange: '12-16 ปี' },
      { ageRange: '17-21 ปี' },
      { ageRange: '22-26 ปี' },
      { ageRange: '87-91 ปี' },
      { ageRange: '92-96 ปี' },
    ]
    const badges = [badge('decade-2')] // 3rd pair (indices 4,5) -> ageStart 87
    assert.equal(findDecadeBadge(badges, daYun, 87), badges[0])
    assert.equal(findDecadeBadge(badges, daYun, 7), undefined) // decade-0 not in badges list
  })

  t('findDecadeBadge: no matching age in daYun -> undefined, no crash', () => {
    assert.equal(findDecadeBadge([badge('decade-0')], [], 7), undefined)
  })

  t('findAnnualBadge matches by age (annual.year IS the age counter, not a calendar year)', () => {
    const badges = [badge('annual-41')]
    assert.equal(findAnnualBadge(badges, 41), badges[0])
    assert.equal(findAnnualBadge(badges, 2041), undefined)
  })

  t('capBadges caps and reports overflow correctly', () => {
    const badges = [badge('a'), badge('b'), badge('c'), badge('d'), badge('e')]
    const { shown, overflow } = capBadges(badges, 3)
    assert.equal(shown.length, 3)
    assert.equal(overflow, 2)
  })

  t('capBadges: under the cap -> zero overflow, all shown', () => {
    const badges = [badge('a')]
    const { shown, overflow } = capBadges(badges, 3)
    assert.equal(shown.length, 1)
    assert.equal(overflow, 0)
  })

  t('badgeIcon: wealth and power map to distinct existing assets', () => {
    assert.notEqual(badgeIcon('wealth'), badgeIcon('power'))
    assert.ok(badgeIcon('wealth').startsWith('/images/box/'))
    assert.ok(badgeIcon('power').startsWith('/images/box/'))
  })

  t('badgePopoverText: fact-only phrasing, always compares against ดิถี, includes clash note only when clash=true', () => {
    const noClash = badgePopoverText(badge('pillar-year', 'wealth'))
    assert.match(noClash, /เทียบดิถี/)
    assert.doesNotMatch(noClash, /ชนดิถี/)

    const withClash = badgePopoverText({ ...badge('pillar-year', 'power'), clash: true })
    assert.match(withClash, /ชนดิถี/)
  })

  t('badgePopoverText: never uses banned words (too\'s word-ban list)', () => {
    const text = badgePopoverText(badge('pillar-year', 'wealth'))
    for (const banned of ['โอกาส', 'ระวัง', 'รุ่งเรือง']) {
      assert.ok(!text.includes(banned), `should not contain "${banned}"`)
    }
  })

  if (process.exitCode) {
    console.error(`\ncalc-badges: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-badges: all ${pass} passed ✓`)
  }
}

main()
