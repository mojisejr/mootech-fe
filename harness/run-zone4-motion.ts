// harness/run-zone4-motion.ts — Zone 4/6 shared <HabitCard/> idle-motion anchor (visual lens).
//
// The blue habit-card carries a 3-element idle cohort (Figma get_motion_context, loop 2000ms · one easing):
//   .hc-big    big mascot   scale 1→1.04→1 · y 0→−8→0    (wrapper animates scale+y only; the flip/rotate that
//                                                          orients the mascot lives on an INNER static child)
//   .hc-small  small mascot rotate −151.216° ±5° · y      (base flip/rotate on the class itself)
//   .hc-frame  book-frame   rotate −9.154° oscillate · y  (base rotate on the class itself)
// The bug-class this anchor owns (pixels lie about motion):
//   1. motion silently never attaches  → a reduced-motion guard that "passes" is vacuous (Zone 3 hit this live).
//   2. reduced-motion strips the BASE transform, not just the animation → the sprite un-flips/un-tilts at rest
//      (the exact #128 bug — a real reduced-motion USER sees the wrong orientation). Now guarded on the SHARED card.
//   3. the cohort drifts out of sync (different duration/easing) — proven declaratively, not by grabbing frames.
//   4. the motion thrashes the main thread (someone animates top/margin instead of transform) → jank + CLS.
//
// This anchor asserts the INSTRUMENT both ways: motion truly runs when it should, AND truly stops when reduce is on
// — otherwise "it never ran" passes the guard. It does NOT assert keyframe values match Figma degree-for-degree —
// that is ฟีม's eye (the pixel capture), not the anchor's job (บอง 2026-07-28).
//   npx tsx harness/run-zone4-motion.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
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
const IDENT = 'matrix(1, 0, 0, 1, 0, 0)'

async function withSection<T>(
  browser: Browser,
  reduce: boolean,
  fn: (sec: Locator, p: Page) => Promise<T>,
  width = 393,
): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2, reducedMotion: reduce ? 'reduce' : 'no-preference' })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  // esbuild/tsx keepNames wraps named fns/consts inside evaluate() with __name(); it isn't defined in the page.
  // Shim it to identity so the browser code (incl. the recursive rAF `tick`) runs unmodified. Safe: __name just
  // sets .name and returns the fn — identity is behaviourally equivalent for our probes.
  await p.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  await p.goto(`${HOST}/v2/home-preview?state=good`, { waitUntil: 'networkidle' })
  const sec = p.locator('section').filter({ hasText: 'โหมดเซียน' }).first()
  await sec.waitFor(); await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(400)
  const r = await fn(sec, p)
  await ctx.close()
  return r
}

// the 3 cohort classes on the shared HabitCard.
const COHORT = ['.hc-big', '.hc-small', '.hc-frame']

