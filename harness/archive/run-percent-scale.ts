// harness/run-percent-scale.ts — the HARVESTER half of PERCENT-SCALE.
//
// This file does not judge anything. It goes and gets the two layers — what the API said, and what the
// screen painted — and hands them to harness/percent-crosscheck.ts, which is pure and lives under CI via
// scripts/percent-scale.test.ts. That split is deliberate: a browser run can only exist in harness/, and CI
// does not run harness/, so putting the judgement here would have left it unenforced exactly like the
// service-hub anchor (#179) and the sapphire invariant were.
//
// ⚠️ EXPECTED TO ABORT TODAY. Neither calendar hook fetches yet — useCalendarMonth serves mockCalendarMonth
// and useDayDetail serves mockDayDetail — so there is no API side to harvest. When that happens this run
// ABORTS with a non-zero exit instead of printing a pass. An anchor that goes green because it found
// nothing to compare is worse than no anchor: it converts "unverified" into "verified" silently, which is
// the failure this whole PR exists to prevent. Once G-0c lands, the harvest becomes real with no edit here.
//
// TEETH live with the judgement (scripts/percent-scale.test.ts): mut-tolerance · mut-empty-passes ·
// mut-skip-implausible. The one that belongs to THIS file is the abort itself — demonstrated by running it
// against today's mock-only build and watching it refuse to certify.
//
// Run:  HARNESS_HOST=http://localhost:3099 npx tsx harness/run-percent-scale.ts
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { crossCheckPercents, harvestIsMeaningful, type ApiPercent, type ScreenPercent } from './percent-crosscheck'

const HOST = process.env.HARNESS_HOST ?? process.env.CAPTURE_HOST ?? 'http://localhost:3099'

function readPasskey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

/** read every day cell's date + the DIGITS it painted. The date comes from the href/aria the cell already
 *  carries, so the two layers are keyed on the same thing rather than on grid position. */
async function readScreen(page: Page): Promise<ScreenPercent[]> {
  return page.$$eval('a[data-testid="calendar-day"], button[data-testid="calendar-day"]', (els) =>
    els
      .map((el) => {
        const href = el.getAttribute('href') ?? ''
        const date = href.split('/').pop() ?? (el.getAttribute('data-date') ?? '')
        // the percent glyph is the last text node ending in '%'
        const m = (el.textContent ?? '').match(/([\d.]+|—)%\s*$/)
        return { date, text: m ? m[1] : '' }
      })
      .filter((x) => x.date && x.text),
  )
}

async function main() {
  console.log('\n═══ PERCENT-SCALE · cross-layer harvest ═══')
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
  const host = new URL(HOST).hostname
  await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  await ctx.addCookies([
    { name: 'cookie-mumate-id', value: 'percent-scale-anchor', domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มุน', domain: host, path: '/' },
  ])
  const page = await ctx.newPage()

  // ── layer 1: whatever the app actually asked the API for ──
  const api: ApiPercent[] = []
  page.on('response', async (res) => {
    const u = res.url()
    if (!/\/api\/v2\/(calendar-month|day-detail)/.test(u)) return
    try {
      const body = (await res.json()) as { days?: unknown; date?: unknown; overallPercent?: unknown }
      if (Array.isArray(body.days)) {
        for (const d of body.days as { date?: unknown; overallPercent?: unknown }[]) {
          if (typeof d.date === 'string') api.push({ date: d.date, percent: typeof d.overallPercent === 'number' ? d.overallPercent : null })
        }
      } else if (typeof body.date === 'string') {
        api.push({ date: body.date, percent: typeof body.overallPercent === 'number' ? body.overallPercent : null })
      }
    } catch {
      /* not JSON — nothing to harvest */
    }
  })

  await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="calendar-day"]', { timeout: 20000 }).catch(() => undefined)
  await page.waitForTimeout(2500) // let a slow personalised month arrive

  const screen = await readScreen(page)
  await browser.close()

  console.log(`  harvested: ${api.length} value(s) from the API · ${screen.length} painted on screen`)

  // ── the abort. NOT a pass. ──
  if (!harvestIsMeaningful(api, screen)) {
    console.log('\n  ⛔ ABORT — nothing to compare.')
    console.log(`     api=${api.length} screen=${screen.length}`)
    console.log('     Today this is EXPECTED: useCalendarMonth still serves mockCalendarMonth, so the app')
    console.log('     never calls the API and there is no second layer to hold the screen against.')
    console.log('     This run refuses to print a pass rather than certify an unchecked screen.')
    process.exit(2)
  }

  const issues = crossCheckPercents(api, screen)
  for (const i of issues) console.log(`  ✗ ${i.kind}  ${JSON.stringify(i)}`)
  console.log(`\n${issues.length === 0 ? '✅ PERCENT-SCALE PASSED — every painted number matches the API value it came from' : `❌ PERCENT-SCALE FAILED (${issues.length})`}\n`)
  process.exit(issues.length === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
