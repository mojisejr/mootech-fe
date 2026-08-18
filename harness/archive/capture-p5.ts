// Capture Phase 5 states @393 for the Figma side-by-side: sheet open (form) + saved (menu 3).
// Run (FE up on :3011): npx tsx harness/capture-p5.ts
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
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  const r = await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  if (r.status() !== 303) throw new Error(`gate ${r.status()}`)
  const page = await ctx.newPage()
  await page.goto(`${HOST}/v2/calendar/2026-07-15`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน' }).click()
  await page.waitForTimeout(250)
  await page.locator('[data-testid="save-sheet"] label').nth(2).click({ force: true }) // tick a ยาม (checked state)
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(OUT, 'save-sheet-open.png') }) // viewport — the fixed sheet overlay
  console.log('sheet open → save-sheet-open.png')
  // save → menu state 3 (saved); capture the bottom bar
  await page.locator('[data-testid="sheet-save"]').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(OUT, 'save-sheet-saved.png') })
  console.log('saved → save-sheet-saved.png')
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
