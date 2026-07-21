// design.reference.ts — Reference Model (Phase E adapter output for splash)
//
// Extracted from Figma frame 588:10335 (01-splash) via get_design_context. This is the adapter's
// job: {figma|image|html|pdf} → normalized element geometry + a fidelity stamp. Here fidelity=exact
// (real node boxes from Figma), so L3 ref-diff can be trusted tightly.
//
// Element boxes are in the AUTHORED coordinate space (375×844); the harness normalizes to % of the
// live viewport before comparing. Status bar is OS chrome (no DOM counterpart) → excluded from L3.
export interface RefElement {
  x: number
  y: number
  w: number
  h: number
}
export interface RefModel {
  screen: string
  fidelity: 'exact' | 'measured' | 'estimate'
  authoredAt: { w: number; h: number }
  elements: Record<string, RefElement>
}

export const splashReference: RefModel = {
  screen: 'splash',
  fidelity: 'exact',
  authoredAt: { w: 375, h: 844 },
  elements: {
    // node 588:10346 (MuMate wordmark group — bbox includes artwork whitespace)
    logo: { x: 32, y: 104, w: 311, h: 74 },
    // node 588:10352 (Quote Container, centered → x=(375-240)/2)
    heading: { x: 67, y: 194, w: 240, h: 56 },
    // node 588:10354 (Mascot Mumate2 1) — the true intended hero box: 82.1% × 44.7%
    mascot: { x: 34, y: 266, w: 308, h: 377 },
    // node 588:10356 (Primary Button "ถัดไป")
    cta: { x: 32, y: 703, w: 311, h: 52 },
  },
}

export default splashReference
