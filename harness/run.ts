// harness/run.ts — PROJECT runner (thin). Wires the project's playwright capture + contract +
// reference + mutant CSS into the generic engine (harness/engine/). One command:
//   npx tsx harness/run.ts     (server up on :3000 with V2_PREVIEW_KEY set)
// Host/cookie value are env-overridable so the same runner drives local dev AND CI (CP-6).
import { chromium } from 'playwright'
import { orchestrate } from './engine'
import { splash } from '../design.contract'
import { splashReference } from '../design.reference'
import { capture } from './capture'
import { mutantCss } from './mutants'
import { states } from './states'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const TARGET = `${HOST}/v2`
const COOKIE = { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }
const VP = { w: 393, h: 852 }

async function main() {
  const browser = await chromium.launch()
  const res = await orchestrate({
    contract: splash,
    reference: splashReference,
    // inject the project's capture (adds url + cookie + shared browser); engine stays playwright-free
    capture: (o) => capture({ url: TARGET, cookie: COOKIE, browser, ...o }),
    sourceFiles: [
      'features/v2-shell/components/FullBleedScreen.tsx',
      'features/onboarding/components/OnboardingCarousel.tsx',
    ],
    mutantCss,
    states,
    viewport: VP,
    evidenceDir: 'harness/evidence',
    stripViewports: [320, 1280],
  })
  await browser.close()

  // ── CP-6 gate: evidence-as-gate. Fail the build on any of the four hard signals. ────────────────
  const fails: string[] = []
  if (!res.teethOk) fails.push(`blind mutant(s): ${res.blindMutantIds.join(', ')}`)
  if (res.blockFailIds.length) fails.push(`block-anchor fail(s): ${res.blockFailIds.join(', ')}`)
  if (res.l3Blocking) fails.push(`L3 composition drift (blocking@${splashReference.fidelity}): ${res.l3FailEls.join(', ')}`)
  if (res.stateFailIds.length) fails.push(`state break(s): ${res.stateFailIds.join(', ')}`)
  if (fails.length) {
    console.log(`\n🔴 GATE FAILED:\n  - ${fails.join('\n  - ')}`)
    process.exit(1)
  }
  console.log('\n🟢 GATE PASSED — teeth proven, block-anchors green, composition within tol, states survive.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
