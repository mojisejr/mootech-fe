// harness/run-zone2-card.ts — Zone 2 manifest/mascot card anchor (visual lens).
//
// Invariants that AST/console pass but can silently regress the pixels:
//   gradient  — the card bg gradient is driven by the user's element (ไม้/ไฟ/ดิน/ทอง/น้ำ); a null/unknown
//               element falls back to the WOOD gradient (the card is never colourless).
//   occlusion — the button (and title) sit ABOVE the mascot (z-order): tapping/reading the button must hit
//               the button, never the mascot, for ANY of the 60 mascots (ฟีม: readable 100%).
//   graceful  — element null → wood gradient · mascot 404 → hero fallback (01.png).
// Runs against the deterministic home-preview (the anchor gate); the human artifact is the capture-route pass.
//   npx tsx harness/run-zone2-card.ts   (dev server up; HARNESS_HOST/PORT + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3006'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const M = '/images/v2/characters/01_ชวด-ไม้.png'
// element → the gradient's FROM colour (lowercased) it must render (mirror of ELEMENT_GRADIENTS).
const EXPECT_FROM: Record<string, string> = { 'ไม้': '#91d8d2', 'ไฟ': '#f6a99f', 'ดิน': '#e8cd94', 'ทอง': '#cfd7e1', 'น้ำ': '#9cc5f1' }
const hex2rgb = (h: string) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`

async function withCard<T>(browser: Browser, query: string, fn: (card: import('playwright').Locator, p: Page) => Promise<T>): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${HOST}/v2/home-preview?${query}`, { waitUntil: 'networkidle' })
  const card = p.locator('section').filter({ hasText: 'มานิเฟส' }).first()
  await card.waitFor(); await p.waitForTimeout(400)
  const r = await fn(card, p)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── gradient by element ──
  const gradient: Record<string, boolean> = {}
  for (const el of Object.keys(EXPECT_FROM)) {
    const bg = await withCard(browser, `element=${encodeURIComponent(el)}&mascot=${encodeURIComponent(M)}`, (c) => c.evaluate((s) => getComputedStyle(s).backgroundImage))
    gradient[el] = bg.includes(hex2rgb(EXPECT_FROM[el]))
  }
  const gradientOk = Object.values(gradient).every(Boolean)

  // ── occlusion: the button/title render ABOVE the mascot (z-order), and the mascot is pointer-events-none
  //    so a tap passes through to the button. elementFromPoint can't measure VISUAL overlap here (it skips
  //    the pointer-events-none mascot), so the visual guarantee is z-index; clickability is the hit-test. ──
  const occlusionOk = await withCard(browser, `element=${encodeURIComponent('ทอง')}&mascot=${encodeURIComponent('/images/v2/characters/10_ระกา-ทอง.png')}`, (c) =>
    c.evaluate((s) => {
      const content = s.querySelector('button')!.parentElement as HTMLElement // the z-10 content column
      const mascot = s.querySelector('[data-testid=manifest-mascot]') as HTMLElement
      const cz = parseInt(getComputedStyle(content).zIndex) || 0
      const mz = parseInt(getComputedStyle(mascot).zIndex) || 0
      const btn = s.querySelector('button')!; const r = btn.getBoundingClientRect()
      const clickable = btn.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) // pass-through works
      return cz > mz && clickable
    }),
  )

  // ── graceful ──
  const woodFrom = hex2rgb('#91d8d2')
  const nullGradient = await withCard(browser, `element=null&mascot=${encodeURIComponent(M)}`, (c) => c.evaluate((s) => getComputedStyle(s).backgroundImage))
  const mascot404 = await withCard(browser, `element=${encodeURIComponent('ไม้')}&mascot=404`, (c) => c.evaluate((s) => (s.querySelector('[data-testid=manifest-mascot] img') as HTMLImageElement)?.currentSrc?.split('/').pop() ?? ''))
  const gracefulOk = nullGradient.includes(woodFrom) && mascot404 === '01.png'

  // ── teeth: drop the content column BELOW the mascot (z-0) → it no longer renders on top → gate rejects ──
  const occlusionCaught = await withCard(browser, `element=${encodeURIComponent('ทอง')}&mascot=${encodeURIComponent('/images/v2/characters/10_ระกา-ทอง.png')}`, (c) =>
    c.evaluate((s) => {
      const content = s.querySelector('button')!.parentElement as HTMLElement
      content.style.zIndex = '0' // now content z(0) < mascot z(1) → mascot on top
      const cz = parseInt(getComputedStyle(content).zIndex) || 0
      const mz = parseInt(getComputedStyle(s.querySelector('[data-testid=manifest-mascot]') as HTMLElement).zIndex) || 0
      return !(cz > mz) // no longer on top → caught
    }),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ ZONE-2 CARD anchor ═══')
  console.log(`  gradient: ${Object.entries(gradient).map(([k, v]) => `${k}=${v ? '✓' : '✗'}`).join(' · ')}`)
  console.log(line(gradientOk, 'card gradient matches the element (5 ธาตุ)'))
  console.log(line(occlusionOk, 'button is ON TOP of the mascot (readable) — winged rooster'))
  console.log(line(gracefulOk, `graceful: null → wood gradient · mascot 404 → hero (01.png = ${mascot404})`))
  console.log('  ── teeth ──')
  console.log(`  ${occlusionCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-button-behind: button z-0 → mascot covers it → occlusion gate rejects`)

  const ok = gradientOk && occlusionOk && gracefulOk && occlusionCaught
  console.log(`\n  ${ok ? '🟢 ZONE-2 CARD PASSED' : '🔴 FAILED'} — element gradient · button-on-top · graceful fallbacks\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
