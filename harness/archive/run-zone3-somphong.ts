// harness/run-zone3-somphong.ts — Zone 3 ดวงสมพงค์ (mindful-moments-section) anchor (visual lens).
//
// Zone 3 is FIXED art (Figma 421:826): 2 cards, 10 mascots/hearts animating in a 2s loop, a full-bleed
// bubble bg, exported radial SVGs. Invariants that AST/console pass but the PIXELS silently regress:
//   motion-guard    — 10 elements animate at once (heavier than Zone 2). Under prefers-reduced-motion the
//                     animation MUST stop (animation-name:none, at-rest opacity). A dropped @media guard
//                     is invisible to tsc/console — only the computed style catches it.
//   occlusion       — the card <h3> titles (z-10) must render ABOVE the mascot cluster (z-5): a big/fat
//                     mascot must never cover the title (same class the Zone-2 winged rooster proved).
//   asset-fidelity  — every asset (bg + 2 radial groups + heart + 9 mascots) must actually PAINT
//                     (naturalWidth>0). A className pointing at a missing file paints nothing — the core
//                     "rendered pixels lie about what the code claims" bug for this zone.
//   no-overflow-x   — the wide mascot clusters (-mx overlap) + full-bleed bg are contained; the page must
//                     not scroll sideways at 393/360/320.
// Runs against the deterministic home-preview (the anchor gate); the human artifact is the capture-route pass.
//   npx tsx harness/run-zone3-somphong.ts   (dev server up; HARNESS_HOST/PORT + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page, type Locator } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3007'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const HERO = '01.png' // Zone3Mascot 404 fallback (HERO_FALLBACK = /images/v2/mascot/01.png)

