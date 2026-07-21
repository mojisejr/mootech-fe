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

/** Reference geometry element. `selector` maps the ref element → its DOM counterpart for L3. */
export interface RefElement {
  x: number
  y: number
  w: number
  h: number
  selector: string
}
export interface RefModel {
  screen: string
  fidelity: Fidelity
  authoredAt: { w: number; h: number }
  elements: Record<string, RefElement>
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
