// harness/verify-home-skeleton.ts — DoD 5 machine leg for P1, on the REAL /v2 route.
//
// DESIGN.md §9.2 makes responsive the DEFAULT and fixes the set at 320/360/393/430/768/1280, and
// /design-verify rejects a preview route as the gate of record. So this drives the real thing.
//
// Reaching the state is the hard part: the grey blocks exist only WHILE the two home requests are in
// flight, and on a FE-only stack /api/user 500s in ~200ms (the hook's state table then settles to
// home+fallback — correctly). Rather than mock a response shape (a mock that drifts from the real row is
// how a gate starts certifying the mock), this DELAYS the real requests: same URL, same response, same
// code path, just slow — which is the actual condition a user on a bad connection meets. The skeleton is
// then a steady state we can measure instead of a frame we have to catch.
//
//   npx tsx harness/verify-home-skeleton.ts
//   npx tsx harness/verify-home-skeleton.ts --widths 393 --hold 4000
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3010'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const USER_NAME = 'มิลา'
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

type Row = {
  w: number
  hScroll: boolean
  contentWithinMax: boolean
  bgFills: boolean
  menubar: boolean
  hydrationErrors: number
  consoleErrors: number
  skeletonsVisible: number
  mascotFallbackVisible: boolean // 🔴 DoD 3: the 01.webp stand-in must NOT be on screen while loading
  falseEmptyClaim: boolean // 🔴 a sentence asserting "no data" while the request is still in flight
  minTapTarget: number
}

