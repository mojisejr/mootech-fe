// design.reference.ts — Reference Model for splash (adapter output, per-project data).
//
// Extracted from Figma frame 588:10335 (01-splash) via get_design_context → fidelity=exact.
// Element boxes are in the AUTHORED space (375×844); `selector` maps each ref element → its DOM
// counterpart so the engine's L3 element ref-diff can compare. Status bar = OS chrome (no DOM), excluded.
//
// CP-3 role-map (`role` + `compare`) makes L3 HONEST — each element is diffed only on what its
// semantic role owns, so real composition drift shows and false deltas don't:
//   • mark/action → size (w,h). Their safe-area POSITION is owned by L2 top/bottom-inset, not re-diffed here.
//   • text → centre-x + height (align:'center', dims:['x','h']). Rendered text WIDTH is content/font
//     noise (Thai copy ≠ the Figma text-box width) — diffing it produced the old logo/heading artifacts.
//   • hero → size (w,h); already faithful at Δ~2%.
// `box:'ink'` (visible-artwork sub-box) is available for elements whose Figma node bbox includes
// whitespace padding; the splash assets are tight, so all use the default node box.
import type { RefModel } from './harness/engine/types'

export const splashReference: RefModel = {
  screen: 'splash',
  fidelity: 'exact',
  authoredAt: { w: 375, h: 844 },
  elements: {
    logo: { x: 32, y: 104, w: 311, h: 74, selector: 'img[src*="logo"]', role: 'mark', compare: { dims: ['w', 'h'] } }, // node 588:10346
    heading: { x: 67, y: 194, w: 240, h: 56, selector: 'h1', role: 'text', compare: { align: 'center', dims: ['x', 'h'] } }, // node 588:10352
    mascot: { x: 34, y: 266, w: 308, h: 377, selector: 'img[src*="mascot"]', role: 'hero', compare: { dims: ['w', 'h'] } }, // node 588:10354 (82.1% × 44.7%)
    cta: { x: 32, y: 703, w: 311, h: 52, selector: 'button', role: 'action', compare: { dims: ['w', 'h'] } }, // node 588:10356
  },
}

export default splashReference
