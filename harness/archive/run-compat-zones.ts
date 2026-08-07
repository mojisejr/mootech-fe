// harness/run-compat-zones.ts — anchor for the ดวงสมพงศ์ result page Zones 1–4 refactored to Figma
// (Z1 636:19319 tabs · Z2 636:19532 dimensions · Z3 636:22150 ธาตุ&เสา · Z4 636:22328 รายคน).
// LENS = visual. Ground-truth = COMPUTED style of the rendered nodes + real layout geometry, not classNames.
//
// Invariants owned here:
//   Z1 TABS  — one #ECF0FC pill container; active = sapphire bg + LIME text, inactive = transparent + sapphire.
//              @393 the tabs FILL the row (no scroll). @320 they must NOT squash: the row SCROLLS instead
//              (scrollWidth > clientWidth) with the scrollbar hidden, and the page never overflows sideways.
//   Z2 DIMS  — the rows live inside ONE section card: a row must NOT paint its own card background (the
//              "card inside a card" regression). The grade pill colour ALWAYS equals its bar colour, and the
//              rationale box carries the grade's soft tint (5-step ramp, A≠B).
//   ELEMENTS — the 5 wuxing chips: the tile is NOT free — it is the glyph colour over white at 16.2% (a rule
//              measured off the two Figma-sampled chips and true on all 6 channels). Only TWO chips render per
//              screen, so all five are ENUMERATED by driving different pairs through the real route.
//   Z3/Z4    — side tint system: ตัวเรา #ECF0FC vs เขา #F9F4F0, on both the pillar panels and the person cards.
//              Inner pillar cells stay white. D23 (ยาม "—" when timeKnown=false) must still hold.
//
// TEETH:
//   • mut-tab-white-text     — active tab text back to white → Z1 lime check trips.
//   • mut-nested-card        — give a dimension row a white card bg → Z2 nested-card check trips.
//   • mut-tint-swap          — swap the self/other tints → Z3/Z4 side-tint check trips.
//   • mut-grade-colour-drift — pill colour ≠ bar colour → Z2 colour-agreement check trips.
//   • mut-element-tint-drift  — an element tile hand-edited off the 16.2% rule → element tint check trips.
//
// Run (dev up :3100 with env):  CAPTURE_HOST=http://localhost:3100 npx tsx harness/run-compat-zones.ts
import { chromium, type Browser, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3100'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'

const TINT_SELF = 'rgb(236, 240, 252)' // #ECF0FC
const TINT_OTHER = 'rgb(249, 244, 240)' // #F9F4F0
const SAPPHIRE = 'rgb(20, 85, 164)' // #1455A4
const LIME = 'rgb(225, 255, 0)' // #E1FF00
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
// TIER_COLOR / TIER_SOFT as rendered rgb, keyed by the grade used in the fixture
const EXPECT_PILL: Record<string, string> = { A: 'rgb(46, 125, 50)', B: 'rgb(102, 187, 106)', 'C+': 'rgb(205, 220, 57)', 'C-': 'rgb(245, 124, 0)', 'D-': 'rgb(183, 28, 28)' }
const EXPECT_SOFT: Record<string, string> = { A: 'rgb(232, 245, 233)', B: 'rgb(240, 248, 240)', 'C+': 'rgb(249, 251, 231)', 'C-': 'rgb(255, 240, 225)', 'D-': 'rgb(252, 228, 236)' }

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

const DIMS = [
  { key: 'destiny', label: 'คู่บุญ / คู่กรรม', percent: 95, grade: 'A', ratingText: 'เกื้อหนุนกันในระยะยาว' },
  { key: 'family', label: 'ความเข้ากันของครอบครัว', percent: 75, grade: 'B', ratingText: 'พ่อแม่ทั้งสองฝั่งยอมรับได้' },
  { key: 'life', label: 'วาสนาการเป็นคู่ชีวิต', percent: 55, grade: 'C+', ratingText: 'ต้องตั้งใจประคับประคอง' },
  { key: 'trust', label: 'มิตรภาพ / ความเข้าใจ', percent: 42, grade: 'C-', ratingText: 'วิธีคิดคนละแบบ' },
  { key: 'body', label: 'ความใกล้ชิด / เสน่หาทางกาย', percent: 15, grade: 'D-', ratingText: 'แรงดึงดูดไม่ได้มาเอง' },
]

function detailBody(el?: { aElementTh: string; bElementTh: string }) {
  const overall = { percent: 57, grade: 'C+', gradeLabel: 'ต้องปรับรับเข้าหากัน', ratingText: 'เป็นคนรักที่มีบทบาทหน้าที่สำคัญ' }
  const pil = (y: string[], m: string[], d: string[], h: string[]) => ({ year: { stem: y[0], branch: y[1], element: y[2] }, month: { stem: m[0], branch: m[1], element: m[2] }, day: { stem: d[0], branch: d[1], element: d[2] }, hour: { stem: h[0], branch: h[1], element: h[2] } })
  const a = { displayName: 'มิลา', dayGanzhi: '壬午', elementTh: el?.aElementTh ?? 'น้ำ', stageTh: 'หยางน้ำ', nisai: ['ปรับตัวเก่ง'], timeKnown: true, fourPillars: pil(['壬', '申', 'น้ำ'], ['甲', '戌', 'ไม้'], ['庚', '戌', 'ทอง'], ['壬', '戌', 'น้ำ']) }
  const b = { displayName: 'โปเตโต้', dayGanzhi: '癸酉', elementTh: el?.bElementTh ?? 'ดิน', stageTh: 'หยางดิน', nisai: ['มั่นคง'], timeKnown: false, fourPillars: pil(['丙', '午', 'ไฟ'], ['乙', '未', 'ไม้'], ['己', '丑', 'ดิน'], ['', '', '']) }
  return JSON.stringify({ result: JSON.stringify({ pairMatch: { overall, dimensions: DIMS, persons: { a, b }, elementInteraction: { aElementTh: el?.aElementTh ?? 'น้ำ', bElementTh: el?.bElementTh ?? 'ดิน', summaryTh: 'ต้องปรับตัว', aToB: { labelTh: 'ดินข่มน้ำ', relation: 'พิฆาต' } } } }) })
}

async function open(browser: Browser, width = 393, el?: { aElementTh: string; bElementTh: string }) {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: new URL(HOST).hostname, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: detailBody(el) }))
  await page.route((u) => u.pathname.includes('/api/bazi/mascot/'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mascot: null }) }))
  await page.goto(`${HOST}/v2/service/compatibility/result/ZONES`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 20000 })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready)
  await page.waitForTimeout(300)
  return { ctx, page }
}

