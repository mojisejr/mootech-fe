// harness/run-breakpoint-sweep.ts — the axis the whole v2 arc never rendered.
// LENS = visual. Ground-truth = the rendered frame at widths other than the one I designed at.
//
// Six PRs and eight screens shipped in this arc, every one of them looked at ONLY at 393px. That is one
// cell of the state-space, and "it looks right" at one cell is an assumption about the rest, not evidence.
// This file turns that assumption into a measurement — it is a CHECK, not a fix: if everything is clean the
// whole debt is discharged in one run; if not, we learn how many screens are affected BEFORE the team
// builds content on top of them.
//
// What it looks for, in order of how badly it bites:
//   H-SCROLL     — the page scrolls sideways. The single worst mobile-layout failure: it makes the whole
//                  screen feel broken and it is invisible at the width you designed at.
//   ESCAPE       — a specific element's box extends past the viewport edge. Named, so the fix is one place.
//   ABS-DRIFT    — decorations positioned by absolute Figma coordinates. THE suspected bug-class here: the
//                  new promo/upsell cards place mascots at fixed px offsets taken from a 393-wide frame, so
//                  a wider card leaves them behind (this is exactly how the Mate AI button broke — ฟีม
//                  caught that one by eye, and it shipped because nothing measured it).
//   TAP-TARGET   — an interactive control narrower than 32px, i.e. collapsed by the narrow viewport.
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-breakpoint-sweep.ts
//   add SHOTS=/tmp/bp to also write a PNG per screen per width for eyeballing.
import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const SHOTS = process.env.SHOTS ?? ''
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'

// 320 = the narrowest phone still in the wild (iPhone SE 1st gen / small Androids)
// 360 = the single most common Android width
// 393 = the ONLY width this arc was ever designed and reviewed at (iPhone 16 / Figma frame)
// 430 = iPhone Pro Max
// 768 = tablet portrait — not a target, but it proves the max-width cap actually caps
const WIDTHS = [320, 360, 393, 430, 768]

type Screen = { name: string; route: string; paid: boolean }
const SCREENS: Screen[] = [
  { name: 'month-free', route: '/v2/calendar', paid: false },
  { name: 'month-paid', route: '/v2/calendar', paid: true },
  { name: 'day-free', route: '/v2/calendar/2026-07-14', paid: false },
  { name: 'day-paid', route: '/v2/calendar/2026-07-14', paid: true },
  { name: 'service', route: '/v2/service', paid: false },
  { name: 'notifications', route: '/v2/calendar/notifications', paid: false },
]

let failed = 0
const rows: string[] = []
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

