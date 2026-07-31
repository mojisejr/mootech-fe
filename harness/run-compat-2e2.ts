// harness/run-compat-2e2.ts — anchor for ดวงสมพงศ์ 2E-2 (the rest of the result page, Figma 636:18819).
// LENS = visual/presentation. Ground-truth = what the RESULT screen RENDERS per data shape. Composes goo's
// useCompatibilityResult; get-detail + the mascot API are route-mocked (no BE). pages/matching & api-user-
// matching are import-only.
//
// Invariants owned here (2E-2):
//   D22 รายมิติ — dimensions render VERBATIM; the tone badge follows ฟีม's threshold END-TO-END (all A + B+ →
//       จุดแข็ง; all D + F → ต้องดูแล; C*/B/B- → none). D25 grade colours from the scale, no new hex.
//   D45 ปฏิกิริยาธาตุ + D44 สี่เสา — element chips + summary; per-person 4-pillar table.
//   D23 — timeKnown === false → the ยาม (hour) column shows "—" + the note, never an invented pillar.
//   D21 รายคน + D46 มาสคอต — per-person nisai; a null mascot hides its card.
//   D47 — a tab appears ONLY for a section that has data (ฟีม: no empty tab); < 2 sections → NO tab bar.
//   GOLDEN RULE 6 — with ONLY overall (no dims/element/people), the page is pixel-identical to the shipped
//       2E-1 spine (the tabs render null; nothing new paints). Proven by the swap-diff in run-compat-2e2-golden.ts.
//
// TOOTH (proven live in compat-2e2.verify-evidence.md):
//   • mut-hour-fake — render a real hour pillar when timeKnown === false (instead of "—"). The D23 assertion
//     (ยาม column shows "—" + the note) then sees a fabricated birth-hour → CAUGHT. Rule-4 silent-default.
//
// Run (dev up on :3027 with env):
//   set -a; . testenv/env/fe.env; set +a; next dev -p 3027
//   CAPTURE_HOST=http://localhost:3027 npx tsx harness/run-compat-2e2.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3027'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const SHOT_DIR = path.resolve(process.cwd(), 'harness/pixel-proof')

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY'); return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
const check = (name: string, ok: boolean, detail = '') => { console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`); if (!ok) failed++ }

async function seed(ctx: BrowserContext) {
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
}

type Dim = { key: string; label: string; percent: number; grade: string; ratingText: string; isMain?: boolean }
const LOVE_DIMS: Dim[] = [
  { key: 'destiny', label: 'คู่บุญ / คู่กรรม', percent: 95, grade: 'A', ratingText: 'เกื้อหนุนกันในระยะยาว', isMain: true },
  { key: 'family', label: 'ความเข้ากันของครอบครัว', percent: 78, grade: 'B+', ratingText: 'พ่อแม่ยอมรับได้' },
  { key: 'life', label: 'วาสนาการเป็นคู่ชีวิต', percent: 55, grade: 'C+', ratingText: 'ต้องประคับประคอง' },
  { key: 'friend', label: 'มิตรภาพ / ความเข้าใจ', percent: 42, grade: 'C-', ratingText: 'วิธีคิดคนละแบบ' },
  { key: 'body', label: 'ความใกล้ชิด / เสน่หาทางกาย', percent: 15, grade: 'D-', ratingText: 'แรงดึงดูดไม่ได้มาเอง' },
]
const COLLEAGUE_DIMS: Dim[] = [
  { key: 'work', label: 'เข้าขากันในงาน', percent: 88, grade: 'A-', ratingText: 'ทำงานเป็นทีมได้ดี', isMain: true },
  { key: 'trust', label: 'ความไว้ใจ', percent: 70, grade: 'B', ratingText: 'เชื่อใจกันได้ในระดับหนึ่ง' },
  { key: 'comm', label: 'การสื่อสาร', percent: 50, grade: 'C', ratingText: 'ต้องเปิดใจคุยกันมากขึ้น' },
  { key: 'goal', label: 'เป้าหมายร่วม', percent: 30, grade: 'D+', ratingText: 'มองคนละทาง ต้องจูนกัน' },
]

function detailBody(opts: { dims?: Dim[]; timeKnownB?: boolean; fakeHour?: boolean; minimal?: boolean } = {}) {
  const { dims, timeKnownB = true, fakeHour = false, minimal = false } = opts
  const overall = { percent: 82, grade: 'A', gradeLabel: 'เข้ากันดีมาก', hearts: 4, emoji: '💞', ratingText: 'โดยรวมหนุนกันได้ดี เข้าใจกันในระยะยาว' }
  if (minimal) return JSON.stringify({ result: JSON.stringify({ pairMatch: { overall, persons: { a: { displayName: 'มิลา' }, b: { displayName: 'ก้อง' } } } }) })
  const hourB = timeKnownB || fakeHour ? { stem: '甲', branch: '寅', element: 'ไม้' } : { stem: '', branch: '', element: '' }
  const pairMatch = {
    overall,
    dimensions: dims,
    persons: {
      a: { displayName: 'มิลา', dayGanzhi: '壬午', elementTh: 'น้ำ', stageTh: 'หยางน้ำ', nisai: ['ปรับตัวเก่ง มีไหวพริบ', 'บางครั้งคิดมาก'], timeKnown: true, fourPillars: { year: { stem: '壬', branch: '申', element: 'น้ำ' }, month: { stem: '甲', branch: '戌', element: 'ไม้' }, day: { stem: '庚', branch: '戌', element: 'ทอง' }, hour: { stem: '壬', branch: '戌', element: 'น้ำ' } } },
      b: { displayName: 'ก้อง', dayGanzhi: '戊子', elementTh: 'ดิน', stageTh: 'หยางดิน', nisai: ['มั่นคง หนักแน่น'], timeKnown: timeKnownB, fourPillars: { year: { stem: '丙', branch: '午', element: 'ไฟ' }, month: { stem: '乙', branch: '未', element: 'ไม้' }, day: { stem: '己', branch: '丑', element: 'ดิน' }, hour: hourB } },
    },
    elementInteraction: { aElementTh: 'น้ำ', bElementTh: 'ดิน', summaryTh: 'ฝ่ายเขามีพลังกำกับและกดดันฝ่ายเรา ความสัมพันธ์จึงต้องอาศัยการปรับตัว', aToB: { labelTh: 'ดินข่มน้ำ', relation: 'พิฆาต' } },
  }
  return JSON.stringify({ result: JSON.stringify({ pairMatch }) })
}

async function wire(page: Page, body: string) {
  await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (route) => route.fulfill({ status: 200, contentType: 'application/json', body }))
  // mascots (D46) — the hook fetches /api/bazi/mascot/<ganzhi>
  await page.route((u) => u.pathname.includes('/api/bazi/mascot/'), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mascot: { ganzhi: 'x', nameTh: 'โปเตโต้', nameEn: 'Potato', imageUrl: '' } }) }))
}

async function load(browser: import('playwright').Browser, body: string, id: string) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await seed(ctx)
  const page = await ctx.newPage()
  const errs: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await wire(page, body)
  await page.goto(`${HOST}/v2/service/compatibility/result/${id}`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 12000 })
  return { ctx, page, errs }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    // ---- 1) LOVE: 5 dims + tone threshold end-to-end + all sections + tabs + D26 shot -------------------
    {
      const { ctx, page, errs } = await load(browser, detailBody({ dims: LOVE_DIMS }), 'LOVE')
      check('D47 tab bar shows (4 sections have data)', (await page.locator('[data-testid="compat-result-tabs"]').count()) === 1)
      check('D47 exactly 4 tabs', (await page.locator('[data-testid^="compat-tab-"]').count()) === 4)
      check('D22 all 5 dimension cards render', (await page.locator('[data-testid="compat-dim-card"]').count()) === 5)
      // tone threshold END-TO-END: A + B+ → จุดแข็ง (2); D- → ต้องดูแล (1); C+/C- → none. total 3 badges.
      const badges = await page.locator('[data-testid="compat-dim-tone"]').allInnerTexts()
      check('D22 tone: exactly 3 badges (A + B+ strong, D- watch; C+/C- none)', badges.length === 3, JSON.stringify(badges))
      check('D22 tone: 2× จุดแข็ง (A + B+)', badges.filter((b) => b.includes('จุดแข็ง')).length === 2)
      check('D22 tone: 1× ต้องดูแล (D-)', badges.filter((b) => b.includes('ต้องดูแล')).length === 1)
      check('D45 ปฏิกิริยาธาตุ renders', (await page.locator('[data-testid="compat-element-interaction"]').count()) === 1)
      check('D44 สี่เสา renders for both persons', (await page.locator('[data-testid="compat-fourpillars"]').count()) === 2)
      check('D21 รายคน renders for both persons', (await page.locator('[data-testid="compat-person-detail"]').count()) === 2)
      check('D46 มาสคอต card renders', (await page.locator('[data-testid="compat-mascot-card"]').count()) >= 1)
      // tab click scrolls → the section is in view (data-active updates)
      await page.locator('[data-testid="compat-tab-people"]').click()
      const active = await page.locator('[data-testid="compat-tab-people"]').getAttribute('data-active')
      check('D47 tab click sets active', active === 'true')
      check('console errors = 0', errs.length === 0, errs.join(' | '))
      await page.locator('[data-testid="compat-tab-overview"]').click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2e2-love.png'), fullPage: true })
      await ctx.close()
    }

    // ---- 2) COLLEAGUE: 4 dims + D26 shot ---------------------------------------------------------------
    {
      const { ctx, page } = await load(browser, detailBody({ dims: COLLEAGUE_DIMS }), 'COLLEAGUE')
      check('COLLEAGUE: 4 dimension cards', (await page.locator('[data-testid="compat-dim-card"]').count()) === 4)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2e2-colleague.png'), fullPage: true })
      await ctx.close()
    }

    // ---- 3) UNKNOWN TIME (D23): person B timeKnown=false → ยาม "—" + note; D26 shot ---------------------
    {
      const { ctx, page } = await load(browser, detailBody({ dims: LOVE_DIMS, timeKnownB: false }), 'NOTIME')
      const hourCells = await page.locator('[data-testid="compat-pillar-ยาม"]').allInnerTexts()
      // person B's ยาม cell must be the "—" (unknown), not a fabricated pillar
      check('D23 a ยาม note present (timeKnown=false)', (await page.locator('[data-testid="compat-pillar-hour-unknown"]').count()) >= 1)
      check('D23 an unknown ยาม column shows "—" not a real pillar', hourCells.some((c) => c.includes('—')), JSON.stringify(hourCells))
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-2e2-notime.png'), fullPage: true })
      await ctx.close()
    }

    // ---- 4) MINIMAL (golden-rule-6 state): only overall → NO tabs, NO new sections, spine only ----------
    {
      const { ctx, page } = await load(browser, detailBody({ minimal: true }), 'MIN')
      check('minimal: NO tab bar (< 2 sections with data)', (await page.locator('[data-testid="compat-result-tabs"]').count()) === 0)
      check('minimal: NO รายมิติ section', (await page.locator('[data-testid="compat-sec-dims"]').count()) === 0)
      check('minimal: NO ธาตุ&เสา section', (await page.locator('[data-testid="compat-sec-element"]').count()) === 0)
      check('minimal: NO รายคน section', (await page.locator('[data-testid="compat-sec-people"]').count()) === 0)
      check('minimal: spine still present (score + ภาพรวม)', (await page.locator('[data-testid="compat-result-score"]').count()) === 1 && (await page.locator('[data-testid="compat-result-overview"]').count()) === 1)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
