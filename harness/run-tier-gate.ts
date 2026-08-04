// harness/run-tier-gate.ts — Zone 4 anchor: the free-vs-paid gate across the v2 calendar flow.
// LENS = visual. Ground-truth = what a member of each tier actually SEES on the rendered screen.
//
// The drift this owns: /v2/calendar/[date] shipped with no tier logic whatsoever, so every section Figma
// marks paid (ความเข้ากัน 5 ด้าน · คำทำนายรายด้าน · โหมดแอดวานซ์ + the four advanced-only sections behind
// it) rendered for people who had not paid. A "does the day screen look right" check passes that happily —
// it looks right, it is just showing it to the wrong person. Only asking "who is looking" catches it.
//
// It drives the REAL hook. `useV2Tier` is exercised through its actual fetch by mocking /api/user at the
// network, not by stubbing the hook — which also closes the gap goo flagged when he shipped it (#169):
// he unit-tested `computeTier` (scripts/v2-tier.test.ts) but nothing had ever run the fetch lifecycle in
// a browser. paid / free / errored / slow are all four of its exits.
//
// Invariants owned here:
//   GATE-PAID     — a paid member sees the three paid sections, and NO อัพเกรด pill, and NO upsell.
//   GATE-FREE     — a free member sees the upsell + the pill, and the paid sections are ABSENT from the DOM
//                   (absent, not hidden — hidden content is still shipped content).
//   GATE-UNKNOWN  — while the tier is undetermined (in flight, or the user fetch failed) NEITHER branch
//                   renders. There is no safe default: guessing free robs a payer, guessing paid re-opens
//                   the leak.
//   ONE-NUMBER    — the upsell's tile percent, its sentence percent and the score ring's percent are the
//                   same figure (ฟีม 2026-08-04: Figma's 57-vs-75 was drift, not two metrics).
//   MOTION-TRACK  — the promo coin runs `v3-float-wide`, NOT the `compat-sprite-float` track the six upsell
//                   sprites run. Figma gives them different keyframes; borrowing one for the other is an
//                   invented motion value that looks fine and is wrong.
//   PROMO-EDGE    — the month promo's right edge lines up with the grid below it (ฟีม, คำถาม I: Figma's
//                   345px width left a 32px right margin on one card only — ruled a slip).
//   PAINT         — the two cards paint the sapphire ground, the lime CTA and both tile fills for real,
//                   read off the pixels rather than off the class list.
//   SSR-NEUTRAL   — the server-rendered HTML commits to NEITHER tier. Checked on the wire bytes with no
//                   browser, because every DOM assertion in this file passed while the server was handing
//                   paid members an upsell.
//   CLS           — free and paid each stay under 0.05 on both screens, asserted independently (a delta
//                   between them can go green while one of them regresses — it did).
//
// TEETH (each reproduces a bug that either shipped or was one edit away):
//   • mut-paid-leak      — render CompatList unconditionally → GATE-FREE trips. This IS main's behaviour.
//   • mut-upsell-on-paid — render the upsell unconditionally → GATE-PAID trips.
//   • mut-null-as-free   — treat `isPaid !== true` as free → GATE-UNKNOWN trips (a payer sees the upsell
//                          flash on every slow load — the bug the eye cannot catch at speed).
//   • mut-two-numbers    — hardcode 75 in the tile → ONE-NUMBER trips.
//   • mut-borrowed-motion— give the coin `.v3-float` → MOTION-TRACK trips.
//   • mut-ssr-seam       — #mut-ssr-seam · remove the mount-gate INSIDE useV2Tier (return computeTier on
//                          the server pass too) → SSR-NEUTRAL trips. RE-HOMED from mut-ssr-free: the SSR
//                          guard moved out of the useClientTier wrapper into the seam (goo follow-up), so
//                          the tooth now mutates the CAUSE (the seam's mount-gate) instead of the wrapper.
//                          Pairs with mut-ssr-paid-leak, which watches the EFFECT (paid bytes on the wire);
//                          this one watches the CAUSE (the seam committing a tier during SSR).
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-tier-gate.ts
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const DAY = '/v2/calendar/2026-07-14'
const MONTH = '/v2/calendar'
const SERVICE = '/v2/service'

