// harness/zone1-height-map.ts — how tall does the Zone-1 card get, per facet line-count, per width?
//
// The P4 shift (18px @393/360 · 64px @320) has one cause: the skeleton is a FIXED height and the real
// card's height follows how many lines its facet text wraps to. Closing it to ≤2px means reserving the
// right number of lines — and "the right number" is the one thing nobody has measured. Guessing it from
// the three fixtures in home-preview would produce a number that fits the fixtures, not the users.
//
// So this splits the question in two, and only the first half needs the app:
//   1. (here)  line-count → rendered card height, at each width. Pure layout arithmetic, no data needed.
//   2. (later) the real distribution of facet line-counts, from the testenv fortunes.
// Tabulate 1 now, lay 2 over it when the stack is up, and the reserve height falls out with no guessing.
//
// It drives /v2/home-preview with synthetic facet text of a known line count — synthetic is CORRECT here,
// because the question is about geometry (how tall is N lines), not about content. The content question
// is step 2, and it is answered with real fortunes.
//
//   npx tsx harness/zone1-height-map.ts
//   npx tsx harness/zone1-height-map.ts --widths 320,393 --lines 1,2,3,4,5
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3010'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

// ⚠️ The first version of this used one long UNBROKEN Thai string, on the assumption that Thai wraps by
// character. It does not — without an explicit break rule an unbroken run OVERFLOWS its box instead of
// wrapping, so the paragraph stayed one line no matter how much text was added and the table came out
// identical for every line-count (368px at 320 for n=1..4). The map was measuring a string that had left
// the layout, not a taller card.
// Real facet text is space-separated Thai phrases ("เริ่มต้นโปรเจกต์ใหม่ ติดต่อเจรจาเรื่องการเงิน"), and
// spaces are where this box actually breaks. So the unit is a short phrase plus a space, and the achieved
// line count is MEASURED and printed rather than assumed.
const UNIT = 'งานดี ' // short enough that even 320 can reach a genuine 1-line row (the longer unit could not)

async function main() {
  const widths = arg('widths', '320,360,393,430,768,1280').split(',').map(Number)
  const lineCounts = arg('lines', '1,2,3,4,5,6').split(',').map(Number)

  const key = process.env.V2_PREVIEW_KEY || (
    fs.readFileSync(path.resolve(process.cwd(), ENV_FILE), 'utf-8')
      .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))!
      .split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  )

  const browser = await chromium.launch()
  const rows: { w: number; n: number; cardH: number; skelH: number; achieved: number }[] = []

  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey: key }, maxRedirects: 0 })
    if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) throw new Error(`gate rejected (${res.status()})`)

    // the skeleton's own height at this width — the fixed side of the comparison
    const skelNav = await page.goto(`${HOST}/v2/home-preview?zones=all&state=loading`, { waitUntil: 'networkidle' })
    if (!skelNav || skelNav.status() >= 400) throw new Error(`home-preview ${skelNav?.status()} — nothing to measure`)
    await page.waitForTimeout(250)
    const skelH = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="zone1-skeleton"]')
      if (!el) throw new Error('zone1-skeleton absent — the loading state was not on screen')
      return Math.round(el.getBoundingClientRect().height)
    })

    for (const n of lineCounts) {
      // ?best= / ?worst= are not preview knobs yet; drive the length through the existing fixture by
      // injecting the text after render. The card is presentational, so setting the chip's text is the
      // same thing a longer fortune does — geometry is what we are measuring.
      await page.goto(`${HOST}/v2/home-preview`, { waitUntil: 'networkidle' })
      await page.waitForSelector('[data-variant="home"]', { state: 'visible' })
      await page.waitForFunction(() => (document.querySelector('[data-variant="home"]') as HTMLElement)?.getBoundingClientRect().height > 0)
      await page.waitForTimeout(200)
      const cardH: { cardH: number; achieved: number } = await page.evaluate((args) => {
        const { unit, n } = args as { unit: string; n: number }
        const chips = Array.from(document.querySelectorAll('[data-testid="fortune-chip"]'))
        if (!chips.length) throw new Error('fortune-chip absent — the loaded card was not on screen')
        // repeat the unit until the paragraph occupies exactly n lines at this width
        const target = chips[0] as HTMLElement
        const lineH = 22
        let achieved = 0
        for (let k = 1; k <= 60; k++) {
          target.textContent = Array.from({ length: k }, () => unit).join('')
          achieved = Math.round(target.getBoundingClientRect().height / lineH)
          if (achieved >= n) break
        }
        const card = document.querySelector('[data-variant="home"]')
        if (!card) throw new Error('daily-fortune-card absent')
        // A zero-height card is not a measurement, it is a miss (the node exists but has not been laid
        // out yet). It showed up once at 1280 and would have entered the table as "-304px of shift" —
        // a number that looks like a dramatic finding and means the opposite of one.
        if (Math.round(card.getBoundingClientRect().height) <= 0) throw new Error('card measured 0px — not laid out yet')
        // report what we actually GOT, not what we asked for — if the text never reached n lines the row
        // must say so instead of quietly contributing a height that belongs to a different line count.
        return { cardH: Math.round(card.getBoundingClientRect().height), achieved }
      }, { unit: UNIT, n })
      rows.push({ w, n, cardH: cardH.cardH, skelH, achieved: cardH.achieved })
    }
    await ctx.close()
  }
  await browser.close()

  console.log(`\n─── Zone-1 height map · card height by facet line-count ───────────────────────`)
  console.log(`${'width'.padStart(6)} ${'skeleton'.padStart(9)} ${'1 line'.padStart(8)} ${'2'.padStart(6)} ${'3'.padStart(6)} ${'4'.padStart(6)} ${'5'.padStart(6)} ${'6'.padStart(6)}`)
  for (const w of Array.from(new Set(rows.map((r) => r.w)))) {
    const mine = rows.filter((r) => r.w === w)
    const skel = mine[0]?.skelH ?? 0
    console.log(`${String(w).padStart(6)} ${String(skel).padStart(9)} ${mine.map((r) => String(r.cardH).padStart(6)).join(' ')}`)
  }
  console.log(`\nΔ (card − skeleton) — this is the shift a fortune of that line-count produces:`)
  console.log(`${'width'.padStart(6)} ${'1 line'.padStart(8)} ${'2'.padStart(6)} ${'3'.padStart(6)} ${'4'.padStart(6)} ${'5'.padStart(6)} ${'6'.padStart(6)}`)
  for (const w of Array.from(new Set(rows.map((r) => r.w)))) {
    const mine = rows.filter((r) => r.w === w)
    console.log(`${String(w).padStart(6)} ${mine.map((r) => { const d = r.cardH - r.skelH; return String(d > 0 ? `+${d}` : d).padStart(6) }).join(' ')}`)
  }
  const bad = rows.filter((r) => r.achieved !== r.n)
  if (bad.length) {
    console.log(`\n❌ ${bad.length} cell(s) never reached the line count asked for — the text did not wrap as`)
    console.log(`   intended and those heights belong to a different line count: ${bad.slice(0, 8).map((r) => `@${r.w} asked ${r.n} got ${r.achieved}`).join(' · ')}`)
    console.log(`   Treat this table as INVALID until that is fixed.\n`)
    process.exit(1)
  }
  console.log(`\nread this with the REAL line-count distribution (step 2) laid over it — the reserve height is`)
  console.log(`the row where Δ reaches 0 for every line-count the users actually produce, at EVERY width.\n`)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2) })
