// harness/run-pixel.ts — pixel-lens gate (webgang v2 · A1). Runs the self-harden loop's proof for the
// visual ground-truth anchor: (1) verify-the-instrument via a negative control, (2) teeth-prove with a
// same-position silent-flash mutant that CLS + console are blind to. Exit non-zero if the instrument is
// invalid (clean not clean) or the anchor is blind (mutant not caught).
//   npx tsx harness/run-pixel.ts    (server up on :3000; env-overridable for CI)
import { chromium } from 'playwright'
import { pixelStability } from './pixel-anchor'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const ROUTE = '/v2'
const VP = { w: 393, h: 852 }
const BUDGET_PCT = 1.0 // floor: clean measured 0.000%; per-route re-ratify (a route with legit motion needs its own budget or masking)
const CLS_SILENT = 0.015 // the flash must sit BELOW goo's CLS gate — that is what proves this lens catches a CLS-blind bug

// mut-pixel-silent-flash: a same-position flash (opacity/colour, never layout) → CLS stays 0, console clean,
// pixels change. This is the family runtime+static cannot see; the pixel lens is the only ground-truth.
const MUTANT_CSS = 'img[src*="mascot"]{opacity:.4!important} h1{color:#e11!important} button{background:#e11!important;color:#fff!important}'

async function main() {
  const browser = await chromium.launch()
  const cookie = { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }
  const evidenceDir = 'harness/evidence/pixel'

  // (1) verify-the-instrument — negative control: a stable route must read ~0 (no false-positive)
  const clean = await pixelStability({ browser, url: `${HOST}${ROUTE}`, label: 'clean', budgetPct: BUDGET_PCT, viewport: VP, evidenceDir, cookie })
  // (2) teeth — the mutant silent flash must TRIP the anchor while CLS stays silent
  const mut = await pixelStability({ browser, url: `${HOST}${ROUTE}`, label: 'mut-pixel-silent-flash', budgetPct: BUDGET_PCT, viewport: VP, evidenceDir, cookie, injectFlashCss: MUTANT_CSS })
  await browser.close()

  const instrumentValid = clean.clean // clean within budget → not vacuous, no false-positive
  const caught = mut.ratioPct > BUDGET_PCT // the anchor tripped on the injected flash
  const clsBlind = mut.cls < CLS_SILENT // the flash is exactly the CLS-blind class this lens exists for

  console.log('\n═══ PIXEL LENS — visual ground-truth (same-position flash) ═══')
  console.log(`  route ${ROUTE} @${VP.w}  budget ${BUDGET_PCT}%`)
  console.log(`  ${instrumentValid ? '✓' : '✗'} neg-control (verify-the-instrument): clean = ${clean.ratioPct.toFixed(3)}%  ${instrumentValid ? '(stable, no false-positive)' : '(NOT clean — instrument false-positives / vacuous)'}`)
  console.log(`  ${caught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-pixel-silent-flash: pixel-diff = ${mut.ratioPct.toFixed(3)}% (> ${BUDGET_PCT}% budget)`)
  console.log(`  ${clsBlind ? '✓' : '✗'} CLS-blind proof: flash CLS = ${mut.cls.toFixed(4)} (< ${CLS_SILENT} → console+CLS could NOT see this; pixel lens is the only ground-truth)`)
  console.log(`  evidence: ${evidenceDir}/{clean,mut-pixel-silent-flash}-{A,B,diff}.png`)

  const ok = instrumentValid && caught && clsBlind
  console.log(`\n  ${ok ? '🟢 PIXEL GATE PASSED' : '🔴 PIXEL GATE FAILED'} — teeth ${caught ? 'proven' : 'BLIND'} · instrument ${instrumentValid ? 'valid' : 'INVALID'} · CLS-blind ${clsBlind ? 'confirmed' : 'NOT confirmed'}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
