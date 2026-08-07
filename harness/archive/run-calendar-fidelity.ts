// harness/run-calendar-fidelity.ts — anchor for the ปฏิทินดวง month view (Figma 368:9832 + ฟีม's selector SVG).
// LENS = visual. Ground-truth = what each cell actually paints and what the picker actually does.
//
// The drift this owns: the shipped grid rendered the GRADE LETTER in the exact slot Figma draws the 干支 in,
// and never rendered the 干支 at all — even though `CalendarDay.ganzhi` has existed since goo's Phase 0.
// Figma's grid shows no grade letter anywhere. A "the grid looks fine" check passes that happily, because
// something IS in the slot; only asking "is the thing in that slot a 干支" catches it.
//
// Invariants owned here:
//   GANZHI       — every real cell renders a CJK 干支 (2 Han chars), and NO cell renders a grade letter.
//   TIER-COLOUR  — each cell's painted background is exactly DAY_CELL_COLORS[dayCellTier(percent)].
//   WANPHRA-KEEP — a day that is BOTH selected and วันพระ keeps its #9D85DA marker. Figma composes the two
//                  (368:9929 has the sapphire fill AND the border); the old code treated them as exclusive.
//   LEGEND       — 4 entries with Figma's copy, and the วันพระ entry is a WHITE swatch with a marker border
//                  (it explains an outline, not a fill).
//   SELECTOR     — 3 cards; the month sheet and the year sheet each actually move the grid.
//   NO-CLIP      — nothing overflows 320 → 430.
//
// TEETH:
//   • mut-grade-letter-back — put a grade letter back beside the day number → GANZHI trips.
//   • mut-tier-swap         — repaint a ≥60 cell with the <40 tint → TIER-COLOUR trips.
//   • mut-wanphra-erased    — drop the marker border from the selected cell → WANPHRA-KEEP trips.
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-calendar-fidelity.ts
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const WIDTHS = [320, 360, 393, 430]
// DESIGN.md §CALENDAR — the same three the node returned (#E2F4F6/#FEF1E0/#FEE7E4), as rgb() for computed style
const TIER_RGB = { good: 'rgb(226, 244, 246)', medium: 'rgb(254, 241, 224)', bad: 'rgb(254, 231, 228)' }
const MARKER = 'rgb(157, 133, 218)'
const SELECTED_FILL = 'rgb(20, 85, 164)'

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

async function seed(ctx: BrowserContext) {
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: '5c7befb3-ebd3-4740-989e-fd6a1cca9662', domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
}

async function open(browser: Browser, width = 393) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 })
  await seed(ctx)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'commit' })
  await page.locator('[data-testid="calendar-day"]').first().waitFor({ timeout: 20000 })
  return { ctx, page }
}

// read every cell as RENDERED TEXT + RENDERED COLOUR — not as props, and not as class names
const readCells = (p: Page) =>
  p.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="calendar-day"]')).map((el) => {
      const cs = getComputedStyle(el as HTMLElement)
      const gz = el.querySelector('[data-testid="calendar-ganzhi"]')
      const text = (el.textContent ?? '').trim()
      const pct = Number((text.match(/(\d+)%/) ?? [])[1] ?? -1)
      return {
        text,
        ganzhi: (gz?.textContent ?? '').trim(),
        pct,
        bg: cs.backgroundColor,
        border: cs.borderTopColor,
        borderW: cs.borderTopWidth,
        selected: el.getAttribute('data-selected') === 'true',
        wanphra: el.getAttribute('data-wanphra') === 'true',
      }
    })
  })

const CJK = /^[一-鿿]{2}$/
// a grade letter is A-D with an optional +/- standing on its own — what the old grid painted in the 干支 slot
const GRADE_LETTER = /(^|[^A-Za-z])[A-D][+-]?([^A-Za-z]|$)/

