// Capture Phase 6 states @393: the reminders list (mock has 3) + the empty state (forced branch).
// Run (FE up on :3011): npx tsx harness/capture-p6.ts  [--empty]
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const OUT = '/private/tmp/claude-501/-Users-non-ghq-github-com-mojisejr-lamun-oracle/f45290ac-6a6b-4771-bb8c-19a1fa5a851b/scratchpad/shots'
function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no key')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const file = process.argv.includes('--empty') ? 'notif-empty.png' : 'notif-list.png'
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/calendar/notifications`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, file), fullPage: true })
  const rows = await page.locator('[data-testid="notif-row"]').count()
  console.log(`${file}  rows=${rows}`)
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
