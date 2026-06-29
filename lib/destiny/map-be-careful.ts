// Zone 3 — map bazi `turning_points` (consumer) onto the "ข้อพึงระวัง" card.
//
// be's `be_careful` is a shallow day-element lookup (one line like
// "ปีมะเมีย เดือนมิถุนายน คนเกิดปีมะเมีย"). bazi computes real clash timing from
// the liuNian/daYun timeline — actual พ.ศ. years + age + ชง/ฮะ (沖/害). We extract
// ONLY the clash-timing lines (the yearly clashes + the recurring monthly clash),
// NOT the full life-cycle narrative (that stays be's cycleYearLife graph).
// (#my-destiny-bazi-engine-swap, Zone 3)

import { stripBaziMarkup } from "./strip-bazi-markup"

interface TopicReadingLike {
  humanReading?: unknown
}

// The clash-timing lines bazi emits in turning_points:
//   "ปี พ.ศ. {year} (อายุ {age} ปี) เป็นจังหวะ ชง/ฮะ … — ควรระวัง…"  (yearly)
//   "เดือนนักษัตร{X} (ราว{month}) … เป็นจังหวะปะทะ (ชง) …"            (monthly)
// These ARE the ข้อพึงระวัง essence — deterministic, deeper than be's lookup.
const CLASH_LINE = /^ปี พ\.ศ\.\s.*เป็นจังหวะ|^เดือนนักษัตร.*จังหวะ/

/**
 * turning_points consumer -> { description } overlay, or null to keep be.
 * description keeps paragraph breaks (`\n\n`) between clash lines so the card
 * renders breathing room instead of one wall (rendered via the shared paragraph
 * getter). Chinese branch chars (巳/亥) are preserved on purpose.
 */
export function mapBeCareful(
  fixture: TopicReadingLike | null | undefined,
): { description: string } | null {
  const hr = fixture?.humanReading
  if (typeof hr !== "string" || !hr.trim()) return null
  const lines = stripBaziMarkup(hr)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => CLASH_LINE.test(l))
  if (lines.length === 0) return null
  return { description: lines.join("\n\n") }
}
