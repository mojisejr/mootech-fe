// harness/run-compat-3c.ts — anchor for ดวงสมพงศ์ 3C: the BLUE HERO (Figma 636:18819, scope A).
// LENS = visual/presentation. Ground-truth = what the HERO renders per data shape. Composes goo's
// useCompatibilityResult; get-detail + mascot API route-mocked. The hero REPLACES the 2E-1 header chips +
// gradient score card (intentional spine rebuild — see compat-3c.verify-evidence.md).
//
// Invariants owned here (3C):
//   HERO — one navy frame holds ScoreRing (from overall) + tagline (gradeLabel) + a DERIVED highlights line
//     (best/worst dimension %) + the two people as mascot cards.
//   RULE 4 — mascot illustration hidden until goo's imageUrlV2 arrives; the person photo (imageProfile,
//     carried from the form) is hidden when opened from history (no carry) — like the birthdate; name always.
//   HIGHLIGHTS — derived from the dimensions the engine already returned (best %, worst %), not fabricated.
//
// TOOTH (proven live in compat-3c.verify-evidence.md):
//   • mut-fake-photo — render the person photo circle even when imageProfile is absent (a fabricated/fallback
//     avatar). The rule-4 assertion (photo hidden on the history/no-carry render) then sees a photo → CAUGHT.
//
// Run (dev up :3028 with env):  CAPTURE_HOST=http://localhost:3028 npx tsx harness/run-compat-3c.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3028'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const PHOTO = '/images/v2/zone4/mascot-leaf.png' // a shipped asset, stands in for the carried real photo
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

type Dim = { key: string; label: string; percent: number; grade: string; ratingText?: string }
const LOVE_DIMS: Dim[] = [
  { key: 'destiny', label: 'คู่บุญ / คู่กรรม', percent: 70, grade: 'B-', ratingText: 'เกื้อหนุนกัน' },
  { key: 'family', label: 'ความเข้ากันของครอบครัว', percent: 60, grade: 'C', ratingText: 'พอไปได้' },
  { key: 'body', label: 'ความใกล้ชิดทางกาย', percent: 38, grade: 'D+', ratingText: 'ต้องดูแล' },
]
const COLLEAGUE_DIMS: Dim[] = [
  { key: 'work', label: 'เข้าขากันในงาน', percent: 82, grade: 'A-', ratingText: 'ดี' },
  { key: 'trust', label: 'ความไว้ใจ', percent: 55, grade: 'C+', ratingText: 'กลางๆ' },
  { key: 'goal', label: 'เป้าหมายร่วม', percent: 30, grade: 'D', ratingText: 'ต่างกัน' },
]

function detailBody(opts: { dims?: Dim[]; timeKnownB?: boolean; carry?: boolean } = {}) {
  const { dims = LOVE_DIMS, timeKnownB = true, carry = true } = opts
  const overall = { percent: 57, grade: 'C+', gradeLabel: 'ต้องปรับรับเข้าหากัน', hearts: 3, emoji: '🙂', ratingText: 'เป็นคนรักที่มีบทบาทหน้าที่สำคัญ พูดเก่ง ชอบเดิน' }
  const carried = carry ? { birthDate: '', imageProfile: PHOTO } : {}
  const a = { displayName: 'มิลา', dayGanzhi: '壬午', elementTh: 'น้ำ', stageTh: 'หยางน้ำ', nisai: ['ปรับตัวเก่ง'], timeKnown: true, fourPillars: { year: { stem: '壬', branch: '申', element: 'น้ำ' }, month: { stem: '甲', branch: '戌', element: 'ไม้' }, day: { stem: '庚', branch: '戌', element: 'ทอง' }, hour: { stem: '壬', branch: '戌', element: 'น้ำ' } }, ...(carry ? { birthDate: '1994-06-14', time: '09:30', imageProfile: PHOTO } : {}) }
  const b = { displayName: 'โปเตโต้', dayGanzhi: '戊子', elementTh: 'ดิน', stageTh: 'หยางดิน', nisai: ['มั่นคง'], timeKnown: timeKnownB, fourPillars: { year: { stem: '丙', branch: '午', element: 'ไฟ' }, month: { stem: '乙', branch: '未', element: 'ไม้' }, day: { stem: '己', branch: '丑', element: 'ดิน' }, hour: timeKnownB ? { stem: '甲', branch: '寅', element: 'ไม้' } : { stem: '', branch: '', element: '' } }, ...(carry ? { birthDate: '1992-08-01', time: '05:30', imageProfile: PHOTO } : {}) }
  void carried
  return JSON.stringify({ result: JSON.stringify({ pairMatch: { overall, dimensions: dims, persons: { a, b }, elementInteraction: { aElementTh: 'น้ำ', bElementTh: 'ดิน', summaryTh: 'ต้องปรับตัว', aToB: { labelTh: 'ดินข่มน้ำ', relation: 'พิฆาต' } } } }) })
}

async function wire(page: Page, body: string, mascotImg?: string) {
  await page.route((u) => u.pathname.endsWith('/user-matching/detail'), (route) => route.fulfill({ status: 200, contentType: 'application/json', body }))
  await page.route((u) => u.pathname.includes('/api/bazi/mascot/'), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mascot: mascotImg ? { ganzhi: 'x', nameTh: 'โปเตโต้', nameEn: 'Potato', imageUrl: mascotImg } : null }) }))
}

