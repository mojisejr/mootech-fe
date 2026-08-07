// harness/run-service-hub.ts — anchor for the บริการทั้งหมด service hub (Figma 333:7519).
//
// REPAIRED 2026-08-05. Verified baseline before touching anything: on main this file RAN and came back
// ❌ FAIL (5). Its independent EXPECT list had drifted — `services.ts` moved couple/coworker onto the real
// compatibility routes in 40332b4 (2026-07-29) and the list still said coming-soon — so the screen had a
// working anchor that had been red for a week. harness/* is not in the CI gate (CI runs scripts/*.test.ts),
// so red here is only red if somebody runs it. That is the actual gap, and it is not fixed by code.
//
// Correcting my own first reading, which is in the git history of this file and in the ledger: I first ran
// it WITHOUT `--tsconfig harness/tsconfig.json`, got `ReferenceError: React is not defined`, and concluded
// the anchor had been dead since July. The flag is documented in service-hub.verify-evidence.md and the
// anchor runs fine with it. Operator error, not a broken anchor — and worth leaving written down, because
// "the guard was never working" is a much more comfortable story than "the guard was working and nobody
// looked", and I reached for the comfortable one first.
//
// The component-level render is dropped anyway — the art is VISIBLE now, so the ground truth is the
// rendered page rather than a server-rendered string, and with react-dom gone the special tsconfig is no
// longer needed either. That is a simplification, not a repair.
//
// WHAT IT PROVES
//   NO-ORPHAN    — exactly 11 cards render, in Figma order, and healing-circles (no delivered art, hidden
//                  by ฟีม 2026-08-05) is absent from the DOM — absent, not merely invisible.
//   DESTINATION  — each card points at its EXPECTED href (the list below is hand-written, NOT imported
//                  from services.ts, so a wrong edit there is caught rather than echoed).
//   REACHABILITY — every card is clickable and LANDS on that destination (4th completeness axis, live).
//   ART-PRESENT  — every card's artwork actually DECODED (naturalWidth > 0). A 404 leaves the <img> in the
//                  DOM with a perfectly valid bounding box; only naturalWidth separates painted from broken.
//   TEXT-CLEAR   — the copy never reaches the artwork. Measured off PIXELS, not off a constant: the copy is
//                  hidden, the card is photographed, and the leftmost column that differs from the #FBF6FA
//                  ground IS the art's edge. No Figma coordinate is trusted anywhere in this check.
//   ART-INTACT   — the artwork keeps its own shape. The INK bounding box in the rendered card is compared
//                  with the ink bounding box of the very file the <img> is pointing at, read off disk. Ink
//                  against ink is scale-free, so it means one thing and one thing only: distortion. (The
//                  first attempt measured "how tall is the painted band" instead, which reads short by up
//                  to 5px on files whose art does not touch its own top row — a number that moves for
//                  reasons unrelated to stretching is not an invariant.)
//   CARD-EDGE    — the card's shadow actually paints. It is load-bearing now: the art ground #FBF6FA sits
//                  6/255 from the page cream #FAF7F4, so without a shadow the card has no visible edge.
//   plus: no overflow-x at any width · บริการ tab active · 0 app-fetch · console 0.
//
// TEETH (each reproduces a bug that shipped or was one edit away — demonstrated in the evidence doc):
//   • mut-px-gutter    — #mut-px-gutter · swap the copy column's w-[47%] for a fixed w-[159px] (the value
//                        measured at 393) → TEXT-CLEAR trips at 320. This is the #166/#174 bug-class.
//   • mut-art-squish   — #mut-art-squish · object-contain → object-fill → ART-INTACT trips (the art fills
//                        the tall card and distorts; the DOM, the class list and every rect stay valid).
//   • mut-flat-card    — #mut-flat-card · drop shadow-card-soft → CARD-EDGE trips (the card dissolves into
//                        the page; nothing else in the DOM changes at all).
//   • mut-drop-card    — #mut-drop-card · remove any service from services.ts → NO-ORPHAN/enumerate trips.
//   • mut-orphan-shown — #mut-orphan-shown · render SERVICES instead of VISIBLE_SERVICES → healing-circles
//                        reappears with no art → NO-ORPHAN trips.
//   • mut-broken-src   — #mut-broken-src · point one card's image at a missing file → ART-PRESENT trips on
//                        natural 0×0. It was written expecting TEXT-CLEAR to stay green (a 404 having no
//                        geometry); running it showed TEXT-CLEAR trips too, because the broken element
//                        still paints something at x=0. Recorded as observed, not as predicted.
//
// VERIFY-INSTRUMENT: TEXT-CLEAR and ART-INTACT are negative-controlled inside the run — the probe first
// confirms it can SEE artwork at all (a card photographing as uniform ground would make both vacuously
// green), and that control failing ABORTS the run rather than reporting a pass.
//
// Run (FE up, from the worktree root):  CAPTURE_HOST=http://localhost:3101 npx tsx harness/run-service-hub.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const SIZES = [320, 360, 393, 430]

