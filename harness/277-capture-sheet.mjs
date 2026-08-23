// harness/277-capture-sheet.mjs — #277 evidence: the add-friend sheet on the REAL route.
//   npm run dev -- -p 3277      (needs .env.local with V2_PREVIEW_KEY — without it every /v2/* rewrites to
//                                /maintenance AND STILL ANSWERS 200; assert page CONTENT, never the status)
//   node harness/277-capture-sheet.mjs <label>
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(REPO, 'harness', 'pixel-proof'); mkdirSync(OUT, { recursive: true })
const LABEL = process.argv[2] ?? 'after'
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()

const b = await chromium.launch()
const rows = []
for (const w of [320, 393]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`http://localhost:3277/v2/service/compatibility/love`, { waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid="compat-screen"]')
  // the empty person-2 slot is what opens the add-friend flow
  // 🔴 `compat-person2-empty` is a <span> INSIDE the button and resolves to two nodes, the first invisible —
  // clicking it times out. The control the user actually taps is the button itself.
  await p.click('[data-testid="compat-person2"]')
  // CompatSelectFriendModal sits in between: pick its "add a new friend" row to reach the sheet.
  const sheet = await p.waitForSelector('[data-testid="add-friend-sheet"]', { timeout: 4000 }).catch(() => null)
  if (!sheet) {
    await p.getByText(/เพิ่มเพื่อน/).first().click()
    await p.waitForSelector('[data-testid="add-friend-sheet"]', { timeout: 8000 })
  }
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: join(OUT, `277-${LABEL}-${w}.png`) })
  // read the words back off the rendered sheet — a filename proves nothing about what is in the frame
  rows.push({
    label: LABEL, w,
    labels: await p.$$eval('[data-testid="add-friend-sheet"] span', (n) => n.map((x) => x.textContent?.trim()).filter((t) => t && t.length < 40)),
    namePlaceholder: await p.getAttribute('[data-testid="add-friend-name"]', 'placeholder'),
  })
  await ctx.close()
}
console.log(JSON.stringify(rows, null, 1))
await b.close()
