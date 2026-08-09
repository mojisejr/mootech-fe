// harness/verify-first-run.ts — design-verify machine leg for the three first-run screens (#215).
//
// The issue makes design-verify the gate INSTEAD of a human reviewer, so this has to answer more
// than "did it render". It answers, per screen per width:
//   • does anything push the page sideways (the 320 killer)
//   • is the bottom of the page REACHABLE — the 05 screen is 1853px at 375, and "ไม่ตัดเนื้อหา"
//     means the last control can actually be scrolled to, not that a tall div exists
//   • does the pager show 3 dots with the right one active
//   • does the PDPA button's RENDERED disabled state match the consent state
//   • are the goal tiles big enough to hit (WCAG 2.5.8, 24px floor; 44 is the comfort target)
//
// ⚠️ Gate-of-record caveat: /design-verify normally rejects a preview route and demands the real
// assembled route. Issue #215 ships no routing on purpose (first-login detection is ใบ 3), so the
// preview page IS the only surface these screens have today. When ใบ 3 mounts them for real, point
// HARNESS_PATH at that route — every check below is route-agnostic.
//
// Every run records its CONDITIONS (host, mode, sha) next to the numbers: a result measured against
// `next dev` and one against `next start` are not interchangeable, and a table that hides which one
// produced it invites exactly that swap.
//
//   npx tsx harness/verify-first-run.ts
//   npx tsx harness/verify-first-run.ts --widths 393 --out harness/out/first-run
//   npx tsx harness/verify-first-run.ts --control clip   # negative control: must FAIL
//   npx tsx harness/verify-first-run.ts --control gate   # negative control: must FAIL
import { chromium, type Page } from 'playwright'
import { execSync } from 'node:child_process'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3011'
const BASE = process.env.HARNESS_PATH ?? '/v2/first-run-preview'

// middleware.ts guardV2 fails CLOSED: with no V2_PREVIEW_KEY, and with no matching `v2_access`
// cookie, every /v2/* URL is REWRITTEN to /maintenance — and a rewrite answers **HTTP 200**. So a
// curl status check says "up" while the browser is looking at "ปิดปรับปรุงชั่วคราว". The first run
// of this harness measured that page for all 20 shots. It went red (0 dots, nothing reachable)
// rather than green, which is the only reason it was caught in seconds — but "red for the wrong
// reason" is still a wrong measurement, so assertServedOurPage() below names the case explicitly.
const V2_KEY = process.env.V2_PREVIEW_KEY ?? ''

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

type Shot = {
  id: string
  query: string
  /** 0-based dot expected to be active. */
  dot: number
  /** undefined = screen has no gated button */
  gateDisabled?: boolean
  tiles?: number
  /** Restrict this shot to a subset of the run's widths. Used by the #233 element sweep — see below. */
  widths?: number[]
  /** Expect the six-facet block to be present (true) / absent (false). undefined = do not check. */
  facets?: boolean
}

const SHOTS: Shot[] = [
  { id: '02-intent', query: '?step=intent&goal=health', dot: 0, tiles: 6 },
  { id: '02-intent-empty', query: '?step=intent&goal=none', dot: 0, tiles: 6 },
  { id: '04-pdpa-unticked', query: '?step=pdpa', dot: 1, gateDisabled: true },
  { id: '04-pdpa-ticked', query: '?step=pdpa&consent=1', dot: 1, gateDisabled: false },
  { id: '05-element', query: '?step=element', dot: 2, facets: true },

  // #233 element sweep. Until this existed, ธาตุไม้ was the ONLY element anyone had ever seen
  // rendered — four of five screens had never been looked at, by anyone, at any width. Being
  // unlooked-at is not the same as being fine, and nothing in the suite would have said so.
  //
  // 393 ONLY, on purpose, and stated rather than quietly capped: what changes between elements is
  // the glyph, its colour, the card artwork and whether the authored-copy blocks appear (#237) —
  // none of which is width-dependent. The width-dependent behaviour of this screen is already
  // measured four ways by `05-element` above. If an element ever gets its own layout, it needs its
  // own full-width row here.
  { id: '05-el-wood-male', query: '?step=element&element=wood&gender=male', dot: 2, widths: [393], facets: true },
  { id: '05-el-wood-female', query: '?step=element&element=wood&gender=female', dot: 2, widths: [393], facets: true },
  { id: '05-el-metal', query: '?step=element&element=metal', dot: 2, widths: [393], facets: false },
  { id: '05-el-fire', query: '?step=element&element=fire', dot: 2, widths: [393], facets: false },
  { id: '05-el-earth', query: '?step=element&element=earth', dot: 2, widths: [393], facets: false },
  { id: '05-el-water', query: '?step=element&element=water', dot: 2, widths: [393], facets: false },
  // the state a real user with no gender lands on — the one the whole seam argument was about
  { id: '05-el-no-cycle', query: '?step=element&element=wood&cycle=none', dot: 2, widths: [393], facets: false },
]

