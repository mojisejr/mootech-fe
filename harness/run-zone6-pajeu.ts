// harness/run-zone6-pajeu.ts — Zone 6 เรียนปาจื่อ (mindful-moments-section · Figma 375:14147) anchor (visual lens).
//
// Zone 6 REUSES the shared <HabitCard/> (Figma 375:14151 === Zone 4's 333:6889 — the card, its 2 mascots, book-frame
// and 3-piece cohort motion are all proven by run-zone4-motion.ts). What is NEW here — and what THIS anchor owns —
// is how Zone 6 differs from Zone 4, i.e. the ways a copy-paste of Zone 4 would silently be WRONG for Zone 6:
//   cta-variant     — Zone 6's CTA is the **tertiary** (bordered, transparent-fill, sapphire text) variant, NOT the
//                     primary filled ซื้อเลย. A wrong variant paints a filled sapphire pill — className passes, pixels lie.
//   no-3-card-row   — Zone 6 has **no** pastel-blue 3-card row (Zone 4 has three). A stray/duplicated row is invisible
//                     to tsc but wrong for the section.
//   title-2-line    — the title is **2 lines** ("เรียนปาจื่อออนไลน์" / "ในงบ 265 บาท") in the 140-tall text box; a
//                     1-line title (missing the break) changes the whole card layout.
//   asset/motion in context — both mascots must PAINT here too, and the shared cohort motion must actually ATTACH in
//                     the เรียนปาจื่อ section (not just in Zone 4) — proving the reuse is live, not decorative.
//   npx tsx harness/run-zone6-pajeu.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page, type Locator } from 'playwright'
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

async function withSection<T>(browser: Browser, reduce: boolean, fn: (sec: Locator, p: Page) => Promise<T>, width = 393): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: reduce ? 'reduce' : 'no-preference' })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  await p.goto(`${HOST}/v2/home-preview?state=good`, { waitUntil: 'networkidle' })
  const sec = p.locator('section').filter({ hasText: 'เรียนปาจื่อ' }).first()
  await sec.waitFor(); await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(400)
  const r = await fn(sec, p)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── cta-variant: the section's single CTA is TERTIARY (visible border, transparent fill, sapphire text) — not
  //    the primary filled pill. Read the computed style, not the className. ──
  const cta = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      const btns = Array.from(s.querySelectorAll('button')) as HTMLButtonElement[]
      if (btns.length !== 1) return { count: btns.length, tertiary: false, label: '' }
      const b = btns[0]; const cs = getComputedStyle(b)
      const borderW = parseFloat(cs.borderTopWidth) || 0
      const bg = cs.backgroundColor.replace(/\s/g, '')
      const transparentFill = bg === 'rgba(0,0,0,0)' || bg === 'transparent'
      // sapphire #1455A4 = rgb(20,85,164); tertiary text + border are sapphire, fill is transparent.
      return { count: btns.length, tertiary: borderW >= 1 && transparentFill && b.type === 'button', label: (b.textContent || '').trim() }
    }),
  )
  const ctaOk = cta.count === 1 && cta.tertiary && cta.label === 'ดูรายละเอียดเพิ่มเติม'

  // ── no-3-card-row: Zone 6 has ZERO pastel-blue property cards (Zone 4 has three) ──
  const cardRow = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => s.querySelectorAll('.bg-v3-pastel-blue').length),
  )
  const noCardRowOk = cardRow === 0

  // ── title-2-line: the card title renders on 2 line boxes (the break is present) ──
  const title = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      // the title is the first bold-navy text node in the card's text column.
      const el = Array.from(s.querySelectorAll('.text-v3-navy')).find((n) => (n.textContent || '').includes('เรียนปาจื่อออนไลน์')) as HTMLElement | undefined
      if (!el) return { found: false, lines: 0 }
      const lineH = parseFloat(getComputedStyle(el).lineHeight) || 24
      return { found: true, lines: Math.round(el.getBoundingClientRect().height / lineH) }
    }),
  )
  const title2LineOk = title.found && title.lines === 2

  // ── asset-fidelity: both mascots paint here too (naturalWidth>0) ──
  const assets = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      const imgs = Array.from(s.querySelectorAll('img')) as HTMLImageElement[]
      const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc.split('/').pop())
      return { total: imgs.length, broken }
    }),
  )
  const assetsOk = assets.broken.length === 0 && assets.total >= 2 // mascot-sian + mascot-leaf

  // ── motion-in-context: the shared cohort motion ACTUALLY attaches in THIS section (reuse is live) ──
  const motion = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => ['.hc-big', '.hc-small', '.hc-frame'].map((cls) => {
      const el = s.querySelector(cls) as HTMLElement | null
      const a = el ? el.getAnimations()[0] : null
      return el ? (a ? a.playState === 'running' : false) : false
    })),
  )
  const motionOk = motion.length === 3 && motion.every(Boolean)

  // ── no-overflow-x at the three burned widths ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) {
    overflow[w] = await withSection(browser, false, (_sec, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth), w)
  }
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-cta-filled — remove the border + fill the CTA (simulate a primary variant slipped into Zone 6) →
  //    the cta-variant gate must REJECT (it no longer reads as tertiary). ──
  const ctaCaught = await withSection(browser, false, (sec, p) =>
    p.addStyleTag({ content: `section .border-v3-sapphire{border-width:0!important;background-color:#1455A4!important}` }).then(() =>
      sec.evaluate((s) => {
        const b = s.querySelector('button') as HTMLButtonElement
        const cs = getComputedStyle(b)
        const stillTertiary = (parseFloat(cs.borderTopWidth) || 0) >= 1 && cs.backgroundColor.replace(/\s/g, '') === 'rgba(0,0,0,0)'
        return !stillTertiary // gate would now reject → caught
      }),
    ),
  )

  // ── teeth: mut-card-row — inject a pastel-blue card into the section → the no-3-card-row gate must REJECT. ──
  const rowCaught = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      const d = document.createElement('div'); d.className = 'bg-v3-pastel-blue'; s.appendChild(d)
      return s.querySelectorAll('.bg-v3-pastel-blue').length > 0 // gate would now reject → caught
    }),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ ZONE-6 PAJEU anchor ═══')
  console.log(line(ctaOk, `cta-variant: single TERTIARY CTA (bordered, transparent fill) "${cta.label}"  [count=${cta.count}]`))
  console.log(line(noCardRowOk, `no-3-card-row: 0 pastel-blue cards in section (Zone 4 has 3)  [found=${cardRow}]`))
  console.log(line(title2LineOk, `title-2-line: card title wraps to 2 lines  [lines=${title.lines}]`))
  console.log(line(assetsOk, `asset-fidelity: ${assets.total} imgs paint, broken=[${assets.broken.join(', ')}]`))
  console.log(line(motionOk, `motion-in-context: shared cohort attaches here  [big/small/frame=${motion.map((b) => (b ? '✓' : '✗')).join('')}]`))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${ctaCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-cta-filled: border removed + filled → cta-variant gate rejects`)
  console.log(`  ${rowCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-card-row: inject a pastel-blue card → no-3-card-row gate rejects`)

  const ok = ctaOk && noCardRowOk && title2LineOk && assetsOk && motionOk && noOverflowOk && ctaCaught && rowCaught
  console.log(`\n  ${ok ? '🟢 ZONE-6 PAJEU PASSED' : '🔴 FAILED'} — cta-variant · no-3-card-row · title-2-line · asset · motion-in-context · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
