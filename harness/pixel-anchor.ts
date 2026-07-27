// harness/pixel-anchor.ts — VISUAL GROUND-TRUTH lens (webgang v2, D3 self-harden · A1).
//
// Closes a class NO other lens sees: a PERSISTENT same-position divergence — pixels change but layout
// does NOT move, and the change PERSISTS into the settled frame. goo-runtime (console+CLS) is blind (no
// layout-shift, no console signal); too-static (AST) is blind (a real render, not a code shape). The
// only ground-truth is the rendered image: two post-assets-ready screenshots of the real route, diffed.
//
// SCOPE (mapped by the goo+too adversary round — see verify-evidence):
//   ✓ catches: persistent same-position divergence (a wrong state that STAYS until corrected)
//   ✗ ALIASES: a TRANSIENT flicker that resolves between the two frames (goo #1) → A2 = burst sampling
//   ✗ blind:   sub-threshold micro-change (fixed here: absolute-px budget, not %), off-viewport,
//              state-specific (only the captured auth state), and it OVER-BLOCKS legit post-settle motion.
// Honest name: this is a *persistent* same-position anchor. A real transient flash needs temporal sampling.
import { type Browser, type Page } from 'playwright'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { freezeAnimations } from './freeze-animation'

export interface PixelResult {
  label: string
  changedPx: number // ABSOLUTE changed-pixel count — a flash is an absolute thing, not a % of screen (too's adversary insight)
  ratioPct: number // kept for context only
  cls: number // measured alongside — proves a same-position divergence is CLS-silent
  clean: boolean // changedPx within the absolute budget
}

async function assetsReady(p: Page) {
  await p.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 }).catch(() => {})
}

function diffPixels(a: Buffer, b: Buffer, diffPath?: string): { changedPx: number; ratioPct: number } {
  const A = PNG.sync.read(a)
  const B = PNG.sync.read(b)
  const diff = diffPath ? new PNG({ width: A.width, height: A.height }) : undefined
  const changed = pixelmatch(A.data, B.data, diff?.data, A.width, A.height, { threshold: 0.1 })
  if (diff && diffPath) writeFileSync(diffPath, PNG.sync.write(diff))
  return { changedPx: changed, ratioPct: (changed / (A.width * A.height)) * 100 }
}

/**
 * Capture two post-assets-ready VIEWPORT frames of a real route and measure their pixel-diff.
 * `injectFlashCss` (the mutant) is applied AFTER frame A and PERSISTS → a stable app reads ~0, a
 * persistent same-position divergence reads high, CLS stays ~0 (measured, proves it is layout-stable).
 * `injectPreSettleFlashCss` (adversary) is applied BEFORE assets-ready and removed before frame A —
 * used to demonstrate the transient/entrance blind spot.
 */
export async function pixelStability(opts: {
  browser: Browser
  url: string
  label: string
  budgetPx: number // absolute changed-pixel budget (floor; per-route re-ratify)
  viewport: { w: number; h: number }
  evidenceDir: string
  cookie?: { name: string; value: string; domain: string; path: string }
  injectFlashCss?: string
  injectPreSettleFlashCss?: string
}): Promise<PixelResult> {
  const ctx = await opts.browser.newContext({ viewport: { width: opts.viewport.w, height: opts.viewport.h }, deviceScaleFactor: 2 })
  if (opts.cookie) await ctx.addCookies([opts.cookie])
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const s = e as unknown as { hadRecentInput: boolean; value: number }
        if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  if (opts.injectPreSettleFlashCss) {
    await page.addInitScript((css) => {
      const style = document.createElement('style')
      style.id = 'pre-settle-flash'
      style.textContent = css
      document.head.appendChild(style)
    }, opts.injectPreSettleFlashCss)
  }

  await page.goto(opts.url, { waitUntil: 'networkidle' })
  await assetsReady(page)
  if (opts.injectPreSettleFlashCss) await page.evaluate(() => document.getElementById('pre-settle-flash')?.remove())

  // Render in the page's reduced-motion STATIC state BEFORE frame A. Without this a looping animation (มุน's
  // 2s mascot loops) makes A≠B for a reason unrelated to the persistent divergence this lens hunts — a
  // guaranteed false-red. reducedMotion is deterministic regardless of load timing (proven: same page frozen
  // at 3 different loop phases → 0px diff), and it persists, so frame B is the same static image. A genuine
  // persistent divergence (opacity/colour HELD, not motion) still reads high — that is not an animation.
  await freezeAnimations(page)

  // Viewport (not fullPage): fixed size @393 regardless of injection, so the two frames always match
  // for pixelmatch. Below-the-fold is a documented boundary (A2 = per-region / scroll capture).
  mkdirSync(opts.evidenceDir, { recursive: true })
  const frameA = await page.screenshot()
  writeFileSync(`${opts.evidenceDir}/${opts.label}-A.png`, frameA)
  if (opts.injectFlashCss) await page.addStyleTag({ content: opts.injectFlashCss })
  await page.waitForTimeout(500)
  const frameB = await page.screenshot()
  writeFileSync(`${opts.evidenceDir}/${opts.label}-B.png`, frameB)

  const { changedPx, ratioPct } = diffPixels(frameA, frameB, `${opts.evidenceDir}/${opts.label}-diff.png`)
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls || 0)
  await ctx.close()
  return { label: opts.label, changedPx, ratioPct, cls, clean: changedPx <= opts.budgetPx }
}
