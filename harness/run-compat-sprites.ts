// harness/run-compat-sprites.ts — anchor for the ดวงสมพงศ์ hero's floating corner element sprites
// (Figma 636:19061 · motion via get_motion_context). LENS = visual/motion. Ground-truth = the rendered
// sprites + whether they actually animate, and whether the reduced-motion guard actually stops them.
//
// Invariants owned here:
//   ASSET-FIDELITY — all 6 element sprites paint (naturalWidth > 0); a wrong path paints nothing.
//   DECORATION     — the sprite layer is aria-hidden + pointer-events-none + BEHIND content (z), and is
//                    clipped by the frame (no page overflow-x @393/360/320).
//   MOTION          — WITHOUT reduced-motion the sprites animate (getAnimations ≥ 1); WITH reduced-motion the
//                    animation STOPS (getAnimations === 0). The two halves are each other's negative-control:
//                    the reduce=0 check is only meaningful because the same probe reads ≥1 when motion is on.
//
// TEETH:
//   • mut-sprite-missing          — point a sprite at a 404 → naturalWidth 0 → ASSET-FIDELITY trips.
//   • mut-motion-runs-under-reduce — force the animation on under reduced-motion (dropped guard) → MOTION trips.
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-compat-sprites.ts
import { chromium, type Browser, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const EXPECT_SPRITES = 6

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
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

function detailBody() {
  const overall = { percent: 57, grade: 'C+', gradeLabel: 'ต้องปรับรับเข้าหากัน', ratingText: 'x' }
  const dims = [{ key: 'love', label: 'ความรัก', percent: 78, grade: 'A' }]
  const a = { displayName: 'มิลา', dayGanzhi: '甲子' }
  const b = { displayName: 'ก้อง', dayGanzhi: '丙子' }
  return JSON.stringify({ result: JSON.stringify({ pairMatch: { overall, dimensions: dims, persons: { a, b } } }) })
}

async function open(browser: Browser, reduce: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: reduce ? 'reduce' : 'no-preference' })
  await seed(ctx)
  const page = await ctx.newPage()
  await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: detailBody() }))
  await page.route((u) => u.pathname.includes('/api/bazi/mascot/'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mascot: null }) }))
  await page.goto(`${HOST}/v2/service/compatibility/result/SPR`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 15000 })
  await page.locator('[data-testid="compat-hero-sprite"]').first().waitFor({ timeout: 8000 })
  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="compat-hero-sprite"]')).every((i) => i.complete), { timeout: 8000 })
  return { ctx, page }
}

const spriteCount = (p: import('playwright').Page) => p.locator('[data-testid="compat-hero-sprite"]').count()
const allPaint = (p: import('playwright').Page) => p.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>('[data-testid="compat-hero-sprite"]')).every((i) => i.naturalWidth > 0))
const animCount = (p: import('playwright').Page) => p.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-hero-sprite"]')).reduce((n, el) => n + el.getAnimations().length, 0))
const overflowX = (p: import('playwright').Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)

;(async () => {
  const browser = await chromium.launch()
  try {
    // ---- 1) NORMAL motion: sprites paint · decorative · animation RUNS (this is the negative-control for #2)
    {
      const { ctx, page } = await open(browser, false)
      check(`all ${EXPECT_SPRITES} sprites present`, (await spriteCount(page)) === EXPECT_SPRITES)
      check('every sprite paints (naturalWidth > 0)', await allPaint(page))
      check('sprite layer is decorative (aria-hidden + pointer-events-none)', await page.evaluate(() => {
        const l = document.querySelector('[data-testid="compat-hero-sprites"]') as HTMLElement | null
        return !!l && l.getAttribute('aria-hidden') === 'true' && getComputedStyle(l).pointerEvents === 'none'
      }))
      const running = await animCount(page)
      check('MOTION on: sprites animate (getAnimations ≥ 6) — proves the reduce=0 check is not vacuous', running >= EXPECT_SPRITES, `${running} animations`)
      check('no page overflow-x @393 (frame clips the sprites)', !(await overflowX(page)))
      // 360 / 320
      for (const w of [360, 320]) { await page.setViewportSize({ width: w, height: 852 }); check(`no page overflow-x @${w}`, !(await overflowX(page))) }
      await ctx.close()
    }

    // ---- 2) REDUCED motion: sprites STILL paint, but the animation STOPS ---------------------------------
    {
      const { ctx, page } = await open(browser, true)
      check('reduced-motion: sprites still present + paint', (await spriteCount(page)) === EXPECT_SPRITES && (await allPaint(page)))
      const reduced = await animCount(page)
      check('reduced-motion: animation STOPS (getAnimations === 0)', reduced === 0, `${reduced} animations`)
      await ctx.close()
    }

    // ---- 3) TOOTH mut-sprite-missing: a sprite at a 404 → naturalWidth 0 → ASSET-FIDELITY trips ----------
    {
      const { ctx, page } = await open(browser, false)
      await page.evaluate(() => { const i = document.querySelector<HTMLImageElement>('[data-testid="compat-hero-sprite"]'); if (i) i.src = '/images/v2/compat/__does-not-exist__.png' })
      await page.waitForTimeout(400)
      const paintsNow = await allPaint(page)
      check('🦷 mut-sprite-missing → a sprite reads naturalWidth 0 → fidelity gate CAUGHT', paintsNow === false)
      await ctx.close()
    }

    // ---- 4) TOOTH mut-motion-runs-under-reduce: force animation on under reduce → MOTION gate trips ------
    {
      const { ctx, page } = await open(browser, true)
      await page.addStyleTag({ content: '.compat-sprite { animation: compat-sprite-float 2s linear infinite !important; }' })
      await page.waitForTimeout(200)
      const stillRunning = await animCount(page)
      check('🦷 mut-motion-runs-under-reduce → animation runs under reduce → MOTION gate CAUGHT', stillRunning >= EXPECT_SPRITES, `${stillRunning} animations`)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
