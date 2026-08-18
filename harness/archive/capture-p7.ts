// Capture Phase 7 entry-points @393 + overflow spot @320. Run (FE up :3011): npx tsx harness/capture-p7.ts
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3011'
const OUT = '/private/tmp/claude-501/-Users-non-ghq-github-com-mojisejr-lamun-oracle/f45290ac-6a6b-4771-bb8c-19a1fa5a851b/scratchpad/shots'
function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no key'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
async function shot(w: number, file: string) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 2 })
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/calendar/2026-07-14`, { waitUntil: 'networkidle' }) // day-14 = saved → A2 + bell
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(OUT, file), fullPage: true })
  const ov = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  console.log(`@${w} → ${file}  no-overflow=${ov}`)
  await browser.close()
}
async function main() { fs.mkdirSync(OUT, { recursive: true }); await shot(393, 'p7-day-entrypoints-393.png'); await shot(320, 'p7-day-320.png') }
main().catch((e) => { console.error(e); process.exit(1) })
