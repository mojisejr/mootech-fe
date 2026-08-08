// harness/first-frame-v2.ts — FIRST-FRAME lens (P1 "หน้าแรกไม่มีจอขาว").
//
// Why this exists: DoD 1 + 2 of the P1 card are stated in FRAMES ("แถบเมนูล่างไม่หายไปสักเฟรม",
// "ไม่มีเฟรมไหนที่จอเป็นสีขาวล้วน"), and every anchor we own samples a SETTLED page. run-pixel.ts
// says so about itself in its own header: "pre-settle/entrance flash (too #1) — resolves before
// frame A; needs first-paint capture." This is that capture.
//
// It drives the REAL user path — standing on another /v2 tab, tapping หน้าหลัก (a soft nav, which is
// what a tab press is) — and records EVERY COMPOSITED FRAME via CDP Page.startScreencast. Then it
// answers two questions per frame, from pixels:
//   1. is the bottom menubar band painted?  (DoD 1)
//   2. is the whole frame near-white?       (DoD 2)
//
//   npx tsx harness/first-frame-v2.ts                       # measure
//   npx tsx harness/first-frame-v2.ts --hard                # hard load instead of soft nav
//   HARNESS_HOST=http://localhost:3010 npx tsx harness/first-frame-v2.ts
//
// Screencast frames are what the compositor actually produced — not a DOM query, not a computed
// style. A frame that never reaches the compositor never reaches the user's eye either, so this
// measures the same thing the eye does, at the eye's own resolution (frames).
//
// NEGATIVE CONTROL (--control white|nav): before any number here counts as evidence, the instrument
// must answer DIFFERENTLY with and without the thing it claims to see.
//   --control white : force a full-white overlay for ~250ms after the nav → whiteFrames MUST rise
//   --control nav   : force display:none on the menubar → menubarFrames MUST fall to 0
// A measure that reads the same in all three modes is measuring the environment, not the page.
import { chromium, type Page, type BrowserContext } from 'playwright'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3010'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const VP = { width: 393, height: 852 }
// A PII-free anonymized test user with a chart (same id capture-route.ts uses; testenv DB, not a real person).
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const USER_NAME = 'มิลา'

const has = (f: string) => process.argv.includes(`--${f}`)
const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

// read the team passkey at runtime — never hardcoded, never printed (CAPTURE.md rule)
function readPasskey(): string {
  const file = path.resolve(process.cwd(), ENV_FILE)
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error(`V2_PREVIEW_KEY not set in ${ENV_FILE}`)
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

type Frame = { t: number; buf: Buffer }

// ── pixel questions ────────────────────────────────────────────────────────────────────────────
// The menubar is `fixed inset-x-0 bottom-0 … max-w-md` — a pill band across the bottom of the
// viewport. We sample the band it occupies and ask whether ANY non-background pixel is painted
// there. The nav's own ground is sapphire/white-pill on the page bg, so "painted" = the band is not
// a single flat colour. A flat band (all one colour, e.g. ScreenLoading's white) = no menubar.
function bandIsPainted(png: PNG, fromBottomPx: number, heightPx: number): boolean {
  const y0 = Math.max(0, png.height - fromBottomPx)
  const y1 = Math.min(png.height, y0 + heightPx)
  let min = 255, max = 0, seen = 0
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      const i = (png.width * y + x) << 2
      const lum = (png.data[i] * 299 + png.data[i + 1] * 587 + png.data[i + 2] * 114) / 1000
      if (lum < min) min = lum
      if (lum > max) max = lum
      seen++
    }
  }
  // a real menubar puts dark glyphs / a sapphire pill next to light ground → wide luminance spread.
  return seen > 0 && max - min > 40
}

// "สีขาวล้วน" — the ScreenLoading ground is #fff with a small centred spinner, so a white frame is
// ~99% near-white pixels. The home skeleton's ground is bg-cream (#FDFBEF-ish) + a nav → far less.
function nearWhiteRatio(png: PNG): number {
  let white = 0, seen = 0
  for (let y = 0; y < png.height; y += 3) {
    for (let x = 0; x < png.width; x += 3) {
      const i = (png.width * y + x) << 2
      if (png.data[i] > 246 && png.data[i + 1] > 246 && png.data[i + 2] > 246) white++
      seen++
    }
  }
  return seen ? white / seen : 0
}

async function login(ctx: BrowserContext, page: Page, passkey: string) {
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  const loc = res.headers()['location'] ?? ''
  if (res.status() !== 303 || loc.includes('gate_error')) {
    throw new Error(`passkey gate rejected (${res.status()}) — check V2_PREVIEW_KEY in ${ENV_FILE} vs the FE serving ${HOST}`)
  }
  // identity by COOKIE, not /dev-login: resolveAuth() reports 'authed' from a uuid MEMBER_ID alone
  // (lib/auth/resolve-auth.ts), so this needs no DB and no next-auth session — and it reproduces the
  // returning user exactly, which is who presses a tab.
  const url = new URL(HOST)
  await ctx.addCookies([
    { name: 'cookie-mumate-id', value: USER_ID, domain: url.hostname, path: '/' },
    { name: 'cookie-mumate-name', value: USER_NAME, domain: url.hostname, path: '/' },
  ])
}

