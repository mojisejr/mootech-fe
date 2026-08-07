// harness/run-calendar-save.ts — Phase 5 STATE-WRITE anchor for the save sheet (Figma 375:13316).
// This is the first day-detail screen that WRITES state, so BOTH outcomes are proven, not just the happy path
// (บทเรียน PR#97): success AND cancel, plus the no-op/replay guard (spam บันทึก → exactly ONE row, not many).
// The sheet is a MASK over goo's save-flow machine — the anchor drives it purely through the UI. Proves:
//   1. 0 app-fetch + 0 console
//   2. OPEN: click "เพิ่มลงปฏิทิน" → sheet appears · menu becomes FormMode(4) → Mate AI HIDDEN
//   3. save disabled with 0 ยาม (goo's canCommit, not a hand guard); tick a ยาม → enabled
//   4. CANCEL path: backdrop → sheet gone · Mate AI back · reminder-count STILL 0 (draft discarded, menu stays 2)
//   5. SUCCESS path: tick 2 ยาม → บันทึก → sheet closed · reminder-count == 2 · menu state 3 (saved · Mate AI back)
//   6. NO-OP guard: fresh date, tick 1 ยาม, fire บันทึก x3 synchronously → reminder-count == 1 (latch + de-dup)
//   7. no-regress: the 10 base sections + C+ #374151 survive open→close (บทเรียน #130)
// TEETH: mut-nonidempotent-save — make onSheetSave mint a unique id per click (bypass de-dup) → assertion (6)
//        reads count 3 not 1 → CAUGHT. Run (FE up on :3011): npx tsx harness/run-calendar-save.ts
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
function readPasskey(): string {
  const file = path.resolve(process.cwd(), 'testenv/env/fe.env')
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('V2_PREVIEW_KEY not found')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}
const sheetOpen = (p: Page) => p.locator('[data-testid="save-sheet"]').count().then((n) => n > 0)
const mateAi = (p: Page) => p.locator('nav [aria-label="Mate AI"]').count().then((n) => n > 0)
const count = (p: Page) => p.locator('[data-testid="reminder-count"]').textContent().then((t) => parseInt(t || '0', 10))
const openSheet = (p: Page) => p.getByRole('button', { name: 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน' }).click()

async function main() {
  const passkey = readPasskey()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const page = await ctx.newPage()
  const tracker = trackAppFetches(page)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))

  console.log('\nrun-calendar-save')

  // ── date 15 (no mock reminder → starts state 2) : OPEN · disabled-guard · CANCEL ──
  await page.goto(`${HOST}/v2/calendar/2026-07-15`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  check('0 app-fetch', tracker.appFetches.length === 0, `app-fetch=${tracker.appFetches.length}`)
  check('0 console errors', consoleErrors.length === 0)
  consoleErrors.forEach((e) => console.log(`     ⚠️ ${e}`))
  check('start: reminder-count 0 · sheet closed · Mate AI present', (await count(page)) === 0 && !(await sheetOpen(page)) && (await mateAi(page)))

  await openSheet(page)
  await page.waitForTimeout(200)
  check('OPEN → sheet visible', await sheetOpen(page))
  check('OPEN → menu FormMode(4): Mate AI HIDDEN', !(await mateAi(page)))
  check('save DISABLED with 0 ยาม (goo canCommit)', await page.locator('[data-testid="sheet-save"]').isDisabled())
  await page.locator('[data-testid="save-sheet"] label').first().click({ force: true })
  await page.waitForTimeout(100)
  check('tick 1 ยาม → save ENABLED', await page.locator('[data-testid="sheet-save"]').isEnabled())

  // CANCEL
  await page.locator('[data-testid="sheet-backdrop"]').click({ position: { x: 100, y: 20 } })
  await page.waitForTimeout(200)
  check('CANCEL → sheet gone · Mate AI back · reminder-count STILL 0 (draft discarded)', !(await sheetOpen(page)) && (await mateAi(page)) && (await count(page)) === 0)

  // ── SUCCESS path (same date 15): tick 2 ยาม → save → count 2 · menu 3 ──
  await openSheet(page)
  await page.waitForTimeout(150)
  const labels = page.locator('[data-testid="save-sheet"] label')
  await labels.nth(0).click({ force: true }); await labels.nth(1).click({ force: true })
  await page.waitForTimeout(100)
  await page.locator('[data-testid="sheet-save"]').click()
  await page.waitForTimeout(250)
  check('SUCCESS → sheet closed · reminder-count == 2', !(await sheetOpen(page)) && (await count(page)) === 2, `count=${await count(page)}`)
  check('SUCCESS → menu state 3 (saved · Mate AI back)', (await mateAi(page)) && (await page.getByRole('button', { name: /คุณบันทึกลงปฏิทินแล้ว/ }).count()) === 1)

  // ── NO-OP guard (fresh date 16): tick 1 ยาม, fire บันทึก x3 synchronously → count 1 ──
  await page.goto(`${HOST}/v2/calendar/2026-07-16`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  check('date 16 fresh: reminder-count 0', (await count(page)) === 0)
  await openSheet(page)
  await page.waitForTimeout(150)
  await page.locator('[data-testid="save-sheet"] label').first().click({ force: true })
  await page.waitForTimeout(100)
  // 3 synchronous clicks in one JS tick — before React re-renders / the sheet unmounts
  await page.evaluate(() => {
    const b = document.querySelector('[data-testid="sheet-save"]') as HTMLElement | null
    if (b) { b.click(); b.click(); b.click() }
  })
  await page.waitForTimeout(250)
  check('NO-OP guard: spam บันทึก x3 → reminder-count == 1 (latch + de-dup, not 3)', (await count(page)) === 1, `count=${await count(page)}`)

  // ── no-regress: base sections + C+ survive open→close ──
  const base = await page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).map((e) => e.textContent || '').join('|')
    const cplus = document.querySelector('[data-grade="C+"]') as HTMLElement | null
    return {
      sections: ['ความเข้ากัน', 'คำทำนายรายด้าน', 'สีมงคล', 'เวลามงคล'].every((t) => h2.includes(t)),
      cplus: cplus ? getComputedStyle(cplus).color === 'rgb(55, 65, 81)' : false,
      overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      anims: document.getAnimations ? document.getAnimations().length : -1,
    }
  })
  check('no-regress: base sections + C+ #374151 + 0 overflow + 0 anim after open→close', base.sections && base.cplus && base.overflow && base.anims === 0, JSON.stringify(base))

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ PASS' : `❌ FAIL (${failed})`}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
