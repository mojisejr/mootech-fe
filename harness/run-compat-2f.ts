// harness/run-compat-2f.ts — anchor for ดวงสมพงศ์ ก้อน 2F: "จอรอครอบช่วงคำนวณ" (the loader moved onto the FORM).
// LENS = visual/presentation + a behavioural fire-once. Ground-truth = what the FORM screen RENDERS while the
// (side-effecting) calc is in flight — not what a state var says. This owns 2F's invariants; it drives the REAL
// CompatibilityScreen (picker) through the real modal, mocking only the v1/BE HTTP (never touching pages/matching).
//
// Invariants owned here (2F):
//   D30  while calculating, the whole FORM is replaced by the full-screen LoadingScreen (role=status). The
//        heavy work (calculateCompatibility) runs on the form, so the wait must SHOW on the form — not behind
//        the button. Assertion: during the calc window, role=status is up AND [data-testid=compat-screen] is gone.
//   D31  the button carries NO loading state — its label is always "ดูผลลัพธ์เลย", never "กำลังคำนวณ…".
//   D32/D35  ONE continuous wait: the form-phase loader and the result-phase loader show the SAME copy
//        (title + the ฟีม-verbatim subtitle). Asserted equal, and equal to COMPAT_CALC_LOADING.
//   D33  fire-ONCE: a rapid multi-tap on the button fires POST /user-matching exactly once (firingRef latch).
//   D34  calc failure → back on the FORM with compat-result-error, loader gone — never stranded on the loader.
//
// TOOTH (proven live in compat-2f.verify-evidence.md):
//   • mut-loader-on-result-only — delete the form's early-return LoadingScreen (revert to the shipped bug:
//     the wait shows as "กำลังคำนวณ…" on the button while the heavy calc runs, loader only on the result read).
//     The D30 assertion (loader up + form gone DURING calc) then fails → CAUGHT. This is the EXACT bug ฟีม hit.
//
// Run (dev up on :3023 with env loaded):
//   set -a; . testenv/env/fe.env; set +a; next dev -p 3023
//   CAPTURE_HOST=http://localhost:3023 npx tsx harness/run-compat-2f.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { COMPAT_CALC_LOADING } from '../features/v2-service/components/compat-loading-copy'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3023'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const FRIEND_ID = 'FRIEND-2F-1'
const SHOT_DIR = path.resolve(process.cwd(), 'harness/pixel-proof')

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

// result blob the result screen reads after the navigate (get-detail → { result: "<json>" } → .pairMatch)
function detailBody() {
  const pairMatch = {
    overall: { percent: 82, grade: 'A', gradeLabel: 'เข้ากันดีมาก', hearts: 4, emoji: '💞', ratingText: 'โดยรวมหนุนกันได้ดี' },
    persons: {
      a: { displayName: 'มิลา', birthDate: '1994-06-14', time: '09:30', dayGanzhi: '壬午', elementTh: 'น้ำ' },
      b: { displayName: 'ก้อง', birthDate: '1992-08-01', time: '05:30', dayGanzhi: '戊子', elementTh: 'ดิน' },
    },
  }
  return JSON.stringify({ result: JSON.stringify({ pairMatch }) })
}

// Wire every HTTP the form + result need. `calc` counts POSTs (fire-once) and can delay (to catch the loader).
// `calcResult` = 'ok' → returns a matching_id (happy) · 'fail' → { error } with no id (D34 error path).
async function wire(page: Page, opts: { calcDelayMs?: number; calcResult?: 'ok' | 'fail'; counter?: { n: number } }) {
  const { calcDelayMs = 0, calcResult = 'ok', counter } = opts
  // person1 (current user)
  await page.route((u) => u.pathname.endsWith('/api/user'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: USER_ID, name: 'มิลา', dob: '1994-06-14', time: '09:30', picture_url: '' }) }))
  // friend LIST (modal) — one selectable friend
  await page.route((u) => u.pathname.endsWith('/api/member-with-friend'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: FRIEND_ID, name: 'ก้อง', surname: '', picture_url: null, is_disable: false }]) }))
  // friend DETAIL (enrich dob/time) — endsWith detail; registered so the list route above never matches it
  await page.route((u) => u.pathname.endsWith('/api/member-with-friend/detail'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: FRIEND_ID, name: 'ก้อง', dob: '1992-08-01', time: '05:30' }) }))
  // result read (after navigate)
  await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: detailBody() }))
  // THE calc (side-effecting) — count + optional delay. endsWith('/user-matching') excludes '/detail'.
  await page.route((u) => u.pathname.endsWith('/user-matching'), async (route) => {
    if (counter) counter.n += 1
    if (calcDelayMs) await new Promise((r) => setTimeout(r, calcDelayMs))
    if (calcResult === 'fail') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'quota' }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matching_id: 'TEST-2F-1' }) })
  })
}

