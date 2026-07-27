// harness/freeze-animation.ts — deterministic animation freeze for pixel-compared captures.
//
// WHY: มุน's Zone 4/5/6 mascots are 2s `infinite` CSS loops. A lens that diffs two frames (pixel-anchor)
// reads a huge diff for a reason unrelated to the bug it hunts ("แดงปลอม 100%", ตู๋). We must render the
// page in ONE deterministic state so N captures — even under DIFFERENT load timing — are byte-identical.
//
// WHY NOT `animation-play-state: paused` (บอง's first instruction, and my first cut): "paused" freezes at
// the CURRENT frame, which depends on WHEN we inject. A slow vs fast load pauses at a different phase of the
// 2s loop → pixels differ across runs = a RARER, timing-dependent flaky, not a fix. Rejected.
// WHY NOT `animation: none` / WAAPI currentTime=0 as the PRIMARY: both snap an element to its base / 0%
// frame — but an ENTRANCE animation starts hidden (e.g. `z3-pop 0%{opacity:0}`), so that would render it
// INVISIBLE, capturing a state the user never sees. Rejected as the primary.
//
// APPROACH — `reducedMotion: 'reduce'` (Playwright-native), belt-and-braces:
//   1. PRIMARY — flip prefers-reduced-motion so the page's OWN `@media (prefers-reduced-motion: reduce)`
//      guards fire. มุน authors those for every motion (`animation:none; opacity:1; transform:none`), so
//      elements land at her INTENDED static state — entrances stay VISIBLE, loops sit at rest. Deterministic
//      (no animation → no phase → timing-independent), faithful (μุน's designed static, not frame 0), and it
//      exercises the reduced-motion guard for free. (มุน already proved this path pixel-identical on Zone 3.)
//   2. BELT — kill transitions, and pin any animation WITHOUT a reduced-motion guard to a deterministic first
//      frame so it still can't vary by capture timing. If (1) stilled everything, getAnimations() is empty
//      and this is a no-op — which is the healthy case (every motion should carry a reduced-motion guard).
//
// NOT covered: a hand-rolled requestAnimationFrame loop writing style directly (nothing exposes it, and it
// carries no reduced-motion guard). มุน's plan is CSS keyframes; the proof (diff==0 on the REAL page, plus
// getAnimations()===0 under reduce) confirms nothing escaped — and a future rAF animation would surface as a
// non-zero diff, i.e. it fails loud, not silent.
import { type Page } from 'playwright'

// ANCHOR: freeze-animation
export async function freezeAnimations(page: Page): Promise<void> {
  // 1) PRIMARY — the page's reduced-motion guards render the intended static state.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // 2) BELT — no transition tween mid-shot; pin any un-guarded animation to a deterministic first frame.
  await page.addStyleTag({
    content: '*,*::before,*::after{transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}',
  })
  await page.evaluate(() => {
    for (const a of (document as unknown as { getAnimations?: () => Animation[] }).getAnimations?.() ?? []) {
      try {
        a.currentTime = 0
        a.pause()
      } catch {
        /* a finished/detached animation can throw on currentTime — ignore, it is not advancing anyway */
      }
    }
  })
}

/** Count animations still live after a freeze — used by the proof to verify the page carries reduced-motion
 *  guards (getAnimations() should be 0 under reduce). A non-zero count names an un-guarded motion to fix. */
export async function liveAnimationCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (document as unknown as { getAnimations?: () => unknown[] }).getAnimations?.().length ?? 0,
  )
}
