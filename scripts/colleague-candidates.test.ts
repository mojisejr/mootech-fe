// #585 — teeth on the three co-worker slots.
//
// Everything here is pure, so it runs in the tsx lane (no vitest.config.mts edit ⇒ no UNION conflict
// with บอง's lane, which is editing that file for the API side).
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   S1  candidateSlots maps the list instead of always returning MAX_CANDIDATES  → "ฟอร์มมีสามแถวเสมอ" RED
//   A1  addCandidate drops the cap check                                          → "เกินสามไม่ได้" RED
//   A2  addCandidate drops the duplicate check                                    → "คนเดิมซ้ำไม่ได้" RED
//   R1  setCandidateAt does not move an already-chosen person                     → "คนเดียวโผล่สองช่อง" RED
//   D1  removeCandidate leaves a hole instead of closing up                       → "ไม่มีรูตรงกลาง" RED
//   C1  canCompare requires all three                                             → "หนึ่งคนก็กดได้" RED
import assert from 'node:assert/strict'
import {
  MAX_CANDIDATES,
  addCandidate,
  candidateSlots,
  canCompare,
  removeCandidate,
  setCandidateAt,
} from '../features/v2-service/colleague-candidates'
import type { CompatPerson } from '../features/v2-service/compatibility-api'

let pass = 0
const fails: string[] = []
function t(name: string, fn: () => void) {
  try { fn(); pass++; console.log('  ✓', name) }
  catch (e) { fails.push(`${name}\n    ${(e as Error).message}`); console.log('  ✗', name) }
}

const p = (id: string, name = id): CompatPerson => ({ id, name, dob: '1989-01-03', time: '08:45', imageProfile: '' })
const A = p('a'), B = p('b'), C = p('c'), D = p('d')

t('S1 · ฟอร์มมีสามแถวเสมอ ไม่ว่าจะเลือกไปกี่คน', () => {
  for (const chosen of [[], [A], [A, B], [A, B, C]]) {
    const slots = candidateSlots(chosen)
    assert.equal(slots.length, MAX_CANDIDATES, `เลือก ${chosen.length} คน ต้องยังเห็น ${MAX_CANDIDATES} แถว`)
    assert.deepEqual(slots.map((s) => s.index), [0, 1, 2])
  }
  // filled first, empties after — never a filled row below an empty one
  const slots = candidateSlots([A, B])
  assert.deepEqual(slots.map((s) => s.person?.id ?? null), ['a', 'b', null])
})

t('A1 · เกิน 3 ไม่ได้ และคืนอาเรย์ตัวเดิมเพื่อบอกว่าไม่มีอะไรเกิดขึ้น', () => {
  const full = addCandidate(addCandidate(addCandidate([], A), B), C)
  assert.equal(full.length, 3)
  const after = addCandidate(full, D)
  assert.equal(after.length, 3, 'ห้ามเกินเพดานของเอนจิน')
  assert.equal(after, full, 'คืน reference เดิม ⇒ ผู้เรียกรู้ได้ว่าถูกปฏิเสธ')
})

t('A2 · คนเดิมเลือกซ้ำไม่ได้ — เอนจินจะถูกขอให้จัดอันดับคนเดียวกันสองครั้ง', () => {
  const one = addCandidate([], A)
  const twice = addCandidate(one, p('a', 'ชื่อคนละอย่างแต่ id เดิม'))
  assert.equal(twice.length, 1, 'ตัดสินด้วย id ❌ ไม่ใช่ชื่อ')
  assert.equal(twice, one)
})

t('R1 · เลือกคนที่อยู่ช่องอื่นอยู่แล้ว = ย้ายมา ❌ ไม่ใช่โผล่สองช่อง', () => {
  const three = [A, B, C]
  const moved = setCandidateAt(three, 0, C)
  assert.equal(moved.filter((x) => x.id === 'c').length, 1, 'ห้ามมีคนเดิมสองช่อง')
  assert.equal(moved[0].id, 'c', 'ต้องมาอยู่ช่องที่กด')
  assert.equal(moved.length, 2, 'ช่องเดิมของเขายุบ')
})

t('R1b · ใส่คนใหม่ทับช่องเดิม', () => {
  const out = setCandidateAt([A, B], 1, D)
  assert.deepEqual(out.map((x) => x.id), ['a', 'd'])
})

t('R1c · ใส่ในช่องที่ยังว่าง = ต่อท้าย ❌ ไม่ใช่เว้นรู', () => {
  const out = setCandidateAt([A], 2, D)
  assert.deepEqual(out.map((x) => x.id), ['a', 'd'])
})

t('D1 · ลบแล้วช่องหลังเลื่อนขึ้น ไม่มีรูตรงกลาง', () => {
  const out = removeCandidate([A, B, C], 'b')
  assert.deepEqual(out.map((x) => x.id), ['a', 'c'])
  assert.deepEqual(candidateSlots(out).map((s) => s.person?.id ?? null), ['a', 'c', null])
})

t('D1b · ลบคนที่ไม่มีอยู่ = ไม่มีอะไรเกิดขึ้น และคืน reference เดิม', () => {
  const list = [A, B]
  assert.equal(removeCandidate(list, 'zzz'), list)
})

t('C1 · หนึ่งคนก็กดดูผลได้ — Figma 720:27747 วาดปุ่มเปิดตอนเลือกคนเดียว', () => {
  assert.equal(canCompare([]), false, 'ยังไม่เลือกใคร กดไม่ได้')
  assert.equal(canCompare([A]), true, '🔴 หนึ่งคนพอ ❌ ไม่ใช่ต้องครบสาม')
  assert.equal(canCompare([A, B]), true)
  assert.equal(canCompare([A, B, C]), true)
})

t('เพดานมาจากเอนจิน ❌ ไม่ใช่เลขที่เราตั้งเอง', () => {
  assert.equal(MAX_CANDIDATES, 3, 'bazi route.ts:13 MAX_CANDIDATES = 3 และ :36-38 ตอบ 400 เมื่อเกิน')
})

if (fails.length) {
  console.log('\n❌ colleague-candidates FAIL')
  for (const f of fails) console.log(' -', f)
  process.exit(1)
}
console.log(`\n✅ colleague-candidates PASS (${pass})`)
