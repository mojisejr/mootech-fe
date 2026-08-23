// harness/276-measure-row.mjs — #276: how tall is the friend profile row, and how many lines is the dob?
//   npm run dev -- -p 3276    (needs .env.local with V2_PREVIEW_KEY — without it /v2/* rewrites to
//                              /maintenance AND STILL ANSWERS 200; assert page CONTENT, never the status)
//   node harness/276-measure-row.mjs <label>
//
// 🔴 LINE COUNT COMES FROM A Range, NOT FROM getClientRects() ON THE <p>.
// An element's getClientRects() returns its BORDER BOXES — for a block <p> that is exactly one rect however
// many lines of text are inside it. Counting that way answers "1" for a paragraph that wrapped to three, and
// the number looks perfectly plausible. A Range over the TEXT NODE returns one rect per rendered line, which
// is the thing being asked about. (Found while measuring #266; recorded in the #276 ticket.)
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evidenceDir } from './evidence-dir.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
// #417 — the output root is a value now, not a string spelled out here. See harness/evidence-dir.mjs.
const OUT = evidenceDir()
const LABEL = process.argv[2] ?? 'after'
const UID = '11111111-2222-4333-8444-555555555555'
const FID = '99999999-8888-4777-8666-555555555555'
// a realistic Thai name — the row's width behaviour depends on the text it actually holds
const FRIEND_NAME = 'ปิยะพงษ์'
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()

const b = await chromium.launch()
const rows = []
for (const w of [320, 360, 393, 430]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  // 🔴 The row that has the bug is the POPULATED person-2 row (two actions). Reaching it needs an identity
  // and a friend, so the CONTRACTS are mocked and the SCREEN is real. Nothing here touches a database —
  // an earlier run of this harness pointed at a shared remote DB before I checked which one it was.
  await ctx.addCookies([{ name: 'cookie-mumate-id', value: UID, domain: 'localhost', path: '/' }])
  await ctx.route('**/api/user*', (r) => r.fulfill({ json: {
    user_id: UID, name: 'มานี', surname: '', dob: '2540-05-04', time: '09:30', picture_url: '',
    payment: { is_not_expired: true },
  } }))
  await ctx.route('**/api/quota*', (r) => r.fulfill({ json: { friend: { remaining: 17 } } }))
  await ctx.route('**/api/member-with-friend/detail*', (r) => r.fulfill({ json: {
    friend_id: FID, name: FRIEND_NAME, surname: '', dob: '2538-11-23', time: '14:05', is_remember_time: true, picture_url: '',
  } }))
  await ctx.route('**/api/member-with-friend*', (r) => r.fulfill({ json: [
    { id: FID, name: FRIEND_NAME, surname: '', picture_url: '', is_disable: false },
  ] }))
  await p.goto(`http://localhost:3276/v2/service/compatibility/love`, { waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid="compat-screen"]')
  // pick the friend so slot 2 becomes the TWO-ACTION row
  await p.click('[data-testid="compat-person2"]')
  await p.waitForSelector('[data-testid="compat-friend-list"]')
  await p.getByText(FRIEND_NAME).first().click()
  await p.waitForSelector('[data-testid="compat-person2-change"]', { timeout: 8000 })
  // 🔴 WAIT FOR THE BIRTHDATE ITSELF. Waiting only for the button let the detail fetch still be in flight,
  // so the line counter found no element and returned null — which reads exactly like "no wrapping problem".
  await p.waitForSelector('[data-testid="compat-person2-dob"]', { timeout: 8000 })
  await p.evaluate(() => document.fonts.ready)

  const m = await p.evaluate(() => {
    const lines = (el) => {
      if (!el) return null
      const node = el.firstChild
      if (!node || node.nodeType !== Node.TEXT_NODE) return null
      const r = document.createRange(); r.selectNodeContents(node)
      // one rect per rendered line — merge rects that share a top (a line split by inline elements)
      const tops = new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top)))
      return tops.size
    }
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null
      const r = e.getBoundingClientRect(); return { h: +r.height.toFixed(1), w: +r.width.toFixed(1) } }
    const dob = document.querySelector('[data-testid="compat-person2-dob"]')
    if (!document.querySelector('[data-testid="compat-person2-dob"]')) throw new Error('dob not rendered — refusing to report a measurement')
    return {
      row1: box('[data-testid="compat-person1"]'),
      row2: box('[data-testid="compat-person2"]'),
      buttons: [box('[data-testid="compat-person2-change"]'), box('[data-testid="compat-person2-edit"]')],
      // 🔴 the two numbers side by side: the <p>'s own rect count vs the Range count.
      dobRectsOnElement: dob ? dob.getClientRects().length : null,
      dobLinesViaRange: lines(dob),
      dobText: dob ? dob.textContent : null,
    }
  })
  rows.push({ label: LABEL, w, ...m })
  await p.screenshot({ path: join(OUT, `276-${LABEL}-${w}.png`) })
  await ctx.close()
}
console.log(JSON.stringify(rows, null, 1))
await b.close()
