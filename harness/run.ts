// harness/run.ts — PROJECT runner (thin). Wires the project's playwright capture + contract +
// reference + mutant CSS into the generic engine (harness/engine/). One command:
//   npx tsx harness/run.ts     (dev server up on :3000 with V2_PREVIEW_KEY set)
import { chromium } from 'playwright'
import { orchestrate } from './engine'
import { splash } from '../design.contract'
import { splashReference } from '../design.reference'
import { capture } from './capture'
import { mutantCss } from './mutants'

const URL = 'http://localhost:3000/v2'
const COOKIE = { name: 'v2_access', value: 'lamun-local-dev', domain: 'localhost', path: '/' }
const VP = { w: 393, h: 852 }

async function main() {
  const browser = await chromium.launch()
  const res = await orchestrate({
    contract: splash,
    reference: splashReference,
    // inject the project's capture (adds url + cookie + shared browser); engine stays playwright-free
    capture: (o) => capture({ url: URL, cookie: COOKIE, browser, ...o }),
    sourceFiles: [
      'features/v2-shell/components/FullBleedScreen.tsx',
      'features/onboarding/components/OnboardingCarousel.tsx',
    ],
    mutantCss,
    viewport: VP,
    evidenceDir: 'harness/evidence',
    stripViewports: [320, 1280],
  })
  await browser.close()
  process.exit(res.teethOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