async function main() {
  const widths = arg('widths', '320,360,393,430,768,1280').split(',').map(Number)
  const hold = Number(arg('hold', '6000'))
  const outDir = path.resolve(process.cwd(), arg('out', 'harness/out/_frames/p1-verify'))
  fs.mkdirSync(outDir, { recursive: true })

  // env first (CI), file second (local) — same reason as first-frame-v2.readPasskey. The parentheses
  // matter: without them the file-parsing chain binds to the whole `||` expression and runs against the
  // ENV STRING, which has no "V2_PREVIEW_KEY=" line, so the `!` hits undefined and the harness dies in CI
  // only — the exact class of break that hides until the one environment you added it for.
  const key = process.env.V2_PREVIEW_KEY || (
    fs.readFileSync(path.resolve(process.cwd(), ENV_FILE), 'utf-8')
      .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))!
      .split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  )

  const browser = await chromium.launch()
  const rows: Row[] = []
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey: key }, maxRedirects: 0 })
    if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) throw new Error(`gate rejected (${res.status()}) — check V2_PREVIEW_KEY vs the FE serving ${HOST}`)
    const url = new URL(HOST)
    await ctx.addCookies([
      { name: 'cookie-mumate-id', value: USER_ID, domain: url.hostname, path: '/' },
      { name: 'cookie-mumate-name', value: USER_NAME, domain: url.hostname, path: '/' },
    ])

    // hold the two home requests in flight so the grey state is steady, not a frame to be caught.
    await page.route(/\/api\/(user|chinese-horoscope|home)/, async (route) => {
      await new Promise((r) => setTimeout(r, hold))
      await route.continue()
    })

    const errors: string[] = []
    const hydration: string[] = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      errors.push(t)
      if (/hydrat|did not match|Text content does not match/i.test(t)) hydration.push(t)
    })

    await page.goto(`${HOST}/v2`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-testid="home-header"]', { timeout: 15000 })
    await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
    await page.waitForTimeout(600) // paint settle only — the requests are still held

    const m = await page.evaluate(() => {
      const de = document.scrollingElement!
      const col = document.querySelector('[data-testid="home-header"]')?.parentElement
      const bg = document.querySelector('img[src*="BG01"]') as HTMLImageElement | null
      const skels = Array.from(document.querySelectorAll('[data-testid="zone1-skeleton"], [data-testid="header-tools-skeleton"], [data-testid="element-line-skeleton"], [data-testid="manifest-mascot-skeleton"]'))
      // The mascot stand-ins DoD 3 forbids during loading — but ONLY where the mascot is USER DATA.
      //
      // The first version of this check matched `mascot/01*` anywhere in the document and went red at all
      // six widths. The culprit was `nav-mate-ai-mascot`: the Mate AI button in the menubar, a permanent
      // brand control that is *supposed* to be on screen and has nothing to do with anyone's chart. The
      // check was named for one class of thing and matched another — so it is scoped, not relaxed: the
      // rule is "no plausible stand-in in a slot that will later hold THIS user's mascot", and those slots
      // all live in the content column (greeting element line · manifest card), never in the fixed nav.
      const column = document.querySelector('[data-testid="home-header"]')?.parentElement
      const fallbacks = Array.from(column?.querySelectorAll('img') ?? []).filter((i) => /mascot\/01(-nav)?\.(webp|png)/.test(i.getAttribute('src') || ''))
      const taps = Array.from(document.querySelectorAll('a[href],button:not([disabled])')).map((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 ? Math.min(r.width, r.height) : Infinity
      })
      // "ยังไม่มีข้อมูลดวงวันนี้" is a CLAIM about data we do not have yet. It is the same bug-class as a
      // plausible stand-in image, one step worse: the image only looks like data, the sentence states an
      // absence as fact. No layout measure can catch it — the card is the right size and the right colour
      // while it says the wrong thing — so it gets its own assertion.
      const falseEmpty = !!Array.from(document.querySelectorAll('p,span,div'))
        .find((el) => el.textContent?.trim() === 'ยังไม่มีข้อมูลดวงวันนี้' && el.getBoundingClientRect().width > 0)
      return {
        falseEmpty,
        hScroll: de.scrollWidth > window.innerWidth + 1,
        colWidth: col ? col.getBoundingClientRect().width : -1,
        bgWidth: bg ? bg.getBoundingClientRect().width : -1,
        menubar: !!document.querySelector('a[href="/v2"]')?.closest('div'),
        skeletons: skels.length,
        fallbackVisible: fallbacks.some((i) => i.getBoundingClientRect().width > 0),
        minTap: Math.round(Math.min(...taps, Infinity)),
      }
    })

    await page.screenshot({ path: path.join(outDir, `v2-skeleton-${w}.png`) })

    rows.push({
      w,
      hScroll: m.hScroll,
      contentWithinMax: m.colWidth > 0 && m.colWidth <= Math.min(w, 448) + 1,
      bgFills: m.bgWidth >= w - 1,
      menubar: m.menubar,
      hydrationErrors: hydration.length,
      consoleErrors: errors.length,
      skeletonsVisible: m.skeletons,
      mascotFallbackVisible: m.fallbackVisible,
      falseEmptyClaim: m.falseEmpty,
      minTapTarget: m.minTap,
    })
    await ctx.close()
  }
  await browser.close()

  console.log(`\n─── DoD 5 machine leg · REAL route /v2 · grey state held ${hold}ms ────────────────`)
  console.log(`${'w'.padStart(5)} ${'h-scroll'.padStart(9)} ${'in max-w'.padStart(9)} ${'bg fills'.padStart(9)} ${'menubar'.padStart(8)} ${'hydration'.padStart(10)} ${'console'.padStart(8)} ${'skeletons'.padStart(10)} ${'01.webp?'.padStart(9)} ${'"ไม่มีข้อมูล"'.padStart(12)} ${'min tap'.padStart(8)}`)
  let fails = 0
  for (const r of rows) {
    const bad = r.hScroll || !r.contentWithinMax || !r.bgFills || !r.menubar || r.hydrationErrors > 0 || r.skeletonsVisible < 4 || r.mascotFallbackVisible || r.falseEmptyClaim
    if (bad) fails++
    console.log(`${String(r.w).padStart(5)} ${(r.hScroll ? 'YES ✗' : 'no ✓').padStart(9)} ${(r.contentWithinMax ? 'yes ✓' : 'NO ✗').padStart(9)} ${(r.bgFills ? 'yes ✓' : 'NO ✗').padStart(9)} ${(r.menubar ? 'yes ✓' : 'NO ✗').padStart(8)} ${String(r.hydrationErrors).padStart(10)} ${String(r.consoleErrors).padStart(8)} ${String(r.skeletonsVisible).padStart(10)} ${(r.mascotFallbackVisible ? 'SHOWN ✗' : 'hidden ✓').padStart(9)} ${(r.falseEmptyClaim ? 'CLAIMED ✗' : 'silent ✓').padStart(12)} ${String(r.minTapTarget).padStart(8)}`)
  }
  // "skeletons ≥ 4" asserts the SURFACE was there to measure: this whole table is about a loading state,
  // and every column above would read green on a page that had already finished loading. A count of 0
  // would mean the run measured the settled screen and called it a skeleton pass.
  console.log(`\nskeleton zones expected ≥4 (zone1 · header-tools · element-line · manifest-mascot) — a 0 here means the state was never on screen and every other column is meaningless`)
  console.log(`shots → ${path.relative(process.cwd(), outDir)}/  ·  ${fails ? `❌ ${fails} width(s) failed` : '✅ all widths clean'}\n`)
  process.exit(fails ? 1 : 0)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2) })
