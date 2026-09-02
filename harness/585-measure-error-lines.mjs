// #585 ก้อน 4 — how many VISUAL lines each refusal takes, at every width the app supports.
//
// CALC_ERROR_COPY is authored as exactly two lines: a headline that is always one line, and guidance that
// is always the second. That contract is invisible to every assertion on textContent — the string can be
// perfect while the browser breaks it mid-phrase, which is what #263's frames caught ("ลองอีก / ครั้ง").
// Thai has no word spaces, so a wrap lands wherever it lands. This counts the rendered line boxes.
import { chromium } from 'playwright'
import { evidenceDir } from './evidence-dir.mjs'
const BASE = 'http://localhost:3210'
const OUT = evidenceDir('585-press')

const CASES = [
  ['quota', 410, { error: 'q' }],
  ['engine-down', 503, {}],
  ['no-friend', 404, {}],
  ['unusable-birth', 422, {}],
  ['too-many', 400, { max: 3 }],
]

const b = await chromium.launch()
const report = {}
for (const W of [320, 360, 393]) {
  for (const [name, status, body] of CASES) {
    const ctx = await b.newContext({ viewport: { width: W, height: 850 }, deviceScaleFactor: 2 })
    await ctx.addCookies([
      { name: 'v2_access', value: 'local-testenv', url: BASE },
      { name: 'cookie-mumate-id', value: 'b54b765a-c01b-471f-bf7c-0c2a1a448bdd', url: BASE },
    ])
    await ctx.route('**/api/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'b54b765a-c01b-471f-bf7c-0c2a1a448bdd', name: 'ฟีม', dob: '1990-01-01', time: '08:00', picture_url: '' }) }))
    await ctx.route('**/api/member-with-friend/detail**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'f-1', name: 'กัสสรนาดี', surname: '', picture_url: '', dob: '1990-06-15', time: '19:15' }) }))
    await ctx.route('**/api/member-with-friend**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'f-1', name: 'กัสสรนาดี', surname: '', picture_url: '', dob: '1990-06-15', time: '19:15' }]) }))
    await ctx.route('**/api/v2/matching/work', (route, req) =>
      req.method() === 'POST'
        ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ ok: false, ...body }) })
        : route.fallback())
    const p = await ctx.newPage()
    await p.goto(`${BASE}/v2/service/compatibility/colleague`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await p.waitForSelector('[data-testid="compat-candidate-0"]', { timeout: 30000 })
    await p.click('[data-testid="compat-candidate-0"]')
    await p.click('[data-testid^="compat-friend-f-"]')
    await p.waitForFunction(() => !document.querySelector('[data-testid="compat-view-result"]').disabled, null, { timeout: 8000 })
    await p.click('[data-testid="compat-view-result"]')
    await p.waitForSelector('[data-testid="compat-result-error"]', { timeout: 15000 })
    const m = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="compat-result-error"]')
      // one client rect per rendered LINE BOX — this is the measurement textContent cannot make
      const lines = (spans) => spans.map((s) => {
        const r = document.createRange(); r.selectNodeContents(s)
        return { text: s.textContent, lines: r.getClientRects().length }
      })
      return lines(Array.from(el.querySelectorAll('span')))
    })
    report[`${W}:${name}`] = m
    await ctx.close()
  }
}
let bad = 0
for (const [k, v] of Object.entries(report)) {
  for (const part of v) {
    const flag = part.lines > 1 ? '🔴' : '  '
    if (part.lines > 1) bad++
    console.log(`${flag} ${k.padEnd(24)} lines=${part.lines}  ${part.text}`)
  }
}
console.log(`\nบรรทัดที่ตัดเกินหนึ่งบรรทัด: ${bad}  (สัญญาคือทุกท่อนต้องเป็น 1 บรรทัด)`)
await b.close()