const bg = (p: Page, sel: string) => p.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : 'NONE' }, sel)

// the element-chip rule: tile = glyph over WHITE at 16.2%. Parses the two computed rgb() strings and checks
// every channel lands within ±2/255 of the composite (rounding + the browser's own rgb rounding).
const rgb = (s: string) => (s.match(/\d+/g) ?? []).slice(0, 3).map(Number)
function obeysTint(fg: string, bgc: string): boolean {
  const f = rgb(fg), b = rgb(bgc)
  if (f.length !== 3 || b.length !== 3) return false
  return f.every((v, i) => Math.abs(Math.round(v * 0.162 + 255 * (1 - 0.162)) - b[i]) <= 2)
}
const noPageOverflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

;(async () => {
  const browser = await chromium.launch()
  try {
    // ═══ ZONE 1 · tabs @393 — Figma-exact fill ═════════════════════════════════════════════════════
    {
      const { ctx, page } = await open(browser, 393)
      check('Z1 container tint = #ECF0FC', (await bg(page, '[data-testid="compat-result-tabs"]')) === TINT_SELF)
      const act = await page.evaluate(() => { const e = document.querySelector('[data-testid="compat-result-tabs"] [data-active="true"]')!; const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color } })
      check('Z1 active tab = sapphire bg + LIME text', act.bg === SAPPHIRE && act.fg === LIME, `${act.bg} / ${act.fg}`)
      const inact = await page.evaluate(() => { const all = Array.from(document.querySelectorAll('[data-testid="compat-result-tabs"] button')); const e = all.find((b) => b.getAttribute('data-active') !== 'true')!; const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color } })
      check('Z1 inactive tab = transparent bg + sapphire text', inact.bg === TRANSPARENT && inact.fg === SAPPHIRE, `${inact.bg} / ${inact.fg}`)
      const geo = await page.evaluate(() => { const n = document.querySelector('[data-testid="compat-result-tabs"]') as HTMLElement; const w = Array.from(n.querySelectorAll('button')).map((b) => +b.getBoundingClientRect().width.toFixed(1)); return { w, scrollW: n.scrollWidth, clientW: n.clientWidth, sbar: n.offsetHeight - n.clientHeight } })
      check('Z1 @393 tabs are EQUAL width (±1px)', Math.max(...geo.w) - Math.min(...geo.w) <= 1, geo.w.join(' / '))
      check('Z1 @393 tabs FILL the row (no scroll)', geo.scrollW <= geo.clientW + 1, `scroll ${geo.scrollW} vs client ${geo.clientW}`)
      check('Z1 @393 no page overflow-x', await noPageOverflow(page))

      // ═══ ZONE 2 · dimensions ════════════════════════════════════════════════════════════════════
      const rowBgs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-dim-card"]')).map((e) => getComputedStyle(e).backgroundColor))
      check(`Z2 all ${rowBgs.length} rows sit INSIDE one card (no nested card bg)`, rowBgs.length === 5 && rowBgs.every((b) => b === TRANSPARENT), rowBgs.join(','))
      const pairs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-dim-card"]')).map((row) => ({
        grade: (row.querySelector('[data-testid="compat-dim-grade"]') as HTMLElement | null)?.textContent?.trim() ?? '',
        pill: getComputedStyle(row.querySelector('[data-testid="compat-dim-grade"]')!).backgroundColor,
        bar: getComputedStyle(row.querySelector('[data-testid="compat-dim-bar"]')!).backgroundColor,
        soft: getComputedStyle(row.querySelector('[data-testid="compat-dim-rating"]')!).backgroundColor,
      })))
      check('Z2 pill colour ALWAYS equals bar colour', pairs.every((p) => p.pill === p.bar), pairs.map((p) => `${p.grade}:${p.pill === p.bar ? 'ok' : 'DRIFT'}`).join(' '))
      check('Z2 every grade uses its Figma ramp colour', pairs.every((p) => p.pill === EXPECT_PILL[p.grade]), pairs.map((p) => `${p.grade}=${p.pill}`).join(' '))
      check('Z2 rationale box carries the grade soft tint', pairs.every((p) => p.soft === EXPECT_SOFT[p.grade]), pairs.map((p) => `${p.grade}=${p.soft}`).join(' '))
      check('Z2 A and B render DIFFERENT greens (5-step ramp, not one bucket)', pairs.find((p) => p.grade === 'A')!.pill !== pairs.find((p) => p.grade === 'B')!.pill)

      // ═══ ZONE 3 · ธาตุ & เสา ════════════════════════════════════════════════════════════════════
      const pil = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-fourpillars"]')).map((e) => ({ side: e.getAttribute('data-side'), bg: getComputedStyle(e).backgroundColor })))
      check('Z3 pillar panels carry the side tint (self #ECF0FC / other #F9F4F0)',
        pil.length === 2 && pil[0].side === 'self' && pil[0].bg === TINT_SELF && pil[1].side === 'other' && pil[1].bg === TINT_OTHER,
        pil.map((p) => `${p.side}=${p.bg}`).join(' '))
      check('Z3 inner pillar cells stay white', (await bg(page, '[data-testid="compat-pillar-ปี"]')) === 'rgb(255, 255, 255)')
      // element chip: the tile must be the GLYPH colour over white at 16.2% — the Figma-proven rule, checked
      // on whatever pair this fixture renders (the all-5 sweep runs in its own block below).
      const chipPair = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-element-chip"]')).map((e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color, hz: e.textContent?.trim() } }))
      check('Z3 element chips render (a pair)', chipPair.length === 2, chipPair.map((c) => c.hz).join('/'))
      check('Z3 chip tile obeys the 16.2% tint rule', chipPair.every((c) => obeysTint(c.fg, c.bg)), chipPair.map((c) => `${c.hz} ${c.fg}→${c.bg}`).join(' '))
      check('Z3 D23 ยาม "—" still shown when timeKnown=false', (await page.locator('[data-testid="compat-pillar-hour-unknown"]').count()) === 1)

      // ═══ ZONE 4 · รายคน ═════════════════════════════════════════════════════════════════════════
      const ppl = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-person-detail"]')).map((e) => ({ side: e.getAttribute('data-side'), bg: getComputedStyle(e).backgroundColor })))
      check('Z4 person cards carry the side tint (self / other)',
        ppl.length === 2 && ppl[0].bg === TINT_SELF && ppl[1].bg === TINT_OTHER, ppl.map((p) => `${p.side}=${p.bg}`).join(' '))
      check('Z4 section header reads "รายคน" (ฟีม 2026-08-03, NOT the Figma copy-paste title)',
        await page.evaluate(() => !!Array.from(document.querySelectorAll('#compat-sec-people h2')).find((h) => h.textContent?.trim() === 'รายคน')))

      // ═══ TEETH ══════════════════════════════════════════════════════════════════════════════════
      await page.addStyleTag({ content: '[data-testid="compat-result-tabs"] [data-active="true"]{color:#fff !important}' })
      check('🦷 mut-tab-white-text → active text no longer lime → CAUGHT',
        (await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="compat-result-tabs"] [data-active="true"]')!).color)) !== LIME)
      await page.addStyleTag({ content: '[data-testid="compat-dim-card"]{background:#fff !important}' })
      check('🦷 mut-nested-card → a row paints its own card bg → CAUGHT',
        (await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-dim-card"]')).some((e) => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'))))
      await page.addStyleTag({ content: '[data-testid="compat-person-detail"][data-side="self"]{background-color:#F9F4F0 !important}' })
      check('🦷 mut-tint-swap → self card wears the other tint → CAUGHT',
        (await bg(page, '[data-testid="compat-person-detail"][data-side="self"]')) === TINT_OTHER)
      await page.addStyleTag({ content: '[data-testid="compat-dim-bar"]{background-color:#000 !important}' })
      check('🦷 mut-grade-colour-drift → bar colour leaves the pill → CAUGHT',
        (await page.evaluate(() => { const r = document.querySelector('[data-testid="compat-dim-card"]')!; return getComputedStyle(r.querySelector('[data-testid="compat-dim-grade"]')!).backgroundColor !== getComputedStyle(r.querySelector('[data-testid="compat-dim-bar"]')!).backgroundColor })))
      await ctx.close()
    }

    // ═══ ELEMENT PALETTE · all 5 (ฟีม 2026-08-03) ══════════════════════════════════════════════════
    // The screen only ever renders TWO chips at a time, so a per-render check can never see all five —
    // the state-space has to be ENUMERATED by driving each pair through the real screen. Only น้ำ/ดิน are
    // Figma-sampled; the other three are ฟีม-ruled, and ALL five must obey the 16.2% tile rule.
    {
      const EXPECT: Record<string, string> = {
        'ไม้': 'rgb(76, 189, 50)', 'ไฟ': 'rgb(217, 76, 76)', 'ดิน': 'rgb(204, 158, 76)',
        'ทอง': 'rgb(217, 184, 76)', 'น้ำ': 'rgb(76, 140, 230)',
      }
      const seen = new Set<string>()
      for (const [a, b] of [['ไม้', 'ไฟ'], ['ทอง', 'น้ำ'], ['ดิน', 'ไม้']] as const) {
        const { ctx, page } = await open(browser, 393, { aElementTh: a, bElementTh: b })
        const chips = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="compat-element-chip"]')).map((e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color, hz: e.textContent?.trim() } }))
        const pair: string[] = [a, b]
        for (let i = 0; i < pair.length; i++) {
          const el = pair[i]
          const c = chips[i]
          check(`element ${el}: glyph colour is the ruled value`, c?.fg === EXPECT[el], `${c?.hz} ${c?.fg}`)
          check(`element ${el}: tile obeys the 16.2% rule`, obeysTint(c?.fg ?? '', c?.bg ?? ''), `${c?.fg} → ${c?.bg}`)
          seen.add(el)
        }
        await ctx.close()
      }
      check('all 5 elements enumerated (not spot-checked on one pair)', seen.size === 5, Array.from(seen).join('/'))

      // 🦷 tooth — a tile that drifts off the rule (hand-edited hex) must trip the tint check
      const { ctx, page } = await open(browser, 393, { aElementTh: 'ไม้', bElementTh: 'ไฟ' })
      await page.addStyleTag({ content: '[data-testid="compat-element-chip"]{background-color:#CCCCCC !important}' })
      const drifted = await page.evaluate(() => { const e = document.querySelector('[data-testid="compat-element-chip"]')!; const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color } })
      check('🦷 mut-element-tint-drift → tile off the rule → CAUGHT', !obeysTint(drifted.fg, drifted.bg), `${drifted.fg} → ${drifted.bg}`)
      await ctx.close()
    }

    // ═══ ZONE 1 · @320 — ฟีม's call: labels must NOT squash; the row scrolls, scrollbar hidden ══════
    {
      const { ctx, page } = await open(browser, 320)
      const geo = await page.evaluate(() => { const n = document.querySelector('[data-testid="compat-result-tabs"]') as HTMLElement; return { w: Array.from(n.querySelectorAll('button')).map((b) => +b.getBoundingClientRect().width.toFixed(1)), scrollW: n.scrollWidth, clientW: n.clientWidth, barH: n.offsetHeight - n.clientHeight } })
      check('Z1 @320 labels do NOT squash (every tab ≥ 86px)', Math.min(...geo.w) >= 86, geo.w.join(' / '))
      check('Z1 @320 the row SCROLLS instead (scrollWidth > clientWidth)', geo.scrollW > geo.clientW, `${geo.scrollW} > ${geo.clientW}`)
      check('Z1 @320 scrollbar is HIDDEN (no reserved track)', geo.barH === 0, `${geo.barH}px`)
      check('Z1 @320 page still has no overflow-x (the scroll is contained)', await noPageOverflow(page))
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
