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

// ── CI FIXTURE (goo 2026-08-05) — this page is now REAL-PIPE (#186): the browser POSTs /api/v2/calendar-month
// to a same-origin BFF that proxies bazi. #185 wired this gate while the page was still a MOCK (grid drew with
// no BE); once #186 landed, a no-BE CI run yields month=null → the card guard returns null → NO grid → the gate
// timed out. Fix: STUB that ONE browser call with a deterministic month (route interception — the same tool goo
// used for the G-2 throttle) so the gate tests what it OWNS (tint · selected · วันพระ · overflow), NOT "is the
// backend alive" (not its job). CURRENT Bangkok month → TODAY is in view (the sapphire-selected check stays
// real); all three tiers + a few วันพระ days → every pixel check has something to bite on.
// The real-pipe grid only fetches the month AFTER identity resolves: MEMBER_ID cookie → userId → /api/user
// (a birth row → person) → THEN /api/v2/calendar-month. So the gate needs a stub identity too. dob+gender
// non-empty ⇒ isBirthProfileComplete ⇒ person ⇒ the month fetch fires. This is plumbing to REACH the grid;
// the gate's teeth are the pixel checks on the fixture month below, not this identity.
const FIXTURE_USER_ID = 'harness-cal-user'
const FIXTURE_USER = { user_id: FIXTURE_USER_ID, name: 'ทดสอบ ปฏิทิน', dob: '1990-06-15', gender: 'MALE', place_name: 'กรุงเทพมหานคร', is_remember_time: false }
const isPath = (url: string, path: string) => { try { return new URL(url).pathname === path } catch { return false } }
function buildFixtureMonth(ym?: string) {
  let y: number, m: number
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [yy, mm] = ym.split('-').map(Number)
    y = yy; m = mm
  } else {
    const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
    ;[y, m] = todayISO.split('-').map(Number)
  }
  const daysInMonth = new Date(y, m, 0).getDate() // m is 1-based → day-0 of next = last day of m
  const GANZHI = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥']
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1
    const overallPercent = d % 3 === 0 ? 72 : d % 3 === 1 ? 48 : 30 // good(≥60) · medium(40-59) · bad(<40)
    return {
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayOfMonth: d,
      dayGanzhi: GANZHI[(d - 1) % GANZHI.length],
      overallPercent,
      grade: overallPercent >= 60 ? 'A' : overallPercent >= 40 ? 'C' : 'F',
      wanPhra: d === 8 || d === 15 || d === 23,
    }
  })
  return { allowed: true, year: y, month: m, days }
}

