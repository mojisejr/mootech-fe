// harness/run-fortune-fidelity.ts — FORTUNE-FIDELITY anchor (Zone 1 daily-fortune · visual lens, widened).
//
// WHY THIS EXISTS: run-verdict-color.ts proves the ring COLOUR reflects the verdict — but colour is ONE
// facet. The cross-oracle adversary (2026-07-25) proved the bug-class "the card faithfully renders the
// fortune" has more facets my colour anchor was blind to:
//   • too  — hardcoded `grade="A" pct={99}` sailed through the colour gate GREEN (colour blind to DATA).
//   • goo รู1 — out-of-range pct (150) → ring/label overflow; colour gate never reads the number.
//   • goo รู2 — empty facets → chip renders a bare icon; colour gate never reads the chip text.
// This anchor closes MY lens's share by reading the RENDERED text (not source, not data attrs — the actual
// glyphs the user sees; a hardcode lands in these nodes too, so it can't hide). Neg-control-first, then
// each facet's teeth proven against the exact mutant that beat the colour anchor.
//
// Cross-lens division (none self-certifies — the three compose to cover the class):
//   too (static) = no hardcoded literal in render path · goo (data) = pct∈[0,100] + facets non-empty at
//   source · me (visual) = colour[run-verdict-color] + data-binding/bounds/empty-fallback[here].
//   npx tsx harness/run-fortune-fidelity.ts   (dev server up; PORT/HARNESS_HOST env-overridable)
import { chromium, type Browser, type Page } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const VP = { w: 393, h: 852 }

type Card = { grade: string; pct: number; best: string; worst: string }

// read the card's RENDERED text (ground truth = the glyphs on screen). onDom lets a mutant blank/patch a
// node just before the read, to reproduce a bad *output* the component could emit (bounds / empty facets).
async function readCard(browser: Browser, query: string, onDom?: (p: Page) => Promise<void>): Promise<Card> {
  const ctx = await browser.newContext({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/home-preview?${query}`, { waitUntil: 'networkidle' })
  await page.getByTestId('fortune-grade').waitFor()
  if (onDom) await onDom(page)
  const grade = ((await page.getByTestId('fortune-grade').textContent()) ?? '').trim()
  const pctText = ((await page.getByTestId('fortune-pct').textContent()) ?? '').trim()
  const chips = page.getByTestId('fortune-chip')
  const best = ((await chips.nth(0).textContent()) ?? '').trim()
  const worst = ((await chips.nth(1).textContent()) ?? '').trim()
  await ctx.close()
  return { grade, pct: parseInt(pctText.replace('%', ''), 10), best, worst }
}

// what each state MUST render if the card is truly data-bound (matches the preview FORTUNES mock).
const EXPECT: Record<string, { grade: string; pct: number }> = {
  good: { grade: 'A', pct: 88 },
  neutral: { grade: 'C+', pct: 62 },
  caution: { grade: 'D', pct: 34 },
}

async function main() {
  const browser = await chromium.launch()

  // ── neg-control (verify-the-instrument): the clean card must read EXACTLY the mock, across all 3 states ──
  const clean: Record<string, Card> = {}
  for (const s of ['good', 'neutral', 'caution']) clean[s] = await readCard(browser, `state=${s}`)
  const bound = Object.keys(EXPECT).every((s) => clean[s].grade === EXPECT[s].grade && clean[s].pct === EXPECT[s].pct)
  const distinct = new Set(['good', 'neutral', 'caution'].map((s) => `${clean[s].grade}/${clean[s].pct}`)).size === 3

  // ── facet 1: DATA-BINDING (too's hole) — mut=hardcode ignores per-state data → grade/pct collapse ──
  const mutHard: Record<string, Card> = {}
  for (const s of ['good', 'neutral', 'caution']) mutHard[s] = await readCard(browser, `state=${s}&mut=hardcode`)
  const hardCollapsed = new Set(['good', 'neutral', 'caution'].map((s) => `${mutHard[s].grade}/${mutHard[s].pct}`)).size < 3
  const hardMismatch = ['neutral', 'caution'].some((s) => mutHard[s].grade !== EXPECT[s].grade || mutHard[s].pct !== EXPECT[s].pct)
  const dataBindingCaught = hardCollapsed && hardMismatch

  // ── facet 2: PCT-BOUNDS (goo รู1) — real overflow(150) must clamp to ≤100; DOM-inject unclamped = caught ──
  const overflowClamped = await readCard(browser, 'state=overflow')
  const boundsHold = overflowClamped.pct >= 0 && overflowClamped.pct <= 100
  const overflowRaw = await readCard(browser, 'state=overflow', async (p) => {
    await p.getByTestId('fortune-pct').evaluate((el) => { el.textContent = '150%' }) // simulate an unclamped component
  })
  const boundsCaught = !(overflowRaw.pct >= 0 && overflowRaw.pct <= 100) // the gate must reject 150

  // ── facet 3: EMPTY-FACET FALLBACK (goo รู2) — empty facets render "—"; DOM-blank (fallback removed) = caught ──
  const emptyFallback = await readCard(browser, 'state=empty-facet')
  const fallbackShown = emptyFallback.best.length > 0 && emptyFallback.worst.length > 0 // "—", never bare
  const emptyRaw = await readCard(browser, 'state=empty-facet', async (p) => {
    await p.getByTestId('fortune-chip').first().evaluate((el) => { el.textContent = '' }) // simulate fallback removed
  })
  const emptyCaught = emptyRaw.best.length === 0 // the gate must reject a truly empty chip

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  const teeth = (ok: boolean, s: string) => `  ${ok ? '🦷 CAUGHT' : '✗ BLIND'}  ${s}`
  console.log('\n═══ FORTUNE-FIDELITY anchor (Zone 1 · widened after goo+too adversary) ═══')
  console.log('  ── neg-control (clean card reads the mock exactly) ──')
  console.log(`  clean: good ${clean.good.grade}/${clean.good.pct}% · neutral ${clean.neutral.grade}/${clean.neutral.pct}% · caution ${clean.caution.grade}/${clean.caution.pct}%`)
  console.log(line(bound, 'data-bound: every state renders its own grade/pct (not a fixed literal)'))
  console.log(line(distinct, 'the three states are distinct (a hardcode would make them identical)'))
  console.log(line(boundsHold, `bounds: overflow(150) clamps to ${overflowClamped.pct}% ≤ 100`))
  console.log(line(fallbackShown, `empty-facet: chips render fallback "${emptyFallback.best}" / "${emptyFallback.worst}" (never bare)`))
  console.log('  ── teeth (each mutant = the exact hole an oracle exploited) ──')
  console.log(teeth(dataBindingCaught, 'too  mut=hardcode: grade/pct ignore data → collapse + mismatch'))
  console.log(teeth(boundsCaught, 'goo รู1 unclamped 150% → bounds gate rejects >100'))
  console.log(teeth(emptyCaught, 'goo รู2 blanked chip → empty gate rejects zero-length'))

  const ok = bound && distinct && boundsHold && fallbackShown && dataBindingCaught && boundsCaught && emptyCaught
  console.log(`\n  ${ok ? '🟢 FORTUNE-FIDELITY PASSED' : '🔴 FAILED'} — data-binding + bounds + empty-fallback proven · colour = run-verdict-color.ts\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
