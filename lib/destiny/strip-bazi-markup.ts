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

// Narrative-glue connectors bazi inserts between thought-blocks. When we split a
// reading into discrete paragraphs they read awkwardly as leading words (or as a
// lone orphan paragraph), so we tidy them out. (T3)
const CONNECTORS = ["ขณะเดียวกัน", "ในอีกด้านหนึ่ง", "นอกจากนี้", "อีกทั้ง", "ยิ่งไปกว่านั้น"]
// The framing line every consumer reading opens with ("…— สำหรับเรื่อง… จากจุดนี้
// จึงค่อยพิจารณารายละเอียดต่อไปนี้") just echoes the card title. Drop it. (T3)
const TITLE_ECHO = /พิจารณารายละเอียดต่อไปนี้\s*$/

/**
 * Paragraph-aware body of a reading. Unlike `bodyLines`, this PRESERVES the
 * blank-line paragraph boundaries from the source so the UI can render breathing
 * room between thought-blocks instead of one wall of text. (T1)
 * Options:
 * - dropIntro: drop the first paragraph (the generic "how this reading works" note)
 * - dropTitleEcho: drop the framing line that echoes the card title (T3)
 * - tidyConnectors: drop orphan connector-only paragraphs and strip leading
 *   connectors from real paragraphs (T3)
 * - until: cut at the first paragraph matching (drops career occupation-lists)
 */
export function bodyParagraphs(
  humanReading: string,
  opts?: { dropIntro?: boolean; dropTitleEcho?: boolean; tidyConnectors?: boolean; until?: RegExp },
): string[] {
  if (!humanReading) return []
  let paras = humanReading
    .split(/\n{2,}/)
    .map((p) => stripBaziMarkup(p).replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length > 0 && !p.startsWith("##"))
  if (opts?.dropIntro && paras.length > 0) paras = paras.slice(1)
  if (opts?.dropTitleEcho) paras = paras.filter((p) => !TITLE_ECHO.test(p))
  if (opts?.tidyConnectors) {
    paras = paras
      .filter((p) => !CONNECTORS.includes(p))
      .map((p) => {
        const hit = CONNECTORS.find((c) => p.startsWith(c + " "))
        return hit ? p.slice(hit.length).trim() : p
      })
  }
  if (opts?.until) {
    const idx = paras.findIndex((p) => opts.until!.test(p))
    if (idx >= 0) paras = paras.slice(0, idx)
  }
  return paras
}
