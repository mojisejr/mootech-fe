// harness/capture-compat-form.ts — capture the ดวงสมพงศ์ FORM in its default "not yet pressed" state @393.
// Used for the golden-rule-6 before/after pixel-proof: CompatibilityScreen is a SHIPPED file 2F operates on,
// so the un-pressed form must render byte-identical before (origin/main) and after (this branch). person2 is
// left EMPTY (the real default landing state) so no modal / friend-select variance enters the capture.
//   usage: CAPTURE_HOST=http://localhost:3023 npx tsx harness/capture-compat-form.ts <out.png>
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3023'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const OUT = path.resolve(process.cwd(), process.argv[2] ?? 'harness/pixel-proof/compat-2f-form.png')

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
  const page = await ctx.newPage()
  // person1 loads (real user); person2 stays empty — the default form. Mock only /api/user for determinism.
  await page.route((u) => u.pathname.endsWith('/api/user'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: USER_ID, name: 'มิลา', dob: '1994-06-14', time: '09:30', picture_url: '' }) }))
  await page.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-person1-name"]').waitFor({ timeout: 8000 })
  await page.locator('[data-testid="compat-person2-empty"]').waitFor({ timeout: 4000 }) // empty friend slot present
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready)
  await page.waitForFunction(() => document.querySelector('[data-testid="compat-person1-name"]')?.textContent?.trim() === 'มิลา', null, { timeout: 4000 })
  await page.screenshot({ path: OUT })
  console.log(`📸 ${OUT}`)
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
