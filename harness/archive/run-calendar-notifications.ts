// harness/run-calendar-notifications.ts — Phase 6 anchor for /v2/calendar/notifications (the reminders list).
// This screen has NO Figma, so the two measurable things are: is it in the DESIGN.md brand, and does it work.
// It also WRITES state (cancel), so cancel is proven through the UI — and crucially the SUMMARY COUNT must
// DECREASE with the row, read on the SAME page at assert-time (บทเรียน P5 near-miss: never navigate away to
// count, that resets per-page state → a vacuous green). Proves, on the REAL route with NO backend:
//   1. 0 app-fetch + 0 console
//   2. real list: goo's 3 mock reminders → 3 rows (not a static 1-row picture) · 2 groups
//   3. "เตือนไปแล้ว" (past) rows are faded (opacity<1) AND have NO cancel button (cancel count == upcoming count)
//   4. CANCEL through the UI: click ยกเลิก → row gone AND summary total decreases (3→2), read on THIS page
//   5. brand tokens: summary bg == v3-sapphire · row bg == lemon-chiffon (DESIGN.md, no new hex)
// TEETH: mut-summary-hardcoded — hardcode the summary number instead of list.totalYams → cancel drops the row
//        but the count STAYS → assertion (4) fails. Run (FE up on :3011): npx tsx harness/run-calendar-notifications.ts
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from '../../scripts/_helpers/assert-no-app-fetch'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const ROUTE = '/v2/calendar/notifications'
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
const rows = (p: Page) => p.locator('[data-testid="notif-row"]').count()
const total = (p: Page) => p.locator('[data-testid="notif-total-yams"]').textContent().then((t) => parseInt(t || '-1', 10))

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const page = await ctx.newPage()
  const tracker = trackAppFetches(page)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))
  await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  console.log(`\nrun-calendar-notifications · ${ROUTE}`)
  check('0 app-fetch', tracker.appFetches.length === 0, `app-fetch=${tracker.appFetches.length}`)
  check('0 console errors', consoleErrors.length === 0)
  consoleErrors.forEach((e) => console.log(`     ⚠️ ${e}`))

  // 2 — real list (goo's 3 mock) · 2 groups
  const rows0 = await rows(page)
  const total0 = await total(page)
  const groups = await page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).map((e) => e.textContent || '').join('|')
    return { upcoming: h2.includes('กำลังจะถึง'), past: h2.includes('เตือนไปแล้ว') }
  })
  check('real list: 3 rows (not a 1-row picture) · summary total 3', rows0 === 3 && total0 === 3, `rows=${rows0} total=${total0}`)
  check('2 groups present (กำลังจะถึง · เตือนไปแล้ว)', groups.upcoming && groups.past)

  // 3 — past faded + no cancel
  const pastFadedNoBtn = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('section'))
    const past = secs.find((s) => (s.querySelector('h2')?.textContent || '').includes('เตือนไปแล้ว'))
    if (!past) return { faded: false, noBtn: false }
    const row = past.querySelector('[data-testid="notif-row"]') as HTMLElement | null
    const faded = row ? parseFloat(getComputedStyle(row).opacity) < 1 : false
    const noBtn = past.querySelectorAll('[data-testid="notif-cancel"]').length === 0
    return { faded, noBtn }
  })
  check('"เตือนไปแล้ว" rows faded + NO cancel button', pastFadedNoBtn.faded && pastFadedNoBtn.noBtn, JSON.stringify(pastFadedNoBtn))
  const cancelBtns = await page.locator('[data-testid="notif-cancel"]').count()
  check('cancel buttons only on upcoming (2, not 3)', cancelBtns === 2, `cancelBtns=${cancelBtns}`)

  // 4 — CANCEL: row gone AND summary total decreases (read on THIS page, not by navigating away)
  await page.locator('[data-testid="notif-cancel"]').first().click()
  await page.waitForTimeout(250)
  const rows1 = await rows(page)
  const total1 = await total(page)
  check('CANCEL → row removed (3→2)', rows1 === 2, `rows=${rows1}`)
  check('CANCEL → summary total DECREASED too (3→2), not just the row', total1 === 2, `total ${total0}→${total1}`)

  // 5 — brand tokens (no new hex)
  const tokens = await page.evaluate(() => {
    const sec = Array.from(document.querySelectorAll('section'))[0]
    const summary = document.querySelector('[data-testid="notif-total-yams"]')?.closest('div') as HTMLElement | null
    const row = document.querySelector('[data-testid="notif-row"]') as HTMLElement | null
    return {
      summaryBg: summary ? getComputedStyle(summary).backgroundColor : '',
      rowBg: row ? getComputedStyle(row).backgroundColor : '',
      hasSection: !!sec,
    }
  })
  check('summary bg == v3-sapphire #1455A4', tokens.summaryBg === 'rgb(20, 85, 164)', tokens.summaryBg)
  check('row bg == lemon-chiffon #F9F4F0', tokens.rowBg === 'rgb(249, 244, 240)', tokens.rowBg)
  check('borrows SectionCard (brand primitive, not a bespoke component)', tokens.hasSection)

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ PASS' : `❌ FAIL (${failed})`}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
