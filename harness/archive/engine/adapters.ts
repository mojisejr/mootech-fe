// design-verify engine — CP-2 adapters. Normalise ANY reference source → one RefModel + a fidelity
// stamp, so L3 is source-agnostic and the gate can scale its strictness by how much the reference can
// be trusted. Pure + playwright-free: rendering/measuring an HTML or image ref is a PROJECT step
// (playwright lives there); these adapters consume the geometry that step produces.
//
//   figma  → exact     (vector geometry, authoritative)      → L3 blocking
//   html   → measured  (rendered + measured real pixels)     → L3 blocking
//   image  → estimate  (agent-vision guess, human-confirm)   → L3 advisory only
//   pdf    → estimate  (same)                                → L3 advisory only
import type { Fidelity, RefModel, RefElement, RefSource } from './types'

/** How strict may L3 be for a reference of this fidelity? Estimates never block — they can be wrong. */
export function fidelityGate(f: Fidelity): 'block' | 'advisory' {
  return f === 'estimate' ? 'advisory' : 'block'
}

/** Geometry for one role: its authored box + the DOM selector + optional role-map compare mode. */
export type RoleGeometry = RefElement

/**
 * FIGMA adapter — vector geometry is authoritative → fidelity 'exact'. Input elements are already in
 * authored space (from get_design_context absoluteBoundingBox). This is a typed, stamped constructor:
 * it is what design.reference.ts calls instead of hand-writing `fidelity: 'exact'`.
 */
export function figmaAdapter(input: {
  screen: string
  ref: string
  authoredAt: { w: number; h: number }
  elements: Record<string, RoleGeometry>
}): RefModel {
  return {
    screen: input.screen,
    fidelity: 'exact',
    authoredAt: input.authoredAt,
    elements: input.elements,
    source: { kind: 'figma', ref: input.ref, authoredAt: input.authoredAt, fidelity: 'exact' },
  }
}

/**
 * HTML adapter — a rendered HTML mock is the design source. The PROJECT renders it in playwright at
 * `authoredAt` and measures each role's box (px == authored coords); this adapter merges those measured
 * boxes with the role-map (selector + compare) → fidelity 'measured'. Real pixels, so still blocking.
 */
export function htmlAdapter(input: {
  screen: string
  ref: string
  authoredAt: { w: number; h: number }
  measured: Record<string, { x: number; y: number; w: number; h: number }>
  roleMap: Record<string, Omit<RefElement, 'x' | 'y' | 'w' | 'h'>>
}): RefModel {
  const elements: Record<string, RefElement> = {}
  for (const [role, box] of Object.entries(input.measured)) {
    const map = input.roleMap[role]
    if (!map) continue // a measured element with no role-map entry is ignored (unknown role)
    elements[role] = { ...box, ...map }
  }
  return {
    screen: input.screen,
    fidelity: 'measured',
    authoredAt: input.authoredAt,
    elements,
    source: { kind: 'html', ref: input.ref, authoredAt: input.authoredAt, fidelity: 'measured' },
  }
}

/**
 * ESTIMATE adapter — image/pdf refs give only an agent-vision GUESS of geometry. fidelity 'estimate'
 * + `unconfirmed: true` → L3 is advisory-only until a human confirms the boxes. Never blocks a build
 * on a guess; surfaces the drift for review and promotes to 'measured' once confirmed.
 */
export function estimateAdapter(input: {
  screen: string
  kind: 'image' | 'pdf'
  ref: string
  authoredAt: { w: number; h: number }
  elements: Record<string, RoleGeometry>
}): RefModel {
  return {
    screen: input.screen,
    fidelity: 'estimate',
    authoredAt: input.authoredAt,
    elements: input.elements,
    unconfirmed: true,
    source: { kind: input.kind, ref: input.ref, authoredAt: input.authoredAt, fidelity: 'estimate' },
  }
}