function readPasskey(): string {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n')
    .find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

const userBody = (paid: boolean) =>
  JSON.stringify({ user_id: USER_ID, name: 'มิลา', payment: { is_not_expired: paid } })

async function sweep(browser: Browser, s: Screen, width: number) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: new URL(HOST).hostname, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.route('**/api/user**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: userBody(s.paid) }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(HOST + s.route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(350)

  const report = await page.evaluate(() => {
    const vw = window.innerWidth
    const hScroll = document.documentElement.scrollWidth - vw
    const escapes: { id: string; right: number; left: number }[] = []
    const smallTaps: { id: string; w: number }[] = []
    // `left/top`-positioned decorations are the drift risk: a fixed px offset copied from a 393 frame does
    // not follow a wider container. Anything anchored from the right (or not absolutely placed) is fine.
    const absDrift: { id: string; left: number; parentW: number; gapRight: number }[] = []

    // NOTE no helper functions in here on purpose: tsx/esbuild rewrites function expressions with a
    // `__name` wrapper that does not exist inside the page, so the whole evaluate throws. Labels are
    // built inline.
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''
      const label = el.getAttribute('data-testid') || el.tagName.toLowerCase() + cls
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue

      // ESCAPE — ignore elements deliberately clipped by an overflow-hidden ancestor (Figma does this on
      // purpose for the mascots), so only report boxes that escape a NON-clipping chain.
      let clipped = false
      for (let p = el.parentElement; p; p = p.parentElement) {
        const pcs = getComputedStyle(p)
        if (pcs.overflow !== 'visible' || pcs.overflowX !== 'visible') { clipped = true; break }
      }
      if (!clipped && (r.right > vw + 1 || r.left < -1)) {
        escapes.push({ id: label, right: Math.round(r.right), left: Math.round(r.left) })
      }

      // ABS-DRIFT sample. The FIRST version of this check asked `computedStyle.right === 'auto'` to spot a
      // left-anchored decoration — and returned 0 for every screen at every width, including the card that
      // was demonstrably broken. Chrome resolves `right` to a used length even when the author only set
      // `left`, so the condition could never be true: a probe that reads clean for everything reads clean
      // for a real bug too. Now it just records WHERE each decoration sits relative to its own card, and
      // main() compares those numbers ACROSS widths — drift is a change, so it takes two measurements.
      // OVERHANG, not anchor. Two earlier formulations of this check failed, in opposite directions:
      //   1. "is `computed.right` auto?" — Chrome resolves both edges to used lengths, so it matched
      //      nothing and reported every screen clean, including the card that was demonstrably broken.
      //   2. "does the distance to the DECLARED edge stay constant?" — that one flagged correct code (the
      //      flame is left-anchored on purpose) and then, once taught to trust the declaration, went green
      //      on the very bug it exists for: a corner sprite that declares `left` is self-consistent, and
      //      still wrong. Trading a false alarm for a blind spot is the worse trade.
      // What is actually observable without knowing intent: how far the decoration hangs OUT of its card.
      // Some overhang is designed (Figma clips the zodiac mascot at every width). What is never designed is
      // overhang that GROWS as the screen narrows — that is the signature of a coordinate pinned to the
      // wrong edge, and it is what makes a sprite vanish on a small phone.
      if (cs.position === 'absolute' && r.width >= 4 && r.height >= 4 && el.getAttribute('data-testid')) {
        const parent = el.parentElement
        if (parent) {
          const pr = parent.getBoundingClientRect()
          if (pr.width > 0 && r.width < pr.width - 4) {
            absDrift.push({
              id: label,
              left: Math.round(r.left - pr.left),
              parentW: Math.round(pr.width),
              gapRight: Math.round(Math.max(0, r.right - pr.right) + Math.max(0, pr.left - r.left)),
            })
          }
        }
      }

      const interactive = ['A', 'BUTTON'].includes(el.tagName) || el.getAttribute('role') === 'switch'
      if (interactive && r.width > 0 && r.width < 32) smallTaps.push({ id: label, w: Math.round(r.width) })
    }
    return { vw, hScroll, escapes: escapes.slice(0, 6), smallTaps: smallTaps.slice(0, 6), absDriftCount: absDrift.length, absDrift }
  })

  const tag = `${s.name} @${width}`
  check(`H-SCROLL · ${tag}`, report.hScroll <= 0, report.hScroll > 0 ? `scrolls ${report.hScroll}px sideways` : '')
  check(`ESCAPE  · ${tag}`, report.escapes.length === 0, report.escapes.map((e) => `${e.id}[${e.left}..${e.right}]`).join(' '))
  check(`TAP     · ${tag}`, report.smallTaps.length === 0, report.smallTaps.map((t) => `${t.id}=${t.w}px`).join(' '))
  rows.push(`| ${s.name} | ${width} | ${report.hScroll > 0 ? `🔴 ${report.hScroll}px` : '—'} | ${report.escapes.length || '—'} | ${report.smallTaps.length || '—'} | ${report.absDriftCount} |`)

  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true })
    await page.screenshot({ path: `${SHOTS}/${s.name}-${width}.png`, fullPage: true })
  }
  await ctx.close()
  return report.absDrift
}

async function main() {
  const browser = await chromium.launch()
  console.log(`\nbreakpoint sweep — ${HOST}\nwidths: ${WIDTHS.join(' · ')}\n`)
  for (const s of SCREENS) {
    console.log(`[${s.name}]`)
    const byWidth = new Map<number, Map<string, number>>()
    for (const w of WIDTHS) {
      const decos = await sweep(browser, s, w)
      byWidth.set(w, new Map(decos.map((d) => [d.id, d.gapRight])))
    }
    // DRIFT — how far each decoration hangs outside its own card, compared against the same number at 393
    // (the width everything was authored at). Designed overhang is constant; overhang that GROWS on a
    // narrower screen means a Figma coordinate was pasted in as a layout rule and the art slides off.
    const base = byWidth.get(393)!
    const drifted: string[] = []
    for (const [w, m] of Array.from(byWidth.entries())) {
      if (w === 393) continue
      for (const [id, gap] of Array.from(m.entries())) {
        const b = base.get(id)
        if (b !== undefined && gap - b > 4) drifted.push(`${id}@${w}: หลุดกรอบ ${b}→${gap}px`)
      }
    }
    check(`DRIFT   · ${s.name}`, drifted.length === 0, drifted.slice(0, 5).join(' '))
  }
  await browser.close()
  console.log('\n| screen | w | h-scroll | escapes | small taps | abs-positioned |')
  console.log('|---|---|---|---|---|---|')
  rows.forEach((r) => console.log(r))
  console.log(failed === 0 ? '\n✅ breakpoint sweep: clean\n' : `\n❌ breakpoint sweep: ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
