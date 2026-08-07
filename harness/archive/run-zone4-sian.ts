// harness/run-zone4-sian.ts — Zone 4 โหมดเซียน (mindful-moments-section · Figma 333:6885) anchor (visual lens).
//
// Zone 4 is STATIC art (no data, no motion this round): a big blue habit-card (gradient + CSS book-frame +
// 2 exported mascots that overflow/clip the card corners + ซื้อเลย button), a 3-card row (3 exported icons),
// and a tertiary CTA. Invariants that AST/console pass but the PIXELS silently regress:
//   asset-fidelity — every exported asset (2 mascots + 3 card icons) must actually PAINT (naturalWidth>0).
//                    A className pointing at a missing file paints nothing — the core "the rendered pixels
//                    lie about what the code claims" bug, and Zone 4 leans entirely on exported assets.
//   readable/z     — the habit-card text + ซื้อเลย button (z-1) must render ABOVE the clipped big mascot;
//                    the small mascot (z-2) sits over the book, never over the CTA.
//   clickable      — both CTAs (ซื้อเลย · ดูบริการทั้งหมด) are hittable and are type=button (ฟีม: not linked
//                    yet, but must not submit a form / throw / navigate).
//   no-overflow-x  — the mascots use %-of-card offsets + overflow-clip; the page must not scroll sideways
//                    at 393/360/320 (fixed-px offsets tuned for 361 would drift and could overflow).
// Runs against the deterministic home-preview (the anchor gate); the human artifact is the capture-route pass.
//   npx tsx harness/run-zone4-sian.ts   (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page, type Locator } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3009'
// the gate cookie must equal the serving FE's V2_PREVIEW_KEY: env → test-env file → local-dev default.
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()

async function withSection<T>(browser: Browser, fn: (sec: Locator, p: Page) => Promise<T>, width = 393): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${HOST}/v2/home-preview?state=good`, { waitUntil: 'networkidle' })
  const sec = p.locator('section').filter({ hasText: 'โหมดเซียน' }).first()
  await sec.waitFor(); await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(400)
  const r = await fn(sec, p)
  await ctx.close()
  return r
}

async function main() {
  const browser = await chromium.launch()

  // ── asset-fidelity: every image in the section actually paints (2 mascots + 3 icons) ──
  const assets = await withSection(browser, (sec) =>
    sec.evaluate((s) => {
      const imgs = Array.from(s.querySelectorAll('img')) as HTMLImageElement[]
      const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc.split('/').pop())
      return { total: imgs.length, broken }
    }),
  )
  const assetsOk = assets.broken.length === 0 && assets.total >= 5 // mascot-sian + mascot-leaf + 3 icons

  // verify-the-instrument: an injected KNOWN-broken <img> must read naturalWidth 0 (else the fidelity probe
  // is blind and a blank card would pass vacuously).
  const assetProbeReadsBroken = await withSection(browser, (sec) =>
    sec.evaluate((s) => new Promise<boolean>((res) => {
      const t = document.createElement('img'); t.src = '/images/v2/zone4/__does-not-exist__.png'
      t.onerror = () => res(t.naturalWidth === 0); t.onload = () => res(false)
      s.appendChild(t); setTimeout(() => res(t.naturalWidth === 0), 1500)
    })),
  )

  // ── readable/z: the ซื้อเลย button (habit-card CTA) is ON TOP of the big mascot (content z > mascot z) ──
  const layering = await withSection(browser, (sec) =>
    sec.evaluate((s) => {
      const buyBtn = Array.from(s.querySelectorAll('button')).find((b) => b.textContent?.includes('ซื้อเลย')) as HTMLElement
      const bigMascot = s.querySelector('img[src*="mascot-sian"]') as HTMLElement
      // the mascot is pointer-events-none and behind; the CTA must be reachable by a hit-test at its centre.
      const r = buyBtn.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const mascotBehind = !!bigMascot && getComputedStyle(bigMascot.closest('div')!.parentElement!).pointerEvents !== 'auto'
      return buyBtn.contains(hit) && mascotBehind
    }),
  )

  // ── clickable: both CTAs are hittable AND type=button (not-linked but must not submit/throw) ──
  const clickable = await withSection(browser, (sec) =>
    sec.evaluate((s) => {
      const btns = Array.from(s.querySelectorAll('button')) as HTMLButtonElement[]
      const buy = btns.find((b) => (b.textContent || '').includes('ซื้อเลย'))
      const all = btns.find((b) => (b.textContent || '').includes('ดูบริการทั้งหมด'))
      if (!buy || !all) return false
      const rb = buy.getBoundingClientRect(); const ra = all.getBoundingClientRect()
      const buyHit = buy.contains(document.elementFromPoint(rb.left + rb.width / 2, rb.top + rb.height / 2))
      const allHit = all.contains(document.elementFromPoint(ra.left + ra.width / 2, ra.top + ra.height / 2))
      return buy.type === 'button' && all.type === 'button' && buyHit && allHit
    }),
  )

  // ── no-overflow-x at the three burned widths ──
  const overflow: Record<number, boolean> = {}
  for (const w of [393, 360, 320]) {
    overflow[w] = await withSection(browser, (_sec, p) => p.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth), w)
  }
  const noOverflowOk = Object.values(overflow).every((o) => !o)

  // ── teeth: mut-asset-missing — repoint a card icon to a 404 path → it stops painting (naturalWidth 0) →
  //    the asset-fidelity gate must REJECT (a silently-missing asset is the exact bug this lens owns). ──
  const assetCaught = await withSection(browser, (sec) =>
    sec.evaluate((s) => new Promise<boolean>((res) => {
      const icon = s.querySelector('img[src*="/zone4/icon-"]') as HTMLImageElement
      if (!icon) return res(false)
      icon.src = '/images/v2/zone4/__mutant-404__.svg'
      // inline (no named fn — esbuild keepNames injects __name into browser scope otherwise)
      icon.onerror = () => res((Array.from(s.querySelectorAll('img')) as HTMLImageElement[]).some((i) => !i.complete || i.naturalWidth === 0))
      setTimeout(() => res((Array.from(s.querySelectorAll('img')) as HTMLImageElement[]).some((i) => !i.complete || i.naturalWidth === 0)), 1200)
    })),
  )

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  console.log('\n═══ ZONE-4 SIAN anchor ═══')
  console.log(line(assetsOk, `asset-fidelity: ${assets.total} imgs paint (2 mascots + 3 icons), broken=[${assets.broken.join(', ')}]`))
  console.log(line(assetProbeReadsBroken, 'verify-instrument: naturalWidth probe reads a known-broken img as 0'))
  console.log(line(layering, 'readable/z: ซื้อเลย CTA hit-tested ON TOP, big mascot behind (pointer-events-none)'))
  console.log(line(clickable, 'clickable: both CTAs type=button + hittable (not-linked, no submit/throw)'))
  console.log(line(noOverflowOk, `no-overflow-x @ 393/360/320  [${Object.entries(overflow).map(([w, o]) => `${w}:${o ? 'OVERFLOW' : 'ok'}`).join(' ')}]`))
  console.log('  ── teeth ──')
  console.log(`  ${assetCaught ? '🦷 CAUGHT' : '✗ BLIND'}  mut-asset-missing: a card icon 404s → asset-fidelity gate rejects`)

  const ok = assetsOk && assetProbeReadsBroken && layering && clickable && noOverflowOk && assetCaught
  console.log(`\n  ${ok ? '🟢 ZONE-4 SIAN PASSED' : '🔴 FAILED'} — asset-fidelity · readable · clickable · no-overflow-x (+ teeth)\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
