// harness/run-calendar-flow.ts — Phase 7 FULL-FLOW anchor. Walks the calendar journey and proves the things a
// per-screen anchor can't: no dead-ends (every screen has a way IN and a way BACK), the menu is the right state
// on every screen, no horizontal overflow at 393/360/320, within-page state continuity, and — the reachability
// 4th axis, first live use — that the notifications screen HAS a real inbound entry-point (bell + post-save
// button), not an orphan URL. 0 app-fetch, console 0 throughout.
//
// TEETH: mut-orphan-notifications — remove the DayHeader bell link or the post-save A2 button and the
// entry-point checks ("header bell → notifications" / "A2 appears") fail — i.e. the reachability 4th axis
// catches the notifications screen going orphan again (the exact bug Phase 7 fixes).
//
// SCOPE (goo seam, flagged to บอง): reminders are per-page useState (not a shared store) — so a reminder saved on
// day X does NOT appear on the notifications page (a fresh instance). Cross-page PERSISTENCE is out of scope this
// round (mock; lands at API-time / a goo shared store). This anchor proves reachability + no-dead-end + menu
// state + no-overflow + WITHIN-page continuity (save→count-up on the day page; cancel→count-down on the list).
// Run (FE up on :3011): npx tsx harness/run-calendar-flow.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const SIZES = [393, 360, 320]
function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no key')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}
const overflowOk = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
// menu state from the CalendarMenu: 1 default (4 tabs) · 2 primary-cta · 3 saved · 4 form (no Mate AI)
const menuState = (p: Page) => p.evaluate(() => {
  const nav = document.querySelector('nav')
  const t = nav?.textContent || ''
  const mate = !!document.querySelector('nav [aria-label="Mate AI"]')
  if (!mate) return 4
  if (t.includes('คุณบันทึกลงปฏิทินแล้ว')) return 3
  if (t.includes('เพิ่มลงปฏิทิน เพื่อแจ้งเตือน')) return 2
  if (t.includes('หน้าหลัก')) return 1
  return 0
})

async function login(ctx: BrowserContext) {
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
}

