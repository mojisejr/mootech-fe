// design-verify engine — public surface (CP-1).
// A project imports { orchestrate } + the types, injects its own playwright capture, and runs the
// 4-layer + mutant gate against its design.contract.ts / design.reference.ts. Engine is playwright-free.
export * from './types'
export { evalAnchor } from './anchors'
export { lintSources } from './lint'
export { refDiff } from './refdiff'
export { orchestrate } from './orchestrate'
export type { OrchestrateResult } from './orchestrate'