type Row = {
  shot: string
  w: number
  docH: number
  hScroll: boolean
  bottomReachable: boolean
  dots: number
  activeDot: number
  gateDisabled: boolean | null
  facetRows: number
  facetNote: boolean
  tiles: number
  minTap: number
  consoleErrors: number
}

/** Refuse to measure a page that is not the one under test. Dying here beats reporting a table of
 *  numbers that were read off the maintenance rewrite (or a login bounce, or a 404 shell). */
async function assertServedOurPage(page: Page, where: string) {
  const seen = await page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    text: (document.body.textContent ?? '').slice(0, 200),
  }))
  const wrong =
    seen.url !== BASE ||
    seen.text.includes('ปิดปรับปรุงชั่วคราว') ||
    seen.title.includes('ปิดปรับปรุง')
  if (wrong) {
    throw new Error(
      `${where}: the server did not serve ${BASE} — got path "${seen.url}", title "${seen.title}".\n` +
        `If this says ปิดปรับปรุง: V2_PREVIEW_KEY is unset on the SERVER (middleware guardV2 fails\n` +
        `closed and rewrites /v2/* to /maintenance with a 200), or the harness has no matching\n` +
        `v2_access cookie. Start the server with V2_PREVIEW_KEY=<key> and run this with the same one.`,
    )
  }
}

