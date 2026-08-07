// harness/run-compat-result.ts — anchor for the ดวงสมพงศ์ result screen (Slice 2E-1, Figma 636:18819).
// LENS = visual/presentation. Ground-truth = the RENDERED result @393, not the hook's return value.
// COMPOSES goo's useCompatibilityResult (2C) + reuses the 2D LoadingScreen. This owns the 2E-1 spine's
// presentation invariants; the calc button's fire-once state-machine lives on the picker (asserted by its
// own logic + tsc; a browser fire-once proof rides with 2E-2's dimensions when the picker is fully mounted).
//
// Invariants owned here (2E-1):
//   D17  the reusable LoadingScreen mounts on the real "รอผลคำนวณ" read (role=status while get-detail pends).
//   D20  the header title is exactly "ผลดวงสมพงศ์" — NOT "รายละเอียดวัน" (the Figma copy-paste typo).
//   score/overview render from overall (grade+%, ratingText via SectionCard).
//   rule-4 HIDE-ABSENT — birthDate present → the birth line shows; birthDate ABSENT → the line is HIDDEN,
//        never a fabricated date (the direct-link / parked-"ล่าสุด" out-of-scope case ฟีม declared).
//   honest fallback — a malformed / no-pairMatch result → "ยังไม่พบผลลัพธ์", never a spinner or a fake block.
//
// TOOTH (proven live in compat-result.verify-evidence.md):
//   • mut-birth-fake — make HeaderPerson render a hardcoded date when birthDate is absent (instead of hiding
//     the line). The rule-4 assertion (#hide-absent) then sees a birth line on the no-birthDate render →
//     CAUGHT. This is the exact silent-default/rule-4 bug: the screen inventing a birthday nobody entered.
//
// Run (dev up on :3022):  next dev -p 3022
//   CAPTURE_HOST=http://localhost:3022 npx tsx harness/run-compat-result.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3022'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const SHOT = path.resolve(process.cwd(), 'harness/pixel-proof/compat-result-2e1-393.png')

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

// a full result blob (get-detail returns { result: "<json string>" }; the rich data lives under .pairMatch)
function detailBody(opts: { birthDateA?: string } = {}) {
  const pairMatch = {
    overall: { percent: 82, grade: 'A', gradeLabel: 'เข้ากันดีมาก', hearts: 4, emoji: '💞', ratingText: 'โดยรวมเป็นความสัมพันธ์ที่หนุนกันได้ดี เข้าใจกันในระยะยาว' },
    persons: {
      a: { displayName: 'มิลา', birthDate: opts.birthDateA, time: '09:30', dayGanzhi: '壬午', elementTh: 'น้ำ' },
      b: { displayName: 'ก้อง', birthDate: '1992-08-01', time: '05:30', dayGanzhi: '戊子', elementTh: 'ดิน' },
    },
  }
  return JSON.stringify({ result: JSON.stringify({ pairMatch }) })
}

async function routeDetail(page: Page, body: string, delayMs = 0) {
  await page.route('**/user-matching/detail**', async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}

async function main() {
  const browser = await chromium.launch()
  try {
    // ---- 1) happy path (birthDate present) + D17 loader (slow mock) --------------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      const errs: string[] = []
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
      await routeDetail(page, detailBody({ birthDateA: '1994-06-14' }), 700)
      await page.goto(`${HOST}/v2/service/compatibility/result/TEST-MATCH-1`, { waitUntil: 'commit' })
      // D17: while get-detail pends (700ms mock delay), the reusable LoadingScreen (role=status) is up.
      // waitFor (not an eager isVisible) — the loader must appear before the result replaces it.
      const loaderSeen = await page.locator('[role="status"]').waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)
      check('D17 LoadingScreen mounts while calc reads', loaderSeen)
      await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 8000 })

      const title = (await page.locator('[data-testid="compat-result-title"]').innerText()).trim()
      check('D20 title = "ผลดวงสมพงศ์"', title === 'ผลดวงสมพงศ์', title)
      const score = await page.locator('[data-testid="compat-result-score"]').innerText()
      check('score renders (grade+%)', /A/.test(score) && /82%/.test(score), score.replace(/\s+/g, ' ').slice(0, 40))
      const overview = await page.locator('[data-testid="compat-result-overview"]').innerText()
      check('ภาพรวม = overall.ratingText', overview.includes('หนุนกันได้ดี'))
      const birthA = await page.locator('[data-testid="compat-result-person-a-birth"]').count()
      check('birth line SHOWS when birthDate present', birthA === 1)
      check('console errors = 0', errs.length === 0, errs.join(' | '))
      await page.screenshot({ path: SHOT })
      console.log(`  📸 ${SHOT}`)
      await ctx.close()
    }

    // ---- 2) rule-4: birthDate ABSENT → birth line HIDDEN (the tooth's target) ----------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await routeDetail(page, detailBody({ birthDateA: undefined }))
      await page.goto(`${HOST}/v2/service/compatibility/result/TEST-MATCH-2`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 8000 })
      const birthA = await page.locator('[data-testid="compat-result-person-a-birth"]').count()
      check('rule-4: birth line HIDDEN when birthDate absent', birthA === 0, `count=${birthA}`)
      await ctx.close()
    }

    // ---- 3) honest fallback: malformed / no pairMatch → "ยังไม่พบผลลัพธ์" --------------------------
    {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
      await seed(ctx)
      const page = await ctx.newPage()
      await routeDetail(page, JSON.stringify({ result: 'not-a-pairmatch-blob' }))
      await page.goto(`${HOST}/v2/service/compatibility/result/TEST-MATCH-3`, { waitUntil: 'commit' })
      await page.locator('[data-testid="compat-result-screen"][data-state="empty"]').waitFor({ timeout: 8000 })
      const txt = await page.locator('[data-testid="compat-result-screen"]').innerText()
      check('fallback: honest "ยังไม่พบผลลัพธ์" (no spinner/fake)', txt.includes('ยังไม่พบผลลัพธ์'))
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
