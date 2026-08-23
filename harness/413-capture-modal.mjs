// harness/413-capture-modal.mjs — #413 evidence: the v1 add-friend modal on the REAL route (/matching).
//   npm run dev -- -p 3413 ; node harness/413-capture-modal.mjs <label>
// The modal is opened by a button on the page; identity comes from the same MEMBER_ID cookie the app uses
// (resolveAuth accepts a uuid there without a NextAuth session), so nothing here writes to any database.
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evidenceDir } from './evidence-dir.mjs'
const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
// #417 — the output root is a value now, not a string spelled out here. See harness/evidence-dir.mjs.
const OUT = evidenceDir()
const LABEL = process.argv[2] ?? 'after'
const UID = '11111111-2222-4333-8444-555555555555'
const b = await chromium.launch()
const rows = []
for (const w of [320, 393]) {
  const c = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'cookie-mumate-id', value: UID, domain: 'localhost', path: '/' }])
  await c.route('**/api/user*', (r) => r.fulfill({ json: { user_id: UID, name: 'มานี', surname: '', dob: '2540-05-04', time: '09:30', picture_url: '' } }))
  await c.route('**/api/member-with-friend*', (r) => r.fulfill({ json: [] }))
  const p = await c.newPage()
  // 🔴 THIS IS THE COMPONENT, NOT THE ROUTE — say it plainly rather than let the filename imply otherwise.
  // On /matching the "add a friend" control is DISABLED without a real friend-quota/session, and this ticket
  // may not touch anything but words in v1 (it takes real money), so the modal is mounted on a throwaway
  // page instead. Real browser, real fonts, real CSS — but the surrounding screen is not in the frame.
  await p.goto('http://localhost:3413/__413-probe', { waitUntil: 'networkidle' })
  await p.waitForSelector('text=เพศดั้งเดิม', { timeout: 8000 })
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: join(OUT, `413-${LABEL}-${w}.png`), fullPage: true })
  // read the label back off the rendered DOM — a filename proves nothing about the frame
  rows.push({ label: LABEL, w, gender: await p.textContent('text=เพศดั้งเดิม') })
  await c.close()
}
console.log(JSON.stringify(rows, null, 1))
await b.close()
