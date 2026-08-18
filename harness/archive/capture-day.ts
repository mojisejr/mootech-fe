// Ad-hoc capture for Phase 3a review: login via the v2 gate, screenshot /v2/calendar/[date] + /v2/calendar
// at 393 (iPhone-16 width) for the Figma side-by-side, and report app-fetch + console-error counts.
// Run (FE up on :3011): npx tsx harness/capture-day.ts
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const OUT = process.env.CAPTURE_OUT ?? '/private/tmp/claude-501/-Users-non-ghq-github-com-mojisejr-lamun-oracle/f45290ac-6a6b-4771-bb8c-19a1fa5a851b/scratchpad/shots'

function readPasskey(): string {
  const file = path.resolve(process.cwd(), 'testenv/env/fe.env')
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('V2_PREVIEW_KEY not found')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const passkey = readPasskey()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
  const res = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) {
    throw new Error(`gate rejected (${res.status()})`)
  }

  const targets = [
    { route: '/v2/calendar/2026-07-15', file: 'day-3a.png' },        // no mock reminder → §14 = state 2 (primary-cta)
    { route: '/v2/calendar/2026-07-14', file: 'day-3a-saved.png' },  // has mock reminders → §14 = state 3 (saved)
    { route: '/v2/calendar', file: 'month-3a.png' },
  ]
  for (const t of targets) {
    const page = await ctx.newPage()
    const tracker = trackAppFetches(page)
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`))
    await page.goto(`${HOST}${t.route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, t.file), fullPage: true })
    const h = await page.evaluate(() => document.body.scrollHeight)
    console.log(`${t.route}  app-fetch=${tracker.appFetches.length}  console-errors=${consoleErrors.length}  height=${h}px  → ${t.file}`)
    if (consoleErrors.length) consoleErrors.forEach((e) => console.log(`   ⚠️ ${e}`))
    if (tracker.appFetches.length) tracker.appFetches.forEach((u) => console.log(`   🌐 ${u}`))
    await page.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
