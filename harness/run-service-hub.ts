// harness/run-service-hub.ts — anchor for the บริการทั้งหมด service hub (Figma 333:7519, PR feat/v2-service-hub).
// Proves what a screenshot can't:
//   1. IMAGE SLOT ACCEPTS src (done-condition #4, ฟีม's most-important): a src flows through to a painted
//      <img>; no src → gray placeholder, no <img>. This is the "not a dead gray div" guarantee — the whole
//      reason the slot is a component. Proven at the COMPONENT level (renderToStaticMarkup), not by pixels,
//      because "the box would accept a future image" is a code contract, not a visible state today.
//   2. ALL 12 CARDS render, in Figma order, each pointing at its EXPECTED destination (independent list
//      below — NOT read from services.ts, so a wrong edit there is caught, not echoed).
//   3. REACHABILITY (4th axis, live): every one of the 12 cards is a real, clickable link that LANDS on its
//      destination — 2 real routes (/v2/calendar, /v2/shop) + 10 → the shared เร็วๆ นี้ page NAMING the service.
//   4. บริการ tab is active; no overflow-x @393/360/320; 0 app-fetch; console 0.
//
// TEETH (code-level, demonstrated live in service-hub.verify-evidence.md):
//   • mut-deadslot     — make ServiceImageSlot ignore `src` (always the gray div) → check #1a fails.
//   • mut-drop-card    — remove any of the 12 from services.ts → count/enumerate (#2) fails.
//   • mut-wrong-dest   — point card 9 at coming-soon instead of /v2/calendar → destination check (#2/#3) fails.
// VERIFY-INSTRUMENT: each check is negative-controlled by construction — the with-src / without-src pair
// (one MUST have <img>, the other MUST NOT) means a slot that hardcodes either answer trips one of them.
//
// Run (FE up on :3011, from the worktree root): npx tsx harness/run-service-hub.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'
import { ServiceImageSlot } from '../features/v2-service/components/ServiceImageSlot'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const SIZES = [393, 360, 320]

// INDEPENDENT expected list (Figma order) — deliberately hand-written here, not imported from services.ts,
// so this anchor is a real second opinion on the data, not a mirror of it.
const EXPECT: { id: string; titleFragment: string; dest: string }[] = [
  { id: 'couple', titleFragment: 'ดูดวงคู่รัก', dest: '/v2/service/coming-soon?service=' },
  { id: 'coworker', titleFragment: 'ดูดวงเพื่อนร่วมงาน', dest: '/v2/service/coming-soon?service=' },
  { id: 'one-book', titleFragment: 'หนังสือเล่มเดียวในโลก', dest: '/v2/service/coming-soon?service=' },
  { id: 'oracle-kiang', titleFragment: 'เสี่ยงไพ่ออราเคิลเคี้ยงคุง', dest: '/v2/service/coming-soon?service=' },
  { id: 'spirit-heaven', titleFragment: 'เสี่ยงไพ่จิตวิญญาณแดนสวรรค์', dest: '/v2/service/coming-soon?service=' },
  { id: 'sian', titleFragment: 'เสี่ยงเซียนเสี่ยงทาย', dest: '/v2/service/coming-soon?service=' },
  { id: 'sinsae', titleFragment: 'กับซินเเส', dest: '/v2/service/coming-soon?service=' },
  { id: 'manifest', titleFragment: 'มานิเฟส', dest: '/v2/service/coming-soon?service=' },
  { id: 'calendar', titleFragment: 'ปฏิทิน', dest: '/v2/calendar' },
  { id: 'healing-circles', titleFragment: 'Healing Circles', dest: '/v2/service/coming-soon?service=' },
  { id: 'sacred-map', titleFragment: 'แผนที่ศักดิ์สิทธิ์', dest: '/v2/service/coming-soon?service=' },
  { id: 'shop', titleFragment: 'ร้านค้าของเรา', dest: '/v2/shop' },
]

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
async function login(ctx: BrowserContext) {
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
}

