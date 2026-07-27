// harness/run-freeze-proof.ts — proof-of-teeth for freeze-animation.ts (Phase 1, บอง 2026-07-27).
//
// Proves the animation freeze used before every pixel-COMPARED screenshot is:
//   (A) DETERMINISTIC across load timing — the SAME page frozen at 3 different loop-phase offsets must be
//       byte-identical (บอง: don't prove with 2 back-to-back frames in one condition — that misses the flaky).
//   (B) NON-VACUOUS — the page really has running animations before the freeze, and reducedMotion stills them
//       all (0 left ⇒ every motion carries a reduced-motion guard; a stray >0 names an un-guarded motion).
//
// (The base-transform / "keyframe-only base" trap — z3-rock-l/r — is documented from the CSS SOURCE in the
//  verify-evidence, not sampled at runtime: a computed-transform read right after a WAAPI currentTime pin
//  races the style flush and is unreliable. Owner of that UI fix = มุน, not the harness.)
//   npx tsx harness/run-freeze-proof.ts   (dev server up on :3000; V2_PREVIEW_KEY / ROUTE env-overridable)
import { chromium, type Browser, type Page } from 'playwright'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { freezeAnimations, liveAnimationCount } from './freeze-animation'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'local-testenv'
const ROUTE = process.env.ROUTE ?? '/v2/home-preview'
const VP = { w: 393, h: 852 }

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const page = await ctx.newPage()
  await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 }).catch(() => {})
  return page
}
const diff = (a: Buffer, b: Buffer) => {
  const A = PNG.sync.read(a),
    B = PNG.sync.read(b)
  return pixelmatch(A.data, B.data, undefined, A.width, A.height, { threshold: 0.1 })
}

async function main() {
  const browser = await chromium.launch()

  // (A) determinism across load timing — freeze at 3 different loop-phase offsets, diff all pairs.
  const shots: Buffer[] = []
  for (const offset of [0, 660, 1320]) {
    const page = await newPage(browser)
    await page.waitForTimeout(offset)
    await freezeAnimations(page)
    shots.push(await page.screenshot())
    await page.context().close()
  }
  const d01 = diff(shots[0], shots[1]),
    d12 = diff(shots[1], shots[2]),
    d02 = diff(shots[0], shots[2])
  const deterministic = d01 === 0 && d12 === 0 && d02 === 0

  // (B) verify-the-instrument — live before, stilled after reducedMotion freeze.
  const p2 = await newPage(browser)
  const before = await liveAnimationCount(p2)
  await freezeAnimations(p2)
  const after = await liveAnimationCount(p2)
  await p2.context().close()
  await browser.close()

  const instrumentValid = before > 0 && after === 0
  console.log('\n═══ FREEZE PROOF (freeze-animation.ts · reducedMotion) ═══')
  console.log(`  route ${ROUTE} @${VP.w}`)
  console.log(`  ${deterministic ? '✓' : '✗'} (A) determinism across timing: diff(0,660)=${d01} diff(660,1320)=${d12} diff(0,1320)=${d02} px  (want 0 — proves timing-independence)`)
  console.log(`  ${instrumentValid ? '✓' : '✗'} (B) instrument non-vacuous: ${before} animations live before freeze → ${after} after  (0 ⇒ all carry a reduced-motion guard)`)
  console.log(`\n  ${deterministic && instrumentValid ? '🟢 FREEZE PROVEN' : '🔴 FREEZE PROOF FAILED'} — deterministic + non-vacuous`)
  if (!deterministic || !instrumentValid) process.exit(1)
}
main()
