// design.reference.ts — Reference Model for splash (CP-2: built via the Figma adapter).
//
// Extracted from Figma frame 588:10335 (01-splash) via get_design_context → fidelity=exact.
// Geometry is in AUTHORED space (375×844). Instead of hand-stamping `fidelity:'exact'`, the model is
// produced by `figmaAdapter(...)` — the same adapter interface every ref source flows through, so L3 is
// source-agnostic (see harness/refs for the HTML-adapter demonstration of the identical pipeline).
//
// The ROLE-MAP (`splashRoleMap`: selector + role + compare) is exported separately because it is the
// screen's DOM binding + L3 honesty rules, shared by EVERY adapter for this screen:
//   • mark/action → size (w,h). Safe-area POSITION is owned by L2 top/bottom-inset, not re-diffed here.
//   • text → centre-x + height. Rendered text WIDTH is content/font noise (Thai copy ≠ Figma text-box).
//   • hero → size (w,h). `box:'ink'` (visible-artwork sub-box) is available for whitespace-padded nodes.
import { figmaAdapter } from './harness/engine'
import type { RefElement } from './harness/engine/types'

/** DOM binding + L3 compare mode per role — reused by the Figma AND HTML adapters for this screen. */
export const splashRoleMap: Record<string, Omit<RefElement, 'x' | 'y' | 'w' | 'h'>> = {
  logo: { selector: 'img[src*="logo"]', role: 'mark', compare: { dims: ['w', 'h'] } }, // node 588:10346
  heading: { selector: 'h1', role: 'text', compare: { align: 'center', dims: ['x', 'h'] } }, // node 588:10352
  mascot: { selector: 'img[src*="mascot"]', role: 'hero', compare: { dims: ['w', 'h'] } }, // node 588:10354 (82.1% × 44.7%)
  cta: { selector: 'button', role: 'action', compare: { dims: ['w', 'h'] } }, // node 588:10356
}

/** Figma authored geometry (get_design_context absoluteBoundingBox, 375×844). */
export const splashGeometry: Record<string, { x: number; y: number; w: number; h: number }> = {
  logo: { x: 32, y: 104, w: 311, h: 74 },
  heading: { x: 67, y: 194, w: 240, h: 56 },
  mascot: { x: 34, y: 266, w: 308, h: 377 },
  cta: { x: 32, y: 703, w: 311, h: 52 },
}

export const splashReference = figmaAdapter({
  screen: 'splash',
  ref: '588:10335',
  authoredAt: { w: 375, h: 844 },
  elements: Object.fromEntries(Object.entries(splashGeometry).map(([role, box]) => [role, { ...box, ...splashRoleMap[role] }])),
})

export default splashReference
