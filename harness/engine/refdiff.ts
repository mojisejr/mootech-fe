// design-verify engine — Layer-3 (element-level ref-diff). Compares each key element's normalized
// box (position+size as % of viewport) to the Reference Model. Robust to font/bg-photo pixel noise.
//
// CP-3 role-map: each RefElement may declare a `compare` mode (box node|ink · which dims · corner|
// center) so L3 is HONEST — it diffs only what a given semantic role owns (a mark's size, a text's
// height+centre) and ignores what is noise (text content-width) or another layer's job (safe-area
// position → L2 insets). Absent → legacy node-box · corner · all-four-dims.
import type { RefModel, RefElement, RefDiffResult, Match, CompareDim } from './types'

const ALL_DIMS: CompareDim[] = ['x', 'y', 'w', 'h']

/** Ref rect in AUTHORED space → % of the authored frame, honouring box: 'ink'. */
function refRectPct(r: RefElement, model: RefModel) {
  const src = r.compare?.box === 'ink' && r.ink ? r.ink : r
  return { x: (src.x / model.authoredAt.w) * 100, y: (src.y / model.authoredAt.h) * 100, w: (src.w / model.authoredAt.w) * 100, h: (src.h / model.authoredAt.h) * 100 }
}

/** Convert a top-left box to a centre-point box (x,y become the centre) when align === 'center'. */
function applyAlign(box: { x: number; y: number; w: number; h: number }, align?: 'corner' | 'center') {
  if (align !== 'center') return box
  return { x: box.x + box.w / 2, y: box.y + box.h / 2, w: box.w, h: box.h }
}

export function refDiff(
  model: RefModel,
  captured: Record<string, Match | undefined>,
  vp: { w: number; h: number },
  tolPct: number,
): RefDiffResult[] {
  return Object.entries(model.elements).map(([el, r]) => {
    const cap = captured[el]
    if (!cap) return { el, deltaPct: NaN, pass: false, detail: `${el}: not rendered` }

    const align = r.compare?.align
    const dims = r.compare?.dims ?? ALL_DIMS
    const box = r.compare?.box === 'ink' && r.ink ? 'ink' : 'node'

    const ref = applyAlign(refRectPct(r, model), align)
    const mine = applyAlign({ x: (cap.left / vp.w) * 100, y: (cap.top / vp.h) * 100, w: (cap.w / vp.w) * 100, h: (cap.h / vp.h) * 100 }, align)

    const delta = Math.max(...dims.map((d) => Math.abs(ref[d] - mine[d])))
    const tag = `${r.role ?? '?'}·${box}·${align ?? 'corner'}·[${dims.join('')}]`
    return {
      el,
      deltaPct: delta,
      pass: delta <= tolPct,
      detail: `${el} (${tag}): Δ${delta.toFixed(1)}%  ref[w${ref.w.toFixed(0)} h${ref.h.toFixed(0)} y${ref.y.toFixed(0)}] vs mine[w${mine.w.toFixed(0)} h${mine.h.toFixed(0)} y${mine.y.toFixed(0)}]`,
    }
  })
}
