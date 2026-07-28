// Capture 3b both modes @393 for the Figma side-by-side: advanced ON (default) + toggle OFF (== 3a).
// Run (FE up on :3011): npx tsx harness/capture-3b.ts
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const OUT = '/private/tmp/claude-501/-Users-non-ghq-github-com-mojisejr-lamun-oracle/f45290ac-6a6b-4771-bb8c-19a1fa5a851b/scratchpad/shots'

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
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/calendar/2026-07-14`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, 'day-3b-advanced.png'), fullPage: true })
  const h1 = await page.evaluate(() => document.body.scrollHeight)
  console.log(`advanced ON  → day-3b-advanced.png  height=${h1}px`)
  await page.click('[role="switch"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(OUT, 'day-3b-normal.png'), fullPage: true })
  const h2 = await page.evaluate(() => document.body.scrollHeight)
  console.log(`toggle OFF   → day-3b-normal.png  height=${h2}px`)
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
