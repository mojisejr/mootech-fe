// harness/capture.ts — Frame-v2 CAPTURE (Phase B). Playwright is Lamun's EYE PROOF.
//
// Renders a route, waits for the ASSETS-READY gate (fonts + image decode) so computed values are
// measured on the FINAL pixels (closes the timing gap opilot flagged), then returns computed
// measurements + a screenshot + runtime observations (Layer-4). Optional injectCss = mutant/state.
import { chromium, type Browser } from 'playwright'

export interface Probe {
  id: string
  selector: string
}
export interface Match {
  objectFit: string
  paddingTop: string
  paddingBottom: string
  w: number
  h: number
  top: number
  left: number
}
export interface Capture {
  viewport: { w: number; h: number }
  overflowX: boolean
  measurements: Record<string, Match[]>
  runtime: { consoleErrors: string[]; failedRequests: string[]; cls: number }
  screenshot: string
}

export async function capture(opts: {
  url: string
  viewport: { w: number; h: number }
  probes: Probe[]
  screenshotPath: string
  cookie?: { name: string; value: string; domain: string; path: string }
  injectCss?: string
  browser?: Browser
}): Promise<Capture> {
  const own = !opts.browser
  const browser = opts.browser ?? (await chromium.launch())
  const ctx = await browser.newContext({
    viewport: { width: opts.viewport.w, height: opts.viewport.h },
    deviceScaleFactor: 2,
  })
  if (opts.cookie) await ctx.addCookies([opts.cookie])
  const page = await ctx.newPage()

  // Layer-4 observers
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
  })
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 120)}`)
  })
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const s = e as unknown as { hadRecentInput: boolean; value: number }
        if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })

  await page.goto(opts.url, { waitUntil: 'networkidle' })

  // ── ASSETS-READY GATE ──────────────────────────────────────────────────────────────────────
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await page
    .waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 })
    .catch(() => {}) // timeout-guarded: intentional 404 states (missing-mascot) never complete

  if (opts.injectCss) {
    await page.addStyleTag({ content: opts.injectCss })
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(200)

  const measurements = await page.evaluate((probes: Probe[]) => {
    const out: Record<string, Match[]> = {}
    for (const p of probes) {
      const els = Array.from(document.querySelectorAll(p.selector))
      out[p.id] = els.map((el) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return {
          objectFit: cs.objectFit,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          left: Math.round(r.left),
        }
      })
    }
    return out
  }, opts.probes)

  const overflowX = await page.evaluate(
    () => document.scrollingElement!.scrollWidth > window.innerWidth,
  )
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls || 0)
  await page.screenshot({ path: opts.screenshotPath })

  await ctx.close()
  if (own) await browser.close()

  return {
    viewport: opts.viewport,
    overflowX,
    measurements,
    runtime: { consoleErrors, failedRequests, cls },
    screenshot: opts.screenshotPath,
  }
}
