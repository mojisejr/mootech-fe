// design-verify engine — orchestrator (CP-1). Runs the 4 layers + mutant proof over a project's
// contract, using a CAPTURE FUNCTION injected by the project (so the engine stays playwright-free).
// Exit contract: teeth must be PROVEN (every mutant caught); block-anchor fails are surfaced.
import { mkdirSync, writeFileSync } from 'node:fs'
import type { ScreenContract, RefModel, CaptureFn, Match } from './types'
import { evalAnchor } from './anchors'
import { lintSources } from './lint'
import { refDiff } from './refdiff'

export interface OrchestrateResult {
  teethOk: boolean
  blockFailIds: string[]
  blindMutantIds: string[]
}

export async function orchestrate(opts: {
  contract: ScreenContract
  reference?: RefModel
  capture: CaptureFn
  sourceFiles: string[]
  mutantCss: Record<string, string>
  viewport: { w: number; h: number }
  evidenceDir: string
  stripViewports?: number[]
  log?: (s: string) => void
}): Promise<OrchestrateResult> {
  const { contract, reference, capture, sourceFiles, mutantCss, viewport: VP, evidenceDir: EV } = opts
  const log = opts.log ?? ((s: string) => console.log(s))
  mkdirSync(EV, { recursive: true })
  const report: Record<string, unknown> = { screen: contract.screen, route: contract.route, viewport: VP }

  const anchorProbes = contract.anchors.filter((a) => a.refDeltaPct === undefined).map((a) => ({ id: a.id, selector: a.selector }))
  const refProbes = reference ? Object.entries(reference.elements).map(([id, e]) => ({ id, selector: e.selector })) : []

  // ── L1 ──────────────────────────────────────────────────────────────────────────────────────
  const lint = lintSources(sourceFiles)
  report.L1_lint = lint

  // ── baseline capture (assets-ready) → L2 + L4 ─────────────────────────────────────────────────
  const cap = await capture({ viewport: VP, probes: [...anchorProbes, ...refProbes], screenshotPath: `${EV}/${contract.screen}-${VP.w}.png` })
  const anchors = contract.anchors.filter((a) => a.refDeltaPct === undefined).map((a) => evalAnchor(a, cap, VP))
  report.L2_anchors = anchors
  report.L4_runtime = { ...cap.runtime, overflowX: cap.overflowX }

  // ── L3 element ref-diff ───────────────────────────────────────────────────────────────────────
  let l3: ReturnType<typeof refDiff> = []
  if (reference) {
    const captured: Record<string, Match | undefined> = Object.fromEntries(refProbes.map((p) => [p.id, cap.measurements[p.id]?.[0]]))
    const tol = contract.anchors.find((a) => a.refDeltaPct !== undefined)?.refDeltaPct ?? 5
    l3 = refDiff(reference, captured, VP, tol)
    report.L3_refdiff = { fidelity: reference.fidelity, tolPct: tol, results: l3 }
  }
  for (const w of opts.stripViewports ?? []) {
    await capture({ viewport: { w, h: VP.h }, probes: anchorProbes, screenshotPath: `${EV}/${contract.screen}-${w}.png` })
  }

  // ── MUTANT PROOF (teeth) ──────────────────────────────────────────────────────────────────────
  const mutants: Array<Record<string, unknown>> = []
  for (const m of contract.mutants) {
    const mcap = await capture({ viewport: VP, probes: anchorProbes, injectCss: mutantCss[m.id], screenshotPath: `${EV}/mutant-${m.id}.png` })
    const anchor = contract.anchors.find((x) => x.id === m.expectFailAt)!
    const r = evalAnchor(anchor, mcap, VP)
    mutants.push({ id: m.id, expectFailAt: m.expectFailAt, caught: !r.pass, detail: r.message, realBug: m.realBug })
  }
  report.mutants = mutants

  // ── report ──────────────────────────────────────────────────────────────────────────────────
  const blockFails = anchors.filter((a) => !a.pass && a.severity === 'block')
  const blindMutants = mutants.filter((m) => !m.caught)
  writeFileSync(`${EV}/report.json`, JSON.stringify(report, null, 2))

  log('\n═══ L1 · source-lint ═══')
  log(lint.length ? lint.map((f) => `  ~ ${f.kind} "${f.text}"  ${f.file}:${f.line}`).join('\n') : '  clean')
  log('\n═══ L2 · computed anchors (measured AFTER assets-ready) ═══')
  anchors.forEach((a) => log('  ' + a.message + (a.pass ? '' : `   [${a.severity}] want ${a.expected}, got ${a.actual}`)))
  if (reference) {
    log(`\n═══ L3 · ref-diff vs ${reference.fidelity} ref (tol, advisory) ═══`)
    l3.forEach((r) => log(`  ${r.pass ? '✓' : '✗'} ${r.detail}`))
  }
  log('\n═══ L4 · runtime observer ═══')
  log(`  consoleErrors:${cap.runtime.consoleErrors.length}  failedReq:${cap.runtime.failedRequests.length}  CLS:${cap.runtime.cls.toFixed(3)}  overflowX:${cap.overflowX}`)
  log('\n═══ MUTANT PROOF (does the gate have teeth?) ═══')
  mutants.forEach((m) => log(`  ${m.caught ? '✓ CAUGHT' : '✗ BLIND '}  ${m.id} → ${m.expectFailAt}   (${m.realBug})`))
  log(`\n  evidence bundle → ${EV}/report.json + screenshots`)

  const teethOk = blindMutants.length === 0
  log(`\n  🦷 teeth: ${teethOk ? 'PROVEN' : 'BLIND — HARNESS FAILED'} (${contract.mutants.length - blindMutants.length}/${contract.mutants.length} caught)`)
  log(`  📐 ${contract.screen} health: ${blockFails.length === 0 ? '🟢 all block-anchors pass' : `🔴 ${blockFails.length} block-anchor(s) fail`} (${blockFails.map((a) => a.id).join(', ') || 'none'})\n`)

  return { teethOk, blockFailIds: blockFails.map((a) => a.id), blindMutantIds: blindMutants.map((m) => m.id as string) }
}