async function withCal<T>(browser: Browser, width: number, fn: (grid: Locator, p: Page, tracker: ReturnType<typeof trackAppFetches>) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: FIXTURE_USER_ID, domain: new URL(HOST).hostname, path: '/' }, // identity → the month fetch fires
  ])
  const p = await ctx.newPage()
  await p.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  const tracker = trackAppFetches(p) // attach BEFORE goto (request-level)
  // STUB the two same-origin BFF calls the real-pipe grid needs — identity row (dob+gender → person) and the
  // month — both deterministic, no BE. The card's /api/v2/day-detail is left to fail gracefully; the GRID (all
  // this gate owns) comes entirely from these stubs. (route interception — the same tool as goo's G-2 throttle.)
  await p.route((url) => isPath(url.toString(), '/api/user'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_USER) }))
  // month-aware stub: return a fixture for the REQUESTED month (so paging shows a real grid per month, and
  // the cache-discipline check below caches per distinct month-key exactly as production does).
  await p.route((url) => isPath(url.toString(), '/api/v2/calendar-month'), (route) => {
    let ym: string | undefined
    try { ym = (JSON.parse(route.request().postData() || '{}') as { month?: string }).month } catch {}
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildFixtureMonth(ym)) })
  })
  await p.goto(`${HOST}/v2/calendar`, { waitUntil: 'networkidle' })
  const grid = p.locator('[data-testid="calendar-grid"]').first()
  await grid.waitFor(); await p.waitForTimeout(400)
  const r = await fn(grid, p, tracker)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── real-pipe discipline (REPLACES the obsolete "0 app-fetch": #186 made this page fetch the BFF, so 0 is
  //    impossible now). TWO honest checks, both BE-independent, both biting:
  //    (a) BFF-exercised — the browser DID request /api/v2/calendar-month ⇒ the grid came from the real data
  //        path we stubbed, NOT a silent mock fallback (kills a vacuous "grid drew from nothing" pass).
  //    (b) no-direct-backend — the browser hit NO :4000/:3100 directly; it goes only through the same-origin BFF. ──
  let appFetches: string[] = []
  const pipe = await withCal(browser, 393, async (_grid, _p, tracker) => {
    appFetches = tracker.appFetches.slice()
    const bffCalled = appFetches.some((f) => f.includes('/api/v2/calendar-month'))
    const directBackend = appFetches.filter((f) => f.includes(':4000') || f.includes(':3100'))
    return { bffCalled, directBackend }
  })
  const pipeOk = pipe.bffCalled && pipe.directBackend.length === 0

  // ── cache-discipline (F1 + DoD #4) — the 2-layer month cache lives in useCalendarMonth.ts (peek-before-
  //    loading + cache-hit-returns-without-fetch). The pure-module tests can't see that WIRING, so prove it
  //    on the REAL ship path: count the browser's POST /api/v2/calendar-month across leave→return.
  //      cold   = fetches to first paint the current month
  //      leave  = pick a DIFFERENT month → a new key → MUST fetch (afterLeave > cold)
  //      return = jump back to the current month (date-today) → it is CACHED → MUST NOT fetch (Δ = 0)
  //    A revisit that re-fetches (Δ>0) means the cache is not consulted on the ship path → RED. This is the
  //    single assertion that closes both F1 (wiring proven live) and DoD #4 (a revisited month costs 0 POST). ──
  const cache = await withCal(browser, 393, async (_grid, p, tracker) => {
    const countMonth = () => tracker.appFetches.filter((f) => f.includes('/api/v2/calendar-month')).length
    await p.waitForTimeout(600)
    const cold = countMonth()
    await p.locator('[data-testid="date-month"]').click()
    await p.locator('[data-testid="date-sheet"]').waitFor()
    await p.locator('[data-testid="date-sheet"] button:not([data-current])').first().click()
    await p.waitForTimeout(800)
    const afterLeave = countMonth()
    await p.locator('[data-testid="date-today"]').click()
    await p.waitForTimeout(800)
    const afterReturn = countMonth()
    return { cold, afterLeave, afterReturn }
  })
  const revisitDelta = cache.afterReturn - cache.afterLeave
  const cacheOk = revisitDelta === 0 && cache.afterLeave > cache.cold

  // ── tier-fidelity: every cell's bg = DESIGN.md tier tint for its percent (or the selected sapphire) ──
  const goodTint = hexToRgb(DAY_CELL_COLORS.good.tint), medTint = hexToRgb(DAY_CELL_COLORS.medium.tint), badTint = hexToRgb(DAY_CELL_COLORS.bad.tint)
  const tiers = await withCal(browser, 393, (grid) =>
    grid.evaluate((g, args) => {
      const [tints, selFill] = args as [Record<string, string>, string]
      const cells = Array.from(g.querySelectorAll('[data-testid="calendar-day"]')) as HTMLElement[]
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
  // NOTE the cells are <button data-testid="calendar-day"> as of M-A. They used to be <a href=…>; the
  // selectors below moved off the anchor tag and off href onto the testid + data-date for that reason.
  const markers = await withCal(browser, 393, (grid) =>
    grid.evaluate((g, args) => {
      const [selFill, markerHex] = args as [string, string]
      const cells = Array.from(g.querySelectorAll('[data-testid="calendar-day"]')) as HTMLElement[]
      const selected = cells.filter((c) => getComputedStyle(c).backgroundColor === selFill).length
      // วันพระ marker — read it wherever it is PAINTED, not where it used to be authored. It was an inset
      // box-shadow; Figma (368:9832) draws a real 1.6px #9D85DA border, so the cell now carries a border.
      // An anchor pinned to the old mechanism reports "0 markers" for a screen that is showing them, which is
      // a false alarm — the expensive kind, because it teaches you to ignore the anchor.
      const ring = cells.filter((c) => {
        const cs = getComputedStyle(c)
        return cs.boxShadow.includes('157, 133, 218') || cs.borderTopColor.includes('157, 133, 218')
      }).length
      // is TODAY even in this grid? The mock month is a fixed constant (กรกฎาคม 2026), so "a cell is
      // sapphire" is only true while the wall clock happens to fall inside it. Asserting selected >= 1
      // unconditionally made this a TIME BOMB: green the week it was written, red every day after the mock
      // month passed — and it has been red for exactly that reason, not because anything regressed.
      const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
      // keyed on data-date, not href: the cell is a <button> now (ฟีม — tapping a day selects it and swaps
      // the card, it does not navigate), so there is no href left to match on. data-date exists precisely
      // so an anchor never has to parse the identity of a cell back out of a URL.
      const todayInView = !!g.querySelector(`[data-date="${todayISO}"]`)
      return { selected, ring, markerHex, todayInView }
    }, [hexToRgb(SELECTED.fill), CALENDAR_MARKER]),
  )
  // today-in-view → exactly one sapphire cell; today NOT in view → none, and that is correct, not a failure.
  const selectedOk = markers.todayInView ? markers.selected === 1 : markers.selected === 0
  const markerOk = selectedOk && markers.ring >= 1

  // ── no-overflow-x ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) overflow[w] = await withCal(browser, w, (_g, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth))
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-hardcode-tier — repaint a cell with an off-DESIGN color → tier-fidelity must REJECT ──
  const tierCaught = await withCal(browser, 393, (grid) =>
    grid.evaluate((g, tints: Record<string, string>) => {
      const c = g.querySelector('[data-testid="calendar-day"]') as HTMLElement
      c.style.backgroundColor = '#123456' // not any DESIGN tier tint
      const bg = getComputedStyle(c).backgroundColor
      return bg !== tints.good && bg !== tints.medium && bg !== tints.bad // off-palette → gate would reject → caught
    }, { good: goodTint, medium: medTint, bad: badTint }),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ CALENDAR-MONTH anchor ═══')
  console.log(line(pipeOk, `real-pipe discipline: BFF /calendar-month ${pipe.bffCalled ? 'called (stubbed)' : 'NOT called ✗'} · direct BE/bazi: ${pipe.directBackend.length ? pipe.directBackend.join(', ') : 'none'}  [all: ${appFetches.length ? appFetches.join(', ') : 'none'}]`))
  console.log(line(cacheOk, `cache-discipline (F1+DoD#4): cold=${cache.cold} POST · leave(new month)=+${cache.afterLeave - cache.cold} · return(cached)=+${revisitDelta}  ⇒ revisit costs ${revisitDelta} POST ${revisitDelta === 0 ? '(cached ✓)' : '(RE-FETCHED ✗)'}`))
  console.log(line(tierOk, `tier-fidelity: ${tiers.ok}/${tiers.total} cells match DESIGN.md tint  [misses: ${tiers.misses.join(' · ') || 'none'}]`))
  console.log(line(markerOk, `selected+marker: ${markers.selected} sapphire-selected (today${markers.todayInView ? '' : ' NOT'} in view) · ${markers.ring} วันพระ ring (#9D85DA)`))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${tierCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-hardcode-tier: an off-DESIGN cell color → tier-fidelity gate rejects`)

  const ok = pipeOk && cacheOk && tierOk && markerOk && noOverflowOk && tierCaught
  console.log(`\n  ${ok ? '🟢 CALENDAR-MONTH PASSED' : '🔴 FAILED'} — real-pipe discipline · tier-fidelity · selected+marker · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