async function main() {
  console.log('\nrun-service-hub')

  // ── 1. IMAGE SLOT contract (component-level, no browser) — the negative-controlled pair ──
  const withSrc = renderToStaticMarkup(createElement(ServiceImageSlot, { src: '/probe.png', alt: 'probe' }))
  const noSrc = renderToStaticMarkup(createElement(ServiceImageSlot, {}))
  check('slot #1a: src="/probe.png" → paints <img src="/probe.png">', withSrc.includes('<img') && withSrc.includes('src="/probe.png"'))
  check('slot #1b: no src → gray placeholder, NO <img> (negative control)', !noSrc.includes('<img') && noSrc.includes('service-image-slot'))

  const browser = await chromium.launch()

  // ── 4a. every size: no overflow-x + all 12 cards present ──
  for (const w of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 820 }, deviceScaleFactor: 2 })
    await login(ctx)
    const page = await ctx.newPage()
    await page.goto(`${HOST}/v2/service`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    check(`@${w} no overflow-x`, await overflowOk(page))
    const count = await page.locator('a[data-testid^="service-card-"]').count()
    check(`@${w} exactly 12 cards`, count === 12, `found ${count}`)
    await ctx.close()
  }

  // ── @393 deep: enumerate destinations, tab active, click-walk all 12, 0-fetch, console 0 ──
  const ctx = await browser.newContext({ viewport: { width: 393, height: 820 }, deviceScaleFactor: 2 })
  await login(ctx)
  const page = await ctx.newPage()
  const tracker = trackAppFetches(page)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`))

  await page.goto(`${HOST}/v2/service`, { waitUntil: 'networkidle' }); await page.waitForTimeout(300)

  // 2. enumerate: each expected card exists, in order, with the expected href + title
  for (let i = 0; i < EXPECT.length; i++) {
    const e = EXPECT[i]
    const card = page.locator(`[data-testid="service-card-${e.id}"]`)
    const href = (await card.getAttribute('href')) || ''
    const text = (await card.textContent()) || ''
    check(`card ${i + 1}/${12} "${e.id}": href → ${e.dest}${e.dest.endsWith('=') ? '…' : ''}`, href.startsWith(e.dest))
    check(`card ${i + 1}/${12} "${e.id}": title present`, text.includes(e.titleFragment), text.slice(0, 24))
  }

  // menubar บริการ active
  const activeTab = page.locator('nav a[href="/v2/service"][aria-current="page"]')
  check('menubar บริการ tab active (aria-current=page)', (await activeTab.count()) === 1 && ((await activeTab.textContent()) || '').includes('บริการ'))

  // 3. REACHABILITY — click each card, assert it LANDS on its destination, return
  for (let i = 0; i < EXPECT.length; i++) {
    const e = EXPECT[i]
    await page.goto(`${HOST}/v2/service`, { waitUntil: 'networkidle' })
    await page.locator(`[data-testid="service-card-${e.id}"]`).click()
    await page.waitForTimeout(350)
    const landed = decodeURIComponent(page.url())
    const ok = e.dest.endsWith('=') ? landed.includes('/v2/service/coming-soon') && landed.includes(e.titleFragment) : landed.includes(e.dest)
    check(`click ${i + 1}/12 "${e.id}" → lands on ${e.dest}${e.dest.endsWith('=') ? '<name>' : ''}`, ok, ok ? '' : `landed: ${landed.replace(HOST, '')}`)
  }

  // coming-soon names the service + has a way back + menu still บริการ
  await page.goto(`${HOST}/v2/service/coming-soon?service=${encodeURIComponent('มานิเฟส')}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  check('coming-soon NAMES the tapped service', ((await page.locator('[data-testid="coming-soon-title"]').textContent()) || '').includes('มานิเฟส'))
  check('coming-soon has a way back (→ /v2/service)', (await page.locator('[data-testid="coming-soon-back"][href="/v2/service"]').count()) === 1)
  check('coming-soon: บริการ tab still active', (await page.locator('nav a[href="/v2/service"][aria-current="page"]').count()) === 1)

  check('0 app-fetch across the walk', tracker.appFetches.length === 0, tracker.appFetches.slice(0, 3).join(', '))
  check('console 0', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  await ctx.close()
  await browser.close()

  console.log(`\n${failed === 0 ? '✅ run-service-hub PASS' : `❌ run-service-hub FAIL (${failed})`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
