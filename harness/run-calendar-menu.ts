// harness/run-calendar-menu.ts — shared CalendarMenu (Figma 461:3224) multi-state anchor (visual lens).
//
// The bottom menu is ONE component with 4 states (left slot swaps; Mate AI slot is constant, except 'form' drops
// it). Invariants the PIXELS own that className/tsc are blind to:
//   state-slot     — each state renders the RIGHT left slot + the RIGHT Mate AI presence (a copy-paste that shows
//                    the tab bar on a form screen, or keeps Mate AI on the form, passes tsc but lies).
//   mascot-inside  — A1 (ฟีม ก · อยู่ในปุ่ม): the mascot's head sits INSIDE the button (its top is NOT above the
//                    button top) and the clip container is overflow-hidden — the old build poked the head ~14px
//                    above the button. Only the rendered geometry catches a re-poke.
//   label-1-line   — the "Mate AI" label is a single line (Figma), not the 2-line wrap that a width-constrained
//                    absolute label falls into.
//   nav-height     — the nav stays ~94px (button 70 + pad) so the home nav-clearance (74px) is untouched (ตู๋).
//   no-word-cut    — A2 (ฟีม ก): the state-2 CTA "…เพื่อแจ้งเตือน" is NEVER truncated at 320 — it wraps/shrinks,
//                    the whole word stays, the text never overflows its button (scrollWidth ≤ clientWidth).
//   npx tsx harness/run-calendar-menu.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page, type Locator } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3012'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()

