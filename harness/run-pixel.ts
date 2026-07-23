// harness/run-pixel.ts — pixel-lens gate (webgang v2 · A1) + the goo+too adversary boundary map.
//
// Self-harden loop, run-proven. The adversary round (goo runtime/timing + too static) mapped this lens's
// scope precisely — every case below is executed, not asserted by eye:
//   CORE  ✓ persistent same-position divergence (console+CLS+AST all blind) — the lens's real value.
//   FIXED ✓ sub-budget magnitude — budget is now ABSOLUTE pixels, not % (too/goo: a flash is absolute).
//   A2    ✗ transient flicker (goo #1) — a 2-frame diff ALIASES a flicker that resolves between frames;
//            needs burst/temporal sampling. My original "flash" mutant was PERSISTENT, not transient —
//            the same blind-to-your-own-bug-class shape I caught in goo's crawl. Honest: this is a
//            *persistent* same-position anchor.
//   A2    ✗ pre-settle/entrance flash (too #1) — resolves before frame A; needs first-paint capture.
//   A2    ✗ state-specific (goo #2) — one auth state captured; needs route×state.
//   SCOPE 🧨 legit post-settle motion OVER-BLOCKS — capability-scoped to STATIC-after-settle routes.
//   npx tsx harness/run-pixel.ts     (server up on :3000; env-overridable for CI)
import { chromium } from 'playwright'
import { pixelStability } from './pixel-anchor'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const ROUTE = '/v2'
const VP = { w: 393, h: 852 }
const BUDGET_PX = 300 // absolute changed-pixel floor; clean = 0 (temporal same-session). Catches ≈ >12×12@2x. Per-route re-ratify.
const CLS_SILENT = 0.015

// core: a PERSISTENT same-position divergence (opacity/colour held) — console+CLS+AST blind.
const MUT_PERSISTENT = 'img[src*="mascot"]{opacity:.4!important} h1{color:#e11!important} button{background:#e11!important;color:#fff!important}'
// goo #3 / too HOLE2 — a 40×40 box (≈6400px@2x). Under a % budget it slipped; the absolute-px budget catches it.
const SUB_BUDGET = 'body::after{content:"";position:fixed;top:10px;left:10px;width:40px;height:40px;background:red;z-index:9999}'
// goo #1 — a transient flicker that resolves (.26s) before frame B → both frames settled → aliased → BLIND (A2).
const TRANSIENT = '@keyframes flk{0%{opacity:1}50%{opacity:.15}100%{opacity:1}} img[src*="mascot"]{animation:flk .26s 1 !important}'
// goo #4 / too HOLE3 — legit continuous motion → A≠B → over-block (capability-scope: static routes only).
const MOTION = '*{animation:spin 2s linear infinite !important}@keyframes spin{100%{transform:rotate(5deg)}}'
// too #1 — flash before assets-ready, removed before frame A → BLIND (A2: entrance window).
const PRESETTLE = 'body{background:red !important}'

async function main() {
  const browser = await chromium.launch()
  const base = { browser, url: `${HOST}${ROUTE}`, budgetPx: BUDGET_PX, viewport: VP, evidenceDir: 'harness/evidence/pixel', cookie: { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' } }

  const clean = await pixelStability({ ...base, label: 'clean' })
  const mut = await pixelStability({ ...base, label: 'mut-persistent', injectFlashCss: MUT_PERSISTENT })
  const subBudget = await pixelStability({ ...base, label: 'sub-budget-40px', injectFlashCss: SUB_BUDGET })
  const transient = await pixelStability({ ...base, label: 'transient-flicker', injectFlashCss: TRANSIENT })
  const motion = await pixelStability({ ...base, label: 'legit-motion', injectFlashCss: MOTION })
  const preSettle = await pixelStability({ ...base, label: 'pre-settle', injectPreSettleFlashCss: PRESETTLE })
  await browser.close()

  const instrumentValid = clean.clean // neg-control: stable route reads clean → not vacuous
  const teethCaught = !mut.clean // persistent same-position divergence tripped
  const clsBlind = mut.cls < CLS_SILENT // it is the CLS-blind class this lens exists for
  const subBudgetFixed = !subBudget.clean // absolute-px budget now catches the sub-% flash

  console.log('\n═══ PIXEL LENS — persistent same-position divergence (visual ground-truth) ═══')
  console.log(`  route ${ROUTE} @${VP.w}  budget ${BUDGET_PX}px (absolute)`)
  console.log(`  ${instrumentValid ? '✓' : '✗'} neg-control (verify-the-instrument): clean = ${clean.changedPx}px (${clean.ratioPct.toFixed(3)}%)`)
  console.log(`  ${teethCaught ? '🦷 CAUGHT' : '✗ BLIND'}  core mut-persistent: ${mut.changedPx}px (> ${BUDGET_PX})`)
  console.log(`  ${clsBlind ? '✓' : '✗'} CLS-blind proof: flash CLS = ${mut.cls.toFixed(4)} (< ${CLS_SILENT})`)
  console.log(`  ${subBudgetFixed ? '🦷 CAUGHT' : '✗ BLIND'}  sub-budget 40×40 (goo#3/too#2 fix, %→px): ${subBudget.changedPx}px (> ${BUDGET_PX})`)

  console.log('\n═══ MAPPED BOUNDARIES (goo+too adversary — accept-risk / A2, documented in ledger) ═══')
  console.log(`  ${transient.clean ? '🥷 BLIND (A2)' : 'caught'}  transient flicker (goo#1): ${transient.changedPx}px — 2-frame aliases a flash that resolves between frames → needs burst sampling`)
  console.log(`  ${preSettle.clean ? '🥷 BLIND (A2)' : 'caught'}  pre-settle/entrance (too#1): ${preSettle.changedPx}px — resolves before frame A → needs first-paint capture`)
  console.log(`  ${!motion.clean ? '🧨 OVER-BLOCK (scope)' : 'ok'}  legit motion (goo#4/too#3): ${motion.changedPx}px — capability-scoped to STATIC-after-settle routes`)

  const ok = instrumentValid && teethCaught && clsBlind && subBudgetFixed
  console.log(`\n  ${ok ? '🟢 PIXEL GATE PASSED' : '🔴 PIXEL GATE FAILED'} — core teeth ${teethCaught ? 'proven' : 'BLIND'} · instrument ${instrumentValid ? 'valid' : 'INVALID'} · sub-budget ${subBudgetFixed ? 'fixed' : 'STILL BLIND'} · transient/entrance/state = A2, motion = capability-scope\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