/** Read the page the way a user meets it, from the rendered DOM only. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const doc = document.scrollingElement as HTMLElement
    const dotWrap = document.querySelector('[role="tablist"]')
    const dotEls = dotWrap ? Array.from(dotWrap.children) : []
    // The active dot is not a class we can trust to have been generated — it is the WIDER one.
    // Measuring it means a silently-dropped Tailwind class shows up here instead of passing.
    const widths = dotEls.map((d) => d.getBoundingClientRect().width)
    const activeDot = widths.length ? widths.indexOf(Math.max(...widths)) : -1

    const gate = Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('ยอมรับและดำเนินการต่อ'),
    ) as HTMLButtonElement | undefined

    const tiles = Array.from(document.querySelectorAll('[role="radio"]')) as HTMLElement[]
    const minTap = tiles.length
      ? Math.min(...tiles.map((t) => Math.min(t.getBoundingClientRect().width, t.getBoundingClientRect().height)))
      : -1

    // "not clipped" = the LAST control in the footer is inside the scrollable area, i.e. a user can
    // scroll to it. A tall document alone proves nothing — content can overflow a fixed-height
    // ancestor and be unreachable while scrollHeight still looks healthy.
    const buttons = Array.from(document.querySelectorAll('button'))
    const last = buttons[buttons.length - 1]
    const lastBottom = last ? last.getBoundingClientRect().bottom + window.scrollY : 0

    // The six-facet block, counted from the DOM. Counting ROWS (not "is the <dl> there") is what
    // makes a half-drawn table fail: a five-row render is the silent-drop this screen refuses to do.
    const facetList = document.querySelector('[data-testid="facet-list"]')
    const facetRows = facetList ? facetList.children.length : 0
    const facetNote = document.querySelector('[data-testid="facet-unavailable"]') !== null
    return {
      facetRows,
      facetNote,
      docH: doc.scrollHeight,
      hScroll: doc.scrollWidth > doc.clientWidth + 1,
      bottomReachable: last ? lastBottom <= doc.scrollHeight + 1 : false,
      dots: dotEls.length,
      activeDot,
      gateDisabled: gate ? gate.disabled : null,
      tiles: tiles.length,
      minTap,
    }
  })
}

async function main() {
  const widths = arg('widths', '320,360,393,430').split(',').map(Number)
  const control = arg('control', '')
  const outDir = path.resolve(process.cwd(), arg('out', 'harness/out/first-run'))
  fs.mkdirSync(outDir, { recursive: true })

  let sha = 'unknown'
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    /* not a git checkout — record it as unknown rather than crash the gate */
  }

  const browser = await chromium.launch()
  const rows: Row[] = []
  const failures: string[] = []
  const skipped: string[] = []

  for (const shot of SHOTS) {
    // A shot may pin itself to a subset (the #233 element sweep runs at 393 only). Intersecting
    // rather than overriding keeps `--widths 320` honest: it must not resurrect a width the shot
    // opted out of, and it must not silently run zero shots either — that is reported below.
    const shotWidths = shot.widths ? widths.filter((w) => shot.widths!.includes(w)) : widths
    if (shotWidths.length === 0) {
      skipped.push(`${shot.id} (pinned to ${shot.widths!.join('/')}, none in this run)`)
      continue
    }
    for (const w of shotWidths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 2 })
      if (V2_KEY) {
        const u = new URL(HOST)
        await ctx.addCookies([{ name: 'v2_access', value: V2_KEY, domain: u.hostname, path: '/' }])
      }
      const page = await ctx.newPage()
      let consoleErrors = 0
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors++
      })
      // cold load per shot — navigating between states in-app would hide first-paint problems
      await page.goto(`${HOST}${BASE}${shot.query}`, { waitUntil: 'networkidle' })
      await assertServedOurPage(page, `${shot.id}@${w}`)

      if (control === 'clip') {
        // NEGATIVE CONTROL: plant something wider than the viewport. If hScroll stays false after
        // this, the overflow check is not measuring overflow and none of its greens mean anything.
        await page.evaluate(() => {
          const d = document.createElement('div')
          d.style.cssText = 'width:2000px;height:8px'
          document.body.appendChild(d)
        })
      }
      if (control === 'gate' && shot.gateDisabled === true) {
        // NEGATIVE CONTROL for the gate: force the button enabled while the box is unticked.
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll('button')).find((x) =>
            (x.textContent ?? '').includes('ยอมรับและดำเนินการต่อ'),
          ) as HTMLButtonElement | undefined
          if (b) b.disabled = false
        })
      }

      if (control === 'facets') {
        // NEGATIVE CONTROL for the facet check: rip one row out of the table. If facetRows still
        // reads 6, the check is counting something other than the rows on screen.
        await page.evaluate(() => {
          const l = document.querySelector('[data-testid="facet-list"]')
          if (l && l.firstElementChild) l.removeChild(l.firstElementChild)
        })
      }

      const m = await measure(page)
      rows.push({ shot: shot.id, w, consoleErrors, ...m })

      const where = `${shot.id}@${w}`
      if (m.hScroll) failures.push(`${where}: page scrolls sideways`)
      if (!m.bottomReachable) failures.push(`${where}: last control is not reachable by scrolling`)
      if (m.dots !== 3) failures.push(`${where}: pager shows ${m.dots} dots, expected 3`)
      if (m.activeDot !== shot.dot) failures.push(`${where}: active dot ${m.activeDot}, expected ${shot.dot}`)
      if (shot.gateDisabled !== undefined && m.gateDisabled !== shot.gateDisabled)
        failures.push(`${where}: button disabled=${m.gateDisabled}, expected ${shot.gateDisabled}`)
      if (shot.tiles !== undefined && m.tiles !== shot.tiles)
        failures.push(`${where}: ${m.tiles} goal tiles, expected ${shot.tiles}`)
      if (m.tiles > 0 && m.minTap < 44) failures.push(`${where}: smallest tile ${m.minTap}px < 44`)
      if (shot.facets === true) {
        if (m.facetRows !== 6) failures.push(`${where}: ${m.facetRows} facet rows, expected 6`)
        if (m.facetNote) failures.push(`${where}: facet rows AND the "no data" note are both showing`)
      }
      if (shot.facets === false) {
        // absence has to be asserted as absence AND as a stated reason — a blank space where a
        // block used to be is indistinguishable from a block that failed to render
        if (m.facetRows !== 0) failures.push(`${where}: ${m.facetRows} facet rows, expected none`)
        if (!m.facetNote) failures.push(`${where}: no facet rows and no reason shown either`)
      }
      if (consoleErrors > 0) failures.push(`${where}: ${consoleErrors} console error(s)`)

      await page.screenshot({ path: path.join(outDir, `${shot.id}-${w}.png`), fullPage: true })
      await ctx.close()
    }
  }
  await browser.close()

  if (skipped.length) {
    // Say what was NOT measured. A gate that quietly runs fewer shots than it lists reads as
    // "all green" when it is really "green over whatever happened to run".
    console.log(`\n  skipped ${skipped.length} shot(s) — not measured, not passed:`)
    for (const s of skipped) console.log(`    · ${s}`)
  }

  const conditions = { host: HOST, path: BASE, sha, control: control || 'none', widths, skipped }
  fs.writeFileSync(
    path.join(outDir, 'result.json'),
    JSON.stringify({ conditions, rows, failures }, null, 2),
  )

  console.log(`conditions: ${JSON.stringify(conditions)}`)
  console.table(rows)
  if (failures.length) {
    console.error(`\n${failures.length} FAILURE(S):`)
    for (const f of failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  console.log(`\n✓ ${rows.length} shot×width combinations clean → ${outDir}`)
}

main().catch((e) => {
  // a harness that crashes is worse than one that goes red: make it exit non-zero, loudly.
  console.error(e)
  process.exit(2)
})
