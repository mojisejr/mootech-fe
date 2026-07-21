// design.contract.ts — MuMate v2 machine-readable design contract (per-project data).
//
// The SCHEMA (interfaces) now lives in the generic engine (harness/engine/types); this file is pure
// DATA — the anchors/tolerances/mutants the engine scores against. Prose/rationale lives in
// DESIGN.md §0. FROZEN tolerances (ฟีม-approved 2026-07-21); each anchor guards a REAL shipped bug.
import type { ScreenContract } from './harness/engine/types'

// ── SPLASH ────────────────────────────────────────────────────────────────────────────────────
export const splash: ScreenContract = {
  screen: 'splash',
  route: '/v2', // onboarding step 0 (withLogo)
  source: {
    kind: 'figma',
    ref: '588:10335', // 01-splash, file hEOnE9S6wLkMhb0Iy2Fe6T
    authoredAt: { w: 375, h: 844 },
    fidelity: 'exact',
  },
  states: ['default', 'long-text', 'missing-mascot', 'fonts-not-ready'],
  viewports: [320, 360, 393, 430, 768, 1280],
  anchors: [
    {
      id: 'bg-aspect',
      selector: 'img[src*="BG"]',
      assert: 'background image renders object-fit:cover (never stretched)',
      computedEquals: { property: 'object-fit', value: 'cover' },
      severity: 'block',
      why: 'stretch destroys the artwork — an invariant, not a range; there is no "a little stretched is ok"',
      catches: 'object-cover className silently computed to fill → bg aspect 0.800 squished to 0.461',
    },
    {
      id: 'top-inset',
      selector: 'div.mx-auto.max-w-md',
      assert: 'content column top padding clears the status bar',
      minPx: { property: 'paddingTop', px: 44 },
      severity: 'block',
      why: '44px = iOS status-bar height; content must not sit under the notch/clock',
      catches: 'pt-10 computed to 0 → logo jammed against the top edge / clipped',
    },
    {
      id: 'bottom-inset',
      selector: 'div.mx-auto.max-w-md',
      assert: 'content column bottom padding clears the home indicator',
      minPx: { property: 'paddingBottom', px: 34 },
      severity: 'block',
      why: '34px = iOS home-indicator zone; the CTA must not glue to the very bottom edge',
      catches: 'pb-[safe-area] computed to 0 → "ถัดไป" button flush against the bottom edge',
    },
    {
      id: 'hero-height',
      selector: 'img[src*="mascot"]',
      assert: 'mascot height ≤ 47% of viewport height',
      maxViewportPct: { of: 'height', pct: 47 },
      severity: 'block',
      // RATIFIED 2026-07-21 from EXACT Figma geometry (node 588:10354 = 44.7% of 844) + 2% tol.
      why: 'Figma exact = 44.7% of viewport height (+2% tol); measured geometry, not an eyeball guess',
      catches: 'mascot exceeding its Figma-intended height band (uncapped max-h → balloon)',
    },
    {
      id: 'hero-width',
      selector: 'img[src*="mascot"]',
      assert: 'mascot width ≤ 86% of viewport width',
      maxViewportPct: { of: 'width', pct: 86 },
      severity: 'block',
      // RATIFIED 2026-07-21 from EXACT Figma geometry (node 588:10354 = 82.1% of 375) + 4% tol.
      why: 'Figma exact = 82.1% of viewport width (+4% tol); measured geometry, not an eyeball guess',
      catches: 'mascot exceeding its Figma-intended width band',
    },
    {
      id: 'tap-target',
      selector: 'button, a[href]',
      assert: 'interactive controls ≥ 44×44px',
      minPx: { property: 'min(width,height)', px: 44 },
      severity: 'block',
      why: 'WCAG 2.5.5 / Apple HIG minimum touch size',
      catches: 'undersized tap targets (guard for future screens)',
    },
    {
      id: 'ref-composition',
      selector: 'img[src*="mascot"]',
      assert: 'each key element within ±5% of its Figma position/size',
      refDeltaPct: 5,
      severity: 'advisory', // block once L3 semantic-mapping (CP-3) lands
      why: 'element-level delta is robust to font/bg-photo render noise; ±5% ≈ perceptually "same place"',
      catches: 'composition drift (logo/heading/mascot/cta out of place) while tolerating render noise',
    },
  ],
  mutants: [
    { id: 'mut-objectfit-fill', inject: 'force bg <img> object-fit:fill', expectFailAt: 'bg-aspect', realBug: 'the shipped object-cover→fill stretch ฟีม caught on device' },
    { id: 'mut-no-top-pad', inject: 'force content column padding-top:0', expectFailAt: 'top-inset', realBug: 'pt-10 computed to 0 → logo at top:0' },
    { id: 'mut-hero-uncapped', inject: 'remove mascot max-height cap', expectFailAt: 'hero-height', realBug: 'max-h-[220px] ignored → mascot 48% of viewport height' },
  ],
}

export const contracts: ScreenContract[] = [splash]
export default contracts