// the flat ground every delivered file is painted on (sampled off all 11: identical, deviation 0)
const GROUND = { r: 0xfb, g: 0xf6, b: 0xfa }
// a pixel this far from the ground is artwork, not compression noise
const ART_TOL = 12

// INDEPENDENT expected list (Figma order) — hand-written here, not imported from services.ts, so this
// anchor is a real second opinion on the data rather than a mirror of it. A `dest` ending in '=' means
// the shared coming-soon page carrying the service name.
const EXPECT: { id: string; titleFragment: string; dest: string }[] = [
  { id: 'couple', titleFragment: 'ดูดวงคู่รัก', dest: '/v2/service/compatibility/love' },
  { id: 'coworker', titleFragment: 'ดูดวงเพื่อนร่วมงาน', dest: '/v2/service/compatibility/colleague' },
  { id: 'one-book', titleFragment: 'หนังสือเล่มเดียวในโลก', dest: '/v2/service/coming-soon?service=' },
  { id: 'oracle-kiang', titleFragment: 'เสี่ยงไพ่ออราเคิลเคี้ยงคุง', dest: '/v2/service/coming-soon?service=' },
  { id: 'spirit-heaven', titleFragment: 'เสี่ยงไพ่จิตวิญญาณแดนสวรรค์', dest: '/v2/service/coming-soon?service=' },
  { id: 'sian', titleFragment: 'เสี่ยงเซียนเสี่ยงทาย', dest: '/v2/service/coming-soon?service=' },
  { id: 'sinsae', titleFragment: 'กับซินแส', dest: '/v2/service/coming-soon?service=' },
  { id: 'manifest', titleFragment: 'มานิเฟส', dest: '/v2/service/coming-soon?service=' },
  { id: 'calendar', titleFragment: 'ปฏิทิน', dest: '/v2/calendar' },
  { id: 'sacred-map', titleFragment: 'แผนที่ศักดิ์สิทธิ์', dest: '/v2/service/coming-soon?service=' },
  { id: 'shop', titleFragment: 'ร้านค้าของเรา', dest: '/v2/shop' },
]
// hidden until its artwork is delivered — must NOT be in the DOM
const HIDDEN_ID = 'healing-circles'

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

// the preview passkey alone is NOT enough: without a user identity /v2/service redirects to /v2 and the
// whole run measures an empty page. The old file missed this and reported "0 cards" as eleven failures
// instead of naming the real cause — so the identity cookies go in here, and the caller asserts it landed.
async function login(ctx: BrowserContext) {
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'cookie-mumate-id', value: 'service-hub-anchor', domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มุน', domain: host, path: '/' },
  ])
}

/** go to the hub and REFUSE to continue if we were bounced — a redirected run would report a screenful of
 *  green "absent" checks that are true only because nothing rendered. */
