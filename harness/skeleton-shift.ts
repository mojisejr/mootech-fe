// harness/skeleton-shift.ts — how far does the page MOVE when the skeleton fills in?
//
// A skeleton's job is not only "not white". ฟีม's words were "โครงจริงตั้งแต่เฟรมแรก" — a real STRUCTURE
// from the first frame — and a grey block that is the wrong SIZE keeps the promise's letter while breaking
// it in the way the user actually feels: the thing they were about to tap slides out from under the thumb.
//
// So this measures the one number that says whether the structure was real: the document-Y of every major
// landmark in the loading render vs the loaded render, same build, same width. 0 = the reveal is data
// filling into boxes that were already right. Anything large = the skeleton was a decoration.
//
//   npx tsx harness/skeleton-shift.ts
//   HARNESS_HOST=http://localhost:3010 npx tsx harness/skeleton-shift.ts --widths 393,360,320
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3010'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

// Landmarks a user actually aims at, plus the page's own total height. Anchored to rendered text/testids,
// never to .nth(i) — an index moves when a section is added and the anchor silently follows it.
const LANDMARKS: { key: string; sel: string }[] = [
  { key: 'header (สวัสดีคุณ)', sel: 'text=สวัสดีคุณ' },
  // one key, two renders: the loaded card carries data-variant="home", the loading one my testid. Selecting
  // on either means the landmark EXISTS in both — a selector that matches only one render reports "ABSENT"
  // and drops out of the worst-shift number, which is how a moved landmark hides behind a green total.
  { key: 'zone1 fortune card', sel: '[data-variant="home"], [data-testid="zone1-skeleton"]' },
  { key: 'zone2 manifest CTA', sel: 'text=เพิ่มความปรารถนาของคุณ' },
  { key: 'zone3 heading', sel: 'text=ดวงสมพงค์' },
  { key: 'zone4 heading', sel: 'text=โหมดเซียน' },
]

async function measure(url: string, width: number) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  // env first (CI), file second (local) — same reason as first-frame-v2.readPasskey. The parentheses
  // matter: without them the file-parsing chain binds to the whole `||` expression and runs against the
  // ENV STRING, which has no "V2_PREVIEW_KEY=" line, so the `!` hits undefined and the harness dies in CI
  // only — the exact class of break that hides until the one environment you added it for.
  const key = process.env.V2_PREVIEW_KEY || (
    fs.readFileSync(path.resolve(process.cwd(), ENV_FILE), 'utf-8')
      .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))!
      .split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  )
  // A rejected gate still returns 303 — check WHERE it points, or an unauthenticated run sails on and
  // measures the passkey form instead of the page (that is how this script first reported "0px shift":
  // both renders were the gate form, both had zero landmarks, and zero-of-zero printed as a pass).
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey: key }, maxRedirects: 0 })
  const loc = res.headers()['location'] ?? ''
  if (res.status() !== 303 || loc.includes('gate_error')) throw new Error(`gate rejected (${res.status()} → ${loc}) — V2_PREVIEW_KEY in ${ENV_FILE} vs the FE serving ${HOST}`)
  const nav = await page.goto(`${HOST}${url}`, { waitUntil: 'networkidle' })
  if (!nav || nav.status() >= 400) throw new Error(`${url} returned ${nav?.status()} — nothing to measure`)
  if (new URL(page.url()).pathname !== url.split('?')[0]) throw new Error(`redirected to ${page.url()} instead of ${url} — measuring the wrong page`)
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(250)

  const out: Record<string, number | null> = {}
  for (const { key: k, sel } of LANDMARKS) {
    const loc = page.locator(sel).first()
    // A selector that ERRORS must not read as "moved 0" — an absent landmark is recorded as null and
    // printed as such, never folded into the pass/fail number (anchors-that-pin-the-wrong-thing #6).
    out[k] = (await loc.count()) ? Math.round((await loc.boundingBox())!.y + (await page.evaluate(() => window.scrollY))) : null
  }
  out['__pageHeight'] = await page.evaluate(() => document.scrollingElement!.scrollHeight)
  await browser.close()
  return out
}

async function main() {
  const widths = arg('widths', '393,360,320').split(',').map(Number)
  let worst = 0
  let missing = 0 // a landmark absent from either render — the surface was not there to be measured
  for (const w of widths) {
    const loadingUrl = '/v2/home-preview?zones=all&state=loading'
    const loadedUrl = '/v2/home-preview'
    const a = await measure(loadingUrl, w)
    const b = await measure(loadedUrl, w)
    console.log(`\n── @${w} ─────────────────────────────────────────────`)
    console.log(`   ${'landmark'.padEnd(24)} ${'loading'.padStart(8)} ${'loaded'.padStart(8)} ${'Δ'.padStart(8)}`)
    for (const k of Object.keys(a)) {
      const x = a[k], y = b[k]
      if (x === null || y === null) { missing++; console.log(`   ${k.padEnd(24)} ${String(x ?? 'ABSENT').padStart(8)} ${String(y ?? 'ABSENT').padStart(8)} ${'n/a'.padStart(8)}  ❌ ABSENT — measured nothing here`); continue }
      const d = y - x
      if (Math.abs(d) > Math.abs(worst)) worst = d
      console.log(`   ${k.padEnd(24)} ${String(x).padStart(8)} ${String(y).padStart(8)} ${String(d > 0 ? `+${d}` : d).padStart(8)}  ${Math.abs(d) <= 2 ? '✓' : '⚠️'}`)
    }
  }
  // "0px shift" over zero landmarks is not a pass, it is an unrun test — and it reads identically to a
  // real pass in a PR body. So the surface SIZE is asserted before the shift number is allowed to mean
  // anything: any absent landmark fails the run outright, no matter how good the number above it looks.
  if (missing) {
    console.log(`\n❌ ${missing} landmark reading(s) ABSENT — this run measured a page that was not there.`)
    console.log(`   "worst shift 0px" over zero landmarks is NOT a pass. Fix the page or the selector, then re-run.\n`)
    process.exit(1)
  }
  console.log(`\nworst shift across all widths: ${worst}px  (over ${LANDMARKS.length} landmarks × ${widths.length} width(s), all present)`)
  console.log(`(a landmark that moves is content sliding under the user's thumb between the frame they aimed at and the frame they hit)\n`)
  process.exit(Math.abs(worst) > 2 ? 1 : 0)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2) })
