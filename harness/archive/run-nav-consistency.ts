// harness/run-nav-consistency.ts — anchor for the v2 bottom navigation (Figma menu 461:3224).
// LENS = visual/layout. Ground-truth = the nav's OWN measured box + its tab elements, at many widths.
//
// THE BUG-CLASS THIS OWNS (and why nothing caught it before):
//   The bottom nav is `position: fixed`. When its content is wider than the screen it OVERFLOWS AND IS
//   CLIPPED — but `document.documentElement.scrollWidth` DOES NOT GROW, so every page-level overflow-x
//   assertion we already had reported CLEAN while the user was literally looking at "น้าหลัก" (the "ห" cut
//   off) and half a Mate AI button. A page-level probe is structurally blind here; the nav must be measured
//   ITSELF. Same for the labels: a tab can sit inside the viewport while its own text is ellipsised away.
//
// Invariants:
//   FIT       — across 320…430 the nav's children never cross either screen edge.
//   NO-CUT    — no TAB LABEL is ever truncated (scrollWidth <= clientWidth). The Mate AI label is EXCLUDED:
//               it intentionally overflows its 74px button (Figma's label frame is 102px wide).
//   PRESENCE  — every v2 app screen shows the nav, and the Mate AI button (ฟีม 2026-08-03 "ทุกหน้า"),
//               EXCEPT the documented exceptions below — absence there is a DECISION, not a miss:
//                 · menu state `form` (save sheet) — Figma has no bottom menu there (menu-state.ts, verified)
//                 · the compat RESULT screen — Figma frame 636:18819 ends with no menu (ฟีม 2026-08-03)
//   MATE-SKIN — the Mate AI button is a LIME #E1FF00 fill with a blue→magenta gradient LABEL (it shipped
//               inverted: gradient fill + solid label). Computed style alone can't prove a gradient renders,
//               so the fill/label-transparency/clip are all asserted together.
//
// TEETH:
//   • mut-nav-fixed-width      — pin the tabs back to a fixed width → FIT trips at 360.
//   • mut-page-missing-nav     — remove the nav from a screen that must have one → PRESENCE trips.
//   • mut-mate-on-form         — add Mate AI to the `form` state → PRESENCE trips (guards the OPPOSITE
//                                error: "ทุกหน้า" applied blindly, breaking a screen that was already right).
//
// Run (dev up :3104 with env):  CAPTURE_HOST=http://localhost:3104 npx tsx harness/run-nav-consistency.ts
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3104'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const WIDTHS = [430, 414, 393, 384, 375, 360, 344, 320]
const LIME = 'rgb(225, 255, 0)'
// The border was pinned to the OPAQUE #EDCCD7 here. `get_design_context` on 461:3303 (2026-08-03) says the
// node's stroke is rgba(216,143,169,.4) — and #EDCCD7 is simply what that 40% pink composites to over the cream
// page, i.e. someone sampled the rendered pixel and hard-coded it. Pinning the composite made the anchor green
// on a value that could not survive a different background. It now pins the DECLARED colour, and
// run-mateai-button.ts owns the complementary check that it still RENDERS pink (bg-clip-padding).
const PINK_BORDER = 'rgba(216, 143, 169, 0.4)'

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

async function ctxFor(browser: Browser, width: number): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: new URL(HOST).hostname, path: '/' },
  ])
  return ctx
}

// Measures the NAV ITSELF — never the document. Returns null when no fixed nav exists.
const measure = (p: Page) => p.evaluate(() => {
  const nav = Array.from(document.querySelectorAll('nav')).find((n) => getComputedStyle(n).position === 'fixed')
  if (!nav) return null
  // VERIFY-THE-INSTRUMENT (found live: mut-nav-fixed-width did NOT trip with an earlier version of this
  // probe). Measuring only nav.children is BLIND to items that overflow INSIDE a child — pin the tabs to a
  // fixed width and they spill out of the pill, not out of the nav, so the nav box never moves. The union
  // must therefore include the LEAF items (tabs + Mate AI), and we must also catch a container that is
  // CLIPPING its own content (scrollWidth > clientWidth) — that is the same "clipped inside a fixed layer"
  // class this anchor exists for, one level down.
  const kids = Array.from(nav.children) as HTMLElement[]
  const tabs = (Array.from(nav.querySelectorAll('a[href^="/v2"]')) as HTMLElement[])
    .filter((a) => a.getAttribute('aria-label') !== 'Mate AI')
  const mate = nav.querySelector('[data-testid="nav-mate-ai"]') as HTMLElement | null
  const boxes = [...kids, ...tabs, ...(mate ? [mate] : [])].map((e) => e.getBoundingClientRect())
  const left = Math.min(...boxes.map((b) => b.left))
  const right = Math.max(...boxes.map((b) => b.right))
  // any container inside the nav that clips its own content (the pill squeezing fixed-width tabs)
  const clippers = (Array.from(nav.querySelectorAll('*')) as HTMLElement[])
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && !e.closest('[data-testid="nav-mate-ai"]'))
  return {
    overLeft: Math.max(0, Math.round(0 - left)),
    overRight: Math.max(0, Math.round(right - window.innerWidth)),
    cut: [...tabs.filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent?.trim() ?? ''),
          ...clippers.filter((c) => !tabs.includes(c)).map(() => '[container-clips]')],
    tabCount: tabs.length,
    hasMate: !!mate,
  }
})