async function main() {
  const control = arg('control') // undefined | 'white' | 'nav'
  const hard = has('hard')
  const outDir = path.resolve(process.cwd(), arg('out', 'harness/out/first-frame')!)
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })

  const passkey = readPasskey()
  const browser = await chromium.launch()
  // deviceScaleFactor 1: screencast frames are compositor output; 1x keeps the frame budget high
  // (a 2x frame takes longer to encode, and a slow encoder DROPS frames — the thing we must not do).
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await login(ctx, page, passkey)

  const failed: string[] = []
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(HOST, '')}`) })

  // stand on ANOTHER tab first — a tab press is a soft nav, and a soft nav is the case the card is about
  await page.goto(`${HOST}/v2/service`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const navOnService = await page.locator('nav, [class*="fixed"][class*="bottom-0"]').count()

  if (control === 'nav') {
    await page.addStyleTag({ content: `[class*="fixed"][class*="bottom-0"]{display:none!important}` })
  }
  if (control === 'white') {
    // a forced full-white overlay for 250ms right after the click — the thing DoD 2 forbids
    await page.evaluate(() => {
      document.addEventListener('click', () => {
        const d = document.createElement('div')
        d.setAttribute('style', 'position:fixed;inset:0;background:#fff;z-index:2147483647')
        document.documentElement.appendChild(d)
        setTimeout(() => d.remove(), 250)
      }, { capture: true })
    })
  }

  const cdp = await ctx.newCDPSession(page)
  const frames: Frame[] = []
  cdp.on('Page.screencastFrame', async (e: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    frames.push({ t: (e.metadata.timestamp ?? 0) * 1000, buf: Buffer.from(e.data, 'base64') })
    await cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
  await page.waitForTimeout(150) // let the cast warm up so frame 0 is the pre-click steady state

  const t0 = Date.now()
  if (hard) {
    // --route lets the hard-load case be pointed at a page with NO auth gate at all (e.g. /v2/service).
    // That is the control for the blank frame a hard navigation shows: if an ungated page blanks too, the
    // frame belongs to the browser's document swap, not to anything this PR renders.
    await page.goto(`${HOST}${arg('route', '/v2')}`, { waitUntil: 'commit' })
  } else {
    await page.getByRole('link', { name: 'หน้าหลัก' }).click()
  }
  await page.waitForTimeout(2500)
  await cdp.send('Page.stopScreencast').catch(() => {})

  // ── analyse every composited frame ───────────────────────────────────────────────────────────
  const rows = frames.map((f, i) => {
    const png = PNG.sync.read(f.buf)
    return {
      i,
      ms: f.t ? Math.round(f.t - (frames[0].t || f.t)) : -1,
      menubar: bandIsPainted(png, 96, 86),
      white: Math.round(nearWhiteRatio(png) * 1000) / 10,
      buf: f.buf,
    }
  })
  // frame 0 is the pre-click steady state on /v2/service; the transition starts at the first frame
  // whose menubar/white reading departs from it (or simply frame 1 onward).
  const post = rows.slice(1)
  const noMenubar = post.filter((r) => !r.menubar)
  const allWhite = post.filter((r) => r.white >= 97)

  rows.forEach((r) => {
    const tag = `${String(r.i).padStart(3, '0')}_${String(r.ms).padStart(5, '0')}ms_${r.menubar ? 'nav' : 'NONAV'}_${r.white}pctwhite.png`
    fs.writeFileSync(path.join(outDir, tag), r.buf)
  })

  const mode = control ? `CONTROL:${control}` : hard ? 'hard-load' : 'soft-nav (tab press)'
  console.log(`\n─── first-frame /v2 · ${mode} ─────────────────────────────`)
  console.log(`host=${HOST}  vp=${VP.width}x${VP.height}  frames=${rows.length}  span=${rows.at(-1)?.ms}ms`)
  console.log(`menubar on /v2/service before the press: ${navOnService > 0 ? '✓ present' : '✗ ABSENT (measurement invalid)'}`)
  console.log(`\nDoD 1 — frames after the press with NO menubar painted : ${noMenubar.length} / ${post.length}`)
  if (noMenubar.length) console.log(`         ${noMenubar.slice(0, 12).map((r) => `#${r.i}@${r.ms}ms`).join(' ')}${noMenubar.length > 12 ? ' …' : ''}`)
  console.log(`DoD 2 — frames after the press that are ≥97% white     : ${allWhite.length} / ${post.length}`)
  if (allWhite.length) console.log(`         ${allWhite.slice(0, 12).map((r) => `#${r.i}@${r.ms}ms (${r.white}%)`).join(' ')}${allWhite.length > 12 ? ' …' : ''}`)
  console.log(`\nverdict: ${noMenubar.length === 0 && allWhite.length === 0 ? '✅ no white frame, menubar never dropped' : '❌ the user sees at least one frame the DoD forbids'}`)
  if (failed.length) console.log(`\nhttp ≥400 during the run (BE down is expected on a FE-only stack): ${Array.from(new Set(failed)).slice(0, 6).join(' · ')}`)
  console.log(`frames → ${path.relative(process.cwd(), outDir)}/  (filename carries ms + nav/NONAV + %white)`)
  console.log(`⚠️  a screencast can DROP frames under load — "0 bad frames" means "none observed", never "none exist".\n`)

  await browser.close()
  process.exit(noMenubar.length === 0 && allWhite.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2) })