async function gotoHub(page: Page) {
  // NOT networkidle: eleven lazy images mean the network may never go quiet, and a run that times out
  // reports nothing at all. Wait for the thing actually being measured — a rendered card — instead.
  await page.goto(`${HOST}/v2/service`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('a[data-testid^="service-card-"]', { timeout: 20000 }).catch(() => undefined)
  if (!page.url().includes('/v2/service')) {
    console.log(`  ✗ SETUP: /v2/service bounced to ${page.url().replace(HOST, '')} — nothing below would be measuring the hub. Aborting.`)
    process.exit(1)
  }
}

/** photograph one card and report, in CSS px relative to the card, where the artwork starts and how tall
 *  the painted band is. The copy is hidden first: otherwise the text itself is "not the ground" and would
 *  be read as artwork. This is why no Figma coordinate appears anywhere in the visual checks. */
async function photographArt(page: Page, id: string, dsf: number) {
  const card = page.locator(`[data-testid="service-card-${id}"]`)
  const copy = card.locator(':scope > div').first()
  // An element screenshot photographs the REGION the element occupies, not the element's own paint — the
  // fixed Menubar sits on top of whatever card is under it and lands in the picture. First run of this
  // probe read the nav's dark pill, which spans the full width, as "art at x=0" on every card the nav
  // happened to cover. Both overlays come out for the shot and go straight back.
  await page.evaluate(() => { const n = document.querySelector('nav[aria-label="เมนูหลัก"]') as HTMLElement | null; if (n) n.style.visibility = 'hidden' })
  await copy.evaluate((el: HTMLElement) => { el.style.visibility = 'hidden' })
  const shot = await card.screenshot()
  await copy.evaluate((el: HTMLElement) => { el.style.visibility = '' })
  await page.evaluate(() => { const n = document.querySelector('nav[aria-label="เมนูหลัก"]') as HTMLElement | null; if (n) n.style.visibility = '' })

  const png = PNG.sync.read(shot)
  const W = png.width
  const H = png.height
  // The screenshot is the border-box, so the four rounded CORNER ARCS show what lies behind the card —
  // page + shadow, which reads ~rgb(239,237,235): about 15 away from the ground, just past the tolerance.
  // First run of this probe reported "art at x=0" on all 11 cards because of exactly that, so the arcs are
  // excluded. Excluded as ARCS and not as full-width bands on purpose: the art's topmost row is the whole
  // basis of ART-INTACT, and a band deep enough to clear the bottom corners would swallow it.
  const R = Math.round(24 * dsf)
  const inCornerArc = (x: number, y: number) => {
    const dx = x < R ? R - x : x >= W - R ? x - (W - R - 1) : 0
    const dy = y < R ? R - y : y >= H - R ? y - (H - R - 1) : 0
    return dx > 0 && dy > 0 && dx * dx + dy * dy > R * R
  }
  let artLeft = W
  let artTop = H
  let artRight = -1
  let artBottom = -1
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const i = (W * y + x) << 2
      if (png.data[i + 3] < 250) continue
      if (inCornerArc(x, y)) continue
      const d = Math.max(Math.abs(png.data[i] - GROUND.r), Math.abs(png.data[i + 1] - GROUND.g), Math.abs(png.data[i + 2] - GROUND.b))
      if (d > ART_TOL) {
        if (x < artLeft) artLeft = x
        if (y < artTop) artTop = y
        if (x > artRight) artRight = x
        if (y > artBottom) artBottom = y
      }
    }
  }
  const found = artRight >= 0
  return {
    cardW: W / dsf,
    cardH: H / dsf,
    artLeft: found ? artLeft / dsf : Infinity,
    /** aspect of the artwork's INK, which is what stretching actually changes. Deliberately not "how tall
     *  is the painted band": the band's top rows are plain ground on most files, so that number reads
     *  short for reasons that have nothing to do with distortion — it disagreed with itself by 5px across
     *  cards on the first run. Ink-vs-ink against the source file is scale-free and means one thing. */
    inkRatio: found && artBottom > artTop ? (artRight - artLeft + 1) / (artBottom - artTop + 1) : 0,
  }
}

