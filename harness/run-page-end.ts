// harness/run-page-end.ts — /v2 home page-end + whole-page-continuity anchor (visual lens).
//
// With Zone 5 (SinseSection) + Zone 6 (PajeuSection) now the last two sections, the page-END is the risk: the
// content column has pb-36 (144px) to clear the fixed bottom-nav (~94px @393). Invariants the PIXELS own:
//   nav-clearance   — scrolled to the BOTTOM, the last content (เรียนปาจื่อ) must sit ABOVE the fixed nav, not be
//                     occluded by it. A dropped/shrunk pb-36, or a hardcoded gap that's too small, hides content
//                     behind the nav — invisible to tsc/console, only the rendered geometry catches it.
//   zone-continuity — all six zones render in order (Zone 1 greeting → 6 เรียนปาจื่อ); a broken import or a
//                     mis-order regresses the page silently.
//   no-overflow-x   — the full page (incl. the full-bleed Zone 5 banner + overflowing mascot) does not scroll
//                     sideways @393/360/320.
// This is the page-level gate; each section has its own anchor (run-zone{1..6}-*.ts). Runs against the
// deterministic home-preview (no BE); the BE-up console-clean pass is the human capture-route artifact.
//   npx tsx harness/run-page-end.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3010'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()
// the home page's sections, in document order, by a text fragment unique to each (greeting → manifest →
// Zone 3 สมพงค์ → Zone 4 โหมดเซียน → Zone 5 ดูดวงส่วนตัว → Zone 6 เรียนปาจื่อ).
const ZONES = ['สวัสดีคุณ', 'มานิเฟส', 'ดวงสมพงค์', 'โหมดเซียน', 'ดูดวงส่วนตัว', 'เรียนปาจื่อ']

async function withPage<T>(browser: Browser, fn: (p: Page) => Promise<T>, width = 393): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  await p.goto(`${HOST}/v2/home-preview?state=good`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  const r = await fn(p)
  await ctx.close()
  return r
}

// scroll to the bottom, then measure the last content section's bottom vs the fixed nav's top.
async function clearanceAt(browser: Browser, width: number): Promise<{ gap: number; lastZone: string }> {
  return withPage(browser, (p) =>
    p.evaluate(async () => {
      const el = document.scrollingElement!
      el.scrollTop = el.scrollHeight
      await new Promise((r) => setTimeout(r, 300))
      const nav = document.querySelector('nav.fixed') as HTMLElement
      const navTop = nav.getBoundingClientRect().top
      // the last real content section = the เรียนปาจื่อ section (Zone 6).
      const secs = Array.from(document.querySelectorAll('section')) as HTMLElement[]
      const last = secs.filter((s) => (s.textContent || '').includes('เรียนปาจื่อ')).pop() || secs[secs.length - 1]
      const lastBottom = last.getBoundingClientRect().bottom
      return { gap: Math.round(navTop - lastBottom), lastZone: (last.textContent || '').slice(0, 12) }
    }),
    width,
  )
}

async function main() {
  const browser = await chromium.launch()

  // ── zone-continuity: all six zones present, in document order ──
  const order = await withPage(browser, (p) =>
    p.evaluate((zones) => {
      const html = document.body.innerText
      const positions = zones.map((z) => html.indexOf(z))
      const allPresent = positions.every((i) => i >= 0)
      const inOrder = positions.every((i, k) => k === 0 || i > positions[k - 1])
      return { allPresent, inOrder, positions }
    }, ZONES),
  )
  const continuityOk = order.allPresent && order.inOrder

  // ── nav-clearance @393/360/320: last content sits ABOVE the nav (positive gap) ──
  const clearance: Record<number, { gap: number; lastZone: string }> = {}
  for (const w of [393, 360, 320]) clearance[w] = await clearanceAt(browser, w)
  const clearanceOk = Object.values(clearance).every((c) => c.gap >= 0)

  // ── no-overflow-x @393/360/320 (full page) ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) {
    overflow[w] = await withPage(browser, (p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth), w)
  }
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-shrink-pad — shrink the content column's bottom padding to 0 (simulate a dropped pb-36) →
  //    the last content slides under the nav → nav-clearance gate must REJECT. ──
  const clearanceCaught = await withPage(browser, (p) =>
    p.evaluate(async () => {
      const col = document.querySelector('.pb-36') as HTMLElement
      if (col) col.style.paddingBottom = '0px'
      const el = document.scrollingElement!
      el.scrollTop = el.scrollHeight
      await new Promise((r) => setTimeout(r, 300))
      const nav = document.querySelector('nav.fixed') as HTMLElement
      const secs = Array.from(document.querySelectorAll('section')) as HTMLElement[]
      const last = secs.filter((s) => (s.textContent || '').includes('เรียนปาจื่อ')).pop() || secs[secs.length - 1]
      return nav.getBoundingClientRect().top - last.getBoundingClientRect().bottom < 0 // now occluded → caught
    }),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ PAGE-END + CONTINUITY anchor ═══')
  console.log(line(continuityOk, `zone-continuity: all 6 zones present + in order  [present=${order.allPresent} order=${order.inOrder}]`))
  console.log(line(clearanceOk, `nav-clearance: last content above nav @393/360/320  [${Object.entries(clearance).map(([w, c]) => `${w}:${c.gap}px`).join(' ')}]`))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${clearanceCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-shrink-pad: drop the pb-36 clearance → last content under nav → nav-clearance gate rejects`)

  const ok = continuityOk && clearanceOk && noOverflowOk && clearanceCaught
  console.log(`\n  ${ok ? '🟢 PAGE-END PASSED' : '🔴 FAILED'} — zone-continuity · nav-clearance · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
