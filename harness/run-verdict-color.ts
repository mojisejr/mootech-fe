// harness/run-verdict-color.ts — VERDICT→RING-COLOUR anchor (Zone 1 daily-fortune · visual lens).
//
// Invariant: the score ring's colour MUST reflect the fortune verdict — good=green(teal) · neutral=
// yellow · caution=orange — and the three must be VISUALLY DISTINCT. A wired-but-wrong mapping (all
// one colour, or swapped) renders fine to console/AST but lies to the user. Ground-truth = the arc pixel.
//   npx tsx harness/run-verdict-color.ts   (dev server up; PORT/HARNESS_HOST env-overridable)
import { chromium, type Browser } from 'playwright'
import { PNG } from 'pngjs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const VP = { w: 393, h: 852 }

// hue (0–360) of the top-of-arc pixel of the ring, per verdict state.
async function ringHue(browser: Browser, state: string, injectCss?: string): Promise<{ hue: number; sat: number }> {
  const ctx = await browser.newContext({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/home-preview?state=${state}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await page.waitForTimeout(400)
  if (injectCss) { await page.addStyleTag({ content: injectCss }); await page.waitForTimeout(150) }
  const svg = page.locator('section').first().locator('svg').first()
  const buf = await svg.screenshot()
  await ctx.close()
  const img = PNG.sync.read(buf)
  // the arc crosses the TOP-CENTRE of the ring for any pct>0 → sample a few px around it, take the most saturated
  let best = { hue: 0, sat: -1 }
  const cx = (img.width >> 1)
  for (let x = cx - 4; x <= cx + 4; x++) for (let y = 2; y < 14; y++) {
    const i = (img.width * y + x) << 2
    const [r, g, b] = [img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
    const sat = mx === 0 ? 0 : d / mx
    if (sat > best.sat) {
      let h = 0
      if (d !== 0) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4 }
      best = { hue: ((h * 60) + 360) % 360, sat }
    }
  }
  return best
}

const FAMILY = { good: [150, 210], neutral: [40, 90], caution: [10, 45] } as const // teal · yellow · orange hue bands
const inBand = (h: number, [lo, hi]: readonly [number, number]) => h >= lo && h <= hi

async function main() {
  const browser = await chromium.launch()
  const clean: Record<string, number> = {}
  for (const s of ['good', 'neutral', 'caution']) clean[s] = (await ringHue(browser, s)).hue
  // mutant: force every verdict class to one colour (sapphire) → the mapping collapses
  const mutantCss = 'section svg{color:#1455a4 !important}'
  const mut: Record<string, number> = {}
  for (const s of ['good', 'neutral', 'caution']) mut[s] = (await ringHue(browser, s, mutantCss)).hue
  await browser.close()

  const correct = (Object.keys(FAMILY) as (keyof typeof FAMILY)[]).every((s) => inBand(clean[s], FAMILY[s]))
  const distinct = new Set(['good', 'neutral', 'caution'].map((s) => Math.round(clean[s] / 20))).size === 3
  const mutCollapsed = new Set(['good', 'neutral', 'caution'].map((s) => Math.round(mut[s] / 20))).size < 3 // mutant → not 3 distinct

  console.log('\n═══ VERDICT→RING-COLOUR anchor (Zone 1) ═══')
  console.log(`  clean hues: good ${clean.good.toFixed(0)}° · neutral ${clean.neutral.toFixed(0)}° · caution ${clean.caution.toFixed(0)}°`)
  console.log(`  ${correct ? '✓' : '✗'} each verdict in its hue band (good teal · neutral yellow · caution orange)`)
  console.log(`  ${distinct ? '✓' : '✗'} the three verdicts are visually DISTINCT`)
  console.log(`  mutant (force one colour) hues: good ${mut.good.toFixed(0)}° · neutral ${mut.neutral.toFixed(0)}° · caution ${mut.caution.toFixed(0)}°`)
  console.log(`  ${mutCollapsed ? '🦷 CAUGHT' : '✗ BLIND'}  mut-verdict-collapse: verdicts no longer distinct`)

  const ok = correct && distinct && mutCollapsed
  console.log(`\n  ${ok ? '🟢 VERDICT-COLOUR PASSED' : '🔴 FAILED'} — mapping correct+distinct · teeth ${mutCollapsed ? 'proven' : 'BLIND'}\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