/** the same ink-bbox measurement, run on the source file — the reference the rendered card is held to. */
const sourceInkRatioCache = new Map<string, number>()
function sourceInkRatio(localPath: string): number {
  const cached = sourceInkRatioCache.get(localPath)
  if (cached !== undefined) return cached
  const png = PNG.sync.read(fs.readFileSync(path.resolve(process.cwd(), 'public', localPath.replace(/^\//, ''))))
  const W = png.width
  const H = png.height
  let l = W
  let t = H
  let r = -1
  let b = -1
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const i = (W * y + x) << 2
      const d = Math.max(Math.abs(png.data[i] - GROUND.r), Math.abs(png.data[i + 1] - GROUND.g), Math.abs(png.data[i + 2] - GROUND.b))
      if (d > ART_TOL) {
        if (x < l) l = x
        if (y < t) t = y
        if (x > r) r = x
        if (y > b) b = y
      }
    }
  }
  const ratio = r >= 0 && b > t ? (r - l + 1) / (b - t + 1) : 0
  sourceInkRatioCache.set(localPath, ratio)
  return ratio
}

async function main() {
  console.log('\nrun-service-hub')
  const browser = await chromium.launch()
  const DSF = 2

  // ── every size: no overflow-x · exactly 11 cards · the hidden one is ABSENT ──
  for (const w of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 820 }, deviceScaleFactor: DSF })
    await login(ctx)
    const page = await ctx.newPage()
    await gotoHub(page)
    await page.waitForTimeout(250)
    check(`@${w} no overflow-x`, await overflowOk(page))
    const count = await page.locator('a[data-testid^="service-card-"]').count()
    check(`@${w} NO-ORPHAN: exactly ${EXPECT.length} cards`, count === EXPECT.length, `found ${count}`)
    check(`@${w} NO-ORPHAN: "${HIDDEN_ID}" absent from the DOM`, (await page.locator(`[data-testid="service-card-${HIDDEN_ID}"]`).count()) === 0)
    await ctx.close()
  }

  // ── VISUAL: art decoded · copy never reaches the art · art keeps its aspect — every card, every size ──
  for (const w of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 820 }, deviceScaleFactor: DSF })
    await login(ctx)
    const page = await ctx.newPage()
    await gotoHub(page)
    // every card's art must be decoded before any of it is measured — lazy images below the fold have not
    // started loading yet, so scroll the whole list first and wait for the decode to finish.
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise((r) => setTimeout(r, 500))
      window.scrollTo(0, 0)
      await Promise.all(Array.from(document.images).map((im) => (im.complete ? Promise.resolve() : im.decode().catch(() => undefined))))
    })
    await page.waitForTimeout(300)

    // NEGATIVE CONTROL for the whole photographic method: if a card photographs as pure ground, both pixel
    // checks below would pass while measuring nothing. Prove the probe can see artwork before trusting it.
    const control = await photographArt(page, EXPECT[0].id, DSF)
    if (!Number.isFinite(control.artLeft) || control.inkRatio <= 0) {
      console.log(`  ✗ CONTROL @${w}: the probe cannot see artwork at all — every measurement below would be vacuous. Aborting.`)
      process.exit(1)
    }

    for (const e of EXPECT) {
      const painted = await page.locator(`[data-testid="service-card-${e.id}"] [data-testid="service-card-art"]`).evaluate((im) => ({ nw: (im as HTMLImageElement).naturalWidth, nh: (im as HTMLImageElement).naturalHeight, src: new URL((im as HTMLImageElement).src).pathname }))
      check(`@${w} ART-PRESENT "${e.id}": artwork decoded`, painted.nw > 0 && painted.nh > 0, `natural ${painted.nw}×${painted.nh}`)

      const geo = await photographArt(page, e.id, DSF)
      const copyRight = await page.locator(`[data-testid="service-card-${e.id}"] > div`).first().evaluate((el, sel) => {
        const card = (el.closest(sel as string) as HTMLElement).getBoundingClientRect()
        return Math.round(el.getBoundingClientRect().right - card.left)
      }, `[data-testid="service-card-${e.id}"]`)
      const gap = Math.round(geo.artLeft - copyRight)
      check(`@${w} TEXT-CLEAR "${e.id}": copy ends before the art`, gap > 0, `copy→${copyRight}px · art@${Math.round(geo.artLeft)}px · gap ${gap}px`)

      const wantRatio = sourceInkRatio(decodeURIComponent(painted.src))
      const drift = wantRatio > 0 ? Math.abs(geo.inkRatio - wantRatio) / wantRatio : 1
      check(`@${w} ART-INTACT "${e.id}": rendered ink matches the source's shape`, drift <= 0.05, `ink ${geo.inkRatio.toFixed(3)} vs source ${wantRatio.toFixed(3)} (${(drift * 100).toFixed(1)}% off)`)
    }
    await ctx.close()
  }

  // ── CARD-EDGE: the shadow paints. Photograph the strip just under a card and require it to be darker
  //    than the page ground far from any card — the card's own surface is 6/255 from the page, so this is
  //    the only thing left separating them. ──
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 820 }, deviceScaleFactor: DSF })
    await login(ctx)
    const page = await ctx.newPage()
    await gotoHub(page)
    await page.waitForTimeout(400)
    // Sampled under the LAST card, not the first. The first card sits directly beneath the BG01 hero, so
    // "the page 40px above it" is the hero gradient — darker than the shadow, which made this check read
    // backwards (under 228.3 vs "page" 223.4) and fail on a card whose shadow was painting perfectly.
    // Below the last card the list's pb-36 leaves real, empty page to compare against.
    // the fixed Menubar covers the page exactly where the clean-ground sample belongs (it read 26.0 —
    // the nav's black pill — the first time). Same overlay, second place it lies about the picture.
    await page.evaluate(() => {
      const n = document.querySelector('nav[aria-label="เมนูหลัก"]') as HTMLElement | null
      if (n) n.style.visibility = 'hidden'
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(500)
    const box = (await page.locator(`[data-testid="service-card-${EXPECT[EXPECT.length - 1].id}"]`).boundingBox())!
    const shot = PNG.sync.read(await page.screenshot())
    const sampleRow = (yCss: number) => {
      const y = Math.round(yCss * DSF)
      const x0 = Math.round((box.x + box.width * 0.4) * DSF)
      let sum = 0
      let n = 0
      for (let x = x0; x < x0 + 40; x++) {
        const i = (shot.width * y + x) << 2
        sum += (shot.data[i] + shot.data[i + 1] + shot.data[i + 2]) / 3
        n++
      }
      return sum / n
    }
    const underCard = sampleRow(box.y + box.height + 3)
    const awayFromCard = sampleRow(box.y + box.height + 70)
    check('CARD-EDGE: shadow darkens the strip under the card', underCard < awayFromCard - 1.5, `under ${underCard.toFixed(2)} vs page ${awayFromCard.toFixed(2)}`)
    await ctx.close()
  }

  // ── @393 deep: destinations, tab active, click-walk every card, 0-fetch, console 0 ──
  const ctx = await browser.newContext({ viewport: { width: 393, height: 820 }, deviceScaleFactor: DSF })
  await login(ctx)
  const page = await ctx.newPage()
  const tracker = trackAppFetches(page)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))

  await gotoHub(page)
  await page.waitForTimeout(300)

  for (let i = 0; i < EXPECT.length; i++) {
    const e = EXPECT[i]
    const card = page.locator(`[data-testid="service-card-${e.id}"]`)
    const href = (await card.getAttribute('href')) || ''
    const text = (await card.textContent()) || ''
    check(`card ${i + 1}/${EXPECT.length} "${e.id}": href → ${e.dest}${e.dest.endsWith('=') ? '…' : ''}`, href.startsWith(e.dest), href)
    check(`card ${i + 1}/${EXPECT.length} "${e.id}": title present`, text.includes(e.titleFragment), text.slice(0, 24))
  }

  const activeTab = page.locator('nav a[href="/v2/service"][aria-current="page"]')
  check('menubar บริการ tab active (aria-current=page)', (await activeTab.count()) === 1 && ((await activeTab.textContent()) || '').includes('บริการ'))

  for (let i = 0; i < EXPECT.length; i++) {
    const e = EXPECT[i]
    await gotoHub(page)
    await page.locator(`[data-testid="service-card-${e.id}"]`).click()
    await page.waitForTimeout(350)
    const landed = decodeURIComponent(page.url())
    const ok = e.dest.endsWith('=') ? landed.includes('/v2/service/coming-soon') && landed.includes(e.titleFragment) : landed.includes(e.dest)
    check(`click ${i + 1}/${EXPECT.length} "${e.id}" → lands on ${e.dest}${e.dest.endsWith('=') ? '<name>' : ''}`, ok, ok ? '' : `landed: ${landed.replace(HOST, '')}`)
  }

  await page.goto(`${HOST}/v2/service/coming-soon?service=${encodeURIComponent('มานิเฟส')}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  check('coming-soon NAMES the tapped service', ((await page.locator('[data-testid="coming-soon-title"]').textContent()) || '').includes('มานิเฟส'))
  check('coming-soon has a way back (→ /v2/service)', (await page.locator('[data-testid="coming-soon-back"][href="/v2/service"]').count()) === 1)
  check('coming-soon: บริการ tab still active', (await page.locator('nav a[href="/v2/service"][aria-current="page"]').count()) === 1)

  // Was "0 app-fetch". That was true when the hub was purely presentational and stopped being true in Zone
  // 4 (#171), when the อัพเกรด pill started reading the real tier — the invariant went stale, the code did
  // not regress. "Zero" is replaced by the sharper statement: the ONLY thing this screen may ask the app
  // for is the viewer's tier. Anything else appearing here is still a finding.
  const nonTier = tracker.appFetches.filter((u) => !u.includes('/api/user'))
  check('app-fetch: the tier lookup and nothing else', nonTier.length === 0, nonTier.slice(0, 3).join(', '))
  check('console 0', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await ctx.close()
  await browser.close()

  console.log(`\n${failed === 0 ? '✅ run-service-hub PASS' : `❌ run-service-hub FAIL (${failed})`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