async function withMenu<T>(browser: Browser, menu: string, width: number, fn: (nav: Locator, p: Page) => Promise<T>, label?: string): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  const url = `${HOST}/v2/menu-preview?menu=${menu}${label ? `&label=${encodeURIComponent(label)}` : ''}`
  await p.goto(url, { waitUntil: 'networkidle' })
  const nav = p.locator('nav.fixed').first()
  await nav.waitFor(); await p.waitForTimeout(300)
  const r = await fn(nav, p)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── state-slot: each state's left slot + Mate AI presence ──
  const slots = await Promise.all((['default', 'primary-cta', 'saved', 'form'] as const).map((menu) =>
    withMenu(browser, menu, 393, (nav) =>
      nav.evaluate((n) => {
        const tabs = n.querySelectorAll('.bg-v3-nav-dark a').length
        const buttons = n.querySelectorAll('button').length
        const mateAI = !!n.querySelector('a[aria-label="Mate AI"]')
        const btnText = (n.querySelector('button')?.textContent || '').trim()
        return { tabs, buttons, mateAI, btnText }
      }).then((r) => ({ menu, ...r })),
    ),
  ))
  const slotOk = (() => {
    const by = Object.fromEntries(slots.map((s) => [s.menu, s]))
    return (
      by.default.tabs === 4 && by.default.buttons === 0 && by.default.mateAI &&
      by['primary-cta'].tabs === 0 && by['primary-cta'].buttons === 1 && by['primary-cta'].mateAI &&
      by.saved.buttons === 1 && by.saved.mateAI && by.saved.btnText.startsWith('✓') &&
      by.form.buttons === 1 && by.form.tabs === 0 && !by.form.mateAI
    )
  })()

  // ── mascot-inside (A1): head not above the button top + clip container overflow-hidden ──
  const mascot = await withMenu(browser, 'default', 393, (nav) =>
    nav.evaluate((n) => {
      const btn = n.querySelector('a[aria-label="Mate AI"]') as HTMLElement
      const img = btn.querySelector('img') as HTMLElement
      const clip = btn.querySelector('.overflow-hidden') as HTMLElement
      const b = btn.getBoundingClientRect(); const i = img.getBoundingClientRect()
      return {
        notAbove: i.top >= b.top - 1, // head inside the button, not poking above (old bug: ~14px above)
        clipped: !!clip && getComputedStyle(clip).overflow === 'hidden',
        pokeAbovePx: Math.round(b.top - i.top), // >0 would mean poking above
      }
    }),
  )
  const mascotOk = mascot.notAbove && mascot.clipped

  // verify-the-instrument: force the mascot to poke above → the notAbove read must flip to false (probe can see a poke).
  const mascotProbe = await withMenu(browser, 'default', 393, (nav, p) =>
    p.addStyleTag({ content: `nav a[aria-label="Mate AI"] .overflow-hidden > span{top:-14px!important}` }).then(() =>
      nav.evaluate((n) => {
        const btn = n.querySelector('a[aria-label="Mate AI"]') as HTMLElement
        const img = btn.querySelector('img') as HTMLElement
        return img.getBoundingClientRect().top < btn.getBoundingClientRect().top - 1 // now poking above → probe reads it
      }),
    ),
  )

  // ── label-1-line + nav-height ──
  const geom = await withMenu(browser, 'default', 393, (nav) =>
    nav.evaluate((n) => {
      const label = n.querySelector('a[aria-label="Mate AI"] .bg-v3-lime') as HTMLElement
      const lh = parseFloat(getComputedStyle(label).lineHeight) || 20
      const lines = Math.round(label.getBoundingClientRect().height / lh)
      return { labelLines: lines, navHeight: Math.round(n.getBoundingClientRect().height) }
    }),
  )
  const labelOk = geom.labelLines === 1
  const navHeightOk = geom.navHeight >= 90 && geom.navHeight <= 98 // ~94 unchanged

  // ── no-word-cut (A2) at 320, state primary-cta: full word present + no text LINE wider than the button (a
  //    flex button clips internally so scrollWidth is blind — a Range over the text reports the true per-line
  //    geometry pre-clip; every line must fit the button's inner width, i.e. the text wrapped, not overflowed). ──
  const wordCut = await withMenu(browser, 'primary-cta', 320, (nav) =>
    nav.evaluate((n) => {
      const btn = n.querySelector('button') as HTMLElement
      const cs = getComputedStyle(btn)
      const inner = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const range = document.createRange(); range.selectNodeContents(btn)
      const rects = Array.from(range.getClientRects())
      const maxLine = rects.length ? Math.max(...rects.map((r) => r.width)) : 0
      return {
        full: (btn.textContent || '').includes('เพื่อแจ้งเตือน'),
        fits: maxLine <= inner + 1,
        noEllipsis: cs.textOverflow !== 'ellipsis',
        maxLine: Math.round(maxLine), inner: Math.round(inner), lines: rects.length,
      }
    }),
  )
  const wordCutOk = wordCut.full && wordCut.fits && wordCut.noEllipsis

  // ── no-overflow-x across states + widths ──
  const overflow: Record<string, boolean> = {}
  for (const menu of ['default', 'primary-cta', 'form']) for (const w of [393, 360, 320]) {
    overflow[`${menu}@${w}`] = await withMenu(browser, menu, w, (_n, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth))
  }
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-text-overflow — force nowrap + a larger font so the CTA becomes ONE line wider than the button
  //    (what a truncation/no-shrink bug would produce) → the no-word-cut gate (every line ≤ inner width) must
  //    REJECT. (At 320 the real CTA fits on one line at text-sm, so nowrap alone overflows nothing — the font
  //    bump is what forces the would-be-clip the gate must catch.) ──
  const truncCaught = await withMenu(browser, 'primary-cta', 320, (nav, p) =>
    p.addStyleTag({ content: `nav button{white-space:nowrap!important;font-size:22px!important}` }).then(() =>
      nav.evaluate((n) => {
        const btn = n.querySelector('button') as HTMLElement
        const cs = getComputedStyle(btn)
        const inner = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        const range = document.createRange(); range.selectNodeContents(btn)
        const rects = Array.from(range.getClientRects())
        const maxLine = rects.length ? Math.max(...rects.map((r) => r.width)) : 0
        return maxLine > inner + 1 // a line now wider than the button → would be cut → gate rejects → caught
      }),
    ),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ CALENDAR-MENU anchor ═══')
  console.log(line(slotOk, `state-slot: default[4tab+AI] · primary-cta[1btn+AI] · saved[✓btn+AI] · form[1btn,NO-AI]  [${slots.map((s) => `${s.menu}:${s.tabs}t/${s.buttons}b/${s.mateAI ? 'AI' : 'noAI'}`).join(' ')}]`))
  console.log(line(mascotOk, `mascot-inside (A1): head not above button (poke=${mascot.pokeAbovePx}px≤0) + clip overflow-hidden=${mascot.clipped}`))
  console.log(line(mascotProbe, 'verify-instrument: forcing the mascot up IS read as poking-above (probe not vacuous)'))
  console.log(line(labelOk, `label-1-line: "Mate AI" on ${geom.labelLines} line`))
  console.log(line(navHeightOk, `nav-height: ${geom.navHeight}px (~94, home clearance untouched)`))
  console.log(line(wordCutOk, `no-word-cut @320: "เพื่อแจ้งเตือน" present=${wordCut.full} · fits (maxLine ${wordCut.maxLine}≤${wordCut.inner}, ${wordCut.lines} lines)=${wordCut.fits} · no-ellipsis=${wordCut.noEllipsis}`))
  console.log(line(noOverflowOk, `no-overflow-x  [${Object.entries(overflow).filter(([, o]) => o).map(([k]) => k).join(',') || 'all ok @393/360/320'}]`))
  console.log('  ── teeth ──')
  console.log(`  ${truncCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-text-truncate: nowrap+ellipsis on the CTA @320 → text clipped → no-word-cut gate rejects`)

  const ok = slotOk && mascotOk && mascotProbe && labelOk && navHeightOk && wordCutOk && noOverflowOk && truncCaught
  console.log(`\n  ${ok ? '🟢 CALENDAR-MENU PASSED' : '🔴 FAILED'} — state-slot · mascot-inside · label · nav-height · no-word-cut · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
