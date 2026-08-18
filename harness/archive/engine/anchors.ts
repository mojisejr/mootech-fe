// design-verify engine — Layer-2 (computed-invariant assert). Pure over a Capture.
// Failure messages point at the INVARIANT + the real bug it guards.
import type { Anchor, AnchorResult, Capture, Match } from './types'

function field(m: Match, prop: string): string {
  if (prop === 'object-fit') return m.objectFit
  if (prop === 'paddingTop') return m.paddingTop
  if (prop === 'paddingBottom') return m.paddingBottom
  return ''
}

export function evalAnchor(a: Anchor, cap: Capture, vp: { w: number; h: number }): AnchorResult {
  const matches = cap.measurements[a.id] ?? []
  const base = { id: a.id, severity: a.severity }

  if (a.refDeltaPct !== undefined) {
    return { ...base, pass: true, expected: `±${a.refDeltaPct}% vs ref`, actual: 'via-L3', message: `~ ${a.id}: handled by L3 element ref-diff` }
  }
  if (matches.length === 0) {
    return { ...base, pass: false, expected: a.assert, actual: 'element not found', message: `✗ ${a.id}: element not found (${a.selector})` }
  }

  if (a.computedEquals) {
    const actual = field(matches[0], a.computedEquals.property)
    const pass = actual === a.computedEquals.value
    return { ...base, pass, expected: `${a.computedEquals.property}=${a.computedEquals.value}`, actual, message: pass ? `✓ ${a.id}` : `✗ ${a.id}: ${a.computedEquals.property} is "${actual}", must be "${a.computedEquals.value}" — ${a.catches}` }
  }

  if (a.minPx) {
    if (a.minPx.property === 'min(width,height)') {
      const worst = matches.reduce((min, m) => Math.min(min, Math.min(m.w, m.h)), Infinity)
      const bad = matches.filter((m) => Math.min(m.w, m.h) < a.minPx!.px)
      const pass = bad.length === 0
      return { ...base, pass, expected: `≥${a.minPx.px}px`, actual: `${worst}px (min of ${matches.length})`, message: pass ? `✓ ${a.id}` : `✗ ${a.id}: ${bad.length} control(s) below ${a.minPx.px}px (smallest ${worst}px)` }
    }
    const actualPx = parseFloat(field(matches[0], a.minPx.property)) || 0
    const pass = actualPx >= a.minPx.px
    return { ...base, pass, expected: `${a.minPx.property}≥${a.minPx.px}px`, actual: `${actualPx}px`, message: pass ? `✓ ${a.id}` : `✗ ${a.id}: ${a.minPx.property} is ${actualPx}px, must be ≥${a.minPx.px}px — ${a.catches}` }
  }

  if (a.maxViewportPct) {
    const m = matches[0]
    const pct = a.maxViewportPct.of === 'width' ? (m.w / vp.w) * 100 : (m.h / vp.h) * 100
    const pass = pct <= a.maxViewportPct.pct
    return { ...base, pass, expected: `≤${a.maxViewportPct.pct}% of ${a.maxViewportPct.of}`, actual: `${pct.toFixed(1)}%`, message: pass ? `✓ ${a.id}` : `✗ ${a.id}: ${pct.toFixed(1)}% of viewport ${a.maxViewportPct.of}, must be ≤${a.maxViewportPct.pct}% — ${a.catches}` }
  }

  return { ...base, pass: true, expected: '-', actual: '-', message: `~ ${a.id}: no assertion shape` }
}
