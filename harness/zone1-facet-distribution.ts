// harness/zone1-facet-distribution.ts — how many LINES does real facet text actually wrap to?
//
// Step 2 of the P4 shift work. zone1-height-map.ts answered "a card with N facet lines is H px tall";
// this answers "what is N in the wild". Together they give the reserve height with nothing guessed.
//
// It has to be real fortunes: the three fixtures in home-preview would produce a reserve that fits the
// fixtures. The text is not stored anywhere — bazi computes it per user per day — so this asks the app's
// own /api/home-fortune for a sample of real testenv users and measures what comes back.
//
// 🔒 PRIVACY: this prints STATISTICS ONLY — line counts and their distribution. It never writes fortune
// text, user ids, or names to stdout or to any file. (บอง, after a PII incident earlier in the day: read
// only, take the shape, leave the content.) The sample ids come from the local testenv DB (anonymized,
// pg:5433) and are held in memory only.
//
//   npx tsx harness/zone1-facet-distribution.ts --n 40
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3010'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}

async function main() {
  const widths = arg('widths', '320,360,393').split(',').map(Number)
  const want = Number(arg('n', '40'))
  const rowsFile = arg('rows', 'harness/out/_frames/sample-rows.tsv')

  // Birth fields only, from a read-only query against the LOCAL testenv db. Deliberately NOT user ids:
  // the fortune is a pure function of (dob, time, gender, place) + today, so the identity adds nothing to
  // the measurement and everything to the blast radius if this file leaked. Columns pulled are exactly the
  // five `userRowToFeCalcInput` reads — no name, no email, no tel, no id.
  //   psql "$LOCAL_TESTENV_URL" -At -F '\t' -c "select coalesce(dob,''), coalesce(time,''), \
  //     coalesce(gender,''), coalesce(place_name,''), coalesce(is_remember_time::text,'false') \
  //     from \"user\" where result_code <> '' and dob <> '' and gender <> '' limit 60" > <rowsFile>
  const rowsPath = path.resolve(process.cwd(), rowsFile)
  if (!fs.existsSync(rowsPath)) { console.error(`no sample-row file at ${rowsFile} — see the SQL in this file's header`); process.exit(2) }
  const rows = fs.readFileSync(rowsPath, 'utf-8').split('\n').map((l) => l.split('\t')).filter((c) => c.length === 5 && c[0]).slice(0, want)
  if (!rows.length) { console.error('sample-row file is empty — nothing to measure'); process.exit(2) }

  const key = process.env.V2_PREVIEW_KEY || (
    fs.readFileSync(path.resolve(process.cwd(), ENV_FILE), 'utf-8')
      .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))!
      .split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  )

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey: key }, maxRedirects: 0 })
  if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) throw new Error(`gate rejected (${res.status()})`)

  // one render surface reused for every sample: the real card, at each width, with the real text put
  // into the real element — so the line count is the browser's, not a character-count approximation.
  await page.goto(`${HOST}/v2/home-preview`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-variant="home"]', { state: 'visible' })

  const counts: Record<number, number[]> = {}
  widths.forEach((w) => { counts[w] = [] })
  let fetched = 0, failed = 0

  for (const cols of rows) {
    const [dob, time, gender, place, remember] = cols
    // the REPO's own mapper shape (lib/bazi-bridge/input.userRowToFeCalcInput) — not a hand-rolled
    // payload. A shape invented here would drift from the one the app sends and this distribution would
    // describe a request no user ever makes.
    const person = {
      name: null,
      dob: dob || null,
      time: remember === 'true' ? (time || null) : '',
      gender: gender || null,
      place_name: place || null,
    }
    let best = '', worst = ''
    try {
      const r = await page.request.post(`${HOST}/api/home-fortune`, {
        data: { person, anonId: 'zone1-distribution' },
        timeout: 30000,
      })
      if (!r.ok()) { failed++; continue }
      const j = (await r.json()) as { fortune?: { best?: { text?: string }; worst?: { text?: string } } | null }
      best = j?.fortune?.best?.text ?? ''
      worst = j?.fortune?.worst?.text ?? ''
      if (!best && !worst) { failed++; continue }
      fetched++
    } catch { failed++; continue }

    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 852 })
      const lines = await page.evaluate((texts) => {
        const { a, b } = texts as { a: string; b: string }
        const chips = Array.from(document.querySelectorAll('[data-testid="fortune-chip"]')) as HTMLElement[]
        if (chips.length < 2) throw new Error('expected two facet chips — the loaded card was not on screen')
        // inlined on purpose: a named inner function here gets an esbuild `__name` wrapper injected by
        // tsx, and that helper does not exist in the page — the evaluate died with "__name is not
        // defined" before measuring anything.
        chips[0].textContent = a || '—'
        const ha = Math.max(1, Math.round(chips[0].getBoundingClientRect().height / 22))
        chips[1].textContent = b || '—'
        const hb = Math.max(1, Math.round(chips[1].getBoundingClientRect().height / 22))
        // the row's height follows the TALLER column, so that is the number that drives the card
        return Math.max(ha, hb)
      }, { a: best, b: worst })
      counts[w].push(lines)
    }
  }
  await browser.close()

  console.log(`\n─── real facet line-count distribution ────────────────────────────────────────`)
  console.log(`sampled ${fetched} fortunes (${failed} unavailable) from the LOCAL testenv stack`)
  console.log(`no fortune text, user id or name is printed or written by this tool — shape only\n`)
  if (!fetched) { console.error('❌ 0 fortunes fetched — nothing measured. Do not read a distribution off this.'); process.exit(1) }

  for (const w of widths) {
    const c = counts[w]
    const hist: Record<number, number> = {}
    c.forEach((n) => { hist[n] = (hist[n] ?? 0) + 1 })
    const max = Math.max(...c)
    const p95 = c.slice().sort((a, b) => a - b)[Math.min(c.length - 1, Math.floor(c.length * 0.95))]
    const bars = Object.keys(hist).map(Number).sort((a, b) => a - b)
      .map((n) => `${n} line${n > 1 ? 's' : ''}: ${String(hist[n]).padStart(3)} ${'█'.repeat(Math.round((hist[n] / c.length) * 30))}`)
    console.log(`@${w} — max ${max} · p95 ${p95}`)
    bars.forEach((b) => console.log(`      ${b}`))
    console.log('')
  }
  console.log(`⚠️ this is ONE day's compute for this sample. The facet text is generated per user per day,`)
  console.log(`   so a reserve chosen from it should cover the MAX seen here with a line to spare, and the`)
  console.log(`   card must degrade gracefully (not clip) if a future fortune runs longer.\n`)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2) })