const SAPPHIRE = 'rgb(20, 85, 164)'
const LIME = 'rgb(225, 255, 0)'
const SLATE_MUTED = 'rgb(148, 163, 184)'
const LEMON_CHIFFON = 'rgb(249, 244, 240)'

// the three sections Figma marks paid-only, by the testid each already ships with
const PAID_SECTIONS = ['day-advanced-toggle', 'day-compat-list', 'day-prediction-cards']

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

function readPasskey(): string {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n')
    .find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'

type Tier = 'paid' | 'free' | 'errored' | 'slow'

// how long the `slow` case holds the user fetch open. It resolves as PAID on purpose: the failure this
// scenario exists to catch is a paying member seeing the upsell flash before the answer lands.
const SLOW_MS = 2500

// The body shape is pages/api/user.ts's: the user row plus a `payment` composite. computeTier reads exactly
// two things off it — `user_id` (present ⇒ the response is a real user) and `payment.is_not_expired`.
const userBody = (isNotExpired: boolean) => ({
  user_id: USER_ID,
  name: 'มิลา',
  payment: { is_not_expired: isNotExpired, total_friend: 0, limit_friend: 3 },
})

async function open(browser: Browser, tier: Tier, width = 393): Promise<[BrowserContext, Page]> {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 })
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.route('**/api/user**', async (route) => {
    if (tier === 'errored') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) })
    // `slow` holds the answer back for longer than the assertions take, so the screen is measured while the
    // tier is genuinely in flight. A never-resolving route would do the same to the page but would also
    // hang the context teardown, so it is bounded rather than infinite.
    if (tier === 'slow') await new Promise((r) => setTimeout(r, SLOW_MS))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userBody(tier === 'paid' || tier === 'slow')) })
  })
  return [ctx, page]
}

