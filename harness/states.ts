// harness/states.ts — MuMate v2 STATE REGISTRY (CP-4, per-project data).
//
// Bugs live in states, not in the happy path. Each entry realises one legitimate runtime CONDITION
// the splash must survive; the engine re-runs the layout-integrity anchors + L4 in that state. This
// is the honest complement to mutants.ts: mutants inject KNOWN BUGS (must fail), states inject REAL
// CONDITIONS (must survive). The contract's `states: [...]` field declares them; this file realises.
import type { StateDef } from './engine/types'

export const states: StateDef[] = [
  {
    id: 'long-text',
    // Thai copy can grow (localisation / dynamic content). Force an oversized heading and assert the
    // column still clears the safe-areas and never scrolls sideways.
    injectCss: 'h1{font-size:2.75rem!important;line-height:1.12!important}',
    expectAnchors: ['top-inset', 'bottom-inset', 'tap-target'],
    note: 'oversized heading → must not overflow-x or clip the safe-areas',
  },
  {
    id: 'missing-mascot',
    // Hero art is served from S3/BE, not the repo — it can 404. The layout must survive a missing hero.
    abortPattern: 'mascot',
    expectAnchors: ['top-inset', 'bottom-inset', 'tap-target'],
    note: 'hero image fails to load → column + CTA must hold, no overflow',
  },
  {
    id: 'fonts-not-ready',
    // Measure BEFORE the assets-ready gate: catch flash-of-unstyled-text / layout shift on first paint.
    skipAssetsReady: true,
    expectAnchors: ['top-inset', 'bottom-inset'],
    note: 'pre-settle frame → watch CLS / FOUT before fonts+images load',
  },
]

export default states
