// harness/run-mateai-button.ts — anchor for the Mate AI button in the bottom menu (Figma 461:3303 → 461:3020).
// LENS = visual. Ground-truth = the RENDERED PIXELS around the tile, not a computed style that claims to clip.
//
// The bug this owns (ฟีม 2026-08-03): "คำว่า Mate AI ทำให้ BG ทะลุกรอบออกมา" — content escaping the tile.
// A computed `overflow: hidden` is only a PROXY for that; the floor is "does anything paint outside the box".
// So CONTAINMENT is measured by reading the strips of screen directly above and below the tile and asserting
// they are still the page background — and it is sampled at FOUR phases of the 2s float, because a 1-frame
// check cannot see a bug that only exists at the top of the arc.
//
// Invariants owned here:
//   CONTAINMENT — the 8px strips above/below the tile stay page-background at t = 0 / 0.5 / 1.0 / 1.5s.
//   LABEL-INSIDE — the label's box is inside the tile's box (it is not clipped, so its geometry must fit).
//   PEEK-PRESERVED — the mascot still overhangs the tile bottom at every phase (ฟีม wants it half-cut, and
//                    "fixing" the overflow by making it fit entirely would be the opposite error).
//   TOKENS — border rgba(216,143,169,.4) and the label gradient #1455A4 → #E913C5 (both were wrong on main).
//   MOTION — animates normally; STOPS under prefers-reduced-motion. Each half is the other's negative-control.
//
// TEETH:
//   • mut-mateai-overflow          — restore main's shape (overflow-visible + a lime slab above the tile) →
//                                    lime paints in the strip above → CONTAINMENT trips.
//   • mut-gradient-drift           — repaint the label with main's #294DA7 → #D036A9 → TOKENS trips.
//   • mut-motion-runs-under-reduce — force the float on under reduce → MOTION trips.
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-mateai-button.ts
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const PHASES = [0, 500, 1000, 1500] // ms into the 2s float — 0/¼/½/¾ of the cycle
const STRIP = 8 // px of screen to inspect above and below the tile

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

type Box = { x: number; y: number; width: number; height: number }

// the v2 gate (middleware + SSR re-check) redirects without these — a 307 renders no menu at all
function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

async function seed(ctx: BrowserContext) {
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: '5c7befb3-ebd3-4740-989e-fd6a1cca9662', domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
}

