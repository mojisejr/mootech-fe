// harness/capture-compat-result-min.ts — capture the result page in its MINIMAL state (only overall, no
// dims/element/people) @393. Used for the golden-rule-6 before/after: CompatibilityResultScreen is a SHIPPED
// file (2E-1 on main); wiring 2E-2 into it must leave the minimal state pixel-identical (tabs render null,
// no new section paints). usage: CAPTURE_HOST=... npx tsx harness/capture-compat-result-min.ts <out.png>
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3027'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const OUT = path.resolve(process.cwd(), process.argv[2] ?? 'harness/pixel-proof/compat-result-min.png')

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

function minimalBody() {
  const overall = { percent: 82, grade: 'A', gradeLabel: 'เข้ากันดีมาก', hearts: 4, emoji: '💞', ratingText: 'โดยรวมหนุนกันได้ดี เข้าใจกันในระยะยาว' }
  return JSON.stringify({ result: JSON.stringify({ pairMatch: { overall, persons: { a: { displayName: 'มิลา' }, b: { displayName: 'ก้อง' } } } }) })
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
  await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: minimalBody() }))
  await page.goto(`${HOST}/v2/service/compatibility/result/MIN`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 12000 })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready)
  await page.waitForTimeout(300)
  await page.screenshot({ path: OUT, fullPage: true })
  console.log(`📸 ${OUT}`)
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
