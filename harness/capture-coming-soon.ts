// harness/capture-coming-soon.ts — CAPTURE + a short behavioural read for the five controls that looked
// pressable and did nothing (ฟีม 2026-08-06, แบบ ก: tapping must SAY something).
//
// Not a permanent gate. The one thing a screenshot cannot show is whether a tap PRODUCES anything, so this
// taps each control and reports what came back; the pixels are photographed alongside for the review.
//
//   npx tsx --tsconfig harness/tsconfig.json harness/capture-coming-soon.ts   (dev server up)
import { chromium, type Browser, type Page } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3108'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()
const isPath = (u: string, p: string) => { try { return new URL(u).pathname === p } catch { return false } }
const UID = 'harness-cs-user'
// FREE on purpose: the อัพเกรด pill and the upsell card only exist for a free member, and they are two of
// the five. `payment` absent ⇒ lib/v2/tier.ts answers false ⇒ isPaid === false.
const USER = { user_id: UID, name: 'ทดสอบ เร็วๆนี้', dob: '1990-06-15', gender: 'MALE', place_name: 'กรุงเทพมหานคร', is_remember_time: false }

let pass = 0, fail = 0
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? ` · ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` · ${detail}` : ''}`) }
}

function fixtureMonth() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const [y, m] = today.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return {
    allowed: true, year: y, month: m,
    days: Array.from({ length: n }, (_, i) => ({
      date: `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      dayOfMonth: i + 1, dayGanzhi: '甲子', overallPercent: 72, grade: 'A', wanPhra: false,
    })),
  }
}

async function open(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: UID, domain: new URL(HOST).hostname, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  await page.route((u) => isPath(u.toString(), '/api/user'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route((u) => isPath(u.toString(), '/api/v2/calendar-month'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureMonth()) }))
  return { page, close: () => ctx.close() }
}

/** tap `sel` and report whether the notice appeared. The point of the whole PR is that it does. */
async function tapAndRead(page: Page, sel: string, label: string, shot?: string) {
  const el = page.locator(sel).first()
  const count = await el.count()
  check(`INSTRUMENT: ${label} exists`, count === 1, `${count} found`)
  if (count !== 1) return
  const tag = await el.evaluate((e) => e.tagName.toLowerCase())
  check(`${label} is a real control, not a painted <span>`, tag === 'button', `<${tag}>`)
  await el.click()
  await page.waitForTimeout(250)
  const toast = page.locator('[data-testid="coming-soon-toast"]')
  const shown = await toast.count()
  const text = shown ? (await toast.first().textContent())?.trim() : ''
  check(`${label} answers when tapped`, shown > 0 && !!text, `"${text}"`)
  if (shot) await page.screenshot({ path: `harness/out/${shot}.png` })
  // and the answer must GO AWAY on its own — a notice that sticks becomes furniture
  await page.waitForTimeout(2400)
  check(`${label}'s answer clears itself`, (await toast.count()) === 0)
}

async function main() {
  const browser = await chromium.launch()

  console.log('\n— month screen: the อัพเกรด pill and the avatar —')
  {
    const { page, close } = await open(browser)
    await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="calendar-grid"]').waitFor({ timeout: 20000 })
    await tapAndRead(page, '[data-testid="header-upgrade"]', 'อัพเกรด pill', 'coming-soon-upgrade-393')
    await tapAndRead(page, '[data-testid="avatar-static"]', 'avatar')
    await close()
  }

  console.log('\n— day detail (free): the upsell CTA + the loading CTA —')
  {
    const { page, close } = await open(browser)
    // hold day-detail so the loading menubar can be photographed before the real CTA replaces it
    await page.route((u) => isPath(u.toString(), '/api/v2/day-detail'), async (r) => {
      await new Promise((res) => setTimeout(res, 3000))
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: null, degraded: true }) })
    })
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
    await page.goto(`${HOST}/v2/calendar/${today}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)
    const cta = page.locator('nav button', { hasText: 'กำลังโหลด' })
    const loadingShown = await cta.count()
    check('the loading CTA says กำลังโหลด instead of being a blank pill', loadingShown === 1, `${loadingShown}`)
    if (loadingShown) {
      check('and it is disabled — it refuses the press rather than swallowing it',
        await cta.first().isDisabled())
      await page.screenshot({ path: 'harness/out/coming-soon-loading-cta-393.png' })
    }
    await close()
  }

  console.log('\n— day detail (free): the upsell CTA, the riskiest of the five —')
  {
    const { page, close } = await open(browser)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
    await page.route((u) => isPath(u.toString(), '/api/v2/day-detail'), (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: {
        date: today, dayGanzhi: '己丑', overallPercent: 72, grade: 'B', verdict: 'good',
        summary: 'วันนี้ดวงดีมาก', suitable: ['เจรจา'], avoid: ['เดินทางไกล'], insight: '',
        compatAreas: [], advice: [], yams: [], dithi: { officer: '', officerDesc: '', jianchu: '' },
        luckyDirection: '', dayDeity: '', spirits: [], wanPhra: { isWanPhra: false, label: '' },
        dayPillars: { day: null, month: null, year: null }, ownerPillars: {}, gates: [], colors: [],
      } }) }))
    await page.goto(`${HOST}/v2/calendar/${today}`, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="day-score"]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    await tapAndRead(page, '[data-testid="calendar-upsell-cta"]', 'upsell CTA', 'coming-soon-upsell-393')
    await close()
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} capture-coming-soon — ${pass} passed, ${fail} failed`)
  await browser.close()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