async function open(browser: Browser, reduce: boolean) {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 1,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
  })
  await seed(ctx)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/menu-preview?menu=default`, { waitUntil: 'commit' })
  await page.locator('[data-testid="nav-mate-ai"]').waitFor({ timeout: 15000 })
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), { timeout: 8000 })
  return { ctx, page }
}

const tileBox = async (p: Page): Promise<Box> => {
  const b = await p.locator('[data-testid="nav-mate-ai"]').boundingBox()
  if (!b) throw new Error('no tile box')
  return b
}

// the page background, read far from the nav — the value every strip pixel must still equal
async function pageBg(p: Page): Promise<[number, number, number]> {
  const buf = await p.screenshot({ clip: { x: 180, y: 300, width: 2, height: 2 } })
  const png = PNG.sync.read(buf)
  return [png.data[0], png.data[1], png.data[2]]
}

/** returns the number of pixels in the strip that are NOT the page background (tolerance ±6/255) */
async function strayPixels(p: Page, clip: Box, bg: [number, number, number]): Promise<number> {
  const buf = await p.screenshot({ clip })
  const png = PNG.sync.read(buf)
  let stray = 0
  for (let i = 0; i < png.data.length; i += 4) {
    const d = Math.max(Math.abs(png.data[i] - bg[0]), Math.abs(png.data[i + 1] - bg[1]), Math.abs(png.data[i + 2] - bg[2]))
    if (d > 6) stray++
  }
  return stray
}

const clamp = (b: Box, vw: number, vh: number): Box => ({
  x: Math.max(0, Math.round(b.x)),
  y: Math.max(0, Math.round(b.y)),
  width: Math.max(1, Math.min(Math.round(b.width), vw - Math.max(0, Math.round(b.x)))),
  height: Math.max(1, Math.min(Math.round(b.height), vh - Math.max(0, Math.round(b.y)))),
})

// A RING of screen around the tile — all four sides, not just top/bottom.
// (Instrument note: the first cut of this anchor checked above/below only, and its own tooth walked straight
// past it — main's real escape was SIDEWAYS: the label was `px-4` on a 74px tile, so the lime slab bled left
// and right while its top edge stayed level with the border. A probe that samples fewer sides than the bug
// has is vacuous on those sides; the ring closes that.)
async function strips(p: Page, tile: Box): Promise<Record<'above' | 'below' | 'left' | 'right', Box>> {
  const { width: vw, height: vh } = p.viewportSize()!
  return {
    above: clamp({ x: tile.x - 3, y: tile.y - STRIP - 1, width: tile.width + 6, height: STRIP }, vw, vh),
    below: clamp({ x: tile.x - 3, y: tile.y + tile.height + 1, width: tile.width + 6, height: STRIP }, vw, vh),
    left: clamp({ x: tile.x - STRIP - 1, y: tile.y, width: STRIP, height: tile.height }, vw, vh),
    right: clamp({ x: tile.x + tile.width + 1, y: tile.y, width: STRIP, height: tile.height }, vw, vh),
  }
}

const animCount = (p: Page) =>
  p.evaluate(() => Array.from(document.querySelectorAll('[data-testid="nav-mate-ai-mascot"] .v3-float')).reduce((n, el) => n + el.getAnimations().length, 0))

;(async () => {
  const browser = await chromium.launch()
  try {
    // ---- 1) CONTAINMENT across the float — the invariant ฟีม's bug lives in --------------------------------
    {
      const { ctx, page } = await open(browser, false)
      const tile = await tileBox(page)
      const bg = await pageBg(page)
      const ring = await strips(page, tile)
      for (const t of PHASES) {
        await page.waitForTimeout(t === 0 ? 0 : 500)
        for (const side of ['above', 'below', 'left', 'right'] as const) {
          const n = await strayPixels(page, ring[side], bg)
          check(`CONTAINMENT @${t}ms — nothing paints ${side} the tile`, n === 0, `${n} stray px`)
        }
      }

      // LABEL-INSIDE — the label is not clipped, so its geometry must fit the tile
      const label = await page.locator('[data-testid="nav-mate-ai-label"]').boundingBox()
      check(
        'LABEL-INSIDE — label box ⊂ tile box',
        !!label && label.x >= tile.x - 0.5 && label.y >= tile.y - 0.5 &&
          label.x + label.width <= tile.x + tile.width + 0.5 && label.y + label.height <= tile.y + tile.height + 0.5,
        label ? `label ${Math.round(label.x)},${Math.round(label.y)} ${Math.round(label.width)}×${Math.round(label.height)} · tile ${Math.round(tile.x)},${Math.round(tile.y)} ${Math.round(tile.width)}×${Math.round(tile.height)}` : 'no label',
      )

      // PEEK-PRESERVED — the mascot must still hang past the tile bottom at every phase (ฟีม: เห็นแค่ส่วนนึง)
      for (const t of PHASES) {
        await page.waitForTimeout(t === 0 ? 0 : 500)
        const m = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="nav-mate-ai-mascot"] .v3-float') as HTMLElement | null
          const tileEl = document.querySelector('[data-testid="nav-mate-ai"]') as HTMLElement | null
          if (!el || !tileEl) return null
          const a = el.getBoundingClientRect(), b = tileEl.getBoundingClientRect()
          return Math.round((a.bottom - b.bottom) * 10) / 10
        })
        check(`PEEK-PRESERVED @${t}ms — mascot still overhangs the tile bottom`, m !== null && m > 6, `overhang ${m}px`)
      }

      // TOKENS — the two values that were wrong on main
      const tok = await page.evaluate(() => {
        const tile = document.querySelector('[data-testid="nav-mate-ai"]') as HTMLElement
        const grad = document.querySelector('[data-testid="nav-mate-ai-label"] span') as HTMLElement
        return { border: getComputedStyle(tile).borderTopColor, width: getComputedStyle(tile).borderTopWidth, bgImage: getComputedStyle(grad).backgroundImage }
      })
      check('TOKENS — border is rgba(216,143,169,.4) @5px (Figma)', /216,\s*143,\s*169/.test(tok.border) && /0\.4/.test(tok.border) && tok.width === '5px', `${tok.border} ${tok.width}`)
      // …and the border must still LOOK pink. The declared colour is 40% pink, so if the lime background paints
      // under it (CSS default, background-clip: border-box) it composites to OLIVE — the computed value passes
      // while the pixels are wrong. Ground-truth: sample the border ring itself and require r > g (pink), which
      // olive fails. This is the proxy-ladder rule: a computed colour is not the colour on screen.
      {
        const px = await page.screenshot({ clip: { x: Math.round(tile.x + tile.width / 2), y: Math.round(tile.y) + 2, width: 1, height: 1 } })
        const png = PNG.sync.read(px)
        const [r, g, b] = [png.data[0], png.data[1], png.data[2]]
        check('TOKENS — the border RENDERS pink, not olive (bg-clip-padding)', r > g, `border px rgb(${r},${g},${b})`)
      }
      check('TOKENS — label gradient is #1455A4 → #E913C5 (v3-sapphire → v3-mate-magenta)',
        /rgb\(20,\s*85,\s*164\)/.test(tok.bgImage) && /rgb\(233,\s*19,\s*197\)/.test(tok.bgImage), tok.bgImage.slice(0, 90))

      // MOTION on — the negative-control that makes the reduce=0 check below meaningful
      const running = await animCount(page)
      check('MOTION on: the mascot animates (getAnimations ≥ 1)', running >= 1, `${running} animations`)
      await ctx.close()
    }

    // ---- 2) REDUCED motion: the float STOPS ---------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, true)
      const reduced = await animCount(page)
      check('reduced-motion: float STOPS (getAnimations === 0)', reduced === 0, `${reduced} animations`)
      const tile = await tileBox(page)
      const bg = await pageBg(page)
      const ring = await strips(page, tile)
      let stray = 0
      for (const side of ['above', 'below', 'left', 'right'] as const) stray += await strayPixels(page, ring[side], bg)
      check('reduced-motion: still contained (static state has no bleed either)', stray === 0, `${stray} stray px`)
      await ctx.close()
    }

    // ---- 3) TOOTH mut-mateai-overflow — main's shape back: overflow-visible + a lime slab above the tile ---
    {
      const { ctx, page } = await open(browser, false)
      const tile = await tileBox(page)
      const bg = await pageBg(page)
      const ring = await strips(page, tile)
      // main's EXACT shape: overflow-visible + the label carrying its own lime slab at px-4 (=87px wide on a
      // 74px tile) sitting at -top-1. That is the build ฟีม was looking at when he said "BG ทะลุกรอบ".
      await page.addStyleTag({
        content: `[data-testid="nav-mate-ai"]{overflow:visible !important}
                  [data-testid="nav-mate-ai-label"]{top:-4px !important;background:#E1FF00 !important;padding:0 16px !important;border-radius:18px 18px 0 0 !important}`,
      })
      await page.waitForTimeout(200)
      let stray = 0
      const hits: string[] = []
      for (const side of ['above', 'below', 'left', 'right'] as const) {
        const n = await strayPixels(page, ring[side], bg)
        stray += n
        if (n > 0) hits.push(`${side}:${n}`)
      }
      check('🦷 mut-mateai-overflow → main\'s lime slab escapes the tile → CONTAINMENT CAUGHT', stray > 0, hits.join(' ') || '0 stray px')
      await ctx.close()
    }

    // ---- 4) TOOTH mut-gradient-drift — repaint with main's wrong hexes -----------------------------------
    {
      const { ctx, page } = await open(browser, false)
      await page.addStyleTag({ content: `[data-testid="nav-mate-ai-label"] span{background-image:linear-gradient(to right,#294DA7,#D036A9) !important}` })
      await page.waitForTimeout(150)
      const bgImage = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="nav-mate-ai-label"] span') as HTMLElement).backgroundImage)
      const stillRight = /rgb\(20,\s*85,\s*164\)/.test(bgImage) && /rgb\(233,\s*19,\s*197\)/.test(bgImage)
      check('🦷 mut-gradient-drift → wrong gradient → TOKENS CAUGHT', !stillRight, bgImage.slice(0, 90))
      await ctx.close()
    }

    // ---- 5) TOOTH mut-motion-runs-under-reduce -----------------------------------------------------------
    {
      const { ctx, page } = await open(browser, true)
      await page.addStyleTag({ content: '.v3-float { animation: compat-sprite-float 2s linear infinite !important; }' })
      await page.waitForTimeout(200)
      const stillRunning = await animCount(page)
      check('🦷 mut-motion-runs-under-reduce → float runs under reduce → MOTION CAUGHT', stillRunning >= 1, `${stillRunning} animations`)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