async function main() {
  const browser = await chromium.launch()
  console.log('\nrun-calendar-flow')

  // ── every size: walk each screen, assert no overflow + a way back (no dead-end) ──
  for (const w of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 820 }, deviceScaleFactor: 2 })
    await login(ctx)
    const page = await ctx.newPage()
    for (const route of ['/v2/calendar', '/v2/calendar/2026-07-14', '/v2/calendar/notifications']) {
      await page.goto(`${HOST}${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(250)
      check(`@${w} ${route} no overflow-x`, await overflowOk(page), '')
      // way back: month has bottom nav (tabs); day + notifications have a back link to /v2/calendar
      if (route !== '/v2/calendar') {
        const back = await page.locator('a[href="/v2/calendar"]').count()
        check(`@${w} ${route} has a way back (→ /v2/calendar)`, back >= 1)
      }
    }
    await ctx.close()
  }

  // ── @393 deep interactive walk: journey + menu states + within-page continuity + reachability ──
  const ctx = await browser.newContext({ viewport: { width: 393, height: 820 }, deviceScaleFactor: 2 })
  await login(ctx)
  const page = await ctx.newPage()
  const tracker = trackAppFetches(page)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))

  // 1 month
  await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
  check('month → menu state 1 (default tabs)', (await menuState(page)) === 1)
  // → M-A CHANGED THIS ROUTE, so the check changed with it — not just the selector.
  //
  // A day cell used to be <a href="/v2/calendar/{date}"> and tapping it left the screen. ฟีม ruled that
  // tapping a day now moves the highlight and swaps the card underneath, and the CARD's button is the only
  // way into the day page. Repointing the old selector at a <button> would have kept a green check on a
  // route that no longer exists; what this asserts instead is the route that does.
  //
  // The date is READ FROM THE GRID rather than hardcoded (it was '2026-07-15', which stopped existing the
  // day the month became real and personalised — a hardcoded date in a live-data anchor is a timer set to
  // go off later).
  const cells = page.locator('[data-testid="calendar-day"]')
  const cellCount = await cells.count()
  check('month: the grid actually rendered cells (else every check below is vacuous)', cellCount > 0, `${cellCount} cells`)
  // pick a day that is NOT already selected — otherwise "the CTA stopped saying วันนี้" would be asserted
  // against the day it already said วันนี้ for, and the check would pass or fail on the calendar date the
  // anchor happens to run on. Chosen by state, never by index.
  const target = page.locator('[data-testid="calendar-day"]:not([data-selected="true"])').first()
  const targetDate = await target.getAttribute('data-date')
  const urlBefore = page.url()
  await target.click()
  await page.waitForTimeout(400)
  // TOOTH — if anyone puts a <Link> back, this is what catches it: the tap must NOT navigate.
  check('month: tapping a day does NOT navigate (it selects)', page.url() === urlBefore, `${urlBefore} → ${page.url()}`)
  check('month: tapping a day moves the selection to it', (await target.getAttribute('data-selected')) === 'true', `date=${targetDate}`)
  check('month: exactly one day is selected at a time', (await page.locator('[data-testid="calendar-day"][data-selected="true"]').count()) === 1)
  // M-B — the card followed the tap. If it still described today, the CTA would open the wrong day.
  const ctaName = await page.locator('[data-testid="calendar-daily-card"] button').last().textContent()
  check('month: the card CTA follows the selected day (not "วันนี้")', !!ctaName && !ctaName.includes('วันนี้'), `cta="${ctaName?.trim()}"`)
  // REACHABILITY — the day screen must still be reachable, now via the card's button.
  await page.locator('[data-testid="calendar-daily-card"] button').last().click()
  await page.waitForTimeout(400)
  check('month→day: the card CTA reaches the SELECTED day-detail', page.url().includes(`/${targetDate}`), `${page.url()} want /${targetDate}`)
  // 2 day-detail (unsaved)
  check('day (unsaved) → menu state 2 (primary-cta)', (await menuState(page)) === 2)
  check('day: header bell → notifications (entry-point A1 exists)', (await page.locator('[data-testid="header-notif-bell"][href="/v2/calendar/notifications"]').count()) === 1)
  // toggle advanced within-page
  const advBefore = await page.locator('h2', { hasText: 'ดวงของฉัน' }).count()
  await page.locator('[role="switch"]').click(); await page.waitForTimeout(150)
  const advAfter = await page.locator('h2', { hasText: 'ดวงของฉัน' }).count()
  check('day: advanced toggle flips within-page (2-way)', advBefore !== advAfter)
  await page.locator('[role="switch"]').click(); await page.waitForTimeout(150) // restore
  // open sheet
  await page.getByRole('button', { name: 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน' }).click(); await page.waitForTimeout(200)
  check('open sheet → menu state 4 (form, no Mate AI)', (await menuState(page)) === 4 && (await page.locator('[data-testid="save-sheet"]').count()) === 1)
  // tick + save
  const cnt0 = parseInt((await page.locator('[data-testid="reminder-count"]').textContent()) || '-1', 10)
  await page.locator('[data-testid="save-sheet"] label').first().click({ force: true }); await page.waitForTimeout(100)
  await page.locator('[data-testid="sheet-save"]').click(); await page.waitForTimeout(250)
  const cnt1 = parseInt((await page.locator('[data-testid="reminder-count"]').textContent()) || '-1', 10)
  check('save → within-page count up (0→1) + menu state 3 (saved)', cnt0 === 0 && cnt1 === 1 && (await menuState(page)) === 3, `count ${cnt0}→${cnt1}`)
  check('save → A2 "ดูรายการทั้งหมด" entry-point appears', (await page.locator('[data-testid="view-all-reminders"][href="/v2/calendar/notifications"]').count()) === 1)
  // → follow A2 to the list
  await page.locator('[data-testid="view-all-reminders"]').click(); await page.waitForTimeout(400)
  check('A2 → reached notifications list', page.url().includes('/notifications'))
  check('notifications: list has real rows + no overflow', (await page.locator('[data-testid="notif-row"]').count()) >= 1 && (await overflowOk(page)))
  // cancel within-page: row + summary both drop
  const nrows0 = await page.locator('[data-testid="notif-row"]').count()
  const ntot0 = parseInt((await page.locator('[data-testid="notif-total-yams"]').textContent()) || '-1', 10)
  await page.locator('[data-testid="notif-cancel"]').first().click(); await page.waitForTimeout(250)
  const nrows1 = await page.locator('[data-testid="notif-row"]').count()
  const ntot1 = parseInt((await page.locator('[data-testid="notif-total-yams"]').textContent()) || '-1', 10)
  check('notifications cancel → row AND summary both drop (within-page)', nrows1 === nrows0 - 1 && ntot1 === ntot0 - 1, `rows ${nrows0}→${nrows1} total ${ntot0}→${ntot1}`)
  // way back exists
  check('notifications → way back (→ /v2/calendar)', (await page.locator('a[href="/v2/calendar"]').count()) >= 1)

  check('flow: 0 app-fetch', tracker.appFetches.length === 0, `app-fetch=${tracker.appFetches.length}`)
  check('flow: 0 console errors', consoleErrors.length === 0)
  consoleErrors.forEach((e) => console.log(`     ⚠️ ${e}`))

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ PASS' : `❌ FAIL (${failed})`}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
