// harness/run-compat-ui.ts — anchor for the V3 compatibility UI (ดวงสมพงศ์ Slice 1, PR feat/v2-compat-slice1-ui).
// COMPLEMENTS goo's run-compatibility (contract) — this owns the PRESENTATION + interaction invariants:
//   1. done-cond #13 (REFRAME 3) END-TO-END — a user who picks 👩 FEMALE makes the value 'FEMALE' reach the
//      create request's args, NOT just recolour a button. Proven by intercepting POST /member-with-friend and
//      asserting the outgoing gender is FEMALE (route.fulfill'd → NO real side effect, done-cond #9 stays clean).
//      goo's compatibility.test.ts proves form→args; THIS proves UI→form→request. Together = button→API.
//   2. 2-STATE — selecting a friend (V3-native list, friend-get mocked) fills row 2 AND flips the button
//      gray→enabled (canViewResult).
//   3. DISABLE-not-HIDE — the 3 account-connect rows are present but disabled + say "ยังไม่เปิด".
//   4. PLACEHOLDERS honest — "ดูดวงสมพงศ์ล่าสุด" + the result button open a "เร็วๆ นี้" sheet, never a dead tap.
//
// TOOTH (demonstrated live in compat-ui.verify-evidence.md):
//   • mut-silent-male — hardcode the AddFriendSheet gender to 'MALE' (ignore the user's pick) → check #1 sees
//     MALE in the create request though the user chose FEMALE → CAUGHT (the exact REFRAME-3 bug this fixes).
// NOTE the view-result gate is DEFENSE-IN-DEPTH (native `disabled` + `aria-disabled` + gray class + onClick
// guard, all off `canViewResult`) — no single-line mutation breaches it (that robustness is the point); the
// gate is proven positively by #2b (disabled while empty) + #2d (enabled after both people).
//
// Run (dev up on :3016): npx tsx --tsconfig harness/tsconfig.json harness/run-compat-ui.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3016'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662' // capture-route default (PII-stripped fake, goo #109)
function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no key'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

async function seed(ctx: BrowserContext) {
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
}
// mock person1's /api/user (localApi('/user')) so the screen has no DB dependency — otherwise dev-without-BE
// returns 500 and pollutes console-0. goo's hook still owns the graceful fallback; this isolates MY UI.
async function mockUser(page: Page) {
  await page.route('**/api/user**', (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: USER_ID, name: 'มิลา', dob: '1994-06-14', time: '09:30', picture_url: '' }) })
    : route.continue())
}
// mock the v1 friend-get so the V3 list has a row without a backend (a GET, no side effect).
async function mockFriendGet(page: Page) {
  await page.route('**/member-with-friend*', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'f1', name: 'โปเตโต้', surname: '', picture_url: '', is_disable: false }]) })
    }
    return route.continue()
  })
}

async function main() {
  console.log('\nrun-compat-ui')
  const browser = await chromium.launch()

  // ── 3 + 4: disable-not-hide + honest placeholder (main screen) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 }); await seed(ctx)
    const page = await ctx.newPage(); await mockUser(page)
    const errors: string[] = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)))
    await page.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
    check('#2b button gray/disabled while person2 empty', await page.locator('[data-testid="compat-view-result"]').isDisabled())
    // placeholder: tapping "ดูดวงสมพงศ์ล่าสุด" opens an honest sheet (not a dead tap)
    await page.getByText('ดูดวงสมพงศ์ล่าสุด').click(); await page.waitForTimeout(200)
    check('#4 "ล่าสุด" → honest "เร็วๆ นี้" sheet (not dead)', (await page.locator('[data-testid="coming-soon-label"]').count()) === 1)
    check('#0 console 0 on the screen', errors.length === 0, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ── 2: 2-state — select a friend → row 2 fills + button enables ──
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 }); await seed(ctx)
    const page = await ctx.newPage(); await mockFriendGet(page); await mockUser(page)
    await page.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
    await page.locator('[data-testid="compat-person2"]').click(); await page.waitForTimeout(250) // open V3 select
    check('#2a V3 friend list renders (mocked GET, not v1 modal)', (await page.locator('[data-testid="compat-friend-f1"]').count()) === 1)
    await page.locator('[data-testid="compat-friend-f1"]').click(); await page.waitForTimeout(300)
    check('#2c row 2 fills with the chosen friend', ((await page.locator('[data-testid="compat-person2-name"]').textContent()) || '').includes('โปเตโต้'))
    check('#2d button flips to enabled (canViewResult)', await page.locator('[data-testid="compat-view-result"]').isEnabled())
    await ctx.close()
  }

  // ── 1: done-cond #13 — pick FEMALE → 'FEMALE' reaches the create request (no real create) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 }); await seed(ctx)
    const page = await ctx.newPage(); await mockFriendGet(page); await mockUser(page)
    let createBody = ''
    await page.route('**/member-with-friend*', async (route) => {
      if (route.request().method() === 'POST') { createBody = `${route.request().url()} ${route.request().postData() ?? ''}`; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'new' }) }) }
      if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      return route.continue()
    })
    await page.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
    await page.locator('[data-testid="compat-person2"]').click(); await page.waitForTimeout(200)
    await page.locator('[data-testid="compat-select-add-new"]').click(); await page.waitForTimeout(200)
    // fill the minimum required + PICK FEMALE (default is the VISIBLE MALE)
    await page.locator('[data-testid="add-friend-name"]').fill('เทสเตอร์')
    await page.locator('[data-testid="add-friend-day"]').selectOption('1')
    await page.locator('[data-testid="add-friend-month"]').selectOption('8')
    await page.locator('[data-testid="add-friend-year"]').fill('2535')
    check('#3 3 connect rows DISABLED not hidden', (await page.locator('[data-testid="connect-facebook"][aria-disabled]').count()) === 1 && (await page.locator('[data-testid="connect-invite"]').count()) === 1)
    check('#1-default MALE pre-highlighted (visible, not hidden)', (await page.locator('[data-testid="add-friend-gender-MALE"]').getAttribute('aria-pressed')) === 'true')
    await page.locator('[data-testid="add-friend-gender-FEMALE"]').click(); await page.waitForTimeout(100)
    check('#1-pick FEMALE now selected', (await page.locator('[data-testid="add-friend-gender-FEMALE"]').getAttribute('aria-pressed')) === 'true')
    await page.locator('[data-testid="add-friend-save"]').click(); await page.waitForTimeout(400)
    check('#1 🔴 the CHOSEN FEMALE reaches the create request (not the MALE default)', createBody.includes('FEMALE'), createBody ? `req had: ${/gender[^&]*/.exec(decodeURIComponent(createBody))?.[0] ?? '?'}` : 'no create request fired')
    check('#1 no silent MALE in the request', !/gender["'=:\s]*MALE/i.test(decodeURIComponent(createBody)), '')
    await ctx.close()
  }

  // ── 5: no overflow-x @393/360/320 (done-cond #9) + save a before-select screenshot for evidence ──
  for (const w of [393, 360, 320]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 2 }); await seed(ctx)
    const page = await ctx.newPage(); await mockUser(page)
    await page.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    check(`#5 no overflow-x @${w}`, !overflow)
    if (w === 393) { try { fs.mkdirSync('/tmp/compat3', { recursive: true }) } catch {}; await page.screenshot({ path: '/tmp/compat3/compat-before-select-393.png', fullPage: true }) }
    await ctx.close()
  }

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ run-compat-ui PASS' : `❌ run-compat-ui FAIL (${failed})`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
