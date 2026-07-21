// design-verify engine — shared DSL schema (CP-1). Generic, project-agnostic, playwright-free.
// A project defines its `ScreenContract` + `RefModel` from these types; the engine scores captured JSON.

export type Fidelity = 'exact' | 'measured' | 'estimate'

export interface RefSource {
  kind: 'figma' | 'image' | 'html' | 'pdf'
  ref: string
  authoredAt: { w: number; h: number }
  fidelity: Fidelity
}

/** One enforceable, size-independent invariant. Exactly one assertion shape is set. */
export interface Anchor {
  id: string
  selector: string
  assert: string
  computedEquals?: { property: string; value: string }
  minPx?: { property: string; px: number }
  maxViewportPct?: { of: 'width' | 'height'; pct: number }
  refDeltaPct?: number
  severity: 'block' | 'advisory'
  why: string
  catches: string
}

/** A deliberate injection of a known-real bug. The gate MUST fail at `expectFailAt` — proof of teeth. */
export interface Mutant {
  id: string
  inject: string
  expectFailAt: string
  realBug: string
}

export interface ScreenContract {
  screen: string
  route: string
  source: RefSource
  states: string[]
  viewports: number[]
  anchors: Anchor[]
  mutants: Mutant[]
}

/** Which box dimensions count toward the L3 delta. */
export type CompareDim = 'x' | 'y' | 'w' | 'h'

/**
 * CP-3 role-map: how to compare ONE ref element against its DOM counterpart — the honesty knob.
 * Removes false deltas (text-width noise, whitespace-padded node boxes, absolute position that L2
 * already guards) so L3 surfaces only real composition drift. Absent = legacy behaviour
 * (node box · corner-aligned · all four dims).
 */
export interface CompareMode {
  /** 'node' = full Figma node bbox (default) · 'ink' = the visible-artwork sub-box (kills reference-model-loss). */
  box?: 'node' | 'ink'
  /** dims that count toward the delta (default ['x','y','w','h']). e.g. a text node → ['x','h'] (position+size, not content width). */
  dims?: CompareDim[]
  /** 'corner' = compare top-left (default) · 'center' = compare centre point (robust to auto-centred layout). */
  align?: 'corner' | 'center'
}

/** Reference geometry element. `selector` maps the ref element → its DOM counterpart for L3. */
export interface RefElement {
  x: number
  y: number
  w: number
  h: number
  selector: string
  /** Semantic role (documentation): 'mark' | 'text' | 'hero' | 'action' | … — explains the compare choice. */
  role?: string
  /** Visible-artwork sub-box in AUTHORED space; used when `compare.box === 'ink'`. */
  ink?: { x: number; y: number; w: number; h: number }
  /** Per-element comparison mode (CP-3). Absent → legacy node-box/corner/all-dims. */
  compare?: CompareMode
}
export interface RefModel {
  screen: string
  fidelity: Fidelity
  authoredAt: { w: number; h: number }
  elements: Record<string, RefElement>
  /** CP-2: how this model was produced (adapter kind + notes) — provenance for the evidence bundle. */
  source?: RefSource
  /** CP-2: true when geometry is an estimate awaiting human confirmation (image/pdf); L3 stays advisory. */
  unconfirmed?: boolean
}

// ── capture contract (the project's capture fn fulfils this; the engine only consumes it) ────────
export interface Probe {
  id: string
  selector: string
}
export interface Match {
  objectFit: string
  paddingTop: string
  paddingBottom: string
  w: number
  h: number
  top: number
  left: number
}
export interface Capture {
  viewport: { w: number; h: number }
  overflowX: boolean
  measurements: Record<string, Match[]>
  runtime: { consoleErrors: string[]; failedRequests: string[]; cls: number }
  screenshot: string
}
export type CaptureFn = (o: {
  viewport: { w: number; h: number }
  probes: Probe[]
  screenshotPath: string
  injectCss?: string
  /** CP-4: abort every request whose URL contains this substring → simulate a missing asset (e.g. 404 hero). */
  abortPattern?: string
  /** CP-4: measure BEFORE the assets-ready gate → catch FOUT/CLS in the fonts-not-ready state. */
  skipAssetsReady?: boolean
}) => Promise<Capture>

// ── result shapes ────────────────────────────────────────────────────────────────────────────────
export interface AnchorResult {
  id: string
  pass: boolean
  severity: 'block' | 'advisory'
  expected: string
  actual: string
  message: string
}
export interface RefDiffResult {
  el: string
  deltaPct: number
  pass: boolean
  detail: string
}
export interface LintFinding {
  file: string
  line: number
  kind: 'raw-hex' | 'arbitrary-class'
  text: string
  severity: 'block' | 'advisory'
}

// ── CP-4 state registry ────────────────────────────────────────────────────────────────────────
/**
 * A legitimate runtime CONDITION the screen must survive (not a bug — that's a Mutant). The project
 * realises each state via a capture intervention; the engine re-runs L2/L4 in that state so the gate
 * proves the layout holds where bugs actually live (overflow, missing image, pre-font reflow, empty).
 */
export interface StateDef {
  id: string
  injectCss?: string
  abortPattern?: string
  skipAssetsReady?: boolean
  /** Anchor ids that MUST hold in this state (default: all non-refDelta block anchors). */
  expectAnchors?: string[]
  note: string
}
export interface StateResult {
  id: string
  note: string
  /** clean = no block-anchor fail, no horizontal overflow, no console errors in this state. */
  clean: boolean
  blockFails: string[]
  runtime: { consoleErrors: number; failedRequests: number; cls: number; overflowX: boolean }
  anchors: AnchorResult[]
  screenshot: string
}
