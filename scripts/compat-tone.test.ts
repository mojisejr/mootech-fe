// ดวงสมพงศ์ 2E-2 — grade→tier→tone teeth across ALL 13 rating levels (บอง engine-check 2026-07-31).
// The engine's grade is NOT 5 values — it's 13 with +/- (src/lib/bazi/data/pair/rating-scale.json):
//   F, D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+
// THE SILENT BUG this guards: comparing `grade === 'A'` (exact) makes A+ and A- — the BEST scores — fall
// through to no-badge. The fix is to key off the LEADING LETTER. This test walks all 13 so a regression to
// exact-match is caught, not hidden behind a lucky sample.
// Run: npx tsx scripts/compat-tone.test.ts
//
// ANCHOR: scripts/compat-tone.test.ts#compat-tone-13-levels
import assert from 'node:assert/strict'
import { gradeTier, deriveTone, TIER_COLOR, type GradeTier, type DimTone } from '../features/v2-service/compat-result-parts'

let pass = 0
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { console.error(`  ✗ ${name}\n    ${(e as Error).message}`); process.exitCode = 1 }
}

const ALL_13 = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'] as const

// (1) every one of the 13 maps to a valid tier — no crash, no undefined
t('all 13 grades map to a defined tier', () => {
  for (const g of ALL_13) {
    const tier = gradeTier(g)
    assert.ok(['best', 'good', 'fair', 'weak', 'poor'].includes(tier), `${g} → ${tier}`)
  }
})

// (2) THE ANTI-TRAP INVARIANT — tone is CONSISTENT within a leading letter for A, C, D. (B is DELIBERATELY
//     split by ฟีม's threshold: B+ strong, B/B- none — so B is excluded here and pinned explicitly in (3b).)
//     For A/C/D, a +/- variant must never get a different badge just because of the sign.
t('tone is consistent within the A, C, D letters (A+ == A == A-, etc.)', () => {
  for (const letter of ['A', 'C', 'D']) {
    const grades = ALL_13.filter((g) => g.charAt(0) === letter)
    const tones = grades.map((g) => String(deriveTone(g)))
    assert.equal(new Set(tones).size, 1, `letter ${letter}: ${grades.join('/')} → ${tones.join(',')} (must be identical)`)
  }
})

// (3) THE SPECIFIC BUG บอง named: A+ and A- must get the SAME badge as A — never null/no-badge.
t('A+ and A- get a badge (NOT null) — the exact silent bug', () => {
  const aTone = deriveTone('A')
  assert.notEqual(aTone, null, 'A must have a tone to compare')
  assert.equal(deriveTone('A+'), aTone, 'A+ must match A')
  assert.equal(deriveTone('A-'), aTone, 'A- must match A')
})

// (3b) THE B-FAMILY SPLIT (ฟีม's threshold makes B non-uniform) — pinned so no one "fixes" it back to uniform.
t('B family splits: B+ → strong, B and B- → null (ฟีม threshold, intentional)', () => {
  assert.equal(deriveTone('B+'), 'strong', 'B+ is a strength')
  assert.equal(deriveTone('B'), null, 'B is NOT a strength (≈ mid) — no badge')
  assert.equal(deriveTone('B-'), null, 'B- (≈55%) is NOT a strength — no badge')
})

// (4) bar-tier colour buckets RE-SAMPLED from Figma 636:19532 (Zone 2, 2026-08-03). The node draws FIVE
//     steps, so A separated from B (deep green vs green). ฟีม ruled plain "C" joins C- on orange.
//     A* = best · B* = good · C+ = fair · C/C- = weak · D*/F = poor.
t('bar tiers per Figma Zone 2: A*=best, B*=good, C+=fair, C/C-=weak, D*/F=poor', () => {
  const expect: Record<string, GradeTier> = {
    'A+': 'best', 'A': 'best', 'A-': 'best', 'B+': 'good', 'B': 'good', 'B-': 'good',
    'C+': 'fair', 'C': 'weak', 'C-': 'weak',
    'D+': 'poor', 'D': 'poor', 'D-': 'poor', 'F': 'poor',
  }
  for (const g of ALL_13) assert.equal(gradeTier(g), expect[g], `${g}`)
})

// (4b) the A/B split is the NEW invariant — a regression that re-merges them into one green trips here.
t('A and B are DIFFERENT tiers + different colours (Figma draws two greens)', () => {
  assert.notEqual(gradeTier('A'), gradeTier('B'), 'A and B must not share a tier')
  assert.notEqual(TIER_COLOR[gradeTier('A')], TIER_COLOR[gradeTier('B')], 'A and B must not share a colour')
})

// (5) The concrete strong/watch mapping — ฟีม-ruled 2026-07-31 (no longer provisional).
//     strong = all A + B+ · watch = all D + F · none = all C, B, B-.
t('ฟีม mapping: A*+B+ → strong, D*+F → watch, C*/B/B- → null', () => {
  const expect: Record<string, DimTone> = {
    'A+': 'strong', 'A': 'strong', 'A-': 'strong', 'B+': 'strong', 'B': null, 'B-': null,
    'C+': null, 'C': null, 'C-': null,
    'D+': 'watch', 'D': 'watch', 'D-': 'watch', 'F': 'watch',
  }
  for (const g of ALL_13) assert.equal(deriveTone(g), expect[g], `${g}`)
})

console.log(`\n${pass} passed`)
