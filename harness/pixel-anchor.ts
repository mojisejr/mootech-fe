// harness/pixel-anchor.ts — VISUAL GROUND-TRUTH lens (webgang v2, D3 self-harden · A1).
//
// The bug-class no other lens sees: a "same-position flash" — pixels change but layout does NOT move.
// goo's runtime crawl reads console + CLS → blind (no layout-shift to catch, no console signal).
// too's AST reads code shape → blind (it's a real render, not a code pattern). The ONLY ground-truth
// is the rendered image itself: screenshot the real route and diff two post-settle frames.
//
// Invariant: after assets-ready, a screen must be VISUALLY STABLE — no pixel change in a settled frame.
// A silent flash (opacity/transform/same-box content swap) breaks it while CLS stays 0 and console clean.
import { type Browser, type Page } from 'playwright'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { mkdirSync, writeFileSync } from 'node:fs'

export interface PixelResult {
  label: string
  ratioPct: number // % of pixels that changed between the two post-settle frames
  cls: number // measured alongside — proves a same-position flash is CLS-silent
  clean: boolean // ratio within budget
}

async function assetsReady(p: Page) {
  await p.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await p.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 }).catch(() => {})
}

function diffRatio(a: Buffer, b: Buffer, diffPath?: string): number {
  const A = PNG.sync.read(a)
  const B = PNG.sync.read(b)
  const diff = diffPath ? new PNG({ width: A.width, height: A.height }) : undefined
  const changed = pixelmatch(A.data, B.data, diff?.data, A.width, A.height, { threshold: 0.1 })
  if (diff && diffPath) writeFileSync(diffPath, PNG.sync.write(diff))
  return (changed / (A.width * A.height)) * 100
}

/**
 * Capture two post-assets-ready frames of a real route and measure their pixel-diff.
 * `injectFlashCss` (the mutant) is applied AFTER frame A — so a stable app reads ~0 and an injected
 * silent flash reads high, while CLS stays ~0 (measured, to prove the flash is layout-stable).
 */
export async function pixelStability(opts: {
  browser: Browser
  url: string
  label: string
  budgetPct: number
  viewport: { w: number; h: number }
  evidenceDir: string
  cookie?: { name: string; value: string; domain: string; path: string }
  injectFlashCss?: string
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
  await page.goto(opts.url, { waitUntil: 'networkidle' })
  await assetsReady(page)

  mkdirSync(opts.evidenceDir, { recursive: true })
  const frameA = await page.screenshot()
  writeFileSync(`${opts.evidenceDir}/${opts.label}-A.png`, frameA)
  if (opts.injectFlashCss) await page.addStyleTag({ content: opts.injectFlashCss })
  await page.waitForTimeout(500)
  const frameB = await page.screenshot()
  writeFileSync(`${opts.evidenceDir}/${opts.label}-B.png`, frameB)

  const ratioPct = diffRatio(frameA, frameB, `${opts.evidenceDir}/${opts.label}-diff.png`)
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls || 0)
  await ctx.close()
  return { label: opts.label, ratioPct, cls, clean: ratioPct <= opts.budgetPct }
}