async function load(browser: import('playwright').Browser, body: string, id: string, mascotImg?: string) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await seed(ctx)
  const page = await ctx.newPage()
  const errs: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await wire(page, body, mascotImg)
  await page.goto(`${HOST}/v2/service/compatibility/result/${id}`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-result-hero"]').waitFor({ timeout: 12000 })
  await page.waitForTimeout(400)
  return { ctx, page, errs }
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    // ---- 1) LOVE (real ships-now state: photo carried, NO mascot image yet) — hero invariants + D26 --------
    {
      const { ctx, page, errs } = await load(browser, detailBody({ dims: LOVE_DIMS }), 'LOVE')
      check('hero renders (one navy frame)', (await page.locator('[data-testid="compat-result-hero"]').count()) === 1)
      const heroText = await page.locator('[data-testid="compat-result-hero"]').innerText()
      check('ScoreRing lives in the hero (grade shown)', heroText.includes('C+'))
      check('tagline = gradeLabel', (await page.locator('[data-testid="compat-hero-tagline"]').innerText()).trim() === 'ต้องปรับรับเข้าหากัน')
      const hi = await page.locator('[data-testid="compat-hero-highlights"]').innerText()
      check('highlights DERIVED: จุดแข็ง = best dim (70%)', hi.includes('จุดแข็ง') && hi.includes('คู่บุญ') && hi.includes('70%'), hi.replace(/\n/g, ' '))
      check('highlights: จุดที่ต้องดูแล = worst dim (38%)', hi.includes('จุดที่ต้องดูแล') && hi.includes('38%'))
      check('both people in the hero (names)', (await page.locator('[data-testid="compat-result-person-a-name"]').count()) === 1 && (await page.locator('[data-testid="compat-result-person-b-name"]').count()) === 1)
      check('carried photo shows in the hero', (await page.locator('[data-testid="compat-result-person-a-photo"]').count()) === 1)
      check('birthdate shows when carried', (await page.locator('[data-testid="compat-result-person-a-birth"]').count()) === 1)
      check('NO mascot illustration yet (goo image absent → hidden, rule 4)', (await page.locator('[data-testid="compat-result-person-a-mascot"]').count()) === 0)
      check('sections still render below the hero (dims/element/people)', (await page.locator('[data-testid="compat-sec-dims"]').count()) === 1 && (await page.locator('[data-testid="compat-sec-element"]').count()) === 1 && (await page.locator('[data-testid="compat-sec-people"]').count()) === 1)
      check('console errors = 0', errs.length === 0, errs.join(' | '))
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-3c-love.png'), fullPage: true })
      await ctx.close()
    }

    // ---- 2) COLLEAGUE — D26 ------------------------------------------------------------------------------
    {
      const { ctx, page } = await load(browser, detailBody({ dims: COLLEAGUE_DIMS }), 'COLLEAGUE')
      check('COLLEAGUE highlights best = 82%', (await page.locator('[data-testid="compat-hero-highlights"]').innerText()).includes('82%'))
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-3c-colleague.png'), fullPage: true })
      await ctx.close()
    }

    // ---- 3) NO BIRTH TIME (D23) — person B ยาม "—"; D26 --------------------------------------------------
    {
      const { ctx, page } = await load(browser, detailBody({ dims: LOVE_DIMS, timeKnownB: false }), 'NOTIME')
      check('D23 ยาม note present (timeKnown=false)', (await page.locator('[data-testid="compat-pillar-hour-unknown"]').count()) >= 1)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-3c-notime.png'), fullPage: true })
      await ctx.close()
    }

    // ---- 4) HISTORY (no carry): NO fabricated real photo + NO birthdate (rule 4), name still shows.
    //         The avatar slot is NOT empty though — a Mumate-logo FALLBACK fills it (ฟีม 2026-08-03). That is a
    //         branded placeholder, NOT fabricated user data, so rule 4 (don't invent a real photo) still holds:
    //         `-photo` stays absent (mut-fake-photo still trips on it); `-avatar-fallback` is the legit stand-in.
    {
      const { ctx, page } = await load(browser, detailBody({ dims: LOVE_DIMS, carry: false }), 'HISTORY')
      check('rule-4: NO fabricated real photo when opened from history (no carry)', (await page.locator('[data-testid="compat-result-person-a-photo"]').count()) === 0)
      check('avatar fallback SHOWS when no photo (ฟีม 2026-08-03 — branded, not fabricated)', (await page.locator('[data-testid="compat-result-person-a-avatar-fallback"]').count()) === 1)
      check('rule-4: NO birthdate when no carry', (await page.locator('[data-testid="compat-result-person-a-birth"]').count()) === 0)
      check('name STILL shows (always-present label)', (await page.locator('[data-testid="compat-result-person-a-name"]').count()) === 1)
      await ctx.close()
    }

    // ---- 5) LAYOUT with mascot image (MOCK — proves the layout accepts goo's future imageUrlV2) ----------
    {
      const { ctx, page } = await load(browser, detailBody({ dims: LOVE_DIMS }), 'WITHIMG', '/images/v2/bg/BG01.png')
      check('mascot illustration shows when an image IS provided', (await page.locator('[data-testid="compat-result-person-a-mascot"]').count()) === 1)
      await page.screenshot({ path: path.join(SHOT_DIR, 'compat-3c-hero-withimg-MOCK.png'), fullPage: true })
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
