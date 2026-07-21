// harness/run-system.ts — CP-7 · `--system` verify. The golden page (design-system) is the source of
// truth screens compose from; this proves it renders as an INTACT, healthy catalogue: every truth
// section present, no console errors, no horizontal overflow, at mobile AND desktop widths.
//
// LOCAL-ONLY (like the auth e2e): /design-system is dev-only (getServerSideProps → notFound in
// production), so it can't run against a CI `next start`. Container-primitive INVARIANTS (bg cover,
// safe-area) are proven live by the SCREEN gate (splash → FullBleedScreen); this proves the catalogue.
//   npx tsx harness/run-system.ts    (dev server up on :3000)
import { chromium, type Browser } from 'playwright'
import { capture } from './capture'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const TARGET = `${HOST}/design-system`

const SECTIONS = [
  { id: 'foundation', selector: '[data-testid="design-v3-foundation"]' },
  { id: 'library', selector: '[data-testid="design-v3-library"]' },
  { id: 'containers', selector: '[data-testid="design-container-primitives"]' },
  { id: 'fullbleed', selector: '[data-testid="primitive-fullbleed"]' },
  { id: 'appscreen', selector: '[data-testid="primitive-appscreen"]' },
]

async function checkAt(browser: Browser, w: number, h: number) {
  const cap = await capture({ url: TARGET, browser, viewport: { w, h }, probes: SECTIONS, screenshotPath: `harness/evidence/system-${w}.png` })
  const missing = SECTIONS.filter((s) => !(cap.measurements[s.id]?.length)).map((s) => s.id)
  return { w, missing, overflowX: cap.overflowX, consoleErrors: cap.runtime.consoleErrors }
}

async function main() {
  const browser = await chromium.launch()
  const results = [await checkAt(browser, 393, 852), await checkAt(browser, 1280, 900)]
  await browser.close()

  console.log('\n═══ CP-7 · SYSTEM VERIFY — golden page as source of truth ═══')
  const fails: string[] = []
  for (const r of results) {
    const ok = r.missing.length === 0 && !r.overflowX && r.consoleErrors.length === 0
    console.log(`  ${ok ? '✓' : '✗'} @${r.w}px  sections:${SECTIONS.length - r.missing.length}/${SECTIONS.length}  overflowX:${r.overflowX}  consoleErrors:${r.consoleErrors.length}${r.missing.length ? `  MISSING:[${r.missing.join(',')}]` : ''}`)
    if (r.missing.length) fails.push(`@${r.w}: missing ${r.missing.join(', ')}`)
    if (r.overflowX) fails.push(`@${r.w}: horizontal overflow`)
    if (r.consoleErrors.length) fails.push(`@${r.w}: console errors (${r.consoleErrors.length})`)
  }

  if (fails.length) {
    console.log(`\n🔴 SYSTEM GATE FAILED:\n  - ${fails.join('\n  - ')}`)
    process.exit(1)
  }
  console.log('\n🟢 SYSTEM GATE PASSED — every truth section renders clean at mobile + desktop.\n')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
