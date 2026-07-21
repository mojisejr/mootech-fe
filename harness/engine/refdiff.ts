// design-verify engine — Layer-3 (element-level ref-diff). Compares each key element's normalized
// box (position+size as % of viewport) to the Reference Model. Robust to font/bg-photo pixel noise.
import type { RefModel, RefDiffResult, Match } from './types'

export function refDiff(
  model: RefModel,
  captured: Record<string, Match | undefined>,
  vp: { w: number; h: number },
  tolPct: number,
): RefDiffResult[] {
  return Object.entries(model.elements).map(([el, r]) => {
    const cap = captured[el]
    if (!cap) return { el, deltaPct: NaN, pass: false, detail: `${el}: not rendered` }
    const ref = { x: (r.x / model.authoredAt.w) * 100, y: (r.y / model.authoredAt.h) * 100, w: (r.w / model.authoredAt.w) * 100, h: (r.h / model.authoredAt.h) * 100 }
    const mine = { x: (cap.left / vp.w) * 100, y: (cap.top / vp.h) * 100, w: (cap.w / vp.w) * 100, h: (cap.h / vp.h) * 100 }
    const delta = Math.max(Math.abs(ref.x - mine.x), Math.abs(ref.y - mine.y), Math.abs(ref.w - mine.w), Math.abs(ref.h - mine.h))
    return {
      el,
      deltaPct: delta,
      pass: delta <= tolPct,
      detail: `${el}: Δ${delta.toFixed(1)}%  ref[w${ref.w.toFixed(0)} h${ref.h.toFixed(0)} y${ref.y.toFixed(0)}] vs mine[w${mine.w.toFixed(0)} h${mine.h.toFixed(0)} y${mine.y.toFixed(0)}]`,
    }
  })
}
