// harness/run-calendar-phase0.ts — RUNTIME proof that the calendar Phase-0 mock is 0-app-fetch and
// console-clean on the REAL routes, WITHOUT a backend booted (nothing to reach = the strongest proof).
//
// Uses the SHARED assertNoAppFetch (same code Lamun's anchor imports — two lenses, one assertion, can't
// diverge). Request-level tracking (not response-level) so a would-be /api call to a downed backend is
// still caught as an ATTEMPT. Requires only the FE dev server (:3000) + the v2 passkey — NO BE/bazi/DB.
//
// Run (FE up on :3000): npx tsx harness/run-calendar-phase0.ts
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { trackAppFetches } from './assert-no-app-fetch'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3000'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'

function readPasskey(): string {
  const file = path.resolve(process.cwd(), ENV_FILE)
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error(`V2_PREVIEW_KEY not in ${ENV_FILE}`)
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

const ROUTES = ['/v2/calendar', '/v2/calendar/2026-07-14', '/v2/calendar/notifications']

async function main() {
  const passkey = readPasskey()
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  // team gate: POST { passkey } → Set-Cookie v2_access (lands in this context's jar).
  const res = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (res.status() !== 303 || (res.headers()['location'] ?? '').includes('gate_error')) {
    throw new Error(`passkey gate rejected (${res.status()}) — check V2_PREVIEW_KEY + FE up`)
  }

  let failed = false
  for (const route of ROUTES) {
    const page = await ctx.newPage()
    const tracker = trackAppFetches(page) // request-level, BEFORE navigation
    const consoleErrors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160))
    })
    await page.goto(`${HOST}${route}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)

    const appFetches = tracker.appFetches.length
    const errs = consoleErrors.length
    const ok = appFetches === 0 && errs === 0
    console.log(`${ok ? '✓' : '✗'} ${route}  app-fetch=${appFetches}  console-errors=${errs}`)
    if (appFetches) tracker.appFetches.forEach((f) => console.log(`     app-fetch: ${f}`))
    if (errs) consoleErrors.forEach((e) => console.log(`     console: ${e}`))
    if (!ok) failed = true
    await page.close()
  }

  await browser.close()
  console.log(failed ? '\n✗ FAIL — see above' : '\n✓ PASS — 0 app-fetch, console-0 on all calendar routes (no backend booted)')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(String(e?.message ?? e))
  process.exit(1)
})
