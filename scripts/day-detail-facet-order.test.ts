// #565 ③ — the four day facets print in ฟีม's order, and the one label we override says so out loud.
//
// The keys are read from the engine source, not from our fixture (whose labels drifted):
// bazi-sft-dataset origin/pdf-dev src/lib/bazi/pair-matching.ts:356-359.
//
// Why the order is knowable even though one of ฟีม's four words is not in the day spec: three of his
// words land exactly on the first segment of an engine label, and there are exactly four keys, so the
// remaining position is forced. Only the NAME of that slot is still open.
//
// MUTANT CONTRACT — each flips real behaviour, each goes RED here:
//   O1  FACET_ORDER reversed                              → "ลำดับตามที่ฟีมสั่ง" RED
//   O2  orderFacets drops unknown keys instead of appending → "คีย์ใหม่ต้องไม่หาย" RED
//   O3  orderFacets is not stable for equal ranks          → "สองคีย์ใหม่ต้องคงลำดับเดิม" RED
//   L1  facetLabel patches every key, not just `outside`   → "แก้เฉพาะช่องเดียว" RED
//   L2  facetLabel replaces the WHOLE label                → "ส่วนที่เหลือเป็นของเอนจิน" RED
//   L3  (ยกออก) การถอด guard `includes` ไม่เปลี่ยนพฤติกรรมเลย — String.replace no-op อยู่แล้ว
//       ⇒ ไม่มีฟันไหนจับได้ และผมถอด guard นั้นออกจากโค้ดแทนที่จะเก็บฟันปลอมไว้
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FACET_ORDER,
  LABEL_PATCH,
  facetLabel,
  labelPatchStillApplies,
  orderFacets,
} from '../features/v2-calendar/components/day-detail/facet-order'

type Area = Parameters<typeof facetLabel>[0]
const mk = (key: string, label: string): Area => ({ key, label, percent: 50, grade: 'C', isStrength: false })

// the four rows EXACTLY as the engine writes them (pair-matching.ts:356-359)
const ENGINE = [
  mk('home', '🏠 อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง'),
  mk('companions', '🤝 อยู่กับเพื่อน / พี่น้อง / คู่ครอง'),
  mk('workplace', '🏢 ไปที่ทำงาน / สถานศึกษา / พ่อแม่'),
  mk('outside', '🌏 ไปลูกค้า / งานสังคม / สื่อ / ต่างถิ่น'),
]

test('O1 · ลำดับที่ฟีมสั่ง — ไปหาลูกค้า > ไปที่ทำงาน > [ช่องที่สาม] > อยู่บ้าน', () => {
  assert.deepEqual(orderFacets(ENGINE).map((a) => a.key), ['outside', 'workplace', 'companions', 'home'])
  // the engine's own arrival order is NOT this, so a no-op sort would fail here
  assert.notDeepEqual(ENGINE.map((a) => a.key), ['outside', 'workplace', 'companions', 'home'])
})

test('O2 · คีย์ที่สเปกไม่รู้จัก ต้องไม่หาย — ไปต่อท้าย', () => {
  const withNew = [...ENGINE, mk('travel', '✈️ เดินทางไกล')]
  const out = orderFacets(withNew)
  assert.equal(out.length, 5, 'ห้ามตกหล่น')
  assert.equal(out[4].key, 'travel', 'ตัวที่ไม่รู้จักไปอยู่ท้าย')
})

test('O3 · คีย์ที่ไม่รู้จักสองตัว คงลำดับที่มันมา', () => {
  const out = orderFacets([mk('zeta', 'z'), mk('alpha', 'a'), ...ENGINE])
  assert.deepEqual(out.slice(4).map((a) => a.key), ['zeta', 'alpha'])
})

test('L1 · แก้เฉพาะช่อง outside — แม้คีย์อื่นจะมีคำเดียวกันอยู่ในป้าย', () => {
  for (const a of ENGINE) {
    if (a.key === LABEL_PATCH.key) continue
    assert.equal(facetLabel(a), a.label, `${a.key} ต้องไม่ถูกแตะ`)
  }
  // 🔴 the case that makes the key check load-bearing. Without it the four engine labels alone prove
  // nothing: none of them contains "ไปลูกค้า", so a facetLabel that patched EVERY key would still
  // return them unchanged and this test would stay green. A collision is what separates the two.
  const collide = mk('workplace', '🏢 ไปที่ทำงาน / ไปลูกค้าด้วย')
  assert.equal(facetLabel(collide), collide.label, 'คีย์อื่นที่บังเอิญมีคำนี้ ต้องไม่ถูกแก้')
})

test('L2 · เปลี่ยนเฉพาะคำแรก ส่วนที่เหลือเป็นของเอนจิน', () => {
  const out = facetLabel(ENGINE[3])
  assert.equal(out, '🌏 ไปหาลูกค้า / งานสังคม / สื่อ / ต่างถิ่น')
  assert.ok(out.startsWith('🌏 '), 'อีโมจิต้องอยู่')
  assert.ok(out.includes('/ งานสังคม / สื่อ / ต่างถิ่น'), 'ส่วนที่เหลือต้องครบ')
  assert.ok(!out.includes('ไปลูกค้า /'), 'คำเก่าต้องไม่เหลือ')
})

test('เอนจินเปลี่ยนคำเมื่อไหร่ เราส่งต่อของเขา ❌ ไม่ทับ', () => {
  // kept as a STATEMENT of behaviour, not as a tooth: String.replace no-ops on an absent substring, so
  // no mutant of facetLabel can make this fail. The tooth for that situation is labelPatchStillApplies.
  const moved = mk('outside', '🌏 ออกไปพบลูกค้า / งานสังคม')
  assert.equal(facetLabel(moved), moved.label, 'ไม่มีอะไรให้แก้ ⇒ ส่งต่อของเดิม')
})

test('🔴 ตัวเตือนว่าแพตช์ยังมีที่ยืน — ถ้าอันนี้แดง แปลว่าเอนจินแก้แล้ว ให้ถอดแพตช์นี้ทิ้ง', () => {
  assert.equal(labelPatchStillApplies(ENGINE), true)
})

test('FACET_ORDER คือสี่คีย์ของ day spec ครบ ไม่ขาดไม่เกิน', () => {
  assert.deepEqual([...FACET_ORDER].sort(), ['companions', 'home', 'outside', 'workplace'])
})
