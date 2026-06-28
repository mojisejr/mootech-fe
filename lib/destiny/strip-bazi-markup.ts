// Markup/section helpers for turning a bazi consumer reading into plain card text.
// (#my-destiny-bazi-engine-swap, Zone1+2). Chinese chars (己/酉) are PRESERVED on
// purpose — bazi glosses them inline in Thai, which reads fine and stays authentic.

/** Remove bazi inline color spans + tidy whitespace. Does NOT touch Chinese chars. */
export function stripBaziMarkup(text: string): string {
  if (!text) return ""
  return text
    .replace(/\[\[c=[a-zA-Z]+\]\]/g, "")
    .replace(/\[\[\/c\]\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Split a consumer `humanReading` into clean content lines:
 * - strips markup spans
 * - drops markdown header lines (`## บทนำ`, `## สรุป`)
 * - trims + drops blank lines
 */
export function toContentLines(humanReading: string): string[] {
  return stripBaziMarkup(humanReading)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("##"))
}

/**
 * Body lines of a reading, with the generic intro explainer dropped and an
 * optional cut at the first line matching `until` (used to drop the career
 * occupation-lists, keeping only the work-disposition portion — operator W-A).
 */
export function bodyLines(
  humanReading: string,
  opts?: { dropIntro?: boolean; until?: RegExp },
): string[] {
  let lines = toContentLines(humanReading)
  if (opts?.dropIntro && lines.length > 0) lines = lines.slice(1)
  if (opts?.until) {
    const idx = lines.findIndex((l) => opts.until!.test(l))
    if (idx >= 0) lines = lines.slice(0, idx)
  }
  return lines
}
