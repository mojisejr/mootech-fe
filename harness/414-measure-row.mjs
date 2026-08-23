// harness/414-measure-row.mjs — #414: the friend profile row across 320…430, one width at a time.
//   npm run dev -- -p $PORT   (needs .env.local with V2_PREVIEW_KEY — without it /v2/* rewrites to
//                              /maintenance AND STILL ANSWERS 200; assert page CONTENT, never the status)
//   PORT=3414 node harness/414-measure-row.mjs <label>
//
// 🔴 PORT IS A PARAMETER BECAUSE HARD-CODING IT MADE TWO OF US COLLIDE. The first version pinned 3414, so
// ตู๋ — reviewing this very ticket — started his server on the port the file told him to use, on a machine
// where I already held it, and cleaned up afterwards with `pkill -f "next dev"`. That killed mine twice,
// mid-sweep. Neither of us did anything careless; the file handed us the same port and never mentioned
// that anyone else might be holding it. `lsof -nP -iTCP:$PORT -sTCP:LISTEN` names the holder, and the
// process's cwd (`lsof -a -p <pid> -d cwd`) says WHOSE worktree is being served — which is the only thing
// that actually answers "were these numbers measured against my code or someone else's?"
//
// Descends from harness/276-measure-row.mjs (#276). What is different, and why:
//
// 🔴 LINE COUNT COMES FROM A Range, NOT FROM getClientRects() ON THE <p>.  (inherited from #276 — an
// element's getClientRects() returns its BORDER BOXES: exactly one rect for a block <p> however many lines
// of text are inside it, so it answers "1" for a paragraph that wrapped to three.)
//
// 🔴 THE MOCK NOW SENDS A CE DATE, BECAUSE THAT IS WHAT THE REAL CONTRACT SENDS.  #276's harness sent
// dob:'2538-11-23' — already Buddhist — into formatCompatBirth(), which adds 543 (compat-format.ts:11).
// The row therefore rendered "23 พ.ย. 3081", a year no user has. AddFriendSheet.tsx:85 converts BE→CE
// before writing, so the column really does hold CE. Same glyph count, so #276's conclusions still stand,
// but a harness that feeds its screen data the app cannot produce is measuring a screen we do not ship.
//
// 🔴 THE WIDTH BUDGET IS REPORTED, NOT JUST THE SYMPTOM.  "the dob wrapped" does not say by how much, and
// the fix has to buy a specific number of pixels. dobInk is measured with a Range over the text node
// (the INK), not the <p>'s box (which is the whole column, and is the same width whether it fits or not).
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evidenceDir } from './evidence-dir.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
// #417 — the output root is a value now, not a string spelled out here. See harness/evidence-dir.mjs.
const OUT = evidenceDir()
const LABEL = process.argv[2] ?? 'before'
// 🔴 THE WIDTH SET IS DERIVED FROM LINES IN THE CODE, NOT FROM PHONE MODELS (ตู๋, #414 2026-08-23).
// 320 · 359 · 360 · 393 · 430 are the set the ticket settled on: 320/393 are the two DoD widths, 359/360
// straddle the `min-[360px]` rule this row is built on, 430 pays off the "360/393/430 do not move a pixel"
// claim at CompatibilityScreen.tsx:91 that shipped without a single image.
// 391 · 392 are MINE, and they are a different KIND of line: not a breakpoint anybody typed, but the width
// where the birthdate stops fitting beside the actions. Measured, not chosen — the text column is exactly
// (viewport - 244)px at every width tested, and the rendered birthdate ink is 147.6px, so the row runs out
// of room at 391.6. That number is what this ticket is actually about, so both sides of it get a picture.
// (I dropped 375 · 390 · 412 from my first pass: those are phone-model widths, which is the habit ตู๋'s
//  survey argues against. 390 said the same thing 391 says.)
const WIDTHS = (process.argv[3] ?? '320,359,360,391,392,393,430').split(',').map(Number)
const PORT = process.env.PORT || '3414'
const UID = '11111111-2222-4333-8444-555555555555'
const FID = '99999999-8888-4777-8666-555555555555'
const FRIEND_NAME = process.env.FRIEND_NAME || 'ปิยะพงษ์'   // a real Thai name — width depends on real text
// overridable so the WIDEST birthdate the formatter can produce can be measured too. "The birthdate is
// 147.6px" is a fact about THIS date, never about the column — all twelve abbreviated months, day 23,
// time 14:05, measured at 430 where none of them wrap (ตู๋ ran this first on #414; these are my own
// re-run and they agree to 0.1px):
//
//   เม.ย. 150.3   พ.ค. 148.1   ก.พ. 147.7   พ.ย. 147.6   ต.ค. 147.1   ส.ค. 146.6
//   ก.ค. 146.5    ม.ค. 146.3   มี.ค. 146.3  ก.ย. 146.0   มิ.ย. 145.8  ธ.ค. 145.7
//
// 🔴 I GUESSED 'มี.ค.' WAS ONE OF THE WIDE ONES BY COUNTING GLYPHS, AND FILED THAT IN #418. It is not —
// at 146.3 it ties for third NARROWEST. Counting characters is not measuring width: 'มี.ค.' carries its
// extra mark above the line, where it costs no advance. The one I missed by guessing is 'พ.ค.' (148.1),
// which has fewer glyphs than 'พ.ย.' and is wider than it. Only a measurement orders these.
// A birthdate needing D px sits on one line iff viewport >= 244 + D, so 151 is the min-w that closes
// every month; 148 (this PR) closes ten of them. FRIEND_DOB=1995-04-23 gives the widest.
const FRIEND_DOB = process.env.FRIEND_DOB || '1995-11-23'   // CE, as the DB holds it → "23 พ.ย. 2538"
const FRIEND_TIME = process.env.FRIEND_TIME || '14:05'
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()
if (!KEY) throw new Error('no V2_PREVIEW_KEY — every /v2 page would answer 200 from /maintenance')

