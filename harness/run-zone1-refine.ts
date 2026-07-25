// harness/run-zone1-refine.ts — Zone-1 REFINE anchor (visual lens · #1/#3/#4 compose).
//
// Three refine invariants that render fine to console/AST but can silently regress the pixels:
//   #3 date  — the score card shows Buddhist-era Thai ("1 มิถุนายน 2569"), NEVER the raw ISO the API
//              returns ("2026-06-01"). A dropped formatter leaks the ISO. Ground-truth = rendered glyphs.
//   #4 divider — the in-card dividers are DASHED per Figma (border-style: dashed), not solid. A dropped
//              `border-dashed` silently falls back to solid. Ground-truth = computed border-style.
//   #4 icon  — the chip markers are check/x-circle SVGs, not ⭐/⚠️ emoji. Ground-truth = the DOM (svg present,
//              no emoji glyphs in the card).
//   #1 long-name — a long name truncates (h1 clips) and never causes horizontal overflow. Ground-truth = geometry.
// npx tsx harness/run-zone1-refine.ts   (dev server up; PORT/HARNESS_HOST env-overridable)
import { chromium, type Browser, type Page } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3002'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const VP = { width: 393, height: 852 }
const LONG_NAME = encodeURIComponent('มิลาวรรณวิไลอลงกรณ์ศรีสุวรรณภูมิ')

// พ.ศ. long-Thai date: "<day> <thai-month> 25xx", and crucially NOT the raw ISO (no "-").
const isThaiBE = (t: string) => /^\d{1,2}\s[ก-๙]+\s25\d\d$/.test(t.trim()) && !t.includes('-')

async function withPage<T>(browser: Browser, query: string, fn: (p: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${HOST}/v2/home-preview?${query}`, { waitUntil: 'domcontentloaded' })
  await p.getByTestId('fortune-date').waitFor()
  await p.waitForTimeout(400)
  const r = await fn(p)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── neg-control: clean good state reads correct across all facets ──
  const clean = await withPage(browser, 'state=good', async (p) => ({
    date: ((await p.getByTestId('fortune-date').textContent()) ?? '').trim(),
    dividerStyle: await p.locator('section').first().locator('hr').first().evaluate((el) => getComputedStyle(el).borderTopStyle),
    svgInCard: await p.locator('section').first().locator('svg').count(), // donut + 2 chip icons = 3
    emojiInCard: /[⭐⚠️]/.test((await p.locator('section').first().textContent()) ?? ''),
  }))
  // long name: h1 truncates + no horizontal overflow
  const longName = await withPage(browser, `state=good&name=${LONG_NAME}`, async (p) => ({
    overflowX: await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    truncated: await p.locator('h1').first().evaluate((el) => el.scrollWidth > el.clientWidth + 1),
  }))

  const dateOk = isThaiBE(clean.date)
  const dividerOk = clean.dividerStyle === 'dashed'
  const iconOk = clean.svgInCard >= 3 && !clean.emojiInCard
  const longOk = !longName.overflowX && longName.truncated

  // ── teeth: each mutant = the exact regression each refine point guards against ──
  const dateCaught = await withPage(browser, 'state=good', async (p) => {
    await p.getByTestId('fortune-date').evaluate((el) => { el.textContent = '2026-06-01' }) // formatter dropped → raw ISO
    return !isThaiBE(((await p.getByTestId('fortune-date').textContent()) ?? '').trim())
  })
  const dividerCaught = await withPage(browser, 'state=good', async (p) => {
    const hr = p.locator('section').first().locator('hr').first()
    await hr.evaluate((el) => { (el as HTMLElement).style.borderTopStyle = 'solid' }) // border-dashed dropped → solid
    return (await hr.evaluate((el) => getComputedStyle(el).borderTopStyle)) !== 'dashed'
  })

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  const teeth = (ok: boolean, s: string) => `  ${ok ? '🦷 CAUGHT' : '✗ BLIND'}  ${s}`
  console.log('\n═══ ZONE-1 REFINE anchor (#1/#3/#4) ═══')
  console.log(`  clean: date="${clean.date}" divider=${clean.dividerStyle} svgInCard=${clean.svgInCard} emoji=${clean.emojiInCard}`)
  console.log(line(dateOk, '#3 date renders พ.ศ. Thai (not raw ISO)'))
  console.log(line(dividerOk, '#4 in-card dividers are DASHED (computed border-style)'))
  console.log(line(iconOk, '#4 chip markers are SVG check/x-circle (no ⭐/⚠️ emoji)'))
  console.log(line(longOk, `#1 long name truncates (${longName.truncated}) + no overflowX (${longName.overflowX})`))
  console.log('  ── teeth ──')
  console.log(teeth(dateCaught, 'mut-date-iso: raw ISO leak → พ.ศ. gate rejects'))
  console.log(teeth(dividerCaught, 'mut-divider-solid: dashed dropped → dashed gate rejects'))

  const ok = dateOk && dividerOk && iconOk && longOk && dateCaught && dividerCaught
  console.log(`\n  ${ok ? '🟢 ZONE-1 REFINE PASSED' : '🔴 FAILED'} — date พ.ศ. + dashed dividers + svg icons + long-name graceful\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
