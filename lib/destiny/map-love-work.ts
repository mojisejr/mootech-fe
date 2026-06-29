// Zone 2 — map bazi `love_partner` + `career_potential` (consumer) onto the
// "ความรัก" and "การงาน" cards of /my-destiny.
//
// For these two topics the deterministic reading.prose[] is technical (raw
// relation rows with Chinese chars), so we read the consumer `humanReading`
// narrative and clean it:
//   - love  -> analytic.love.note            (full body, intro explainer dropped)
//   - work  -> analytic.prediction_work.desc[] (W-A: ONLY the disposition portion,
//              cut before the occupation-lists which overlap the kept be `occupations`)
// (#my-destiny-bazi-engine-swap)

import { bodyParagraphs } from "./strip-bazi-markup"

interface TopicReadingLike {
  humanReading?: unknown
}

// First occupation-list / ranking marker in the career narrative. Everything from
// here on is the "which jobs by element" list (kept on be `occupations`), so the
// work-disposition portion is everything BEFORE it.
const CAREER_LIST_MARKER = /ดังนี้\s*:|^•|อาชีพธาตุ.{0,8}อันดับ/

/**
 * love_partner consumer -> { note } overlay, or null to keep be.
 * note keeps paragraph breaks (`\n\n`) so the card can render breathing room
 * instead of one wall of text (T1). Title-echo + orphan connectors stripped (T3).
 */
export function mapLove(
  fixture: TopicReadingLike | null | undefined,
): { note: string } | null {
  const hr = fixture?.humanReading
  if (typeof hr !== "string" || !hr.trim()) return null
  const paras = bodyParagraphs(hr, { dropIntro: true, dropTitleEcho: true, tidyConnectors: true })
  const note = paras.join("\n\n").trim()
  return note ? { note } : null
}

/**
 * career_potential consumer -> prediction_work.desc[] (disposition only), or null.
 * One paragraph per bullet; title-echo + connectors stripped (T3); occupation
 * lists cut (W-A).
 */
export function mapWork(
  fixture: TopicReadingLike | null | undefined,
): { desc: { note: string }[] } | null {
  const hr = fixture?.humanReading
  if (typeof hr !== "string" || !hr.trim()) return null
  const paras = bodyParagraphs(hr, {
    dropIntro: true,
    dropTitleEcho: true,
    tidyConnectors: true,
    until: CAREER_LIST_MARKER,
  })
  const desc = paras.map((note) => ({ note }))
  return desc.length > 0 ? { desc } : null
}