const b = await chromium.launch()
const rows = []
for (const w of WIDTHS) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const p = await ctx.newPage()
  // The row with the bug is the POPULATED person-2 row (two actions). Reaching it needs an identity and a
  // friend, so the CONTRACTS are mocked and the SCREEN is real. Nothing here touches a database.
  await ctx.addCookies([{ name: 'cookie-mumate-id', value: UID, domain: 'localhost', path: '/' }])
  await ctx.route('**/api/user*', (r) => r.fulfill({ json: {
    user_id: UID, name: 'มานี', surname: '', dob: '1997-05-04', time: '09:30', picture_url: '',
    payment: { is_not_expired: true },
  } }))
  await ctx.route('**/api/quota*', (r) => r.fulfill({ json: { friend: { remaining: 17 } } }))
  await ctx.route('**/api/member-with-friend/detail*', (r) => r.fulfill({ json: {
    friend_id: FID, name: FRIEND_NAME, surname: '', dob: FRIEND_DOB, time: FRIEND_TIME,
    is_remember_time: true, picture_url: '',
  } }))
  await ctx.route('**/api/member-with-friend*', (r) => r.fulfill({ json: [
    { id: FID, name: FRIEND_NAME, surname: '', picture_url: '', is_disable: false },
  ] }))
  await p.goto(`http://localhost:${PORT}/v2/service/compatibility/love`, { waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid="compat-screen"]')
  await p.click('[data-testid="compat-person2"]')
  await p.waitForSelector('[data-testid="compat-friend-list"]')
  await p.getByText(FRIEND_NAME).first().click()
  await p.waitForSelector('[data-testid="compat-person2-change"]', { timeout: 8000 })
  // 🔴 WAIT FOR THE BIRTHDATE ITSELF (#276). Waiting only for the button let the detail fetch still be in
  // flight, so the line counter found no element and returned null — which reads exactly like "no problem".
  await p.waitForSelector('[data-testid="compat-person2-dob"]', { timeout: 8000 })
  await p.evaluate(() => document.fonts.ready)

  const m = await p.evaluate(() => {
    const lineRects = (el) => {
      if (!el) return null
      const node = el.firstChild
      if (!node || node.nodeType !== Node.TEXT_NODE) return null
      const r = document.createRange(); r.selectNodeContents(node)
      const byTop = new Map()
      for (const x of Array.from(r.getClientRects())) {
        const k = Math.round(x.top)
        const cur = byTop.get(k)
        byTop.set(k, cur ? { l: Math.min(cur.l, x.left), r: Math.max(cur.r, x.right) } : { l: x.left, r: x.right })
      }
      return Array.from(byTop.entries()).sort((a, b) => a[0] - b[0])
        .map(([top, v]) => ({ top, x: +v.l.toFixed(1), w: +(v.r - v.l).toFixed(1) }))
    }
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null
      const r = e.getBoundingClientRect()
      return { x: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } }
    const dob = document.querySelector('[data-testid="compat-person2-dob"]')
    if (!dob) throw new Error('dob not rendered — refusing to report a measurement')
    const lines = lineRects(dob)
    const actions = document.querySelector('[data-testid="compat-person2-change"]')?.parentElement
    const ar = actions?.getBoundingClientRect()
    return {
      row1: box('[data-testid="compat-person1"]'),
      row2: box('[data-testid="compat-person2"]'),
      p1: (() => {
        const e = document.querySelector('[data-testid="compat-person1-dob"]')
        const ls = lineRects(e) ?? []
        const act = document.querySelector('[data-testid="compat-person1-edit"]')?.parentElement
        return { lines: ls.length, ink: ls.map((l) => l.w), col: box('[data-testid="compat-person1-dob"]')?.w,
                 text: e?.textContent,
                 actionsOnOwnLine: !!(act && e && act.getBoundingClientRect().top > e.getBoundingClientRect().top) }
      })(),
      dobText: dob.textContent,
      // 🔴 the two numbers side by side: the <p>'s own rect count vs the Range count.
      dobRectsOnElement: dob.getClientRects().length,
      dobLines: lines.length,
      dobInk: lines.map((l) => l.w),           // ink width per rendered line
      dobLineX: lines.map((l) => l.x),
      // where the horizontal budget actually goes, left to right
      col: box('[data-testid="compat-person2-dob"]'),   // the text column the dob may use
      actionsX: ar ? +ar.left.toFixed(1) : null,
      actionsW: ar ? +ar.width.toFixed(1) : null,
      actionsTop: ar ? Math.round(ar.top) : null,
      colTop: Math.round(dob.getBoundingClientRect().top),
    }
  })
  // the number the fix has to buy: ink of a single unwrapped line vs the column it has to live in
  m.deficit = m.dobLines > 1 ? '+' + (m.dobInk.reduce((a, b) => a + b, 0) - (m.col?.w ?? 0)).toFixed(1) + 'px short (approx)' : 'fits'
  m.actionsOnOwnLine = m.actionsTop !== null && m.colTop !== null && m.actionsTop > m.colTop
  rows.push({ label: LABEL, w, ...m })
  await p.screenshot({ path: join(OUT, `414-${LABEL}-${w}.png`) })
  await ctx.close()
}
console.log(JSON.stringify(rows, null, 1))
await b.close()