// drive the form until the "ดูผลลัพธ์เลย" button is enabled (person1 loaded + friend picked)
async function reachEnabledForm(page: Page) {
  await page.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-person1-name"]').waitFor({ timeout: 8000 })
  await page.locator('[data-testid="compat-person2"]').click()             // open select modal
  await page.locator('[data-testid="compat-select-modal"]').waitFor({ timeout: 4000 })
  await page.locator(`[data-testid="compat-friend-${FRIEND_ID}"]`).click() // pick the friend
  // button enabled = sapphire, not disabled
  await page.locator('[data-testid="compat-view-result"]:not([disabled])').waitFor({ timeout: 4000 })
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    // ---- 1) happy: form-ready → rapid-tap → loader-ON-FORM → navigate → result (3 shots + fire-once + copy) --
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      const errs: string[] = []
      const warns: string[] = []
      // design-verify.yml gates on CONSOLE NOISE, so a "harmless" warning can redden the harness — capture
      // warnings too (esp. a React setState-after-unmount if the success path ever touched state; it must not).
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); if (m.type() === 'warning') warns.push(m.text()) })
      const counter = { n: 0 }
      await wire(page, { calcDelayMs: 900, calcResult: 'ok', counter })
      await reachEnabledForm(page)

      // D31: the button's label is "ดูผลลัพธ์เลย" (no loading text) while enabled
      const label = (await page.locator('[data-testid="compat-view-result"]').innerText()).trim()
      check('D31 button label = "ดูผลลัพธ์เลย" (no loading state)', label === 'ดูผลลัพธ์เลย', label)
      // the button uses `transition-colors`; capturing the instant it enables catches a gray mid-transition
      // frame (looks disabled). Settle to the resting sapphire before the shot AND assert it — the evidence
      // must show the TRUE enabled state, not an in-between paint (verify the instrument: shot = settled state).
      const SAPPHIRE = 'rgb(20, 85, 164)'
      await page.waitForFunction((rgb) => {
        const el = document.querySelector('[data-testid="compat-view-result"]') as HTMLElement | null
        return !!el && getComputedStyle(el).backgroundColor === rgb
      }, SAPPHIRE, { timeout: 4000 }).catch(() => {})
      const btnBg = await page.$eval('[data-testid="compat-view-result"]', (el) => getComputedStyle(el as HTMLElement).backgroundColor)
      check('button PAINTS enabled (sapphire, not gray) when both people set', btnBg === SAPPHIRE, btnBg)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2f-1-form-ready.png') })

      // D32 continuity — a still screenshot CANNOT prove the absence of a transient white frame across the
      // form→result nav (it can't catch the sub-second handoff; ตู๋ was right, I was overclaiming). Instead
      // record role=status presence every animation frame: client-nav is SAME-DOCUMENT, so this rAF loop
      // survives the route swap and gives a frame-level trace of the handoff.
      // string-eval (NOT an arrow fn) so tsx/esbuild's keepNames helper isn't injected into the page context
      await page.evaluate(`
        window.__frames = [];
        (function loop(){
          window.__frames.push(document.querySelectorAll('[role="status"]').length);
          window.__raf = requestAnimationFrame(loop);
        })();
      `)

      // D33: the strongest fire-once test — dispatch 5 real DOM clicks in ONE synchronous tick, before React
      // can re-render. A `calculating` state var alone would let the 2nd–5th clicks re-enter onViewResult with
      // a stale (false) closure and fire the side-effecting calc 5×; the firingRef latch short-circuits them.
      await page.$eval('[data-testid="compat-view-result"]', (el) => { for (let i = 0; i < 5; i++) (el as HTMLElement).click() })

      // D30: DURING the calc window the full-screen loader is up AND the form is gone
      const loader = page.locator('[role="status"]')
      const loaderSeen = await loader.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
      check('D30 loader covers the FORM during calc', loaderSeen)
      const formGone = (await page.locator('[data-testid="compat-screen"]').count()) === 0
      check('D30 form is replaced (not just overlaid) during calc', formGone)
      const noSpinnerButton = (await page.locator('[data-testid="compat-view-result"]').count()) === 0
      check('D31 no "กำลังคำนวณ…" button lingering under the loader', noSpinnerButton)
      // D35: the form-phase loader copy is the ฟีม-verbatim string (and the shared constant)
      const formTitle = (await loader.locator('h1').innerText()).trim()
      const formSub = (await loader.getByText(COMPAT_CALC_LOADING.subtitle).count())
      check('D35 form loader title = ฟีม copy', formTitle === COMPAT_CALC_LOADING.title, formTitle)
      check('D35 form loader subtitle = ฟีม copy (verbatim)', formSub === 1)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2f-2-loading.png') })

      // navigate completes → result screen ready
      await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 12000 })
      check('D33 calc fired EXACTLY once on rapid multi-tap', counter.n === 1, `count=${counter.n}`)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2f-3-result.png') })

      // D32 frame-level continuity: stop the recorder; within the loader-active span (first loader frame →
      // last loader frame, i.e. the whole form-loader→handoff→result-loader window) there must be NO frame
      // with zero role=status — a 0 sandwiched between 1s is exactly a blank flash. CAVEAT (stated in
      // evidence): rAF ~60fps → this bounds a flash to < ~16ms; a sub-frame blank is below this and below
      // human perception, so this OBSERVES continuity at frame granularity — it does not prove zero-flash absolutely.
      const frames = (await page.evaluate(`(function(){ cancelAnimationFrame(window.__raf); return window.__frames; })()`)) as number[]
      const firstOne = frames.findIndex((n) => n >= 1)
      const lastOne = frames.length - 1 - [...frames].reverse().findIndex((n) => n >= 1)
      const gapZeros = firstOne >= 0 ? frames.slice(firstOne, lastOne + 1).filter((n) => n === 0).length : -1
      check('D32 no blank frame between form-loader & result (rAF trace)', gapZeros === 0, `frames=${frames.length} loaderSpan=[${firstOne}..${lastOne}] blankFrames=${gapZeros}`)

      check('console errors + warnings = 0 (design-verify noise gate)', errs.length === 0 && warns.length === 0, [...errs.map((e) => 'E:' + e), ...warns.map((w) => 'W:' + w)].join(' | '))
      await ctx.close()
    }

    // ---- 2) D32/D35 continuity: the RESULT-phase loader shows the SAME copy as the form-phase loader --------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      // slow the result read so its loader is observable; deep-link straight to the result
      await page.route((u) => u.pathname.endsWith('/user-matching/detail'), async (route) => {
        await new Promise((r) => setTimeout(r, 900)); await route.fulfill({ status: 200, contentType: 'application/json', body: detailBody() })
      })
      await page.goto(`${HOST}/v2/service/compatibility/result/TEST-2F-1`, { waitUntil: 'commit' })
      const loader = page.locator('[role="status"]')
      await loader.waitFor({ state: 'visible', timeout: 4000 })
      const rTitle = (await loader.locator('h1').innerText()).trim()
      const rSub = await loader.getByText(COMPAT_CALC_LOADING.subtitle).count()
      check('D32 result loader title = SAME as form (ฟีม copy)', rTitle === COMPAT_CALC_LOADING.title, rTitle)
      check('D32 result loader subtitle = SAME as form (verbatim)', rSub === 1)
      await ctx.close()
    }

    // ---- 3) D34 error path: calc fails → back on the FORM with error, NOT stranded on the loader -------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await wire(page, { calcDelayMs: 100, calcResult: 'fail' })
      await reachEnabledForm(page)
      await page.locator('[data-testid="compat-view-result"]').click()
      await page.locator('[data-testid="compat-result-error"]').waitFor({ timeout: 6000 })
      const backOnForm = (await page.locator('[data-testid="compat-screen"]').count()) === 1
      const loaderGone = (await page.locator('[role="status"]').count()) === 0
      check('D34 error → back on the FORM (compat-screen visible)', backOnForm)
      check('D34 error → NOT stranded on the loader', loaderGone)
      await ctx.close()
    }

    // ---- 4) D34b (ตู๋ catch — the REAL hole): calc OK (quota spent) but router.push FAILS → recover ----------
    // An un-awaited push, if rejected (route cancelled / thrown gSSP) or resolving false (nav prevented),
    // would leave calculating=true + the latch closed → the user is stranded on the loader forever. The fix
    // awaits push in try/catch and treats reject OR !navigated as failure → release + back to form + error.
    // A network-mock can't force this in Next dev (it hard-falls-back on data/chunk errors), so we override
    // push on Next's SINGLETON router (window.next.router — the same instance useRouter() returns) to fail
    // deterministically WITHOUT navigating away, so the "recover on the form" behaviour is observable.
    // (This is also the tooth for the hole: revert the await+catch and the rejected push strands the loader.)
    for (const c of [
      { name: 'reject', stub: `(function(){ window.next.router.push = function(){ return Promise.reject(new Error('forced-reject')) } })()` },
      { name: 'false', stub: `(function(){ window.next.router.push = function(){ return Promise.resolve(false) } })()` },
    ]) {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await wire(page, { calcDelayMs: 30, calcResult: 'ok' })
      await reachEnabledForm(page)
      await page.evaluate(c.stub)                                    // make the upcoming push fail
      await page.$eval('[data-testid="compat-view-result"]', (el) => (el as HTMLElement).click())
      await page.locator('[data-testid="compat-result-error"]').waitFor({ timeout: 6000 }) // hangs here if stranded
      const backOnForm2 = (await page.locator('[data-testid="compat-screen"]').count()) === 1
      const loaderGone2 = (await page.locator('[role="status"]').count()) === 0
      const canRetry = (await page.locator('[data-testid="compat-view-result"]:not([disabled])').count()) === 1
      check(`D34b push ${c.name} → back on FORM, loader released, retry possible (not stranded)`, backOnForm2 && loaderGone2 && canRetry, `form=${backOnForm2} loaderGone=${loaderGone2} retry=${canRetry}`)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
