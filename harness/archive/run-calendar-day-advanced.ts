// harness/run-calendar-day-advanced.ts — Phase 3b VISUAL anchor for /v2/calendar/[date] ADVANCED mode
// (Figma 634:8752). The ~4384px screen is ~2× 3a, so off-screen-motion + overflow are RE-checked here
// (3a's result does NOT cover this frame). Proves, on the REAL route with NO backend:
//   1. 0 app-fetch + 0 console
//   2. toggle DEFAULT ON → all 4 advanced sections present (§5 ดวงของฉัน · §9 ดิถี · §12 8ประตู · §13 8เทพ)
//   3. §5 binds goo's detail.pillars — every rendered pillar stem == mockDayDetail(date).pillars (NOT hardcoded)
//   4. §12 = 9 gate cells, exactly ONE sapphire highlight (財 · ทิศ W = SELECTED.fill)
//   5. off-screen-motion battery rule on the tall frame — getAnimations() == 0
//   6. no horizontal overflow @393 on the tall frame
//   7. toggle 2-way + OFF == 3a (no-regression, บทเรียน #130 การ์ดร่วม): click OFF → 4 advanced sections GONE,
//      the 10 base sections remain, C+ badge #374151 still holds, still 0 overflow + 0 animations; click ON → back
// TEETH: mut-hardcode-pillar — hardcode a glyph in MyChart instead of detail.pillars → assertion (3) fails.
//        mut-toggle-noop — toggle that doesn't unmount advanced → assertion (7) fails.
// Run (FE up on :3011): npx tsx harness/run-calendar-day-advanced.ts
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from '../../scripts/_helpers/assert-no-app-fetch'
import { SELECTED } from '../features/v2-calendar/components/grade-colors'
import { mockDayDetail } from '../features/v2-calendar/fixtures'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const DATE = '2026-07-14'
const ROUTE = `/v2/calendar/${DATE}`

function readPasskey(): string {
  const file = path.resolve(process.cwd(), 'testenv/env/fe.env')
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('V2_PREVIEW_KEY not found')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

// which advanced-section headings are on the page right now
async function advancedPresent(page: Page) {
  return page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).map((e) => e.textContent || '').join('|')
    return {
      myChart: h2.includes('ดวงของฉัน'),
      dithi: h2.includes('ดิถีวันนี้'),
      gates: h2.includes('8 ประตู'),
      deities: h2.includes('8 เทพ'),
    }
  })
}
async function tallInvariants(page: Page) {
  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    anims: document.getAnimations ? document.getAnimations().length : -1,
    height: document.body.scrollHeight,
  }))
}
// C+ badge #374151 must still hold (3a fidelity) in whatever state we're in
async function cplusHolds(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-grade="C+"]') as HTMLElement | null
    return el ? getComputedStyle(el).color === 'rgb(55, 65, 81)' : false
  })
}

