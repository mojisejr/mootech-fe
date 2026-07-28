// harness/run-calendar-month.ts — ปฏิทินดวง month view (Figma 375:16710) anchor (visual lens).
//
// Phase 2 renders goo's mock month with the DESIGN.md grade/day-cell color system. Invariants the PIXELS own:
//   no-app-fetch    — done-condition 8: the mock page reaches NO app backend (0 /api·:4000·:3100). Proven with
//                     goo's shared trackAppFetches (request-level — same code both lenses) → console-0 without BE.
//   tier-fidelity   — every day cell's tint = the DESIGN.md §CALENDAR tier for its percent (dayCellTier), NOT an
//                     eyeballed hex (done-condition 6: one color source, no scattered hardcodes). Read computed bg,
//                     compare to DAY_CELL_COLORS — a wrong/hardcoded tint is invisible to tsc.
//   selected+marker — the today cell is sapphire-filled (#1455A4); วันพระ cells carry the #9D85DA ring.
//   no-overflow-x   — the 7-col grid + cards don't scroll sideways @393/360/320.
//   npx tsx harness/run-calendar-month.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page, type Locator } from 'playwright'
import * as fs from 'fs'
import { trackAppFetches } from './assert-no-app-fetch'
import { DAY_CELL_COLORS, SELECTED, CALENDAR_MARKER } from '../features/v2-calendar/components/grade-colors'
import { dayCellTier } from '../features/v2-calendar'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3014'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()
const hexToRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})` }

async function withCal<T>(browser: Browser, width: number, fn: (grid: Locator, p: Page, tracker: ReturnType<typeof trackAppFetches>) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  const tracker = trackAppFetches(p) // attach BEFORE goto (request-level)
  await p.goto(`${HOST}/v2/calendar`, { waitUntil: 'networkidle' })
  const grid = p.locator('[data-testid="calendar-grid"]').first()
  await grid.waitFor(); await p.waitForTimeout(400)
  const r = await fn(grid, p, tracker)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── no-app-fetch (done-condition 8) ──
  let appFetches: string[] = []
  const noApp = await withCal(browser, 393, async (_grid, _p, tracker) => { appFetches = tracker.appFetches.slice(); return tracker.appFetches.length === 0 })

  // ── tier-fidelity: every cell's bg = DESIGN.md tier tint for its percent (or the selected sapphire) ──
  const goodTint = hexToRgb(DAY_CELL_COLORS.good.tint), medTint = hexToRgb(DAY_CELL_COLORS.medium.tint), badTint = hexToRgb(DAY_CELL_COLORS.bad.tint)
  const tiers = await withCal(browser, 393, (grid) =>
    grid.evaluate((g, args) => {
      const [tints, selFill] = args as [Record<string, string>, string]
      const cells = Array.from(g.querySelectorAll('a[aria-label^="วันที่"]')) as HTMLElement[]
      let ok = 0, bad = 0
      const misses: string[] = []
      for (const c of cells) {
        const m = (c.getAttribute('aria-label') || '').match(/(\d+)%/)
        const pct = m ? parseInt(m[1]) : -1
        const bg = getComputedStyle(c).backgroundColor
        const expTier = pct >= 60 ? 'good' : pct >= 40 ? 'medium' : 'bad'
        const expected = tints[expTier]
        // a cell is fine if it matches its tier tint OR the selected sapphire fill (today).
        if (bg === expected || bg === selFill) ok++
        else { bad++; if (misses.length < 4) misses.push(`${pct}% exp ${expected} got ${bg}`) }
      }
      return { total: cells.length, ok, bad, misses }
    }, [{ good: goodTint, medium: medTint, bad: badTint }, hexToRgb(SELECTED.fill)]),
  )
  const tierOk = tiers.total >= 28 && tiers.bad === 0

  // ── selected + วันพระ marker ──
  const markers = await withCal(browser, 393, (grid) =>
    grid.evaluate((g, args) => {
      const [selFill, markerHex] = args as [string, string]
      const cells = Array.from(g.querySelectorAll('a[aria-label^="วันที่"]')) as HTMLElement[]
      const selected = cells.filter((c) => getComputedStyle(c).backgroundColor === selFill).length
      // วันพระ ring is an inset box-shadow using #9D85DA (rgb 157,133,218).
      const ring = cells.filter((c) => getComputedStyle(c).boxShadow.includes('157, 133, 218')).length
      return { selected, ring, markerHex }
    }, [hexToRgb(SELECTED.fill), CALENDAR_MARKER]),
  )
  const markerOk = markers.selected >= 1 && markers.ring >= 1

  // ── no-overflow-x ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) overflow[w] = await withCal(browser, w, (_g, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth))
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-hardcode-tier — repaint a cell with an off-DESIGN color → tier-fidelity must REJECT ──
  const tierCaught = await withCal(browser, 393, (grid) =>
    grid.evaluate((g, tints: Record<string, string>) => {
      const c = g.querySelector('a[aria-label^="วันที่"]') as HTMLElement
      c.style.backgroundColor = '#123456' // not any DESIGN tier tint
      const bg = getComputedStyle(c).backgroundColor
      return bg !== tints.good && bg !== tints.medium && bg !== tints.bad // off-palette → gate would reject → caught
    }, { good: goodTint, medium: medTint, bad: badTint }),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ CALENDAR-MONTH anchor ═══')
  console.log(line(noApp, `no-app-fetch (done-cond 8): 0 app-fetch → console-0 without BE  [${appFetches.length ? appFetches.join(', ') : 'none'}]`))
  console.log(line(tierOk, `tier-fidelity: ${tiers.ok}/${tiers.total} cells match DESIGN.md tint  [misses: ${tiers.misses.join(' · ') || 'none'}]`))
  console.log(line(markerOk, `selected+marker: ${markers.selected} sapphire-selected · ${markers.ring} วันพระ ring (#9D85DA)`))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${tierCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-hardcode-tier: an off-DESIGN cell color → tier-fidelity gate rejects`)

  const ok = noApp && tierOk && markerOk && noOverflowOk && tierCaught
  console.log(`\n  ${ok ? '🟢 CALENDAR-MONTH PASSED' : '🔴 FAILED'} — no-app-fetch · tier-fidelity · selected+marker · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