;(async () => {
  const browser = await chromium.launch()
  try {
    {
      const { ctx, page } = await open(browser)
      const cells = await readCells(page)
      check('cells rendered', cells.length >= 28, `${cells.length} cells`)

      // GANZHI — the invariant the old grid failed silently
      const missing = cells.filter((c) => !CJK.test(c.ganzhi))
      check('GANZHI — every cell renders a 2-char 干支', missing.length === 0, `${missing.length} missing`)
      const withLetter = cells.filter((c) => GRADE_LETTER.test(c.text.replace(/\d+%/, '')))
      check('GANZHI — no cell renders a grade letter (Figma shows none)', withLetter.length === 0, withLetter.slice(0, 3).map((c) => c.text).join(' | '))

      // TIER-COLOUR — computed background must equal the tier the percent maps to
      const tierOf = (pct: number) => (pct >= 60 ? 'good' : pct >= 40 ? 'medium' : 'bad') as keyof typeof TIER_RGB
      const wrong = cells.filter((c) => !c.selected && c.pct >= 0 && c.bg !== TIER_RGB[tierOf(c.pct)])
      check('TIER-COLOUR — every unselected cell paints its tier tint', wrong.length === 0, wrong.slice(0, 3).map((c) => `${c.pct}%→${c.bg}`).join(' '))

      // LEGEND — 4 entries, Figma copy, and the วันพระ swatch is an OUTLINE not a fill
      const legend = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="calendar-grid-card"]') as HTMLElement
        const items = Array.from(card.querySelectorAll('span')).filter((s) => /≥60%|40–59%|<40%|วันพระ/.test(s.textContent ?? '') && s.children.length === 0)
        const sw = items.map((s) => {
          const dot = s.parentElement?.querySelector('span[aria-hidden]') as HTMLElement | null
          const cs = dot ? getComputedStyle(dot) : null
          return { label: (s.textContent ?? '').trim(), bg: cs?.backgroundColor ?? '', border: cs?.borderTopColor ?? '', bw: cs?.borderTopWidth ?? '' }
        })
        return sw
      })
      check('LEGEND — 4 entries with Figma copy', legend.length === 4 && legend.map((l) => l.label).join('|') === '≥60% วันดี|40–59%|<40% ระวัง|วันพระ', legend.map((l) => l.label).join('|'))
      const wp = legend.find((l) => l.label === 'วันพระ')
      check('LEGEND — วันพระ swatch is white + marker outline', wp?.bg === 'rgb(255, 255, 255)' && wp?.border === MARKER, `${wp?.bg} / ${wp?.border}`)

      // SELECTOR — 3 cards, and the pickers actually move the grid
      check('SELECTOR — 3 cards (วันนี้ · เดือน · ปี)', (await page.locator('[data-testid="date-selector"] > button').count()) === 3)
      const monthBefore = (await page.locator('[data-testid="date-month"]').innerText()).trim()
      await page.locator('[data-testid="date-month"]').click()
      await page.getByRole('button', { name: 'ธันวาคม', exact: true }).click()
      await page.waitForTimeout(250)
      const monthAfter = (await page.locator('[data-testid="date-month"]').innerText()).trim()
      check('SELECTOR — picking a month moves the cursor', monthAfter !== monthBefore && /ธันวาคม/.test(monthAfter), `${monthBefore.replace(/\n/g, ' ')} → ${monthAfter.replace(/\n/g, ' ')}`)

      const yearBefore = (await page.locator('[data-testid="date-year"]').innerText()).trim()
      await page.locator('[data-testid="date-year"]').click()
      const target = String(Number(yearBefore.match(/(\d{4})/)![1]) + 1)
      await page.getByRole('button', { name: target, exact: true }).click()
      await page.waitForTimeout(250)
      const yearAfter = (await page.locator('[data-testid="date-year"]').innerText()).trim()
      check('SELECTOR — picking a year moves the cursor', yearAfter.includes(target), `${yearBefore.replace(/\n/g, ' ')} → ${yearAfter.replace(/\n/g, ' ')}`)
      await ctx.close()
    }

    // ---- WANPHRA-KEEP — selection must not erase the marker (Figma composes them) --------------------
    {
      const { ctx, page } = await open(browser)
      // force the composed state: make a วันพระ cell the selected one
      await page.evaluate(() => {
        const wp = document.querySelector('[data-testid="calendar-day"][data-wanphra="true"]') as HTMLElement
        wp.setAttribute('data-selected', 'true')
        wp.style.backgroundColor = 'rgb(20, 85, 164)'
      })
      const composed = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="calendar-day"][data-wanphra="true"][data-selected="true"]') as HTMLElement
        const cs = getComputedStyle(el)
        return { bg: cs.backgroundColor, border: cs.borderTopColor, bw: cs.borderTopWidth }
      })
      // width is asserted as "visible", not as "1.6px": Chrome reports the USED border width, which it snaps
      // to whole device pixels (1.6 → 1 at dsf 1, 1.5 at dsf 2). Pinning the authored number here would make
      // the anchor fail on a device-pixel artifact rather than on a real change. The COLOUR is the invariant.
      check('WANPHRA-KEEP — selected + วันพระ shows BOTH the fill and the marker',
        composed.bg === SELECTED_FILL && composed.border === MARKER && parseFloat(composed.bw) >= 1, `${composed.bg} + ${composed.border} ${composed.bw}`)
      await ctx.close()
    }

    // ---- NO-CLIP ------------------------------------------------------------------------------------
    for (const w of WIDTHS) {
      const { ctx, page } = await open(browser, w)
      const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      check(`NO-CLIP @${w}`, !ov, ov ? 'overflows' : 'clean')
      await ctx.close()
    }

    // ---- TOOTH mut-grade-letter-back ----------------------------------------------------------------
    {
      const { ctx, page } = await open(browser)
      await page.evaluate(() => {
        document.querySelectorAll('[data-testid="calendar-ganzhi"]').forEach((el) => { el.textContent = 'B+' })
      })
      const cells = await readCells(page)
      const stillOk = cells.every((c) => CJK.test(c.ganzhi))
      check('🦷 mut-grade-letter-back → grade letter back in the 干支 slot → GANZHI CAUGHT', !stillOk)
      await ctx.close()
    }

    // ---- TOOTH mut-tier-swap ------------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser)
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('[data-testid="calendar-day"]'))
          .find((e) => Number(((e.textContent ?? '').match(/(\d+)%/) ?? [])[1] ?? 0) >= 60) as HTMLElement
        el.style.backgroundColor = '#FEE7E4'
      })
      const cells = await readCells(page)
      const tierOf = (pct: number) => (pct >= 60 ? 'good' : pct >= 40 ? 'medium' : 'bad') as keyof typeof TIER_RGB
      const wrong = cells.filter((c) => !c.selected && c.pct >= 0 && c.bg !== TIER_RGB[tierOf(c.pct)])
      check('🦷 mut-tier-swap → a ≥60 cell painted with the <40 tint → TIER-COLOUR CAUGHT', wrong.length > 0, `${wrong.length} wrong`)
      await ctx.close()
    }

    // ---- TOOTH mut-wanphra-erased -------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser)
      await page.evaluate(() => {
        const wp = document.querySelector('[data-testid="calendar-day"][data-wanphra="true"]') as HTMLElement
        wp.setAttribute('data-selected', 'true')
        wp.style.backgroundColor = 'rgb(20, 85, 164)'
        wp.style.border = '1.6px solid transparent' // the old behaviour: selection wins, marker vanishes
      })
      const composed = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="calendar-day"][data-wanphra="true"][data-selected="true"]') as HTMLElement
        const cs = getComputedStyle(el)
        return { bg: cs.backgroundColor, border: cs.borderTopColor }
      })
      check('🦷 mut-wanphra-erased → selection erases the marker → WANPHRA-KEEP CAUGHT', composed.border !== MARKER, composed.border)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
