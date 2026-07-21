// design.reference.ts — Reference Model for splash (adapter output, per-project data).
//
// Extracted from Figma frame 588:10335 (01-splash) via get_design_context → fidelity=exact.
// Element boxes are in the AUTHORED space (375×844); `selector` maps each ref element → its DOM
// counterpart so the engine's L3 element ref-diff can compare. Status bar = OS chrome (no DOM), excluded.
import type { RefModel } from './harness/engine/types'

export const splashReference: RefModel = {
  screen: 'splash',
  fidelity: 'exact',
  authoredAt: { w: 375, h: 844 },
  elements: {
    logo: { x: 32, y: 104, w: 311, h: 74, selector: 'img[src*="logo"]' }, // node 588:10346
    heading: { x: 67, y: 194, w: 240, h: 56, selector: 'h1' }, // node 588:10352
    mascot: { x: 34, y: 266, w: 308, h: 377, selector: 'img[src*="mascot"]' }, // node 588:10354 (82.1% × 44.7%)
    cta: { x: 32, y: 703, w: 311, h: 52, selector: 'button' }, // node 588:10356
  },
}

export default splashReference
