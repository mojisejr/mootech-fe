// ดวงสมพงศ์ ก้อน 2G — "ล่าสุด" history pure-logic teeth (CI-executed; the browser anchor run-compat-2g.ts
// does NOT run in CI, so the rule-4 / D43 decisions live here too).
// Bug-class this guards:
//  (1) D40 rule-4 — fabricating a friend name ("คุณ & เพื่อน") or a type when data is absent, instead of
//      hiding it (v1's recent screen literally falls back to 'เพื่อน');
//  (2) D43 — labelling a matching_type v2 doesn't support (legacy BOSS/EMPLOYEE) instead of hiding the chip,
//      or throwing on it;
//  (3) treating a non-array / { error } response as a valid (fabricated) list instead of a fallback.
// Run: npx tsx scripts/compat-recent.test.ts
//
// ANCHOR: scripts/compat-recent.test.ts#compat-recent-rule4-seam
import assert from 'node:assert/strict'
import { parseRecentMatches, matchTypeLabel, recentCardTitle } from '../features/v2-service/compatibility-recent'

let pass = 0
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { console.error(`  ✗ ${name}\n    ${(e as Error).message}`); process.exitCode = 1 }
}

// --- matchTypeLabel: only the two v2 types are labelled; legacy/unknown → undefined (chip hidden, D43) ---
t('LOVE → "คู่รัก"', () => assert.equal(matchTypeLabel('LOVE'), 'คู่รัก'))
t('FRIEND → "เพื่อนร่วมงาน"', () => assert.equal(matchTypeLabel('FRIEND'), 'เพื่อนร่วมงาน'))
t('D43 legacy BOSS → undefined (no fake label, no throw)', () => assert.equal(matchTypeLabel('BOSS'), undefined))
t('D43 legacy EMPLOYEE → undefined', () => assert.equal(matchTypeLabel('EMPLOYEE'), undefined))
t('unknown/absent type → undefined', () => { assert.equal(matchTypeLabel('WHATEVER'), undefined); assert.equal(matchTypeLabel(undefined), undefined) })

// --- recentCardTitle: rule 4 — never fabricate "เพื่อน" ---
t('name present → "คุณ & <name>"', () => assert.equal(recentCardTitle('ก้อง'), 'คุณ & ก้อง'))
t('D40 rule-4: absent name → "คุณ" (NOT "คุณ & เพื่อน")', () => {
  assert.equal(recentCardTitle(''), 'คุณ')
  assert.equal(recentCardTitle(null), 'คุณ')
  assert.equal(recentCardTitle(undefined), 'คุณ')
})
t('whitespace-only name is treated as absent', () => assert.equal(recentCardTitle('   '), 'คุณ'))

// --- parseRecentMatches: array → items (drop rows with no id); non-array → fallback (ok:false), never fabricate ---
t('array → ok:true, keeps rows with an id', () => {
  const r = parseRecentMatches([{ id: 'A', type: 'LOVE' }, { id: 'B', type: 'FRIEND' }])
  assert.equal(r.ok, true); assert.equal(r.items.length, 2)
})
t('drops malformed rows (no id) rather than render a card that navigates nowhere', () => {
  const r = parseRecentMatches([{ id: 'A' }, { type: 'LOVE' }, null, {}])
  assert.equal(r.ok, true); assert.deepEqual(r.items.map((i) => i.id), ['A'])
})
t('{ error } → ok:false, items:[] (fallback, not a fabricated list)', () => {
  const r = parseRecentMatches({ error: 'boom' })
  assert.equal(r.ok, false); assert.equal(r.items.length, 0)
})
t('null / undefined → ok:false, items:[]', () => {
  assert.equal(parseRecentMatches(null).ok, false)
  assert.equal(parseRecentMatches(undefined).ok, false)
})

console.log(`\n${pass} passed`)
