// Zone 1 — map bazi `chart_foundation` (consumer) onto the 3 top cards of /my-destiny.
// Split is DETERMINISTIC by stable index of reading.prose[] (verified ×3 charts in P0):
//   prose[0] -> card 1 "พื้นฐานบุคลิก"      (analytic.base.description)
//   prose[1] -> card 2 "ธาตุ-แข็ง/อ่อน"      (analytic.habit.note ; title stays be's, pillars match)
//   prose[2] -> card 3 "นิสัย"               (analytic.behaviors[].behavior)
//   prose[3,4] = technical (ธาตุถ่ายเท/คู่ธาตุ) -> DROPPED
// prose[0,1,2] are markup-free in consumer mode, so no stripping is needed here.
// (#my-destiny-bazi-engine-swap)

export interface ChartFoundationOverlay {
  baseDescription: string
  habitNote: string
  behaviorText: string
}

interface TopicReadingLike {
  reading?: { prose?: unknown }
}

/**
 * Returns the 3-card overlay, or null if the fixture is missing the expected
 * prose triplet (caller then keeps the be value — never guess/blank).
 */
export function mapChartFoundation(
  fixture: TopicReadingLike | null | undefined,
): ChartFoundationOverlay | null {
  const prose = fixture?.reading?.prose
  if (!Array.isArray(prose) || prose.length < 3) return null

  const p = (i: number) =>
    typeof prose[i] === "string" ? (prose[i] as string).trim() : ""

  const baseDescription = p(0)
  const habitNote = p(1)
  const behaviorText = p(2)
  if (!baseDescription || !habitNote || !behaviorText) return null

  return { baseDescription, habitNote, behaviorText }
}
