// harness/adapters/measureHtml.ts — PROJECT side of the CP-2 HTML adapter (playwright lives here).
// Renders an HTML reference file at its authored viewport, measures each [data-role] block, and hands
// the geometry to the generic engine's htmlAdapter → RefModel (fidelity: 'measured'). The engine stays
// playwright-free; this is the analogue of capture.ts but for the REFERENCE instead of the app.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { htmlAdapter } from '../engine'
import type { RefElement, RefModel } from '../engine/types'

export async function measureHtmlRef(opts: {
  screen: string
  htmlPath: string // path to the HTML ref, relative to cwd
  authoredAt: { w: number; h: number }
  roleMap: Record<string, Omit<RefElement, 'x' | 'y' | 'w' | 'h'>>
  browser?: Browser
}): Promise<RefModel> {
  const own = !opts.browser
  const browser = opts.browser ?? (await chromium.launch())
  const ctx = await browser.newContext({ viewport: { width: opts.authoredAt.w, height: opts.authoredAt.h }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const url = pathToFileURL(resolve(opts.htmlPath)).href
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})

  const measured = await page.evaluate(() => {
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (const el of Array.from(document.querySelectorAll('[data-role]'))) {
      const role = (el as HTMLElement).dataset.role!
      const r = el.getBoundingClientRect()
      out[role] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
    }
    return out
  })

  await ctx.close()
  if (own) await browser.close()

  return htmlAdapter({ screen: opts.screen, ref: opts.htmlPath, authoredAt: opts.authoredAt, measured, roleMap: opts.roleMap })
}
