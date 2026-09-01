// #565 ③ — the display order of the four day facets, and the one label our side overrides.
//
// ORDER. ฟีม asked for ไปหาลูกค้า > ไปที่ทำงาน > หุ้นส่วน > อยู่บ้าน. Three of those land exactly on the
// first segment of an engine label, read from the engine source rather than from our fixture (whose
// labels have drifted): bazi-sft-dataset origin/pdf-dev src/lib/bazi/pair-matching.ts:356-359
//
//   home        🏠 อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง
//   companions  🤝 อยู่กับเพื่อน / พี่น้อง / คู่ครอง        ← isMain, so `advice` belongs to THIS facet
//   workplace   🏢 ไปที่ทำงาน / สถานศึกษา / พ่อแม่
//   outside     🌏 ไปลูกค้า / งานสังคม / สื่อ / ต่างถิ่น
//
// The word "หุ้นส่วน" appears in no `day` facet — it is the label of the `partner` relationship, which is
// a reading between two PEOPLE. So the third slot is not something we can read off his wording. It does
// not have to be: three slots are pinned and there are exactly four keys, so the fourth position is
// forced whatever it ends up being called. The ORDER is determined; only the NAME is still ฟีม's to give.
//
// LABEL. The engine sends "🌏 ไปลูกค้า / …" and ฟีม wants "ไปหาลูกค้า". The durable home for that word is
// the engine's own table — this is their copy, and rewriting it here forks the contract. Until that lands
// upstream we patch the leading segment on our side, and the patch is LOUD rather than silent: it applies
// only when the label still starts with the exact segment we expect. The day ทีมโอ changes that string,
// this stops matching and the tooth in scripts/day-detail-facet-order.test.ts goes red, instead of us
// quietly showing a stale word or double-patching one.
import type { DayDetailArea } from '../../types'

/** ฟีม's order, by engine key. The array is the spec — position in it IS the display position. */
export const FACET_ORDER = ['outside', 'workplace', 'companions', 'home'] as const

/** the one segment we rewrite, and what it becomes. Both halves are exact strings on purpose. */
export const LABEL_PATCH = { key: 'outside', from: 'ไปลูกค้า', to: 'ไปหาลูกค้า' } as const

/**
 * Sort into ฟีม's order. A key the spec does not know keeps its arrival order and lands AFTER the known
 * ones — never dropped. A facet the engine adds later shows up at the end rather than disappearing,
 * which is the failure a Map-lookup-or-skip would have given us.
 */
export function orderFacets(areas: DayDetailArea[]): DayDetailArea[] {
  const rank = (a: DayDetailArea) => {
    const i = (FACET_ORDER as readonly string[]).indexOf(a.key)
    return i === -1 ? FACET_ORDER.length : i
  }
  return areas
    .map((a, i) => ({ a, i }))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i)
    .map(({ a }) => a)
}

/**
 * The label to print. Everything except the one patched segment is passed through untouched — including
 * the emoji and the other segments, which are the engine's content and not ours to edit.
 */
export function facetLabel(area: DayDetailArea): string {
  // The key check is load-bearing and stays: the word "ไปลูกค้า" is not reserved to this facet, and a
  // future label on another key that happens to contain it must NOT be rewritten by a patch aimed here.
  // A mutant that drops this line is caught by the colliding-label case in the test file.
  if (area.key !== LABEL_PATCH.key) return area.label
  // No "does it still contain the segment?" guard: String.replace already returns the string untouched
  // when the substring is absent, so such a guard is a comment written as code — a mutant that removes
  // it cannot be caught by any test, because it changes nothing. `labelPatchStillApplies` is the real
  // early warning and it is asserted separately.
  return area.label.replace(LABEL_PATCH.from, LABEL_PATCH.to)
}

/** true when our patch no longer has anything to bite on — the tooth reads this, not a copy of the string. */
export function labelPatchStillApplies(areas: DayDetailArea[]): boolean {
  const target = areas.find((a) => a.key === LABEL_PATCH.key)
  return Boolean(target && target.label.includes(LABEL_PATCH.from))
}