async function main() {
  const browser = await chromium.launch()

  // ── liveness (no reduce): each cohort element has a running 2000ms CSS animation ──
  const live = await withSection(browser, false, (sec) =>
    sec.evaluate((s, sel) =>
      sel.map((cls) => {
        const el = s.querySelector(cls) as HTMLElement | null
        if (!el) return { cls, len: 0, playState: 'missing', duration: 0, easing: '' }
        const anims = el.getAnimations()
        const t = anims[0] ? (anims[0].effect as KeyframeEffect).getComputedTiming() : null
        return {
          cls,
          len: anims.length,
          playState: anims[0] ? anims[0].playState : 'none',
          duration: t ? Number(t.duration) : 0,
          easing: getComputedStyle(el).animationTimingFunction,
        }
      }), COHORT),
  )
  const liveOk = live.every((e) => e.len >= 1 && e.playState === 'running' && e.duration === 2000)

  // ── cohort-sync: all 3 share duration (2000) AND a single easing — proves sync WITHOUT grabbing frames ──
  const durations = new Set(live.map((e) => e.duration))
  const easings = new Set(live.map((e) => e.easing))
  const syncOk = durations.size === 1 && durations.has(2000) && easings.size === 1

  // ── reduced-motion: the cohort animations are GONE (getAnimations empty) ──
  const reduced = await withSection(browser, true, (sec) =>
    sec.evaluate((s, sel) => sel.map((cls) => {
      const el = s.querySelector(cls) as HTMLElement | null
      return { cls, len: el ? el.getAnimations().length : -1 }
    }), COHORT),
  )
  const reducedEmptyOk = reduced.every((e) => e.len === 0)

  // ── rest-transform (#128 lesson, now on the SHARED card): stopping the animation is not enough — the elements
  //    whose base flip/rotate lives on their own class (.hc-small, .hc-frame) must STILL sit at that base under
  //    reduce (not identity). .hc-big is different BY DESIGN — its wrapper rests at identity and the flip/rotate
  //    lives on an inner static child, so we assert THAT child keeps the orientation instead. ──
  const rest = await withSection(browser, true, (sec) =>
    sec.evaluate((s, ident: string) => {
      const smallEl = s.querySelector('.hc-small')
      const frameEl = s.querySelector('.hc-frame')
      const bigChildEl = s.querySelector('.hc-big > div') // the -scale-y-100 rotate static child
      const small = smallEl ? getComputedStyle(smallEl).transform : 'MISSING'
      const frame = frameEl ? getComputedStyle(frameEl).transform : 'MISSING'
      const bigChild = bigChildEl ? getComputedStyle(bigChildEl).transform : 'MISSING'
      return {
        small, frame, bigChild,
        smallOk: small !== 'none' && small !== ident && small !== 'MISSING' && small.startsWith('matrix('),
        frameOk: frame !== 'none' && frame !== ident && frame !== 'MISSING',
        bigChildOk: bigChild !== 'none' && bigChild !== ident && bigChild !== 'MISSING',
      }
    }, IDENT),
  )
  const restOk = rest.smallOk && rest.frameOk && rest.bigChildOk

  // ── verify-the-instrument, 2-WAY (the check บอง flagged): the getAnimations probe must read a NON-empty set
  //    when motion should run AND an empty set when reduce is on. If it only ever reads empty, "reduce stops it"
  //    is vacuous. Both directions together prove the instrument distinguishes the two states. ──
  const liveNonEmpty = live.every((e) => e.len >= 1)
  const instrument2way = liveNonEmpty && reducedEmptyOk

  // ── jank (no reduce, 4× CPU throttle): a transform-only compositor animation must produce ZERO long tasks on
  //    the main thread; rAF p95 is reported as a diagnostic. If someone animates top/margin (layout, not
  //    transform) this trips (long tasks appear) — tying the jank gate to ตู๋'s transform-only rule. ──
  const jank = await withSection(browser, false, async (sec, p) => {
    const client = await p.context().newCDPSession(p)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await p.waitForTimeout(200)
    return p.evaluate(() => new Promise<{ longCount: number; longTotal: number; p50: number; p95: number; max: number; frames: number }>((res) => {
      const tasks: number[] = []
      const po = new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push(e.duration) })
      try { po.observe({ entryTypes: ['longtask'] }) } catch {}
      const deltas: number[] = []
      let last = performance.now(); const start = last
      const tick = (now: number) => {
        deltas.push(now - last); last = now
        if (now - start < 2000) requestAnimationFrame(tick)
        else {
          po.disconnect()
          const sorted = deltas.slice(1).sort((a, b) => a - b) // drop the first (warm-up) delta
          const q = (x: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))] : 0
          res({ longCount: tasks.length, longTotal: Math.round(tasks.reduce((a, b) => a + b, 0)), p50: Math.round(q(0.5)), p95: Math.round(q(0.95)), max: Math.round(sorted[sorted.length - 1] || 0), frames: sorted.length })
        }
      }
      requestAnimationFrame(tick)
    }))
  })
  const jankOk = jank.longCount === 0 && jank.p95 < 100

  // verify-the-instrument for jank: a deliberate 250ms main-thread busy block MUST be observed as a long task,
  // else the "0 long tasks" reading is vacuous (observer broken/unsupported).
  const jankProbeReads = await withSection(browser, false, (sec, p) =>
    p.evaluate(() => new Promise<boolean>((res) => {
      const tasks: number[] = []
      const po = new PerformanceObserver((list) => { for (const e of list.getEntries()) tasks.push(e.duration) })
      try { po.observe({ entryTypes: ['longtask'] }) } catch { return res(false) }
      setTimeout(() => { const end = performance.now() + 250; while (performance.now() < end) { /* burn */ } }, 50)
      setTimeout(() => { po.disconnect(); res(tasks.length >= 1) }, 600)
    })),
  )

  // ── teeth ──
  // mut-motion-never-attached: kill the animation WITHOUT reduce → getAnimations empty in live mode → the
  // liveness gate must REJECT (this is the vacuous-pass this whole anchor exists to prevent).
  const liveCaught = await withSection(browser, false, (sec, p) =>
    p.addStyleTag({ content: `section .hc-big,section .hc-small,section .hc-frame{animation:none!important}` }).then(() =>
      sec.evaluate((s, sel) => sel.some((cls) => {
        const el = s.querySelector(cls) as HTMLElement | null
        return !el || el.getAnimations().length === 0
      }), COHORT),
    ),
  )

  // mut-reduce-kills-transform: re-introduce the #128 bug on the SHARED card — force transform:none on the
  // base-carrying classes under reduce → they lose their flip/tilt → the rest-transform gate must REJECT.
  const restCaught = await withSection(browser, true, (sec, p) =>
    p.addStyleTag({ content: `@media(prefers-reduced-motion:reduce){section .hc-small,section .hc-frame{transform:none!important}}` }).then(() =>
      sec.evaluate(() => {
        const s = getComputedStyle(document.querySelector('.hc-small')!).transform
        const f = getComputedStyle(document.querySelector('.hc-frame')!).transform
        return s === 'none' || f === 'none' // base lost → caught
      }),
    ),
  )

  // mut-desync: force one element to a different duration WITHOUT reduce → the cohort-sync gate must REJECT
  // (durations set gains a second value).
  const syncCaught = await withSection(browser, false, (sec, p) =>
    p.addStyleTag({ content: `section .hc-frame{animation-duration:1.5s!important}` }).then(() =>
      sec.evaluate((s, sel) => {
        const durs = new Set(sel.map((cls) => {
          const el = s.querySelector(cls) as HTMLElement | null
          const a = el?.getAnimations()[0]
          return a ? Number((a.effect as KeyframeEffect).getComputedTiming().duration) : 0
        }))
        return durs.size > 1 // no longer a single shared duration → caught
      }, COHORT),
    ),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ ZONE-4/6 HABITCARD MOTION anchor ═══')
  console.log(line(liveOk, `liveness: 3/3 cohort els running · duration 2000ms  [${live.map((e) => `${e.cls}:${e.len}/${e.playState}/${e.duration}`).join(' ')}]`))
  console.log(line(syncOk, `cohort-sync: single duration {${Array.from(durations).join(',')}} + single easing (${easings.size} unique) — declarative, no frame-grab`))
  console.log(line(reducedEmptyOk, `reduced-motion: getAnimations empty  [${reduced.map((e) => `${e.cls}:${e.len}`).join(' ')}]`))
  console.log(line(restOk, `rest-transform (#128): hc-small/hc-frame keep base + hc-big child keeps flip  [s:${rest.smallOk ? '✓' : '✗'} f:${rest.frameOk ? '✓' : '✗'} big:${rest.bigChildOk ? '✓' : '✗'}]`))
  console.log(line(instrument2way, 'verify-instrument (2-way): motion reads NON-empty live AND empty under reduce (not vacuous)'))
  console.log(line(jankOk, `jank @4× CPU: longtasks=${jank.longCount} (${jank.longTotal}ms) · rAF p50/p95/max=${jank.p50}/${jank.p95}/${jank.max}ms over ${jank.frames} frames`))
  console.log(line(jankProbeReads, 'verify-instrument (jank): a 250ms busy block IS observed as a long task (probe not vacuous)'))
  console.log('  ── teeth ──')
  console.log(`  ${liveCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-motion-never-attached: animation:none in live mode → liveness gate rejects`)
  console.log(`  ${restCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-reduce-kills-transform: transform:none under reduce (#128) → rest-transform gate rejects`)
  console.log(`  ${syncCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-desync: one element at 1.5s → cohort-sync gate rejects`)

  const ok = liveOk && syncOk && reducedEmptyOk && restOk && instrument2way && jankOk && jankProbeReads && liveCaught && restCaught && syncCaught
  console.log(`\n  ${ok ? '🟢 HABITCARD MOTION PASSED' : '🔴 FAILED'} — liveness · sync · reduced-motion · rest-transform · instrument(2-way) · jank (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