// `networkidle` can never arrive while a request is deliberately held open, so the in-flight case waits for
// the document instead and then gives React its mount. Everything else keeps the stricter gate.
async function goto(page: Page, route: string, tier: Tier = 'free') {
  if (tier === 'slow') {
    await page.goto(HOST + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    return
  }
  await page.goto(HOST + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
}

const shown = async (page: Page, testId: string) => (await page.locator(`[data-testid="${testId}"]`).count()) > 0
// Paid CONTENT is judged on presence — absent, not hidden, because hidden content is still shipped to the
// client. Our own chrome is judged on VISIBILITY, since the undetermined state withholds the body with a
// class rather than unmounting it.
const visible = async (page: Page, testId: string) => page.locator(`[data-testid="${testId}"]`).first().isVisible().catch(() => false)

async function bgOf(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]`).first().evaluate((el) => getComputedStyle(el).backgroundColor)
}

// ---------------------------------------------------------------- day detail

async function dayScreen(browser: Browser, tier: Tier) {
  const [ctx, page] = await open(browser, tier)
  await goto(page, DAY, tier)
  const upsell = await shown(page, 'calendar-upsell')
  const pill = await shown(page, 'header-upgrade')
  const sections = await Promise.all(PAID_SECTIONS.map((t) => shown(page, t)))
  const anyPaid = sections.some(Boolean)
  const allPaid = sections.every(Boolean)

  if (tier === 'paid') {
    check('GATE-PAID · day · paid sections render', allPaid, sections.map((s, i) => `${PAID_SECTIONS[i]}=${s}`).join(' '))
    check('GATE-PAID · day · no upsell', !upsell)
    check('GATE-PAID · day · no อัพเกรด pill', !pill)
  }
  if (tier === 'free') {
    check('GATE-FREE · day · upsell renders', upsell)
    check('GATE-FREE · day · อัพเกรด pill renders', pill)
    check('GATE-FREE · day · paid sections ABSENT from the DOM', !anyPaid, sections.map((s, i) => `${PAID_SECTIONS[i]}=${s}`).join(' '))
  }
  if (tier === 'errored' || tier === 'slow') {
    check(`GATE-UNKNOWN · day · ${tier} · no paid sections`, !anyPaid)
    check(`GATE-UNKNOWN · day · ${tier} · no upsell`, !upsell)
    check(`GATE-UNKNOWN · day · ${tier} · no pill`, !pill)
  }
  if (tier === 'slow') {
    // …and once the held-back answer lands (as PAID), the screen must fill in. Without this the three
    // checks above would also pass on a page that simply never renders anything — a blank screen is not
    // the same as a correctly-withheld one.
    await page.waitForSelector('[data-testid="day-compat-list"]', { timeout: SLOW_MS + 5000 })
    check('GATE-UNKNOWN · day · slow · resolves to the paid view once the answer lands', await shown(page, 'day-compat-list'))
    check('GATE-UNKNOWN · day · slow · and never showed the upsell on the way', !(await shown(page, 'calendar-upsell')))
  }
  return [ctx, page] as const
}

async function upsellDetail(browser: Browser) {
  const [ctx, page] = await open(browser, 'free')
  await goto(page, DAY, 'free')

  // ONE-NUMBER — the three places a percent appears on this screen must agree.
  const tileText = (await page.locator('[data-testid="calendar-upsell-tile-free"] p').nth(1).innerText()).trim()
  const sentence = (await page.locator('[data-testid="calendar-upsell"] p').filter({ hasText: 'ค่าเฉลี่ยของ' }).first().innerText()).trim()
  const ringText = (await page.locator('[data-testid="day-score"]').first().innerText()).trim()
  const tilePct = tileText.match(/(\d+)%/)?.[1] ?? ''
  const sentencePct = sentence.match(/(\d+)%/)?.[1] ?? ''
  check('ONE-NUMBER · tile % == sentence %', tilePct !== '' && tilePct === sentencePct, `tile=${tilePct} sentence=${sentencePct}`)
  check('ONE-NUMBER · that % is the ring % too', ringText.includes(`${tilePct}%`), `ring text contains ${tilePct}%`)

  // PAINT — read the pixels' own report, not the class list.
  check('PAINT · upsell ground is sapphire', (await bgOf(page, 'calendar-upsell')) === SAPPHIRE, await bgOf(page, 'calendar-upsell'))
  check('PAINT · CTA is lime', (await bgOf(page, 'calendar-upsell-cta')) === LIME, await bgOf(page, 'calendar-upsell-cta'))
  check('PAINT · free tile is slate-muted', (await bgOf(page, 'calendar-upsell-tile-free')) === SLATE_MUTED, await bgOf(page, 'calendar-upsell-tile-free'))
  check('PAINT · mine tile is lemon-chiffon', (await bgOf(page, 'calendar-upsell-tile-mine')) === LEMON_CHIFFON, await bgOf(page, 'calendar-upsell-tile-mine'))

  // the CTA must not read as an operable control while payment v2 does not exist (ฟีม, คำถาม E)
  const ctaTag = await page.locator('[data-testid="calendar-upsell-cta"]').evaluate((el) => el.tagName)
  check('DEAD-CTA · rendered as a span, not a button', ctaTag === 'SPAN', ctaTag)

  // six decorations, each actually animating
  const sprites = await page.locator('[data-testid^="calendar-upsell-sprite-"]').count()
  check('SPRITES · five element sprites present', sprites === 5, String(sprites))
  const running = await page
    .locator('[data-testid="calendar-upsell"] .v3-float')
    .evaluateAll((els) => els.filter((e) => e.getAnimations().length > 0).length)
  check('SPRITES · all six floats are running', running === 6, `${running}/6`)

  // PAINT-ORDER — Figma draws the fire sprite AFTER the CTA, so it sits ON TOP of the lime. The first
  // build put all six decorations in one layer behind the content and the fire vanished under the button;
  // every check in this file stayed green, because "the element exists and is animating" says nothing
  // about which of two overlapping things the eye actually sees. So this reads the PIXEL where the two
  // overlap: if it comes back lime, the button won and the sprite is buried.
  {
    const rects = await page.evaluate(() => {
      const f = document.querySelector('[data-testid="calendar-upsell-sprite-fire"]')!.getBoundingClientRect()
      const c = document.querySelector('[data-testid="calendar-upsell-cta"]')!.getBoundingClientRect()
      const card = document.querySelector('[data-testid="calendar-upsell"]')!.getBoundingClientRect()
      const overlaps = f.right > c.left && f.left < c.right && f.bottom > c.top && f.top < c.bottom
      return {
        overlaps,
        x0: Math.round(Math.max(f.left, c.left) - card.left),
        x1: Math.round(Math.min(f.right, c.right) - card.left),
        y0: Math.round(Math.max(f.top, c.top) - card.top),
        y1: Math.round(Math.min(f.bottom, c.bottom) - card.top),
      }
    })
    check('PAINT-ORDER · the fire sprite overlaps the CTA at all', rects.overlaps, JSON.stringify(rects))
    // Two weaker versions of this check failed their own negative control before this one held, and both
    // failed the same way — they sampled pixels the BUTTON never paints. The CTA is a pill; the fire sits
    // at its left end, so most of the two rectangles' intersection is outside the rounded shape, and a
    // flame there proves nothing about who is on top. First a single point, then a flame-count over the
    // whole overlap: burying the sprite still left 114 flame pixels and neither could fail.
    //
    // So the sample area is derived instead of assumed: hide the sprite, photograph the button, and keep
    // only the pixels that came back LIME. Those are the ones the button really covers. Put the sprite
    // back and ask how many of exactly those pixels stopped being lime. If the sprite is behind the
    // button, the answer is zero, by construction.
    const card = page.locator('[data-testid="calendar-upsell"]')
    const hide = await page.addStyleTag({ content: '[data-testid="calendar-upsell-sprite-fire"]{display:none !important}' })
    const withoutFire = PNG.sync.read(await card.screenshot())
    await hide.evaluate((el) => (el as unknown as Element).remove())
    await page.waitForTimeout(80)
    const withFire = PNG.sync.read(await card.screenshot())

    const isLime = (p: PNG, i: number) => p.data[i + 1] > 200 && p.data[i + 2] < 80 && p.data[i] > 180 && p.data[i] < p.data[i + 1]
    let buttonPx = 0
    let covered = 0
    for (let y = rects.y0; y < rects.y1; y++) {
      for (let x = rects.x0; x < rects.x1; x++) {
        const i = (withoutFire.width * y + x) * 4
        if (!isLime(withoutFire, i)) continue
        buttonPx++
        if (!isLime(withFire, i)) covered++
      }
    }
    check('PAINT-ORDER · probe control · the button really paints inside the overlap', buttonPx > 50, `${buttonPx} lime px`)
    check('PAINT-ORDER · fire paints IN FRONT of the lime CTA', covered > 20, `${covered}/${buttonPx} of the button's own pixels are covered`)
  }

  // nothing escapes the card
  const overflow = await page.locator('[data-testid="calendar-upsell"]').evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), inViewport: r.left >= 0 && r.right <= window.innerWidth }
  })
  check('NO-CLIP · upsell sits inside the viewport', overflow.inViewport, `w=${overflow.w}`)

  await ctx.close()
}

