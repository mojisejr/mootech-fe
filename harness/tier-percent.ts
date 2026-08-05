// harness/tier-percent.ts — the ONE-NUMBER reader, pulled out of run-tier-gate.ts so the two scale
// mutants can prove it without launching the browser harness (run-tier-gate.ts self-executes main()).
//
// Real percents on the wire are DECIMALS (man-vs-day: 40.83 · 61.67). The old /(\d+)%/ read only the
// integer run immediately before the '%':
//   "57.3%" → "3"   (garbage — grabbed the fractional digit)
//   "0.57%" → "57"  ← the dangerous one: a fraction-scale leak read as a correct 57 and the gate went GREEN
// so the ONE-NUMBER check certified a scale bug instead of catching it. Fixed: decimal-aware read + numeric
// comparison. Meaning of the ONE-NUMBER assertions is unchanged — tile, sentence and ring must show the
// same number — only the reader and the comparison method changed.

/** #b1-decimal-percent — read a percent as a NUMBER, decimals included. null when none is present. */
export function readPct(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)%/)
  return m ? Number(m[1]) : null
}

/** #b1-fraction-scale — the ONE-NUMBER invariant as pure logic: all three read to the SAME number
 *  (compared numerically, never as substrings). A missing percent never "agrees". */
export function onePercentAgree(tileText: string, sentenceText: string, ringText: string): boolean {
  const t = readPct(tileText)
  const s = readPct(sentenceText)
  const r = readPct(ringText)
  return t !== null && t === s && t === r
}
