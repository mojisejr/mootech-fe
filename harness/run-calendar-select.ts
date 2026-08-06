// harness/run-calendar-select.ts — M-A + M-B anchor (visual lens): the calendar's BODY STATES and the
// selected-day loop, judged from what paints.
//
// Two things ship together in this PR and they fail in opposite directions, so both are measured here:
//
//   M-A  the body no longer returns null while the month is in flight — it shows a skeleton. The danger of
//        a skeleton is not that it looks wrong, it is that it NEVER ENDS: three of goo's settled branches
//        (anon · user-row error · no birth date) end with `month: null, loading: false`, so the obvious
//        `if (!month) <Skeleton/>` pulses forever at anyone without a birth date. scripts/calendar-view-
//        state.test.ts proves the RULE cannot do that; this file proves the PIXELS cannot either — and it
//        proves it by actually driving a birth-date-less account, not by trusting the rule.
//   M-B  tapping a day moves the selection AND the card follows it. Before, the highlight moved and the
//        card kept describing today: one widget, two answers.
//
//   npx tsx --tsconfig harness/tsconfig.json harness/run-calendar-select.ts     (dev server up)
//   HARNESS_HOST=http://localhost:3104 overrides the host.
//
// WHY A BROWSER AT ALL, when the rule is unit-tested: the rule says which state to render; only the browser
// can say whether that state PAINTS. A `hidden` class, a crash inside the ready branch, or a skeleton that
// renders under the tier spinner would all leave the unit test green and the screen blank.
//
// TEETH (each reproduces a real failure this PR could have shipped)
//   • mut-dead-skeleton   — #mut-dead-skeleton · render the skeleton for any null month → SETTLED-EMPTY
//                           trips (the no-birth-date account pulses forever).
//   • mut-card-today      — #mut-card-today · bind the card to todayISO instead of selectedDate → CARD-
//                           FOLLOWS trips (the M-B bug itself).
//   • mut-cell-link       — #mut-cell-link · make the cell a <Link> again → NO-NAVIGATE trips.
//
// VERIFY-THE-INSTRUMENT: every loop below asserts it has something to loop over BEFORE it judges, and the
// selected-cell check asserts the sapphire ground is not already every cell's colour. A probe that reports
// "0 of 0 wrong" is not a passing probe, it is an absent one.
import { chromium, type Browser, type Page } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3104'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()
const isPath = (url: string, path: string) => { try { return new URL(url).pathname === path } catch { return false } }

let pass = 0, fail = 0
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? ` · ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` · ${detail}` : ''}`) }
}

// ── fixtures. Identity is stubbed to REACH the screen (the month fetch only fires after /api/user yields a
//    complete birth profile); the month is stubbed so the gate tests what it owns and not "is bazi alive".
//    Same approach as run-calendar-month.ts (goo's #185×#186 fix), deliberately not a new invention.
const UID = 'harness-select-user'
const USER_WITH_DOB = { user_id: UID, name: 'ทดสอบ เลือกวัน', dob: '1990-06-15', gender: 'MALE', place_name: 'กรุงเทพมหานคร', is_remember_time: false }
// the account the dead-skeleton check needs: real user, NO birth date ⇒ goo's hook settles at
// {month: null, loading: false} ⇒ the screen must NOT be a skeleton.
const USER_NO_DOB = { user_id: UID, name: 'ทดสอบ ไร้วันเกิด', dob: '', gender: '', place_name: '', is_remember_time: false }
const PAID = { user_id: UID, name: 'ทดสอบ', payment: { is_not_expired: true, total_friend: 0, limit_friend: 3 } }

function fixtureMonth() {
  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const [y, m] = todayISO.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  const G = ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳', '庚午', '辛未', '壬申', '癸酉', '甲戌', '乙亥']
  const days = Array.from({ length: n }, (_, i) => {
    const d = i + 1
    const overallPercent = d % 3 === 0 ? 72 : d % 3 === 1 ? 48 : 30
    return {
      date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayOfMonth: d, dayGanzhi: G[(d - 1) % G.length], overallPercent,
      grade: overallPercent >= 60 ? 'A' : overallPercent >= 40 ? 'C' : 'F',
      wanPhra: d === 8 || d === 15 || d === 23,
    }
  })
  return { allowed: true, year: y, month: m, days }
}
const MONTH = fixtureMonth()

