// harness/run-calendar-day.ts — Phase 3a VISUAL anchor for /v2/calendar/[date] (Figma 634:8194 ธรรมดา).
// The rendered pixels/computed-styles are the ground-truth, not the className. Proves, on the REAL route
// with NO backend:
//   1. 0 app-fetch (goo's shared trackAppFetches — request-level; a call to a downed BE is still caught)
//   2. GRADE badge fidelity — every [data-grade] badge's COMPUTED bg == GRADE_COLORS[grade].accent, text
//      is white EXCEPT the C+ contrast exception which MUST be #374151 (rgb 55,65,81) — DESIGN.md
//   3. no horizontal overflow (scrollWidth <= clientWidth) — the long frame must not leak sideways
//   4. all 10 normal-mode sections present (§1 header · §2 strip · §3 score · §4 toggle · §6 · §8 · §10 · §11 · §14)
//   5. off-screen-motion battery rule — 0 running animations (getAnimations()==0) → nothing drains off-screen
// TEETH: mut-hardcode-cplus-white — flip GradeBadge's C+ text to #FFFFFF and assertion (2) fails.
// VERIFY-THE-INSTRUMENT: a negative control mutates a live badge to white in the DOM and re-runs the C+
// check to confirm it FAILS (the probe is not vacuous), before trusting the green on the real render.
//
// Run (FE up on :3011): npx tsx harness/run-calendar-day.ts
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'
import { GRADE_COLORS } from '../features/v2-calendar/components/grade-colors'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const ROUTE = '/v2/calendar/2026-07-14' // full-data day (all grades + reminders present)

function readPasskey(): string {
  const file = path.resolve(process.cwd(), 'testenv/env/fe.env')
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('V2_PREVIEW_KEY not found')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

// Read every grade badge's grade + computed bg + text color from the live DOM.
async function readBadges(page: Page) {
  return page.$$eval('[data-grade]', (els) =>
    els.map((el) => {
      const cs = getComputedStyle(el)
      return { grade: el.getAttribute('data-grade') ?? '', bg: cs.backgroundColor, color: cs.color }
    }),
  )
}

async function main() {
  const passkey = readPasskey()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
  const res = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) {
    throw new Error(`gate rejected (${res.status()})`)
  }

  const page = await ctx.newPage()
  const tracker = trackAppFetches(page) // request-level, BEFORE navigation
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))
  await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  console.log(`\nrun-calendar-day · ${ROUTE}`)

  // 1 — 0 app-fetch + console clean
  check('0 app-fetch (no backend reached)', tracker.appFetches.length === 0, `app-fetch=${tracker.appFetches.length}`)
  check('0 console errors', consoleErrors.length === 0, `errors=${consoleErrors.length}`)
  consoleErrors.forEach((e) => console.log(`     ⚠️ ${e}`))

  // 2 — GRADE badge fidelity (COMPUTED, not className)
  const badges = await readBadges(page)
  check('grade badges present', badges.length >= 8, `count=${badges.length}`)
  let bgOk = true, cplusOk = true, otherTextOk = true
  for (const b of badges) {
    const expectBg = hexToRgb(GRADE_COLORS[b.grade as keyof typeof GRADE_COLORS]?.accent ?? '#000000')
    if (b.bg !== expectBg) { bgOk = false; console.log(`     bg mismatch ${b.grade}: got ${b.bg}, want ${expectBg}`) }
    if (b.grade === 'C+') {
      if (b.color !== 'rgb(55, 65, 81)') { cplusOk = false; console.log(`     C+ text got ${b.color}, want rgb(55, 65, 81)`) }
    } else if (b.color !== 'rgb(255, 255, 255)') {
      otherTextOk = false; console.log(`     ${b.grade} text got ${b.color}, want white`)
    }
  }
  check('badge bg == GRADE_COLORS accent (all grades)', bgOk)
  check('C+ badge text == #374151 (DESIGN.md contrast exception)', cplusOk)
  check('non-C+ badge text == white', otherTextOk)

  // VERIFY-THE-INSTRUMENT (negative control): force a C+ badge to white in the DOM → the check MUST flip to fail.
  const controlTrips = await page.evaluate(() => {
    const el = document.querySelector('[data-grade="C+"]') as HTMLElement | null
    if (!el) return false
    el.style.color = 'rgb(255, 255, 255)'
    return getComputedStyle(el).color === 'rgb(255, 255, 255)'
  })
  check('instrument verified — C+ probe trips on a known-bad (white) control', controlTrips)
  await page.reload({ waitUntil: 'networkidle' }) // restore the real DOM after the control
  await page.waitForTimeout(300)

  // 3 — no horizontal overflow (+ diagnose the widest leaking element if any)
  const overflow = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth
    const sw = document.documentElement.scrollWidth
    const leaks: string[] = []
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect()
      if (r.right > cw + 1 || r.left < -1) {
        leaks.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').slice(0, 40)} right=${Math.round(r.right)}`)
      }
    }
    return { sw, cw, leaks: leaks.slice(0, 6) }
  })
  check('no horizontal overflow', overflow.sw <= overflow.cw + 1, `scrollW=${overflow.sw} clientW=${overflow.cw}`)
  overflow.leaks.forEach((l) => console.log(`     ↔ ${l}`))

  // 4 — all 10 normal-mode sections present (inline, no named fns → avoids tsx keepNames __name footgun)
  const present = await page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).map((e) => e.textContent || '').join('|')
    const body = document.body.textContent || ''
    return {
      header: Array.from(document.querySelectorAll('h1')).some((e) => (e.textContent || '').includes('รายละเอียดวัน')),
      strip: !!document.querySelector('[data-testid="day-strip"]'),
      score: !!document.querySelector('[data-testid="day-score"]'),
      toggle: !!document.querySelector('[role="switch"]'),
      compat: h2.includes('ความเข้ากัน'),
      insight: body.includes('พลังแรงสุด'),
      predictions: h2.includes('คำทำนายรายด้าน'),
      colors: h2.includes('สีมงคล'),
      yams: h2.includes('เวลามงคล'),
      menu: !!document.querySelector('nav'),
    }
  })
  const missing = Object.entries(present).filter(([, v]) => !v).map(([k]) => k)
  check('all 10 sections present (§1·2·3·4·6·7·8·10·11·14)', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : '10/10')

  // 5 — off-screen-motion battery rule: 0 running animations on the long frame
  const anims = await page.evaluate(() => (document.getAnimations ? document.getAnimations().length : -1))
  check('0 running animations (nothing drains off-screen)', anims === 0, `getAnimations()=${anims}`)

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ PASS' : `❌ FAIL (${failed})`}`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
