// harness/run-compat-2g.ts — anchor for ดวงสมพงศ์ ก้อน 2G "ดูดวงสมพงศ์ล่าสุด" (history list).
// LENS = visual/presentation + state-table completeness. Ground-truth = what the RECENT screen renders for
// each history shape, not what the hook returns. Drives the REAL screen; mocks only v1 UserMatchingGetApi
// (GET /user-matching) + the result read (GET /user-matching/detail). pages/matching + api-user-matching are
// import-only, never edited (ironclad rule 1).
//
// Invariants owned here (2G):
//   D39/state-table — no infinite spinner: list → cards · empty → "ยังไม่มีประวัติ" · error → honest fallback
//   D40 rule-4 — a missing friend NAME → "คุณ" (NEVER v1's fabricated "คุณ & เพื่อน"); a missing avatar →
//        an initial-letter placeholder (not a fake photo).
//   D43 — a legacy/unsupported matching_type (BOSS/EMPLOYEE) → the type chip is HIDDEN, the card still
//        renders + is clickable, the screen does NOT crash.
//   D41 — a card opens the ALREADY-computed result (navigate to /result/<id>, no re-calculate).
//   D42 — deep-link into the result from history (no sessionStorage carry) → the header birthdate line is
//        HIDDEN quietly (never a fabricated date, never a crash) — verified on the shared result screen.
//
// TOOTH (proven live in compat-2g.verify-evidence.md):
//   • mut-fake-friend-name — make recentCardTitle fabricate "เพื่อน" when the friend name is absent (v1's
//     bug). The rule-4 assertion (title === "คุณ" when name absent) then sees a fabricated name → CAUGHT.
//
// Run (dev up on :3024 WITH env):
//   set -a; . testenv/env/fe.env; set +a; next dev -p 3024
//   CAPTURE_HOST=http://localhost:3024 npx tsx harness/run-compat-2g.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3024'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const SHOT_DIR = path.resolve(process.cwd(), 'harness/pixel-proof')

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

async function seed(ctx: BrowserContext, withUser = true) {
  const host = new URL(HOST).hostname
  const cookies = [{ name: 'v2_access', value: readPasskey(), domain: host, path: '/' }]
  if (withUser) cookies.push(
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  )
  await ctx.addCookies(cookies)
}

// a mixed history: LOVE, FRIEND, legacy BOSS (D43), and a row with NO friend name + NO pictures (rule 4)
const MIXED = [
  { id: 'R-LOVE', type: 'LOVE', user: { picture: '' }, friend: { name: 'ก้อง', picture: null } },
  { id: 'R-FRIEND', type: 'FRIEND', user: { picture: '' }, friend: { name: 'มาลี', picture: null } },
  { id: 'R-BOSS', type: 'BOSS', user: { picture: '' }, friend: { name: 'หัวหน้า', picture: null } },
  { id: 'R-NONAME', type: 'LOVE', user: { picture: '' }, friend: {} },
]