// ---------------------------------------------------------------- month

async function monthScreen(browser: Browser, tier: Tier) {
  const [ctx, page] = await open(browser, tier)
  await goto(page, MONTH, tier)
  const promo = await visible(page, 'calendar-promo')
  const pill = await shown(page, 'header-upgrade')
  if (tier === 'paid') {
    check('GATE-PAID · month · no promo card', !promo)
    check('GATE-PAID · month · no อัพเกรด pill', !pill)
  }
  if (tier === 'free') {
    check('GATE-FREE · month · promo card renders', promo)
    check('GATE-FREE · month · อัพเกรด pill renders', pill)

    // PROMO-EDGE — ฟีม ruled Figma's 345px a slip; the card must line up with the grid under it.
    const edges = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="calendar-promo"]')!.getBoundingClientRect()
      const g = document.querySelector('[data-testid="calendar-grid-card"]')!.getBoundingClientRect()
      return { pl: Math.round(p.left), pr: Math.round(p.right), gl: Math.round(g.left), gr: Math.round(g.right) }
    })
    check('PROMO-EDGE · left edges agree with the grid', Math.abs(edges.pl - edges.gl) <= 1, `${edges.pl} vs ${edges.gl}`)
    check('PROMO-EDGE · right edges agree with the grid', Math.abs(edges.pr - edges.gr) <= 1, `${edges.pr} vs ${edges.gr}`)

    check('PAINT · promo ground is sapphire', (await bgOf(page, 'calendar-promo')) === SAPPHIRE, await bgOf(page, 'calendar-promo'))

    // MOTION-TRACK — the coin has its OWN keyframe. Reading the animation NAME is the only way to catch a
    // borrowed track: both tracks float, both look plausible, only one is Figma's.
    // read whatever is RUNNING on the coin, found by position in the tree — not by the class we hope is
    // there. Selecting `.v3-float-wide` made the check vacuous: swap the class for the wrong track and the
    // selector matches nothing, which is an error, not a failure. An invariant must be able to observe its
    // own violation.
    const coin = await page
      .locator('[data-testid="calendar-promo-coin"]')
      .evaluate((el) => Array.from(el.querySelectorAll('*')).flatMap((n) => n.getAnimations().map((a) => (a as CSSAnimation).animationName)))
    check('MOTION-TRACK · coin runs v3-float-wide', coin.includes('v3-float-wide'), coin.join(','))
    check('MOTION-TRACK · coin does NOT run the sprite track', !coin.includes('compat-sprite-float'), coin.join(','))

    // the zodiac character is static in Figma — an added float here would be invented motion too
    const charAnims = await page
      .locator('[data-testid="calendar-promo"] img')
      .first()
      .evaluate((el) => el.getAnimations().length)
    check('MOTION-TRACK · zodiac character stays static', charAnims === 0, String(charAnims))
  }
  if (tier === 'errored' || tier === 'slow') {
    check(`GATE-UNKNOWN · month · ${tier} · promo not visible`, !promo)
    check(`GATE-UNKNOWN · month · ${tier} · body withheld, spinner shown instead`, await visible(page, 'calendar-tier-pending'))
    check(`GATE-UNKNOWN · month · ${tier} · no pill`, !pill)
  }
  await ctx.close()
}

