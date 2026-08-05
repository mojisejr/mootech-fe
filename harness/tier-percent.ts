// harness/tier-percent.ts — the ONE-NUMBER reader, pulled out of run-tier-gate.ts so the mutants can prove
// it without launching the browser harness (run-tier-gate.ts self-executes main()).
//
// WHAT THIS PATCH FIXES — the reader, so ONE-NUMBER READS RIGHT (not: catches a scale bug). Real percents
// on the wire are DECIMALS (man-vs-day: 40.83 · 61.67). The old /(\d+)%/ read only the integer run before
// the '%': "61.67%" → "67", "57.3%" → "3" — garbage the moment real data lands, so ONE-NUMBER would compare
// junk. Fixed: decimal-aware read + numeric comparison. Assertion meaning unchanged — tile, sentence, ring
// must show the SAME number.
//
// ⚠️ WHAT THIS DOES **NOT** CLOSE (μุน, #175 review): a fraction-scale leak. In the real UI all three
// numbers render from the SAME `detail.percent` (ruling H, and ONE-NUMBER itself forces one source), so a
// scale leak at the source shows up in all three AT ONCE (0.57 / 0.57 / 0.57) — and ONE-NUMBER, being a
// "do-they-AGREE" invariant, reads that as GREEN. An agreement-invariant over same-source values CANNOT
// detect that source's error, by construction (same lesson as #171's CLS-delta). Catching a leaked scale
// needs a DIFFERENT invariant — PERCENT-SCALE: the rendered percent must be in a plausible range (a value
// meaning "day strength" rendering < 1 is almost certainly a fraction leak), or better, compare the API
// number to the screen number (different layers), not screen-to-screen. Logged as A2 — NOT covered here.

/** #b1-decimal-percent — read a percent as a NUMBER, decimals included. null when none is present. */
export function readPct(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)%/)
  return m ? Number(m[1]) : null
}

/** #b1-percent-divergence — the ONE-NUMBER invariant as pure logic: all three read to the SAME number
 *  (compared numerically, never as substrings). This guards DIVERGENCE (the three disagree), NOT a
 *  consistently-leaked scale — see the ⚠️ note above. A missing percent never "agrees". */
export function onePercentAgree(tileText: string, sentenceText: string, ringText: string): boolean {
  const t = readPct(tileText)
  const s = readPct(sentenceText)
  const r = readPct(ringText)
  return t !== null && t === s && t === r
}
