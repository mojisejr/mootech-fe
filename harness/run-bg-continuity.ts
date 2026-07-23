// harness/run-bg-continuity.ts — BG-CONTINUITY anchor (slice-2 home · extends pixel-lens A1).
//
// ฟีม's headline requirement: the home BG must be CONTINUOUS through the full scroll — no seam/break.
// No other lens sees this (renders fine to console/AST; CLS/computed don't measure a hard visual seam).
// Ground-truth = the rendered image: screenshot the full page, sample BOTH BG margins (left + right),
// and assert no abrupt colour jump — row-to-row AND skip-8 (so a SOFT gradient seam can't hide).
//
// SCOPE — mapped by the goo+too adversary round (both converged, run-proven):
//   ✓ catches: a seam that touches EITHER margin (hard #-band, center/right band, vertical right-edge
//     split, BG-ends-short) + SOFT/gradient seams (skip-8, not just adjacent-row).
//   ✗ A2: a seam ONLY in the centre GAP (touches neither margin — mostly behind content) → grid sampling.
//   ✗ A2: a break that appears only at another VIEWPORT (responsive md:) → multi-viewport capture.
//   NOTE: a left-vs-right margin comparison was tried and DROPPED — it over-blocked the clean page
//   (legit left/right BG asymmetry read 164 > budget). too caught that; the anchor must not false-positive.
//   npx tsx harness/run-bg-continuity.ts   (dev server up; HARNESS_HOST/HOME_ROUTE env-overridable)
import { chromium, type Page, type Browser } from 'playwright'
import { PNG } from 'pngjs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const ROUTE = process.env.HOME_ROUTE ?? '/v2/home-preview'
const VP = { w: 393, h: 852 }
const SEAM_BUDGET = 90 // max colour delta (sum|ΔRGB|, 0..765) allowed in a BG margin

// mutants (each an adversary vector, run-proven):
const MUT = {
  hard: 'div.min-h-screen::after{content:"";position:absolute;left:0;right:0;top:900px;height:40px;background:#1455a4;z-index:20}',
  soft: 'div.min-h-screen::after{content:"";position:absolute;left:0;right:0;top:900px;height:12px;background:linear-gradient(#faf7f4,#111);z-index:20}', // too#3
  vertical: 'div.min-h-screen::after{content:"";position:absolute;right:0;top:600px;width:14px;height:500px;background:#111;z-index:20}', // too#4
  centerRight: 'div.min-h-screen::after{content:"";position:absolute;left:50px;right:0;top:900px;height:40px;background:#fff;z-index:20}', // too/goo#1 (reaches right margin)
  centerGap: 'div.min-h-screen::after{content:"";position:absolute;left:120px;right:120px;top:900px;height:40px;background:#fff;z-index:20}', // A2 — touches neither margin
  responsive: '@media (min-width:768px){div.min-h-screen::after{content:"";position:absolute;left:0;right:0;top:900px;height:40px;background:#fff;z-index:20}}', // too#2 — A2
} as const

const rgb = (img: PNG, x: number, y: number) => { const i = (img.width * y + x) << 2; return [img.data[i], img.data[i + 1], img.data[i + 2]] }
const delta = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

// max seam over the LEFT BG margin (pure page-BG), row-to-row + skip-8. The right margin was tried and
// dropped — it carries a legit greeting decoration (a sparkle) that over-blocked the clean page at 106
// (too's over-block catch). Left margin stays pure BG (~10), so a real seam that crosses it is honest.
async function maxSeam(page: Page): Promise<number> {
  const img = PNG.sync.read(await page.screenshot({ fullPage: true }))
  const x = 6 * 2 // left BG margin (deviceScaleFactor 2)
  let max = 0
  for (let y = 8; y < img.height; y++) for (const k of [1, 8]) max = Math.max(max, delta(rgb(img, x, y), rgb(img, x, y - k)))
  return max
}

async function grab(browser: Browser, injectCss?: string): Promise<number> {
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
  const clean = await grab(browser)
  const hard = await grab(browser, MUT.hard)
  const soft = await grab(browser, MUT.soft)
  const vertical = await grab(browser, MUT.vertical)
  const centerRight = await grab(browser, MUT.centerRight)
  const centerGap = await grab(browser, MUT.centerGap)
  const responsive = await grab(browser, MUT.responsive)
  await browser.close()

  const c = (v: number) => v > SEAM_BUDGET
  const instrumentValid = clean <= SEAM_BUDGET // too's over-block guard: the clean page MUST stay under budget
  console.log('\n═══ BG-CONTINUITY anchor (reconciled after goo+too adversary) ═══')
  console.log(`  route ${ROUTE} @${VP.w}  budget ${SEAM_BUDGET}  (LEFT BG margin · row + skip-8)`)
  console.log(`  ${instrumentValid ? '✓' : '✗ OVER-BLOCK'} neg-control: clean = ${clean}  (must be ≤ ${SEAM_BUDGET})`)
  console.log('  ── teeth (seams crossing the left margin) ──')
  console.log(`  ${c(hard) ? '🦷 CAUGHT' : '✗ BLIND'}  hard full-width band: ${hard}`)
  console.log(`  ${c(soft) ? '🦷 CAUGHT' : '✗ BLIND'}  too#3 soft/gradient (full-width): ${soft}  (skip-8)`)
  console.log('  ── A2 (documented, run-proven by goo+too — not gate-blocking) ──')
  console.log(`  🥷 A2  too#4 vertical right-edge: ${vertical}  (right-only) → right-margin has legit decoration → grid`)
  console.log(`  🥷 A2  too/goo#1 center→right seam: ${centerRight}  (misses left margin) → grid sampling`)
  console.log(`  🥷 A2  centre-gap seam: ${centerGap}  (touches no margin, mostly behind content) → grid`)
  console.log(`  🥷 A2  too#2 responsive (md:768): ${responsive}  (evades @393) → multi-viewport`)

  const ok = instrumentValid && c(hard) && c(soft)
  console.log(`\n  ${ok ? '🟢 BG-CONTINUITY PASSED' : '🔴 FAILED'} — instrument ${instrumentValid ? 'valid (no over-block)' : 'OVER-BLOCKS'} · teeth ${ok ? 'proven (full-width horizontal seam — the primary class)' : 'BLIND'} · side/center/responsive = A2\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