// ---------------------------------------------------------------- service

async function serviceScreen(browser: Browser, tier: Tier) {
  const [ctx, page] = await open(browser, tier)
  await goto(page, SERVICE, tier)
  const pill = await shown(page, 'header-upgrade')
  if (tier === 'paid') check('GATE-PAID · service · no อัพเกรด pill', !pill)
  if (tier === 'free') check('GATE-FREE · service · อัพเกรด pill renders', pill)
  if (tier === 'errored') check('GATE-UNKNOWN · service · no pill', !pill)
  await ctx.close()
}

// ---------------------------------------------------------------- CLS

// The shift the gate costs a free member: the tier resolves after first paint, so the promo/upsell arrives
// late and pushes what is under it. Measured, not assumed — and NEGATIVE-CONTROLLED first, because a layout
// probe that reads 0 for everything reads 0 for a real shift too (hit exactly that on the CLS work).
async function measureCls(browser: Browser, tier: Tier, route = MONTH) {
  const [ctx, page] = await open(browser, tier)
  await page.addInitScript(() => {
    ;(window as any).__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await goto(page, route, tier)
  await page.waitForTimeout(600)
  const cls = await page.evaluate(() => (window as any).__cls as number)
  return { ctx, page, cls }
}

async function clsBudget(browser: Browser) {
  // A raw CLS number is not attributable on its own — this page already shifts for reasons that predate the
  // gate (hero image, fonts, the grid's own mount). The paid run renders NO promo, so it is the same page
  // WITHOUT the card this PR adds: the difference between the two is the part I am accountable for.
  const paidRun = await measureCls(browser, 'paid')
  const paidCls = paidRun.cls
  await paidRun.ctx.close()

  const { ctx, page, cls: real } = await measureCls(browser, 'free')
  const delta = real - paidCls
  console.log(`  · CLS page baseline (paid, no promo) = ${paidCls.toFixed(4)}`)
  console.log(`  · CLS with the promo (free)          = ${real.toFixed(4)}`)
  // A DELTA is the wrong invariant here and the first version of this anchor proved it: reserving the
  // promo's height cut the free number and quietly trebled the paid one, and a "free minus paid" check went
  // GREEN on that regression. So the ceiling is asserted for BOTH tiers independently — an anchor that can
  // pass while somebody's screen gets worse is not an anchor.
  check('CLS · free path under 0.05', real < 0.05, real.toFixed(4))
  check('CLS · paid path under 0.05', paidCls < 0.05, paidCls.toFixed(4))
  console.log(`  · Δ free-vs-paid = ${delta.toFixed(4)} (reported, NOT the gate — see the note above)`)

  // the day screen carries the bigger swing between branches (three sections vs one card), so it gets the
  // same ceiling rather than being assumed fine because the month one is.
  for (const t of ['free', 'paid'] as Tier[]) {
    const r = await measureCls(browser, t, DAY)
    check(`CLS · day detail · ${t} path under 0.05`, r.cls < 0.05, r.cls.toFixed(4))
    await r.ctx.close()
  }

  // negative control: force a shift the probe MUST see. If this reads 0 the probe is blind and the number
  // above means nothing.
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.style.height = '300px'
    document.body.prepend(d)
  })
  await page.waitForTimeout(400)
  const afterControl = await page.evaluate(() => (window as any).__cls as number)
  check('CLS-PROBE · negative control moves the needle', afterControl > real, `${real.toFixed(4)} → ${afterControl.toFixed(4)}`)
  await ctx.close()
}