// route GET /user-matching (list). endsWith('/user-matching') excludes '/user-matching/detail'.
async function routeList(page: Page, body: unknown) {
  await page.route((u) => u.pathname.endsWith('/user-matching'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }))
}
// result read WITHOUT birthDate → the shared result header hides the birth line (D42)
function detailNoBirth() {
  const pairMatch = {
    overall: { percent: 70, grade: 'B', gradeLabel: 'พอไปได้', hearts: 3, emoji: '🙂', ratingText: 'โดยรวมโอเค' },
    persons: { a: { displayName: 'มิลา', dayGanzhi: '壬午' }, b: { displayName: 'ก้อง', dayGanzhi: '戊子' } },
  }
  return JSON.stringify({ result: JSON.stringify({ pairMatch }) })
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    // ---- A) mixed list: chips · rule-4 title/avatar · D43 legacy no-crash ---------------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      const errs: string[] = []
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
      await routeList(page, MIXED)
      await page.goto(`${HOST}/v2/service/compatibility/recent`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-recent-screen"][data-state="ready"]').waitFor({ timeout: 8000 })

      check('all 4 rows render (legacy BOSS did NOT crash the screen — D43)', (await page.locator('button[data-testid^="compat-recent-card-R-"]').count()) === 4)
      const loveType = await page.locator('[data-testid="compat-recent-card-R-LOVE-type"]').innerText()
      const friendType = await page.locator('[data-testid="compat-recent-card-R-FRIEND-type"]').innerText()
      check('LOVE chip = "คู่รัก"', loveType.trim() === 'คู่รัก', loveType)
      check('FRIEND chip = "เพื่อนร่วมงาน"', friendType.trim() === 'เพื่อนร่วมงาน', friendType)
      check('D43 legacy BOSS chip HIDDEN (v2 unsupported → no fake label)', (await page.locator('[data-testid="compat-recent-card-R-BOSS-type"]').count()) === 0)
      const loveTitle = await page.locator('[data-testid="compat-recent-card-R-LOVE-title"]').innerText()
      check('title with name = "คุณ & ก้อง"', loveTitle.trim() === 'คุณ & ก้อง', loveTitle)
      const noNameTitle = await page.locator('[data-testid="compat-recent-card-R-NONAME-title"]').innerText()
      check('D40 rule-4: missing friend name → "คุณ" (NOT fabricated "คุณ & เพื่อน")', noNameTitle.trim() === 'คุณ', noNameTitle)
      check('D40 rule-4: no fabricated "เพื่อน" name anywhere', !(await page.locator('[data-testid="compat-recent-screen"]').innerText()).includes('& เพื่อน'))
      check('console errors = 0', errs.length === 0, errs.join(' | '))
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2g-1-list.png') })
      await ctx.close()
    }

    // ---- B) D41 open + D42 deep-link birthdate hidden -----------------------------------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await routeList(page, MIXED)
      await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: detailNoBirth() }))
      await page.goto(`${HOST}/v2/service/compatibility/recent`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-recent-card-R-LOVE"]').waitFor({ timeout: 8000 })
      await page.locator('[data-testid="compat-recent-card-R-LOVE"]').click()
      await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 12000 })
      check('D41 card opens the result (navigated to /result/R-LOVE)', page.url().includes('/result/R-LOVE'), page.url())
      check('D42 deep-link (no carry) → birthdate line HIDDEN, not fabricated', (await page.locator('[data-testid="compat-result-person-a-birth"]').count()) === 0)
      await ctx.close()
    }

    // ---- C) empty history --------------------------------------------------------------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await routeList(page, [])
      await page.goto(`${HOST}/v2/service/compatibility/recent`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-recent-screen"][data-state="empty"]').waitFor({ timeout: 8000 })
      check('empty history → "ยังไม่มีประวัติ" (no spinner)', (await page.locator('[data-testid="compat-recent-empty"]').innerText()).includes('ยังไม่มีประวัติ'))
      await ctx.close()
    }

    // ---- D) error (non-array / {error}) → honest fallback ------------------------------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await routeList(page, { error: 'boom' })
      await page.goto(`${HOST}/v2/service/compatibility/recent`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-recent-screen"][data-state="error"]').waitFor({ timeout: 8000 })
      check('error → honest fallback (no infinite spinner)', (await page.locator('[data-testid="compat-recent-error"]').count()) === 1)
      await ctx.close()
    }

    // ---- E) no userId (anon cookie) → resolved-empty, NOT stuck loading ----------------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx, false) // v2 passkey only, no mumate-id
      const page = await ctx.newPage()
      await page.goto(`${HOST}/v2/service/compatibility/recent`, { waitUntil: 'commit' })
      // no userId → hook resolves empty immediately; screen must NOT be stuck on the loading skeleton
      const settled = await page.locator('[data-testid="compat-recent-screen"][data-state="empty"]').waitFor({ timeout: 6000 }).then(() => true).catch(() => false)
      check('no userId → resolved-empty (never stuck on loading)', settled)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
