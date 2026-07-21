// harness/run.ts — Frame-v2 orchestrator (Phase C). One command → 4 layers + mutant proof + bundle.
//   npx tsx harness/run.ts       (dev server must be up on :3000 with V2_PREVIEW_KEY set)
// Exit 0 only if: no BLOCK anchor fails AND every mutant was CAUGHT.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { splash } from '../design.contract'
import { splashReference } from '../design.reference'
import { capture } from './capture'
import { evalAnchor } from './anchors'
import { lintSources } from './lint'
import { mutantCss } from './mutants'
import { refDiff } from './refdiff'

const URL = 'http://localhost:3000/v2'
const COOKIE = { name: 'v2_access', value: 'lamun-local-dev', domain: 'localhost', path: '/' }
const VP = { w: 393, h: 852 }
const EV = 'harness/evidence'
const probes = splash.anchors.map((a) => ({ id: a.id, selector: a.selector }))
// L3 element probes (map DOM → Reference Model element keys)
const refProbes = [
  { id: 'logo', selector: 'img[src*="logo"]' },
  { id: 'heading', selector: 'h1' },
  { id: 'mascot', selector: 'img[src*="mascot"]' },
  { id: 'cta', selector: 'button' },
]

async function main() {
  mkdirSync(EV, { recursive: true })
  const browser = await chromium.launch()
  const report: Record<string, unknown> = { screen: splash.screen, route: splash.route, viewport: VP }

  // ── Layer 1: source lint ────────────────────────────────────────────────────────────────────
  const lint = lintSources([
    'features/v2-shell/components/FullBleedScreen.tsx',
    'features/onboarding/components/OnboardingCarousel.tsx',
  ])
  report.L1_lint = lint

  // ── baseline capture (assets-ready) → Layer 2 anchors + Layer 4 runtime ──────────────────────
  const cap = await capture({ url: URL, viewport: VP, probes: [...probes, ...refProbes], cookie: COOKIE, browser, screenshotPath: `${EV}/splash-393.png` })
  // L2 = computed anchors only; ref-composition is handled by the L3 element-diff below
  const anchors = splash.anchors.filter((a) => a.refDeltaPct === undefined).map((a) => evalAnchor(a, cap, VP))
  report.L2_anchors = anchors
  report.L4_runtime = { ...cap.runtime, overflowX: cap.overflowX }

  // ── Layer 3: element-level ref-diff vs EXACT Figma geometry (fidelity=exact) ──────────────────
  const captured = Object.fromEntries(refProbes.map((p) => [p.id, cap.measurements[p.id]?.[0]]))
  const refTol = splash.anchors.find((a) => a.id === 'ref-composition')?.refDeltaPct ?? 5
  const l3 = refDiff(splashReference, captured, VP, refTol)
  report.L3_refdiff = { fidelity: splashReference.fidelity, tolPct: refTol, results: l3 }
  for (const w of [320, 1280]) {
    await capture({ url: URL, viewport: { w, h: VP.h }, probes, cookie: COOKIE, browser, screenshotPath: `${EV}/splash-${w}.png` })
  }
  report.L3_strip = ['320', '393', '1280'].map((w) => `${EV}/splash-${w}.png`)

  // ── MUTANT PROOF (teeth) ──────────────────────────────────────────────────────────────────────
  const mutants: Array<Record<string, unknown>> = []
  for (const m of splash.mutants) {
    const mcap = await capture({ url: URL, viewport: VP, probes, cookie: COOKIE, browser, injectCss: mutantCss[m.id], screenshotPath: `${EV}/mutant-${m.id}.png` })
    const anchor = splash.anchors.find((x) => x.id === m.expectFailAt)!
    const r = evalAnchor(anchor, mcap, VP)
    mutants.push({ id: m.id, expectFailAt: m.expectFailAt, caught: !r.pass, detail: r.message, realBug: m.realBug })
  }
  report.mutants = mutants

  await browser.close()

  // ── report ────────────────────────────────────────────────────────────────────────────────────
  const blockFails = anchors.filter((a) => !a.pass && a.severity === 'block')
  const blindMutants = mutants.filter((m) => !m.caught)
  writeFileSync(`${EV}/report.json`, JSON.stringify(report, null, 2))

  console.log('\n═══ L1 · source-lint ═══')
  console.log(lint.length ? lint.map((f) => `  ~ ${f.kind} "${f.text}"  ${f.file}:${f.line}`).join('\n') : '  clean')
  console.log('\n═══ L2 · computed anchors (measured AFTER assets-ready) ═══')
  anchors.forEach((a) => console.log('  ' + a.message + (a.pass ? '' : `   [${a.severity}] want ${a.expected}, got ${a.actual}`)))
  console.log(`\n═══ L3 · ref-diff vs Figma (fidelity=${splashReference.fidelity}, tol ±${refTol}%, advisory) ═══`)
  l3.forEach((r) => console.log(`  ${r.pass ? '✓' : '✗'} ${r.detail}`))
  console.log('\n═══ L4 · runtime observer ═══')
  console.log(`  consoleErrors:${cap.runtime.consoleErrors.length}  failedReq:${cap.runtime.failedRequests.length}  CLS:${cap.runtime.cls.toFixed(3)}  overflowX:${cap.overflowX}`)
  console.log('\n═══ MUTANT PROOF (does the gate have teeth?) ═══')
  mutants.forEach((m) => console.log(`  ${m.caught ? '✓ CAUGHT' : '✗ BLIND '}  ${m.id} → ${m.expectFailAt}   (${m.realBug})`))
  console.log(`\n  evidence bundle → ${EV}/report.json + screenshots`)

  const teethOk = blindMutants.length === 0
  console.log(`\n  🦷 teeth: ${teethOk ? 'PROVEN' : 'BLIND — HARNESS FAILED'} (${splash.mutants.length - blindMutants.length}/${splash.mutants.length} mutants caught)`)
  console.log(`  📐 splash health: ${blockFails.length === 0 ? '🟢 all block-anchors pass' : `🔴 ${blockFails.length} block-anchor(s) fail`} (${blockFails.map((a) => a.id).join(', ') || 'none'})`)
  console.log(
    `\n  → thin-slice goal = teeth PROVEN + harness flags the real broken anchors on current splash.\n    (fixing those anchors is Phase F.)\n`,
  )

  // engine self-test success = teeth proven. splash being broken is EXPECTED pre-Phase-F.
  process.exit(teethOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