async function withSection<T>(browser: Browser, reduce: boolean, fn: (sec: Locator, p: Page) => Promise<T>, width = 393): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: reduce ? 'reduce' : 'no-preference' })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${HOST}/v2/home-preview?state=good`, { waitUntil: 'networkidle' })
  const sec = p.locator('section').filter({ hasText: 'ดวงสมพงค์' }).first()
  await sec.waitFor(); await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(400)
  const r = await fn(sec, p)
  await ctx.close()
  return r
}

// the 4 animated CSS classes → the 10 elements Figma animates (2 rats + heart + 7 pop).
const ANIM_SEL = '.z3-heart,.z3-rock-l,.z3-rock-r,.z3-pop'

async function main() {
  const browser = await chromium.launch()

  // ── motion-guard: under reduce, ALL 10 animated els have animation-name:none AND are at rest (opacity 1) ──
  const motion = await withSection(browser, true, (sec) =>
    sec.evaluate((s, sel) => {
      const els = Array.from(s.querySelectorAll(sel)) as HTMLElement[]
      const stopped = els.every((e) => {
        const cs = getComputedStyle(e)
        return cs.animationName === 'none' && cs.opacity === '1'
      })
      return { count: els.length, stopped }
    }, ANIM_SEL),
  )
  const motionStoppedOk = motion.count === 10 && motion.stopped

  // verify-the-instrument: WITHOUT reduce the animation IS running (animation-name != none) — so the
  // "stopped" check above isn't vacuously passing because the animation was never applied at all.
  // (I hit this live once: a probe that read the at-rest value for everything until a control proved it moved.)
  const probeCanRead = await withSection(browser, false, (sec) =>
    sec.evaluate((s, sel) => {
      const els = Array.from(s.querySelectorAll(sel)) as HTMLElement[]
      return els.some((e) => getComputedStyle(e).animationName !== 'none')
    }, ANIM_SEL),
  )

  // ── rest-transform: stopping the animation is NOT enough — under reduce each element must still SIT at its
  //    base transform. z3-rock-l = rotate(7deg) · z3-rock-r = scaleX(-1) rotate(8.55deg). If the base lives ONLY
  //    in the keyframe (not the class) and the guard forces transform:none, the คู่รัก rats un-tilt + the left one
  //    un-flips (faces the wrong way) under reduced-motion — a bug real reduced-motion USERS see, not just the
  //    harness (goo/บอง 2026-07-28). This check is the widened scope the motion-guard alone missed. ──
  const IDENT = 'matrix(1, 0, 0, 1, 0, 0)'
  const restTransform = await withSection(browser, true, (sec) =>
    sec.evaluate((_el, ident) => {
      const l = getComputedStyle(document.querySelector('.z3-rock-l')!).transform
      const r = getComputedStyle(document.querySelector('.z3-rock-r')!).transform
      return { lOk: l !== 'none' && l !== ident, rOk: r !== 'none' && r !== ident && r.startsWith('matrix(-') }
    }, IDENT),
  )
  const restTransformOk = restTransform.lOk && restTransform.rOk

  // ── teeth: mut-motion-runs — re-enable animation under reduce (simulate a dropped @media guard) →
  //    the animated els are no longer at animation-name:none → the motion-guard gate must REJECT. ──
  const motionCaught = await withSection(browser, true, (sec, p) =>
    // higher specificity (section .cls = 0,1,1) than the component guard (.cls = 0,1,0) so it wins the
    // cascade regardless of document order → faithfully simulates "the @media reduce guard was dropped".
    p.addStyleTag({ content: `section .z3-heart,section .z3-rock-l,section .z3-rock-r,section .z3-pop{animation:z3-heart 2s infinite!important}` }).then(() =>
      sec.evaluate((s, sel) => {
        const els = Array.from(s.querySelectorAll(sel)) as HTMLElement[]
        const stillStopped = els.every((e) => getComputedStyle(e).animationName === 'none')
        return !stillStopped // guard would now pass an animating page → caught
      }, ANIM_SEL),
    ),
  )

  // ── teeth: mut-rock-rest-none — re-add the shipped bug (transform:none on the rocks under reduce) → they
  //    lose their base rotate/flip → the rest-transform gate must REJECT. ──
  const restCaught = await withSection(browser, true, (sec, p) =>
    p.addStyleTag({ content: `@media(prefers-reduced-motion:reduce){section .z3-rock-l,section .z3-rock-r{transform:none!important}}` }).then(() =>
      sec.evaluate(() => {
        const l = getComputedStyle(document.querySelector('.z3-rock-l')!).transform
        const r = getComputedStyle(document.querySelector('.z3-rock-r')!).transform
        return l === 'none' || r === 'none' // base lost → caught
      }),
    ),
  )

  // ── occlusion: both card <h3> titles (z-10) sit ABOVE their mascot cluster wrapper (z-5) ──
  const occlusion = await withSection(browser, true, (sec) =>
    sec.evaluate((s) => {
      const cards = Array.from(s.querySelectorAll('.rounded-2xl')) as HTMLElement[]
      return cards.map((card) => {
        const h3 = card.querySelector('h3') as HTMLElement
        const wrap = card.querySelector('.z3-pop, .z3-rock-l')?.parentElement as HTMLElement // the z-5 cluster div
        const tz = parseInt(getComputedStyle(h3).zIndex) || 0
        const mz = parseInt(getComputedStyle(wrap).zIndex) || 0
        return tz > mz
      })
    }),
  )
  const occlusionOk = occlusion.length === 2 && occlusion.every(Boolean)

  // teeth: mut-title-behind — drop a title BELOW its mascot cluster → not-on-top → gate rejects.
  const occlusionCaught = await withSection(browser, true, (sec) =>
    sec.evaluate((s) => {
      const card = s.querySelector('.rounded-2xl') as HTMLElement
      const h3 = card.querySelector('h3') as HTMLElement
      const wrap = card.querySelector('.z3-pop, .z3-rock-l')!.parentElement as HTMLElement
      h3.style.zIndex = '0'; wrap.style.zIndex = '5'
      const tz = parseInt(getComputedStyle(h3).zIndex) || 0
      const mz = parseInt(getComputedStyle(wrap).zIndex) || 0
      return !(tz > mz) // no longer on top → caught
    }),
  )

  // ── asset-fidelity: every image in the section actually paints (naturalWidth>0) — bg + radials + heart + mascots ──
  const assets = await withSection(browser, true, (sec) =>
    sec.evaluate((s) => {
      const imgs = Array.from(s.querySelectorAll('img')) as HTMLImageElement[]
      const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc.split('/').pop())
      return { total: imgs.length, broken }
    }),
  )
  const assetsOk = assets.broken.length === 0 && assets.total >= 11 // bg+2 radials+heart+2 rats+7 colleagues (>= because radial dup on pink)

  // verify-the-instrument for asset-fidelity: inject a KNOWN-broken img into the section; the naturalWidth
  // probe must read 0 for it (a probe that can't see a broken asset would pass a blank card vacuously).
  const assetProbeReadsBroken = await withSection(browser, true, (sec) =>
    sec.evaluate((s) => new Promise<boolean>((res) => {
      const t = document.createElement('img'); t.src = '/images/v2/__does-not-exist__.png'
      t.onerror = () => res(t.naturalWidth === 0); t.onload = () => res(false)
      s.appendChild(t); setTimeout(() => res(t.naturalWidth === 0), 1500)
    })),
  )

  // ── graceful: a mascot whose file 404s falls back to the hero (01.png), never a broken-image gap ──
  //    (drive the real Zone3Mascot onError by breaking one img's src → React swaps it to HERO_FALLBACK.)
  const graceful = await withSection(browser, true, (sec, p) =>
    sec.evaluate((s, hero) => new Promise<boolean>((res) => {
      const img = s.querySelector('.z3-pop') as HTMLImageElement
      const before = img.currentSrc
      img.src = '/images/v2/characters/__nope__.png' // fire the error → onError → setState → hero
      let tries = 0
      const iv = setInterval(() => {
        const now = (s.querySelector('.z3-pop') as HTMLImageElement).currentSrc
        if (now.endsWith(hero) && now !== before) { clearInterval(iv); res(true) }
        if (++tries > 30) { clearInterval(iv); res(false) }
      }, 100)
    }), HERO),
  ).catch(() => false)

  // ── no-overflow-x at the three burned widths ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) {
    overflow[w] = await withSection(browser, true, (_sec, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth), w)
  }
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ ZONE-3 SOMPHONG anchor ═══')
  console.log(line(motionStoppedOk, `reduced-motion: all ${motion.count}/10 animated els → animation:none + opacity 1`))
  console.log(line(probeCanRead, 'verify-instrument: WITHOUT reduce the animation IS running (probe reads motion, not vacuous)'))
  console.log(line(restTransformOk, `rest-transform: under reduce z3-rock-l/r keep their base rotate/flip (not none/identity)  [l:${restTransform.lOk ? '✓' : '✗'} r:${restTransform.rOk ? '✓' : '✗'}]`))
  console.log(line(occlusionOk, `occlusion: both card titles z > mascot cluster z  [${occlusion.map((b) => (b ? '✓' : '✗')).join(' ')}]`))
  console.log(line(assetsOk, `asset-fidelity: ${assets.total} imgs paint, broken=[${assets.broken.join(', ')}]`))
  console.log(line(assetProbeReadsBroken, 'verify-instrument: naturalWidth probe reads a known-broken img as 0'))
  console.log(line(graceful, `graceful: mascot 404 → hero fallback (${HERO})`))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${motionCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-motion-runs: re-enable animation under reduce → motion-guard rejects`)
  console.log(`  ${occlusionCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-title-behind: title z below mascot → occlusion gate rejects`)
  console.log(`  ${restCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-rock-rest-none: transform:none guard → rats un-tilt/un-flip → rest-transform gate rejects`)

  const ok = motionStoppedOk && probeCanRead && restTransformOk && occlusionOk && assetsOk && assetProbeReadsBroken && graceful && noOverflowOk && motionCaught && occlusionCaught && restCaught
  console.log(`\n  ${ok ? '🟢 ZONE-3 SOMPHONG PASSED' : '🔴 FAILED'} — motion-guard · occlusion · asset-fidelity · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