async function openPreview(browser: Browser, width: number, state: string) {
  const ctx = await ctxFor(browser, width)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/menu-preview?menu=${state}`, { waitUntil: 'domcontentloaded' })
  await page.locator('nav').first().waitFor({ timeout: 10000 })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready)
  await page.waitForTimeout(150)
  return { ctx, page }
}

async function openRoute(browser: Browser, width: number, route: string) {
  const ctx = await ctxFor(browser, width)
  const page = await ctx.newPage()
  await page.goto(`${HOST}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready)
  return { ctx, page }
}

;(async () => {
  const browser = await chromium.launch()
  try {
    // ═══ FIT + NO-CUT · every menu state × every width ══════════════════════════════════════════════
    for (const state of ['default', 'primary-cta', 'saved', 'form']) {
      const bad: string[] = []
      for (const w of WIDTHS) {
        const { ctx, page } = await openPreview(browser, w, state)
        const m = await measure(page)
        if (!m) bad.push(`@${w} no-nav`)
        else {
          if (m.overLeft || m.overRight) bad.push(`@${w} overflow L${m.overLeft}/R${m.overRight}`)
          if (m.cut.length) bad.push(`@${w} cut:${m.cut.join('|')}`)
        }
        await ctx.close()
      }
      check(`state "${state}" — fits + no label cut across ${WIDTHS.length} widths (320–430)`, bad.length === 0, bad.join(' '))
    }

    // ═══ MATE-AI presence per state (form is the documented exception) ═════════════════════════════
    for (const [state, expect] of [['default', true], ['primary-cta', true], ['saved', true], ['form', false]] as const) {
      const { ctx, page } = await openPreview(browser, 393, state)
      const m = await measure(page)
      check(`state "${state}" — Mate AI ${expect ? 'PRESENT' : 'ABSENT (Figma: save sheet has no menu)'}`, m?.hasMate === expect, `hasMate=${m?.hasMate}`)
      await ctx.close()
    }

    // ═══ PRESENCE across the real routes (ฟีม: Mate AI ทุกหน้า) ════════════════════════════════════
    const MUST_HAVE = ['/v2/service', '/v2/shop', '/v2/calendar', '/v2/service/compatibility/love', '/v2/service/compatibility/recent']
    for (const route of MUST_HAVE) {
      const { ctx, page } = await openRoute(browser, 393, route)
      const m = await measure(page)
      check(`route ${route} — nav present WITH Mate AI`, !!m && m.hasMate && m.tabCount === 4, m ? `tabs=${m.tabCount} mate=${m.hasMate}` : 'no nav')
      await ctx.close()
    }

    // ═══ FIT on the real routes at the tightest widths ═════════════════════════════════════════════
    for (const route of ['/v2/service', '/v2/calendar']) {
      const bad: string[] = []
      for (const w of [393, 360, 320]) {
        const { ctx, page } = await openRoute(browser, w, route)
        const m = await measure(page)
        if (!m) bad.push(`@${w} no-nav`)
        else if (m.overLeft || m.overRight || m.cut.length) bad.push(`@${w} L${m.overLeft}/R${m.overRight} cut:${m.cut.join('|')}`)
        await ctx.close()
      }
      check(`route ${route} — nav fits + no cut @393/360/320`, bad.length === 0, bad.join(' '))
    }

    // ═══ DOCUMENTED ABSENCE — the compat RESULT screen has NO menu (Figma 636:18819 ends empty) ════
    {
      const ctx = await ctxFor(browser, 393)
      const page = await ctx.newPage()
      await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: JSON.stringify({ pairMatch: { overall: { percent: 57, grade: 'C+', gradeLabel: 'x' }, dimensions: [{ key: 'l', label: 'ความรัก', percent: 78, grade: 'A' }], persons: { a: { displayName: 'ม', dayGanzhi: '甲子' }, b: { displayName: 'ก', dayGanzhi: '丙子' } } } }) }) }))
      await page.route((u) => u.pathname.includes('/api/bazi/mascot/'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mascot: null }) }))
      await page.goto(`${HOST}/v2/service/compatibility/result/NAV`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 20000 })
      const m = await measure(page)
      check('compat RESULT — NO bottom menu (ฟีม-ruled, Figma frame ends empty)', m === null, m ? 'a nav appeared' : 'none, as designed')
      await ctx.close()
    }

    // ═══ MATE-AI SKIN — lime fill + gradient label (it shipped INVERTED) ═══════════════════════════
    {
      const { ctx, page } = await openPreview(browser, 393, 'default')
      const skin = await page.evaluate(() => {
        const a = document.querySelector('[data-testid="nav-mate-ai"]') as HTMLElement | null
        if (!a) return null
        const cs = getComputedStyle(a)
        // was `span span` — a positional selector that silently retargeted to the mascot wrapper when the
        // button's child order changed. Address the label by its testid instead.
        const lbl = a.querySelector('[data-testid="nav-mate-ai-label"] span') as HTMLElement | null
        if (!lbl) return null
        const ls = getComputedStyle(lbl)
        const r = lbl.getBoundingClientRect()
        return { fill: cs.backgroundColor, fillImg: cs.backgroundImage, border: cs.borderColor,
          lblColor: ls.color, lblImg: ls.backgroundImage, clip: ls.backgroundClip || (ls as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip,
          w: Math.round(r.width), h: Math.round(r.height) }
      })
      check('Mate AI fill is LIME (not a gradient — the shipped version had these inverted)',
        skin?.fill === LIME && skin?.fillImg === 'none', `${skin?.fill} / ${skin?.fillImg}`)
      check('Mate AI border = rgba(216,143,169,.4) (Figma stroke, not its composite)', skin?.border === PINK_BORDER, skin?.border)
      check('Mate AI label is GRADIENT text (transparent ink + clip:text + a real gradient + non-zero box)',
        skin?.lblColor === 'rgba(0, 0, 0, 0)' && skin?.clip === 'text' && !!skin?.lblImg?.includes('linear-gradient') && (skin?.w ?? 0) > 0 && (skin?.h ?? 0) > 0,
        `${skin?.clip} ${skin?.w}x${skin?.h}`)
      await ctx.close()
    }

    // ═══ TEETH ════════════════════════════════════════════════════════════════════════════════════
    {
      // 🦷 mut-nav-fixed-width — pin tabs back to a fixed width at the tightest real width
      const { ctx, page } = await openPreview(browser, 360, 'default')
      await page.addStyleTag({ content: 'nav a[href^="/v2"]:not([aria-label="Mate AI"]){width:58px !important;flex:none !important;font-size:14px !important;padding-left:4px !important;padding-right:4px !important}' })
      await page.waitForTimeout(150)
      const m = await measure(page)
      check('🦷 mut-nav-fixed-width → nav overflows or a label cuts @360 → CAUGHT',
        !!m && (m.overLeft > 0 || m.overRight > 0 || m.cut.length > 0), m ? `L${m.overLeft}/R${m.overRight} cut:${m.cut.join('|')}` : 'no nav')
      await ctx.close()
    }
    {
      // 🦷 mut-page-missing-nav — a screen that must have a nav loses it
      const { ctx, page } = await openRoute(browser, 393, '/v2/service')
      await page.evaluate(() => document.querySelectorAll('nav').forEach((n) => n.remove()))
      check('🦷 mut-page-missing-nav → PRESENCE gate sees no nav → CAUGHT', (await measure(page)) === null)
      await ctx.close()
    }
    {
      // 🦷 mut-mate-on-form — the OPPOSITE error: "ทุกหน้า" applied blindly onto the save sheet
      const { ctx, page } = await openPreview(browser, 393, 'form')
      await page.evaluate(() => {
        const nav = Array.from(document.querySelectorAll('nav')).find((n) => getComputedStyle(n).position === 'fixed')!
        const fake = document.createElement('a'); fake.setAttribute('data-testid', 'nav-mate-ai'); fake.setAttribute('href', '/v2/service'); fake.textContent = 'Mate AI'
        nav.appendChild(fake)
      })
      const m = await measure(page)
      check('🦷 mut-mate-on-form → Mate AI forced onto the save sheet → CAUGHT', m?.hasMate === true, `hasMate=${m?.hasMate}`)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
