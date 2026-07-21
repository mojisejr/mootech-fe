// design-verify engine — orchestrator (CP-1). Runs the 4 layers + mutant proof over a project's
// contract, using a CAPTURE FUNCTION injected by the project (so the engine stays playwright-free).
// Exit contract: teeth must be PROVEN (every mutant caught); block-anchor fails are surfaced.
import { mkdirSync, writeFileSync } from 'node:fs'
import type { ScreenContract, RefModel, CaptureFn, Match, StateDef, StateResult, AnchorResult } from './types'
import { evalAnchor } from './anchors'
import { lintSources } from './lint'
import { refDiff } from './refdiff'

export interface OrchestrateResult {
  teethOk: boolean
  blockFailIds: string[]
  blindMutantIds: string[]
  /** CP-3: reference elements whose L3 delta exceeds tolerance (advisory until CP-6 gates them). */
  l3FailEls: string[]
  /** CP-4: states that did not survive clean (block-fail / overflow / console error). */
  stateFailIds: string[]
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
  /** CP-4: legitimate runtime states the screen must survive (long-text, missing-image, pre-font, empty). */
  states?: StateDef[]
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

  // ── CP-4 · STATE REGISTRY (bugs live in states — verify the layout survives each condition) ─────
  // A state that deliberately drops an asset (abortPattern) WILL log the browser's own resource
  // failure — that is expected truth, not an app defect. Cleanliness measures APPLICATION errors
  // (thrown/React), so "does the app survive a missing hero?" is answered honestly, not by the
  // network noise we ourselves injected.
  const NET_NOISE = /failed to load resource|net::err_|err_failed/i
  const blockAnchorIds = contract.anchors.filter((a) => a.refDeltaPct === undefined && a.severity === 'block').map((a) => a.id)
  const stateResults: StateResult[] = []
  for (const s of (opts.states ?? []).filter((st) => st.id !== 'default')) {
    const scap = await capture({
      viewport: VP,
      probes: anchorProbes,
      injectCss: s.injectCss,
      abortPattern: s.abortPattern,
      skipAssetsReady: s.skipAssetsReady,
      screenshotPath: `${EV}/state-${s.id}.png`,
    })
    const ids = s.expectAnchors ?? blockAnchorIds
    const sAnchors: AnchorResult[] = ids.map((id) => evalAnchor(contract.anchors.find((a) => a.id === id)!, scap, VP))
    const blockFails = sAnchors.filter((a) => !a.pass && a.severity === 'block').map((a) => a.id)
    const appErrors = s.abortPattern ? scap.runtime.consoleErrors.filter((e) => !NET_NOISE.test(e)) : scap.runtime.consoleErrors
    const clean = blockFails.length === 0 && !scap.overflowX && appErrors.length === 0
    stateResults.push({
      id: s.id,
      note: s.note,
      clean,
      blockFails,
      runtime: { consoleErrors: appErrors.length, failedRequests: scap.runtime.failedRequests.length, cls: scap.runtime.cls, overflowX: scap.overflowX },
      anchors: sAnchors,
      screenshot: `${EV}/state-${s.id}.png`,
    })
  }
  report.states = stateResults

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
  const l3Fails = l3.filter((r) => !r.pass)
  const stateFails = stateResults.filter((s) => !s.clean)
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
  if (stateResults.length) {
    log('\n═══ CP-4 · STATE REGISTRY (does the layout survive real conditions?) ═══')
    stateResults.forEach((s) => log(`  ${s.clean ? '✓ SURVIVES' : '✗ BREAKS  '}  ${s.id.padEnd(16)} overflowX:${s.runtime.overflowX} CLS:${s.runtime.cls.toFixed(3)} err:${s.runtime.consoleErrors} blockFails:[${s.blockFails.join(',') || 'none'}]  — ${s.note}`))
  }
  log('\n═══ MUTANT PROOF (does the gate have teeth?) ═══')
  mutants.forEach((m) => log(`  ${m.caught ? '✓ CAUGHT' : '✗ BLIND '}  ${m.id} → ${m.expectFailAt}   (${m.realBug})`))
  log(`\n  evidence bundle → ${EV}/report.json + screenshots`)

  const teethOk = blindMutants.length === 0
  log(`\n  🦷 teeth: ${teethOk ? 'PROVEN' : 'BLIND — HARNESS FAILED'} (${contract.mutants.length - blindMutants.length}/${contract.mutants.length} caught)`)
  log(`  📐 ${contract.screen} health: ${blockFails.length === 0 ? '🟢 all block-anchors pass' : `🔴 ${blockFails.length} block-anchor(s) fail`} (${blockFails.map((a) => a.id).join(', ') || 'none'})`)
  if (reference) log(`  🎯 L3 composition: ${l3Fails.length === 0 ? '🟢 all elements within tol' : `🟡 ${l3Fails.length} advisory drift`} (${l3Fails.map((r) => r.el).join(', ') || 'none'})`)
  if (stateResults.length) log(`  🧪 states: ${stateFails.length === 0 ? '🟢 all survive' : `🔴 ${stateFails.length} break`} (${stateFails.map((s) => s.id).join(', ') || 'none'})\n`)

  return {
    teethOk,
    blockFailIds: blockFails.map((a) => a.id),
    blindMutantIds: blindMutants.map((m) => m.id as string),
    l3FailEls: l3Fails.map((r) => r.el),
    stateFailIds: stateFails.map((s) => s.id),
  }
}
