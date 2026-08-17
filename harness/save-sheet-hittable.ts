// #299 negative-control: the SaveSheet's "บันทึก" button must be the TOP element at its own centre —
// i.e. actually clickable. The bug: SaveSheet overlay and the bottom Menubar are BOTH `z-40`, so at an
// equal stacking level the DOM order wins and the <nav> covers the save button → the click never lands.
// This asserts hit-testing (document.elementFromPoint), the same thing a real tap resolves, across the
// three viewports มุน measured. RED on `main` today (nav wins); GREEN once the sheet sits above the nav.
//
// Standalone + backend-independent (every call is Playwright-stubbed), so a CI box with no backend runs
// exactly what this owns. Run:  HARNESS_HOST=http://localhost:3000 V2_PREVIEW_KEY=<key> npx tsx harness/save-sheet-hittable.ts
import { chromium, type Browser } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const UID = 'harness-299-user'
const host = new URL(HOST).hostname
const isPath = (u: string, p: string) => new URL(u).pathname === p
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
// /api/user must carry birth data or useDayDetail never fetches the day → day-score never renders.
const USER = { user_id: UID, name: 'ทดสอบ #299', dob: '1990-06-15', gender: 'MALE', place_name: 'กรุงเทพมหานคร', is_remember_time: false }

const dayDetail = { detail: {
  date: today, dayGanzhi: '己丑', overallPercent: 72, grade: 'B', verdict: 'good', summary: 'วันนี้ดวงดีมาก',
  suitable: ['เจรจา'], avoid: ['เดินทางไกล'], insight: '', compatAreas: [], advice: [],
  yams: [{ id: 'y1', label: 'ยามมงคล', window: '09:00-10:59' }],
  dithi: { officer: '', officerDesc: '', jianchu: '' }, luckyDirection: '', dayDeity: '', spirits: [],
  wanPhra: { isWanPhra: false, label: '' }, dayPillars: { day: null, month: null, year: null },
  ownerPillars: {}, gates: [], colors: [],
} }

async function openSheetPage(browser: Browser, vw: number) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 852 } })
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: UID, domain: host, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.route((u) => isPath(u.toString(), '/api/user'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route((u) => isPath(u.toString(), '/api/v2/calendar-month'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' }))
  await page.route((u) => isPath(u.toString(), '/api/v2/day-detail'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dayDetail) }))
  await page.goto(`${HOST}/v2/calendar/${today}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="day-score"]').waitFor({ timeout: 20000 })
  // open the sheet from the bottom CTA, then enable "บันทึก" by picking a ยาม (it's disabled until then)
  await page.locator('nav button', { hasText: 'เพิ่มลงปฏิทิน' }).first().click()
  await page.locator('[data-testid="save-sheet"]').waitFor({ timeout: 10000 })
  await page.locator('[data-testid="save-sheet"] label').first().click()
  return { ctx, page }
}

/** At the save button's own centre, what does hit-testing return? */
async function probe(page: import('playwright').Page) {
  return page.evaluate(() => {
    const btn = document.querySelector('[data-testid="sheet-save"]') as HTMLElement | null
    if (!btn) return { found: false } as const
    const r = btn.getBoundingClientRect()
    const x = Math.round(r.left + r.width / 2)
    const y = Math.round(r.top + r.height / 2)
    const top = document.elementFromPoint(x, y) as HTMLElement | null
    return {
      found: true,
      disabled: (btn as HTMLButtonElement).disabled,
      hitIsSaveButton: !!top?.closest('[data-testid="sheet-save"]'),
      hitInsideSheet: !!top?.closest('[data-testid="save-sheet"]'),
      hitInNav: !!top?.closest('nav[aria-label="เมนูหลัก"]'),
      topTag: top?.tagName ?? null,
      topTestId: top?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
    } as const
  })
}

async function main() {
  const browser = await chromium.launch()
  let fail = 0
  for (const vw of [320, 393, 1280]) {
    const { ctx, page } = await openSheetPage(browser, vw)
    const p = await probe(page)
    if (!p.found) {
      console.log(`  ✗ [${vw}] save button not found (sheet did not render as expected)`)
      fail++
    } else {
      const ok = p.hitIsSaveButton && !p.hitInNav
      console.log(`  ${ok ? '✓' : '✗'} [${vw}] save button is the top element at its centre` +
        ` · hit=${p.topTag}${p.topTestId ? `#${p.topTestId}` : ''} inNav=${p.hitInNav} disabled=${p.disabled}`)
      if (!ok) fail++
    }
    await ctx.close()
  }
  await browser.close()
  console.log(`\n${fail === 0 ? '✅' : '🔴'} save-sheet-hittable — ${3 - fail} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
