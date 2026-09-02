// #585 ก้อน 6 — the FIRST pixels of the colleague result route. Everything before this was jsdom.
//
// The API is route-mocked at the network edge, not stubbed in the app: the page, its hook, the union
// state machine and the real seat ordering all run. The payload shape is the GET route's own envelope
// (pages/api/v2/matching/work/[id].ts:85-92) and the role strings are the engine's literals
// (bazi-sft-dataset src/lib/bazi/pair-matching.ts:191-193, branch pdf-dev).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3210'
const OUT = process.env.OUT || '/tmp/eye-585'
mkdirSync(OUT, { recursive: true })

const BOSS = { perspective: 'ตัวเรา → เจ้านาย', stageName: 'เจ๊าะ', narrative: 'ตัวเราทํางานร่วมกับหัวหน้า เจ้าของ ด้วยความยากลําบาก แต่ได้รับความไว้วางใจในระยะยาว' }
const SUB = { perspective: 'ลูกน้อง → ตัวเรา', stageName: 'เจ๊าะ', narrative: 'ลูกน้องคนนี้ทำงานเร็วแต่ข้ามขั้นตอน ต้องวางกรอบให้ชัดตั้งแต่ต้น ไม่งั้นจะสร้างงานซ่อมตามหลัง' }
const PARTNER = { perspective: 'หุ้นส่วน/เพื่อนร่วมงาน', stageName: 'เจ๊าะ', narrative: 'หุ้นส่วนที่กล้าลงทุนแต่ไม่ชอบทำบัญชี จับคู่กับคนที่ละเอียดแล้วจะไปได้ไกล' }

const person = (n, s, url) => ({ slot: s, friendId: `f-${s}`, name: n, surname: '', pictureUrl: url || '', timeKnown: true })

const ENTRIES = [
  // arrives shuffled on purpose — the screen must still seat them boss, sub, partner
  { rank: 1, slot: 0, person: person('กัสสรนาดี', 0), rankScore: 95, grade: 'A', ratingText: 'เข้ากันได้ดีมาก ทำงานด้วยแล้วงานเดิน ไม่ต้องตามซ้ำ', roles: [PARTNER, BOSS, SUB], rolesComplete: true, rolesMissing: 0, rankFromEngine: true },
  { rank: 2, slot: 2, person: person('ปินหยก', 2), rankScore: 75, grade: 'B', ratingText: 'พอไปได้ ต้องคุยกันให้ชัดก่อนเริ่ม', roles: [BOSS, SUB, PARTNER], rolesComplete: true, rolesMissing: 0, rankFromEngine: true },
  // ③ the engine skipped his middle reading, and ④ his position is OURS, not the engine's
  { rank: 3, slot: 1, person: person('สมชาย', 1), rankScore: 55, grade: 'C+', ratingText: 'ต้องใช้เวลาปรับจูนกันพอสมควร', roles: [PARTNER, BOSS], rolesComplete: false, rolesMissing: 1, rankFromEngine: false },
]

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 393, height: 850 }, deviceScaleFactor: 2 })
await ctx.addCookies([
  { name: 'v2_access', value: 'local-testenv', url: BASE },
  { name: 'cookie-mumate-id', value: 'b54b765a-c01b-471f-bf7c-0c2a1a448bdd', url: BASE },
])

let served = 0
await ctx.route('**/api/v2/matching/work/**', async (route) => {
  served++
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, matching_id: 'm-1', create_at: '2026-09-02T02:00:00Z', entries: ENTRIES }),
  })
})

const p = await ctx.newPage()
await p.goto(`${BASE}/v2/service/compatibility/work/m-1`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.waitForSelector('[data-testid="work-roles"]', { timeout: 30000 })
await p.waitForTimeout(600)

// 🔴 measure what the pixels are supposed to prove, so a screenshot that LOOKS right can still fail
const read = async () => p.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const box = q('[data-testid="work-roles"]')
  return {
    roleHeadings: Array.from(box?.querySelectorAll('h3') ?? []).map((e) => e.textContent),
    rolePairs: Array.from(box?.querySelectorAll('section') ?? []).map((e) => [
      e.getAttribute('data-perspective'),
      (e.querySelector('[data-testid^="work-role-narrative-"]')?.textContent ?? '').slice(0, 18),
    ]),
    badges: Array.from(document.querySelectorAll('[data-testid^="work-rank-badge-"]')).map((e) => e.getAttribute('data-testid')),
    rows: document.querySelectorAll('[data-testid="work-ranked-list"] li').length,
    incomplete: q('[data-testid="work-roles-incomplete"]')?.textContent?.trim() ?? null,
    // horizontal overflow is a bug the eye misses at one width
    bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
  }
})

console.log('TAB1', JSON.stringify(await read(), null, 1))
await p.screenshot({ path: `${OUT}/work-result-393-tab1.png`, fullPage: true })

await p.click('[data-testid="work-tab-3"]')
await p.waitForTimeout(500)
console.log('TAB3', JSON.stringify(await read(), null, 1))
await p.screenshot({ path: `${OUT}/work-result-393-tab3.png`, fullPage: true })

console.log('api calls served:', served, '(0 would mean the app never asked, and the shot is of a mock we never used)')
await b.close()
