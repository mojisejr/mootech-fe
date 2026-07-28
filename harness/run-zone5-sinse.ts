// harness/run-zone5-sinse.ts — Zone 5 ทักซินแส / section-mascot (Figma 333:6989) anchor (visual lens).
//
// Zone 5 is a full-bleed sapphire banner: text + lime Secondary CTA, the big water-owl mascot overflowing
// bottom/right (STATIC — reuses zone4/mascot-sian.png), a small fire sprite (the ONLY animated element,
// loop 2000ms), and a cream white-mound wave. Invariants the PIXELS own that className/tsc/console are blind to:
//   asset-fidelity  — mascot-sian + sprite-fire must PAINT (naturalWidth>0); a missing file paints nothing.
//   fire-only-motion — EXACTLY the fire animates; the big mascot is STATIC (Figma: นิ่ง). A mascot that
//                      accidentally animates, or a fire that doesn't, both pass tsc but lie about the design.
//   reduced-motion  — under reduce the fire stops (getAnimations empty). Its rest pose IS identity (rotate0
//                      scale1) — so, unlike hc-small/hc-frame, resting at identity is CORRECT here (no base to lose).
//   secondary-cta   — the CTA is the lime-FILLED Secondary variant (ทักซินเเสเพื่อจอง), not an outline/ghost.
//   full-bleed      — the banner breaks out of the px-4 column to ~viewport width (Figma card is 393-wide).
//   no-overflow-x   — the mascot overflows the CARD but is clipped; the PAGE must not scroll sideways @393/360/320.
//   npx tsx harness/run-zone5-sinse.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
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
  const sec = p.locator('section').filter({ hasText: 'ดูดวงส่วนตัว' }).first()
  await sec.waitFor(); await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(400)
  const r = await fn(sec, p)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── asset-fidelity: mascot + fire paint ──
  const assets = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      const imgs = Array.from(s.querySelectorAll('img')) as HTMLImageElement[]
      const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc.split('/').pop())
      const hasMascot = imgs.some((i) => i.currentSrc.includes('mascot-sian'))
      const hasFire = imgs.some((i) => i.currentSrc.includes('sprite-fire'))
      return { total: imgs.length, broken, hasMascot, hasFire }
    }),
  )
  const assetsOk = assets.broken.length === 0 && assets.hasMascot && assets.hasFire

  // ── fire-only-motion: the fire runs a 2000ms animation; the big mascot is STATIC (no animation) ──
  const motion = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      const fire = s.querySelector('.z5-fire') as HTMLElement | null
      const mascot = s.querySelector('img[src*="mascot-sian"]') as HTMLElement | null
      const fa = fire ? fire.getAnimations()[0] : null
      return {
        fireRuns: !!fa && fa.playState === 'running' && Number((fa.effect as KeyframeEffect).getComputedTiming().duration) === 2000,
        mascotStatic: !!mascot && mascot.getAnimations().length === 0,
      }
    }),
  )
  const motionOk = motion.fireRuns && motion.mascotStatic

  // ── reduced-motion: the fire stops (getAnimations empty). identity rest is correct here (no base to preserve). ──
  const reduced = await withSection(browser, true, (sec) =>
    sec.evaluate((s) => {
      const fire = s.querySelector('.z5-fire') as HTMLElement | null
      return fire ? fire.getAnimations().length : -1
    }),
  )
  const reducedOk = reduced === 0

  // verify-the-instrument (2-way): fire reads NON-empty live AND empty under reduce (not vacuous).
  const instrument2way = motion.fireRuns && reducedOk

  // ── secondary-cta: single lime-FILLED CTA (not an outline). background is lime, text is sapphire. ──
  const cta = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => {
      const btns = Array.from(s.querySelectorAll('button')) as HTMLButtonElement[]
      if (btns.length !== 1) return { count: btns.length, filled: false, label: '' }
      const b = btns[0]; const bg = getComputedStyle(b).backgroundColor.replace(/\s/g, '')
      // lime #E1FF00 = rgb(225,255,0); a filled Secondary has an opaque lime fill (not transparent).
      const filled = bg !== 'rgba(0,0,0,0)' && bg !== 'transparent'
      return { count: btns.length, filled, label: (b.textContent || '').trim() }
    }),
  )
  const ctaOk = cta.count === 1 && cta.filled && cta.label === 'ทักซินเเสเพื่อจอง'

  // ── full-bleed: the banner is ~viewport-wide (breaks out of the px-4 column, Figma card = 393) ──
  const bleed = await withSection(browser, false, (sec, p) =>
    sec.evaluate((s) => s.getBoundingClientRect().width).then((w) => ({ w, vw: 393 })),
  )
  const fullBleedOk = bleed.w >= bleed.vw - 1 // spans the full 393 viewport (content column would be 361)

  // ── mound present: a cream wave svg exists at the section bottom ──
  const mound = await withSection(browser, false, (sec) =>
    sec.evaluate((s) => !!s.querySelector('svg path')),
  )

  // ── no-overflow-x at the three widths (mascot overflows the CARD, must be clipped, not scroll the PAGE) ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) {
    overflow[w] = await withSection(browser, false, (_sec, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth), w)
  }
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-mascot-animates — give the static mascot an animation → fire-only-motion gate must REJECT. ──
  const mascotCaught = await withSection(browser, false, (sec, p) =>
    p.addStyleTag({ content: `@keyframes __mut{to{transform:translateY(1px)}} section img[src*="mascot-sian"]{animation:__mut 1s infinite!important}` }).then(() =>
      sec.evaluate((s) => {
        const mascot = s.querySelector('img[src*="mascot-sian"]') as HTMLElement
        return mascot.getAnimations().length > 0 // mascot now animates → gate would reject → caught
      }),
    ),
  )

  // ── teeth: mut-fire-reduce-runs — re-enable the fire under reduce (dropped guard) → reduced-motion gate rejects. ──
  const fireCaught = await withSection(browser, true, (sec, p) =>
    p.addStyleTag({ content: `section .z5-fire{animation:z5-fire 2s infinite!important}` }).then(() =>
      sec.evaluate((s) => {
        const fire = s.querySelector('.z5-fire') as HTMLElement
        return fire.getAnimations().length > 0 // fire animates under reduce → gate would reject → caught
      }),
    ),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ ZONE-5 SINSE anchor ═══')
  console.log(line(assetsOk, `asset-fidelity: mascot+fire paint (${assets.total} imgs, broken=[${assets.broken.join(', ')}], mascot=${assets.hasMascot} fire=${assets.hasFire})`))
  console.log(line(motionOk, `fire-only-motion: fire runs 2000ms=${motion.fireRuns} · big mascot STATIC=${motion.mascotStatic}`))
  console.log(line(reducedOk, `reduced-motion: fire animation removed (getAnimations=${reduced})`))
  console.log(line(instrument2way, 'verify-instrument (2-way): fire reads running live AND empty under reduce (not vacuous)'))
  console.log(line(ctaOk, `secondary-cta: single lime-FILLED CTA "${cta.label}"  [count=${cta.count}]`))
  console.log(line(fullBleedOk, `full-bleed: banner spans ${Math.round(bleed.w)}px @393 (content column is 361)`))
  console.log(line(mound, `mound: cream wave svg present at section bottom`))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${mascotCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-mascot-animates: static mascot given an animation → fire-only-motion gate rejects`)
  console.log(`  ${fireCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-fire-reduce-runs: fire re-enabled under reduce → reduced-motion gate rejects`)

  const ok = assetsOk && motionOk && reducedOk && instrument2way && ctaOk && fullBleedOk && mound && noOverflowOk && mascotCaught && fireCaught
  console.log(`\n  ${ok ? '🟢 ZONE-5 SINSE PASSED' : '🔴 FAILED'} — asset · fire-only-motion · reduced-motion · secondary-cta · full-bleed · mound · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
