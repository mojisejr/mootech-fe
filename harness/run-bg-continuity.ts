// harness/run-bg-continuity.ts — BG-CONTINUITY anchor (slice-2 home · extends pixel-lens A1).
//
// ฟีม's headline requirement: the home BG must be CONTINUOUS through the full scroll — no seam, no
// break. No other lens sees this (it renders fine to console/AST; CLS/computed don't measure a hard
// visual seam). Ground-truth = the rendered image: screenshot the full page, sample the left-margin
// column (pure page-BG, x=6px), and assert there is NO abrupt row-to-row colour jump (a seam).
//   npx tsx harness/run-bg-continuity.ts   (dev server up; HARNESS_HOST/PORT env-overridable)
import { chromium, type Page } from 'playwright'
import { PNG } from 'pngjs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const ROUTE = process.env.HOME_ROUTE ?? '/v2/home-preview'
const VP = { w: 393, h: 852 }
const SEAM_BUDGET = 90 // max allowed adjacent-row colour delta (sum|ΔRGB|, 0..765) in the BG margin

// a hard horizontal BG seam — a full-width band injected mid-page, ABOVE the page bg, in the relative
// page div (so it scrolls in page coords + crosses the sampled left-margin column). The exact "BG แตก" bug.
const SEAM_MUTANT = 'div.min-h-screen::after{content:"";position:absolute;left:0;right:0;top:900px;height:40px;background:#1455a4;z-index:20}'

async function maxSeam(page: Page): Promise<number> {
  const buf = await page.screenshot({ fullPage: true })
  const img = PNG.sync.read(buf)
  const x = 6 * 2 // deviceScaleFactor 2 → left-margin column at CSS x=6
  let max = 0
  for (let y = 1; y < img.height; y++) {
    const i = (img.width * y + x) << 2
    const j = (img.width * (y - 1) + x) << 2
    const d = Math.abs(img.data[i] - img.data[j]) + Math.abs(img.data[i + 1] - img.data[j + 1]) + Math.abs(img.data[i + 2] - img.data[j + 2])
    if (d > max) max = d
  }
  return max
}

async function grab(browser: import('playwright').Browser, injectCss?: string): Promise<number> {
  const ctx = await browser.newContext({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const page = await ctx.newPage()
  await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await page.waitForTimeout(600)
  if (injectCss) await page.addStyleTag({ content: injectCss })
  await page.waitForTimeout(200)
  const m = await maxSeam(page)
  await ctx.close()
  return m
}

async function main() {
  const browser = await chromium.launch()
  const clean = await grab(browser) // neg-control: continuous BG → low seam
  const mutant = await grab(browser, SEAM_MUTANT) // hard band → high seam
  await browser.close()

  const instrumentValid = clean <= SEAM_BUDGET
  const caught = mutant > SEAM_BUDGET

  console.log('\n═══ BG-CONTINUITY anchor (home, full scroll) ═══')
  console.log(`  route ${ROUTE} @${VP.w}  seam budget ${SEAM_BUDGET} (max adjacent-row ΔRGB in the BG margin)`)
  console.log(`  ${instrumentValid ? '✓' : '✗'} neg-control: clean BG max-seam = ${clean}  (continuous → no abrupt jump)`)
  console.log(`  ${caught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-bg-seam (hard band): max-seam = ${mutant}  (> ${SEAM_BUDGET})`)
  const ok = instrumentValid && caught
  console.log(`\n  ${ok ? '🟢 BG-CONTINUITY PASSED' : '🔴 FAILED'} — instrument ${instrumentValid ? 'valid' : 'INVALID'} · teeth ${caught ? 'proven' : 'BLIND'}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
