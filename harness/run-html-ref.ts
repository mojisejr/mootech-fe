// harness/run-html-ref.ts — CP-2 CK: verify the splash against an HTML reference instead of Figma.
// Same contract, same app, same 4-layer + mutant + state pipeline — ONLY the reference SOURCE differs
// (measured from harness/refs/splash.ref.html via the html adapter). Proves the verify path is
// source-agnostic and that fidelity scales the gate (measured → L3 blocking, like exact).
//   npx tsx harness/run-html-ref.ts   (dev server up on :3000 with V2_PREVIEW_KEY set)
import { chromium } from 'playwright'
import { orchestrate } from './engine'
import { splash } from '../design.contract'
import { splashRoleMap } from '../design.reference'
import { capture } from './capture'
import { mutantCss } from './mutants'
import { states } from './states'
import { measureHtmlRef } from './adapters/measureHtml'

const URL = 'http://localhost:3000/v2'
const COOKIE = { name: 'v2_access', value: 'lamun-local-dev', domain: 'localhost', path: '/' }
const VP = { w: 393, h: 852 }

async function main() {
  const browser = await chromium.launch()

  // ── ADAPTER: HTML reference → RefModel (fidelity: 'measured') ──────────────────────────────────
  const htmlReference = await measureHtmlRef({
    screen: 'splash',
    htmlPath: 'harness/refs/splash.ref.html',
    authoredAt: { w: 375, h: 844 },
    roleMap: splashRoleMap,
    browser,
  })
  console.log(`\n🔌 adapter: html → RefModel  fidelity=${htmlReference.fidelity}  elements=${Object.keys(htmlReference.elements).join(', ')}`)

  const res = await orchestrate({
    contract: splash,
    reference: htmlReference,
    capture: (o) => capture({ url: URL, cookie: COOKIE, browser, ...o }),
    sourceFiles: ['features/v2-shell/components/FullBleedScreen.tsx', 'features/onboarding/components/OnboardingCarousel.tsx'],
    mutantCss,
    states,
    viewport: VP,
    evidenceDir: 'harness/evidence/html',
  })
  await browser.close()
  process.exit(res.teethOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