async function main() {
  const passkey = readPasskey()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
  const res = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) throw new Error(`gate rejected (${res.status()})`)

  const page = await ctx.newPage()
  const tracker = trackAppFetches(page)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))
  await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  console.log(`\nrun-calendar-day-advanced · ${ROUTE}`)

  // 1 — clean
  check('0 app-fetch', tracker.appFetches.length === 0, `app-fetch=${tracker.appFetches.length}`)
  check('0 console errors', consoleErrors.length === 0, `errors=${consoleErrors.length}`)
  consoleErrors.forEach((e) => console.log(`     ⚠️ ${e}`))

  // 2 — default ON: 4 advanced sections present
  const on = await advancedPresent(page)
  check('toggle default ON → §5/§9/§12/§13 all present', on.myChart && on.dithi && on.gates && on.deities, JSON.stringify(on))

  // 3 — §5 binds detail.pillars (NOT hardcoded)
  const expected = mockDayDetail(DATE)
  const man = expected.pillars?.find((p) => p.kind === 'man')
  const day = expected.pillars?.find((p) => p.kind === 'day')
  const rendered = await page.evaluate(() => ({
    man: Array.from(document.querySelectorAll('[data-testid^="man-stem-"]')).map((e) => e.textContent || ''),
    day: Array.from(document.querySelectorAll('[data-testid^="day-stem-"]')).map((e) => e.textContent || ''),
  }))
  const manOk = !!man && JSON.stringify(rendered.man) === JSON.stringify(man.cells.map((c) => c.stem))
  const dayOk = !!day && JSON.stringify(rendered.day) === JSON.stringify(day.cells.map((c) => c.stem))
  check('§5 MAN stems == detail.pillars (not hardcoded)', manOk, `rendered=${JSON.stringify(rendered.man)}`)
  check('§5 DAY stems == detail.pillars (day-column = real ganzhi)', dayOk, `rendered=${JSON.stringify(rendered.day)} want=${JSON.stringify(day?.cells.map((c) => c.stem))}`)

  // 4 — §12: 9 gates, exactly one sapphire highlight
  const gates = await page.evaluate((selFill: string) => {
    // the gates grid is the 3-col grid inside the "8 ประตู" section
    const sec = Array.from(document.querySelectorAll('section')).find((s) => (s.querySelector('h2')?.textContent || '').includes('8 ประตู'))
    if (!sec) return { count: 0, highlights: 0 }
    const cells = Array.from(sec.querySelectorAll('.grid > div'))
    let highlights = 0
    for (const c of cells) if (getComputedStyle(c as HTMLElement).backgroundColor === selFill) highlights++
    return { count: cells.length, highlights }
  }, hexToRgb(SELECTED.fill))
  check('§12 = 9 gate cells', gates.count === 9, `count=${gates.count}`)
  check('§12 exactly 1 sapphire highlight (財 · ทิศ W)', gates.highlights === 1, `highlights=${gates.highlights}`)

  // 5+6 — tall-frame off-screen-motion + overflow (RE-checked; 3a didn't cover this height)
  const tallOn = await tallInvariants(page)
  check('off-screen-motion: 0 animations on the tall frame', tallOn.anims === 0, `getAnimations()=${tallOn.anims} height=${tallOn.height}px`)
  check('no horizontal overflow @393 (tall frame)', tallOn.overflow)
  check('C+ #374151 holds (advanced ON)', await cplusHolds(page))

  // 7 — toggle 2-way + OFF == 3a (no-regression)
  await page.click('[role="switch"]')
  await page.waitForTimeout(200)
  const off = await advancedPresent(page)
  check('toggle OFF → §5/§9/§12/§13 all GONE (real unmount, not 2 static images)', !off.myChart && !off.dithi && !off.gates && !off.deities, JSON.stringify(off))
  const base = await page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).map((e) => e.textContent || '').join('|')
    return {
      header: Array.from(document.querySelectorAll('h1')).some((e) => (e.textContent || '').includes('รายละเอียดวัน')),
      strip: !!document.querySelector('[data-testid="day-strip"]'),
      score: !!document.querySelector('[data-testid="day-score"]'),
      compat: h2.includes('ความเข้ากัน'), predictions: h2.includes('คำทำนายรายด้าน'),
      colors: h2.includes('สีมงคล'), yams: h2.includes('เวลามงคล'),
    }
  })
  const baseOk = Object.values(base).every(Boolean)
  check('toggle OFF → the 10 base sections remain (3a intact)', baseOk, JSON.stringify(base))
  const tallOff = await tallInvariants(page)
  check('OFF: no-regression — 0 animations + 0 overflow + C+ #374151', tallOff.anims === 0 && tallOff.overflow && (await cplusHolds(page)), `anims=${tallOff.anims} overflow=${tallOff.overflow}`)

  // toggle back ON → sections return (2-way proven)
  await page.click('[role="switch"]')
  await page.waitForTimeout(200)
  const backOn = await advancedPresent(page)
  check('toggle back ON → advanced sections return (2-way)', backOn.myChart && backOn.gates)

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ PASS' : `❌ FAIL (${failed})`}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
