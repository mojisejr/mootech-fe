// harness/run-element-line.ts — GREETING ELEMENT-LINE anchor (contract #2 · visual lens).
//
// Invariant: the "ธาตุของคุณคือ …" line renders the compute honestly across its progressive-enhance
// states, and NEVER paints an orphan "·". Three ground-truths (rendered glyphs, not source):
//   • has band   → "ธาตุของคุณคือ {ธาตุ} · {ดิถี}"  (bullet present)
//   • no band    → "ธาตุของคุณคือ {ธาตุ}"            (bullet DROPPED — progressive-enhance)
//   • blank band → same as no-band                    (whitespace " " is truthy but must NOT leak "· ")
//   • no data    → row HIDDEN                          (no orphan mascot beside empty text)
// The whitespace case is too's "bare-bullet" catch: a naive `strengthLabel ? …` renders "· " for " ".
// goo closes it at the data layer; this anchor is the visual belt + proves the trim-guard has teeth.
//   npx tsx harness/run-element-line.ts   (dev server up; PORT/HARNESS_HOST env-overridable)
import { chromium, type Browser, type Page } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3001'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const VP = { width: 393, height: 852 }

// an orphan bullet = "·" with nothing meaningful after it (the exact bare-bullet bug).
const orphanBullet = (t: string) => /·\s*$/.test(t.trim())

type Read = { present: boolean; text: string }
async function readLine(browser: Browser, el: string, onDom?: (p: Page) => Promise<void>): Promise<Read> {
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/home-preview?el=${el}`, { waitUntil: 'domcontentloaded' })
  await page.locator('header').first().waitFor()
  await page.waitForTimeout(400)
  if (onDom) await onDom(page)
  const line = page.getByTestId('element-line')
  const present = (await line.count()) > 0
  const text = present ? ((await line.textContent()) ?? '').trim() : ''
  await ctx.close()
  return { present, text }
}

async function main() {
  const browser = await chromium.launch()
  const full = await readLine(browser, 'full')
  const partial = await readLine(browser, 'partial')
  const blank = await readLine(browser, 'blankband')
  const none = await readLine(browser, 'none')
  // mut-bare-bullet: inject the bare "· " a naive truthy-check would emit for a whitespace band.
  const injected = await readLine(browser, 'blankband', async (p) => {
    await p.getByTestId('element-line').evaluate((el) => { el.append(' · ') })
  })
  await browser.close()

  const bandShown = full.present && full.text.includes('·') && full.text.includes('ดิถี')
  const bandDropped = partial.present && !partial.text.includes('·')
  const guardHolds = blank.present && !orphanBullet(blank.text) // whitespace band → NO orphan bullet (neg-control)
  const rowHidden = !none.present // settled + no data → element-line absent
  const bareBulletCaught = orphanBullet(injected.text) // the gate must flag the injected orphan "·"

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ GREETING ELEMENT-LINE anchor (contract #2) ═══')
  console.log(`  full="${full.text}" · partial="${partial.text}" · blank="${blank.text}" · none.present=${none.present}`)
  console.log(line(bandShown, 'has-band renders "· {ดิถี}"'))
  console.log(line(bandDropped, 'no-band drops the "·" (progressive-enhance)'))
  console.log(line(guardHolds, 'blank " " band → NO orphan "·" (trim-guard, neg-control)'))
  console.log(line(rowHidden, 'no-data → row HIDDEN (no orphan mascot)'))
  console.log('  ── teeth ──')
  console.log(`  ${bareBulletCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-bare-bullet: injected orphan "·" flagged`)

  const ok = bandShown && bandDropped && guardHolds && rowHidden && bareBulletCaught
  console.log(`\n  ${ok ? '🟢 ELEMENT-LINE PASSED' : '🔴 FAILED'} — progressive-enhance + trim-guard + null-hide proven\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