type Opts = { user?: object; monthDelayMs?: number; stubMonth?: boolean }
async function open(browser: Browser, opts: Opts = {}): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: UID, domain: new URL(HOST).hostname, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  await page.route((u) => isPath(u.toString(), '/api/user'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.user ?? USER_WITH_DOB) }))
  // the tier gate hides the whole column while isPaid is null — every probe on this page must answer it
  await page.route((u) => /\/api\/(v2\/)?(tier|user-payment|payment)/.test(new URL(u.toString()).pathname), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAID) }))
  if (opts.stubMonth !== false) {
    await page.route((u) => isPath(u.toString(), '/api/v2/calendar-month'), async (r) => {
      if (opts.monthDelayMs) await new Promise((res) => setTimeout(res, opts.monthDelayMs))
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MONTH) })
    })
  }
  return { page, close: () => ctx.close() }
}

const bg = (page: Page, sel: string) => page.$eval(sel, (el) => getComputedStyle(el).backgroundColor)

async function main() {
  const browser = await chromium.launch()

  // ── 1 · SKELETON-PAINTS — the body is a skeleton, not a blank screen, while the month is in flight ──
  console.log('\n— SKELETON-PAINTS: a slow month shows the skeleton, not nothing —')
  {
    const { page, close } = await open(browser, { monthDelayMs: 2500 })
    await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'domcontentloaded' })
    const sk = page.locator('[data-testid="calendar-skeleton"]')
    await sk.waitFor({ timeout: 8000 }).catch(() => {})
    const painted = await sk.count()
    check('a skeleton is on screen while the month loads', painted === 1, `${painted} found`)
    check('it declares itself as loading', (await sk.getAttribute('data-state')) === 'loading', String(await sk.getAttribute('data-state')))
    check('it is busy for screen readers', (await sk.getAttribute('aria-busy')) === 'true')
    const box = await sk.boundingBox()
    check('it actually occupies the body (not a 0-height node)', !!box && box.height > 400, `h=${Math.round(box?.height ?? 0)}`)
    // it must PULSE — the animation is the claim that work is happening
    const anims = await page.$eval('[data-testid="calendar-skeleton"] .animate-pulse', (el) => el.getAnimations().length)
    await page.screenshot({ path: 'harness/out/calendar-state-loading-393.png' })
    check('the loading skeleton pulses (the animation is the claim work is in flight)', anims > 0, `${anims} animations`)
    // selector-always (2026-08-07) — added to THIS anchor rather than a new one, because it already opens
    // exactly the states the claim is about. The row used to live inside the page's `ready` branch, so it
    // vanished while the month was in flight, taking วันนี้/เดือน/ปี with it: measured on main a4560da as
    // absent in 5 of 6 states and gone for ~865ms on every month change.
    check('the SELECTOR is still on screen while the month loads', (await page.locator('[data-testid="date-selector"]').count()) === 1)
    check('and it is the real row, not a grey stand-in', (await page.locator('[data-testid="date-selector"] > button').count()) === 3)
    // The skeleton used to draw a 46px placeholder bar of its own. It has no testid, so counting selectors
    // cannot see it — the thing that CAN is the geometry: a leftover bar would sit between the real row and
    // the grid card and blow the container's single 16px gap apart. Asserting the gap, not the absence.
    const gap = await page.evaluate(() => {
      const sel = document.querySelector('[data-testid="date-selector"]')?.getBoundingClientRect()
      const sk = document.querySelector('[data-testid="calendar-skeleton"]')?.getBoundingClientRect()
      return sel && sk ? Math.round(sk.top - sel.bottom) : NaN
    })
    check('no stand-in bar left stacked under the real one (gap is one container gap)', gap >= 0 && gap <= 20, `gap=${gap}px`)
    // 2 · SKELETON-RESOLVES — and it must END
    await page.locator('[data-testid="calendar-grid"]').waitFor({ timeout: 15000 })
    check('the skeleton is gone once the month lands', (await page.locator('[data-testid="calendar-skeleton"]').count()) === 0)
    await close()
  }

  // ── 3 · SETTLED-EMPTY — the account with no birth date. THE tooth for the dead skeleton. ──
  console.log('\n— SETTLED-EMPTY: an account with no birth date must NOT pulse forever —')
  {
    const { page, close } = await open(browser, { user: USER_NO_DOB, stubMonth: false })
    await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500) // well past any fetch — this state is settled, not in flight
    const sk = page.locator('[data-testid="calendar-skeleton"]')
    check('the body resolved to a screen (not blank)', (await sk.count()) === 1)
    check('it declares itself UNAVAILABLE, not loading', (await sk.getAttribute('data-state')) === 'unavailable', String(await sk.getAttribute('data-state')))
    check('it is NOT busy (nothing is coming)', (await sk.getAttribute('aria-busy')) === null)
    const anims = await page.$$eval('[data-testid="calendar-skeleton"] .animate-pulse', (els) => els.length)
    check('it does NOT pulse — a pulse here is a promise that is never kept', anims === 0, `${anims} pulsing nodes`)
    const msg = await page.locator('[data-testid="calendar-unavailable"]').textContent()
    await page.screenshot({ path: 'harness/out/calendar-state-unavailable-393.png' })
    check('it says something rather than showing a silent placeholder', !!msg && msg.trim().length > 10, `"${msg?.trim().slice(0, 40)}…"`)
    // selector-always — the settled-empty screen is the one a user cannot leave without this row: there is
    // no month, so there is nothing else on the page to press.
    const sel = page.locator('[data-testid="date-selector"]')
    const selHere = (await sel.count()) === 1
    check('the SELECTOR survives the settled-empty screen', selHere)
    // Guarded on `selHere`: unguarded, getAttribute/isEnabled on an absent node THROW, and the anchor dies
    // mid-run instead of reporting — proven live against mut-selector-hidden, which crashed here and
    // swallowed the two checks below. A gate that crashes reports nothing at all; it must go red and finish.
    check('its cursor is real, not "unknown"', selHere && (await sel.getAttribute('data-cursor')) === 'known', selHere ? String(await sel.getAttribute('data-cursor')) : 'no selector')
    // the escape hatch has to be PRESSABLE, not merely painted — #191's bug class
    check('วันนี้ is enabled here (the way out of a monthless screen)', selHere && (await page.locator('[data-testid="date-today"]').isEnabled()), selHere ? '' : 'no selector')
    await close()
  }

  // ── 4-7 · the selected-day loop ──
  console.log('\n— SELECT: tapping a day moves the ground, the card follows, nothing navigates —')
  {
    const { page, close } = await open(browser)
    await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="calendar-grid"]').waitFor({ timeout: 15000 })
    await page.waitForTimeout(400)

    const cells = page.locator('[data-testid="calendar-day"]')
    const n = await cells.count()
    check('INSTRUMENT: the grid rendered cells (else every check below is vacuous)', n > 0, `${n} cells`)
    const selBefore = page.locator('[data-testid="calendar-day"][data-selected="true"]')
    check('INSTRUMENT: exactly one cell starts selected', (await selBefore.count()) === 1)
    const dateBefore = await selBefore.getAttribute('data-date')
    const groundBefore = await bg(page, '[data-testid="calendar-day"][data-selected="true"]')
    const restingGround = await bg(page, '[data-testid="calendar-day"]:not([data-selected="true"])')
    check('INSTRUMENT: the selected ground differs from a resting one (else the pixel check proves nothing)',
      groundBefore !== restingGround, `${groundBefore} vs ${restingGround}`)

    const target = page.locator('[data-testid="calendar-day"]:not([data-selected="true"])').first()
    const targetDate = await target.getAttribute('data-date')
    const urlBefore = page.url()
    await target.click()
    await page.waitForTimeout(350)

    // NO-NAVIGATE — the tooth against someone restoring the <Link>
    check('tapping a day does NOT navigate', page.url() === urlBefore, `${page.url()}`)
    // the GROUND moved, read from pixels — not from the attribute that drives it
    const targetGround = await bg(page, `[data-testid="calendar-day"][data-date="${targetDate}"]`)
    check('the sapphire ground moved ONTO the tapped day (pixels)', targetGround === groundBefore, `${targetGround}`)
    const oldGround = await bg(page, `[data-testid="calendar-day"][data-date="${dateBefore}"]`)
    check('and moved OFF the previously selected day (pixels)', oldGround !== groundBefore, `${oldGround}`)
    check('still exactly one selected cell', (await page.locator('[data-testid="calendar-day"][data-selected="true"]').count()) === 1)
    // NOT `target.getAttribute(...)`: `target` is the locator ":not([data-selected=true]) first", which
    // RE-RESOLVES after the click and now points at a different, unselected cell. It failed here first time
    // and the product was right — the probe was asking the wrong element. Address the cell by its date.
    check('the tapped cell announces itself as the chosen date',
      (await page.locator(`[data-testid="calendar-day"][data-date="${targetDate}"]`).getAttribute('aria-current')) === 'date')

    // CARD-FOLLOWS — the card must describe the tapped day, not today
    const dayNum = String(parseInt((targetDate ?? '').slice(8), 10))
    const cardText = (await page.locator('[data-testid="calendar-daily-card"]').textContent()) ?? ''
    const cta = (await page.locator('[data-testid="calendar-daily-card"] button').last().textContent()) ?? ''
    check('the card CTA follows the selection (no longer says วันนี้)', !cta.includes('วันนี้'), `cta="${cta.trim()}"`)
    check('the CTA names the tapped day', cta.includes(dayNum), `cta="${cta.trim()}" day=${dayNum}`)
    check('the card body is not empty', cardText.trim().length > 20)

    // KEYBOARD — a button that only works with a mouse is a regression from the link it replaced.
    // (The first version of this check ended in `|| true`, which is not a check. Removed: a probe that
    // cannot fail is worse than no probe, because it reports a pass.)
    // Driven by REAL Tab presses, not element.focus(). This check failed on its first run and the product
    // was right again: Chromium withholds :focus-visible from a programmatic focus that follows a MOUSE
    // interaction, so the ring genuinely was not painted — for a probe that had just clicked. Measuring a
    // keyboard affordance right after a click measures the wrong user.
    const before2 = await page.locator('[data-testid="calendar-day"][data-selected="true"]').getAttribute('data-date')
    let tabs = 0
    for (; tabs < 60; tabs++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'calendar-day')) break
    }
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el.getAttribute('data-testid') !== 'calendar-day') return null
      const s = getComputedStyle(el)
      return { date: el.getAttribute('data-date'), outline: s.outlineStyle, shadow: s.boxShadow, fv: el.matches(':focus-visible') }
    })
    check('a day cell is reachable by Tab (it is a real control, not a painted div)', !!focused, `${tabs} tabs`)
    check('the tabbed cell shows a visible focus ring (a focus you cannot see is not keyboard support)',
      !!focused && (focused.outline !== 'none' || focused.shadow !== 'none'), `outline=${focused?.outline} fv=${focused?.fv}`)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    const after2 = await page.locator('[data-testid="calendar-day"][data-selected="true"]').getAttribute('data-date')
    check('Enter on the focused day selects it (keyboard parity with the tap)',
      !!focused && after2 === focused.date && after2 !== before2, `${before2} → ${after2}`)

    await page.screenshot({ path: 'harness/out/calendar-select-393.png', fullPage: false })
    await close()
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} run-calendar-select — ${pass} passed, ${fail} failed`)
  await browser.close()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