// SSR-NEUTRAL — read the bytes on the wire, with no browser and no JavaScript at all.
//
// This invariant exists because the DOM-level checks above were ALL GREEN while the server was shipping
// the free branch to everybody: these pages are server-rendered, `useCookies` has no jar on the server, so
// useV2Tier saw an empty userId and computeTier answered "no account ⇒ certainly not paying". A paid
// member's HTML arrived with calendar-promo and the อัพเกรด pill already in it, and React threw a
// hydration mismatch on top. Playwright could not see it because by the time it looked, the client had
// re-rendered. Different ground truth, different instrument.
//
// SCOPE WIDENED after goo's adversary pass (2026-08-04): the first version curled only the month screen —
// the one screen where the worst thing on the wire is an advert. The screen that actually carries the paid
// content (`/v2/calendar/[date]`: ความเข้ากัน · คำทำนายรายด้าน · 8 ประตู · 8 เทพ) was never read on the
// wire at all. It happens to be safe today because the gate keeps those sections out of the tree entirely,
// but "safe today by luck of another mechanism" is not an invariant: an SSR regression on that page would
// hand paid sections to free members with this file still green. His crack, my scope — widened, not waived.
async function ssrHtml(route: string) {
  const res = await fetch(`${HOST}${route}`, {
    headers: { cookie: `v2_access=${readPasskey()}; cookie-mumate-id=${USER_ID}; cookie-mumate-name=x` },
  })
  return res.text()
}

async function ssrNeutral() {
  const html = await ssrHtml(MONTH)
  check('SSR-NEUTRAL · month · server ships no promo', !html.includes('data-testid="calendar-promo"'))
  check('SSR-NEUTRAL · month · server ships no อัพเกรด pill', !html.includes('data-testid="header-upgrade"'))
  check('SSR-NEUTRAL · month · server ships the undetermined state instead', html.includes('data-testid="calendar-tier-pending"'))

  const day = await ssrHtml(DAY)
  for (const t of PAID_SECTIONS) {
    check(`SSR-NEUTRAL · day · paid section not on the wire: ${t}`, !day.includes(`data-testid="${t}"`))
  }
  check('SSR-NEUTRAL · day · server ships no upsell', !day.includes('data-testid="calendar-upsell"'))
  check('SSR-NEUTRAL · day · server ships no อัพเกรด pill', !day.includes('data-testid="header-upgrade"'))
  check('SSR-NEUTRAL · day · server ships the undetermined state instead', day.includes('data-testid="day-tier-pending"'))
}

async function main() {
  const browser = await chromium.launch()
  console.log(`\nZone 4 · tier gate — ${HOST}\n`)
  console.log('[server-rendered html]')
  await ssrNeutral()
  console.log('')

  for (const tier of ['paid', 'free', 'errored', 'slow'] as Tier[]) {
    console.log(`[${tier}]`)
    const [ctx] = await dayScreen(browser, tier)
    await ctx.close()
    await monthScreen(browser, tier)
    if (tier !== 'slow') await serviceScreen(browser, tier)
  }

  console.log('\n[upsell detail]')
  await upsellDetail(browser)
  console.log('\n[layout stability]')
  await clsBudget(browser)

  await browser.close()
  console.log(failed === 0 ? '\n✅ tier gate: all checks passed\n' : `\n❌ tier gate: ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
