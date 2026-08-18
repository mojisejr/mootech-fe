// harness/capture-daydetail-g2.ts — G-2 BROWSER PROOF (goo). Three things บอง asked to SEE, not be told:
//   A. ring-first-frame — on /v2/calendar the card ring shows a GRADE (from the month cell, จังหวะ-1) while
//      the day-detail text is still pending (empty). Proven by THROTTLING /api/v2/day-detail so the transient
//      "month loaded, detail pending" state stands still long enough to screenshot. If the ring only ever
//      shows a grade AFTER the text arrives, จังหวะ-1 is NOT proven — we assert both-at-once or fail loud.
//   B. anti-latch — clicking through dates on the /v2/calendar/[date] screen (DayStrip's next/link = CLIENT
//      nav = the SAME mounted page → useDayDetail(date) re-runs) yields THREE DISTINCT day sets, and the
//      click→render time is measured for each. This is the surface the alive-guard defends; the card can't
//      show it yet because its date is fixed at today until มุน's M-B (stated in the PR, not hidden).
//   C. latch teeth — with the slow date's response DELAYED past the fast one's, the final render is the LAST
//      date requested, never the stale slow one. A doneRef-latch or a stale-wins race would show the slow date.
//
// Requires the test-env stack booted from THIS worktree (goo verified: FE cwd = mootech-fe-wt-g4, DB 5433).
//   npx tsx harness/capture-daydetail-g2.ts
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const HOST = 'http://localhost:3000'
const ENV_FILE = 'testenv/env/fe.env'
const PASSKEY_VAR = 'V2_PREVIEW_KEY'
const OUT = path.resolve(process.cwd(), 'harness/captures')
const USER = { userId: '5c7befb3-ebd3-4740-989e-fd6a1cca9662', name: 'มิลา' } // fake test user, dob 1980-04-05

function readPasskey(): string {
  const file = path.resolve(process.cwd(), ENV_FILE)
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith(`${PASSKEY_VAR}=`))
  if (!line) throw new Error(`${PASSKEY_VAR} not in ${ENV_FILE}`)
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

async function login(page: Page, passkey: string) {
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  const loc = res.headers()['location'] ?? ''
  if (res.status() !== 303 || loc.includes('gate_error')) throw new Error(`passkey gate rejected (${res.status()} → ${loc})`)
  await page.goto(`${HOST}/dev-login`, { waitUntil: 'networkidle' })
  const inputs = page.locator('input')
  await inputs.nth(0).fill(USER.userId)
  await inputs.nth(1).fill(USER.name)
  await page.getByRole('button', { name: /dev login/i }).click()
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => {})
}

// client-side nav to a date on the [date] screen. Prefer the REAL DayStrip <Link> (product-loop); fall back to
// Next dev's router (window.next.router.push) — same router.push the Link fires — if the link isn't in the
// current DayStrip window. Returns how the nav was driven, for honest reporting.
async function navToDate(page: Page, date: string): Promise<'link-click' | 'router-push'> {
  const link = page.locator(`a[href="/v2/calendar/${date}"]`)
  if (await link.count()) {
    await link.first().click()
    return 'link-click'
  }
  await page.evaluate((d) => (window as unknown as { next: { router: { push: (u: string) => void } } }).next.router.push(`/v2/calendar/${d}`), date)
  return 'router-push'
}

// the day-detail text signature on the [date] screen — the score card's grade + summary. Empty/absent while
// the guard shows its spinner (detail null). We use this to detect "the new date's content has rendered".
async function dayScoreText(page: Page): Promise<string> {
  const el = page.locator('[data-testid="day-score"]')
  if (!(await el.count())) return '' // guard spinner is up (detail loading)
  return (await el.innerText()).replace(/\s+/g, ' ').trim()
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const passkey = readPasskey()
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
  await login(page, passkey)

  const log: string[] = []
  const say = (s: string) => { log.push(s); console.log(s) }

  // ══════════ PART A · ring first-frame ══════════
  say('\n═══ A · ring-first-frame (calendar card) ═══')
  let holdDetail = true // while true, /api/v2/day-detail is stalled → the "detail pending" window stands still
  await page.route('**/api/v2/day-detail', async (route) => {
    while (holdDetail) await new Promise((r) => setTimeout(r, 100))
    await route.continue()
  })
  await page.goto(`${HOST}/v2/calendar`, { waitUntil: 'domcontentloaded' })
  // wait until the card ring paints a grade (it can only come from the month cell — day-detail is stalled)
  await page.waitForSelector('[data-testid="calendar-daily-card"] [data-testid="fortune-grade"]', { timeout: 20000 })
  await page.waitForTimeout(300)
  const frameA = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="calendar-daily-card"]')!
    const grade = card.querySelector('[data-testid="fortune-grade"]')?.textContent?.trim() ?? ''
    const pct = card.querySelector('[data-testid="fortune-pct"]')?.textContent?.trim() ?? ''
    const headline = (card.querySelector('p.flex-1') as HTMLElement | null)?.textContent?.trim() ?? '∅NOFIND'
    const ganzhi = card.querySelector('[data-testid="fortune-ganzhi"]')?.textContent?.trim() ?? ''
    return { grade, pct, headline, ganzhi }
  })
  const fileA = path.join(OUT, 'g2-ringfirst__detail-pending.png')
  await page.screenshot({ path: fileA })
  const ringHasGrade = frameA.grade.length > 0
  const textEmpty = frameA.headline === '' || frameA.headline === '∅NOFIND'
  say(`  ring: grade="${frameA.grade}" pct="${frameA.pct}" ganzhi="${frameA.ganzhi}"  | headline="${frameA.headline}"`)
  say(`  ⇒ ring-has-grade=${ringHasGrade}  text-empty=${textEmpty}  ${ringHasGrade && textEmpty ? '✅ จังหวะ-1 PROVEN (ring from month cell, text still pending)' : '❌ NOT proven — REPORT honestly'}`)
  say(`  📸 ${path.basename(fileA)}`)
  // release the stall → the text resolves; screenshot the settled card so both frames are on record
  holdDetail = false
  await page.waitForFunction(() => {
    const h = document.querySelector('[data-testid="calendar-daily-card"] p.flex-1') as HTMLElement | null
    return !!h && (h.textContent ?? '').trim().length > 0
  }, null, { timeout: 20000 }).catch(() => {})
  const frameAresolved = await page.evaluate(() => (document.querySelector('[data-testid="calendar-daily-card"] p.flex-1') as HTMLElement | null)?.textContent?.trim() ?? '')
  const fileAr = path.join(OUT, 'g2-ringfirst__resolved.png')
  await page.screenshot({ path: fileAr })
  say(`  after release: headline="${frameAresolved}"  📸 ${path.basename(fileAr)}`)
  await page.unroute('**/api/v2/day-detail')

  // ══════════ PART B · anti-latch, 3 distinct sets + timing ══════════
  say('\n═══ B · anti-latch — 3 dates, client nav on the SAME mounted [date] page ═══')
  await page.goto(`${HOST}/v2/calendar/2026-08-05`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="day-score"]', { timeout: 20000 })
  const sets: Record<string, string> = {}
  sets['2026-08-05'] = await dayScoreText(page)
  say(`  05 (initial mount): ${sets['2026-08-05'].slice(0, 90)}`)
  for (const date of ['2026-08-06', '2026-08-07']) {
    const prev = await dayScoreText(page)
    const t0 = await page.evaluate(() => performance.now())
    const how = await navToDate(page, date)
    // wait until the score card shows the NEW date's content (text differs from prev; guard spinner passes through)
    await page.waitForFunction((p) => {
      const el = document.querySelector('[data-testid="day-score"]')
      return !!el && (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim() !== p
    }, prev, { timeout: 20000 })
    const dt = (await page.evaluate(() => performance.now())) - t0
    sets[date] = await dayScoreText(page)
    say(`  ${date.slice(8)} via ${how}: ${Math.round(dt)}ms  → ${sets[date].slice(0, 90)}`)
    await page.screenshot({ path: path.join(OUT, `g2-antilatch__${date}.png`) })
  }
  const distinct = new Set(Object.values(sets)).size
  say(`  ⇒ ${distinct}/3 distinct day sets  ${distinct === 3 ? '✅ each date its own data (no latch across real navs)' : '❌ dates collapsed — LATCH suspected'}`)

  // ══════════ PART C · latch teeth — slow date must NOT win ══════════
  // Uncached far dates (only today=08-05 is prefetched). Delay the FIRST (15) past the LAST (17); fire fast.
  say('\n═══ C · latch teeth — slow 08-15 delayed past fast 08-17, final must be 17 ═══')
  await page.goto(`${HOST}/v2/calendar/2026-08-14`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="day-score"]', { timeout: 20000 })
  await page.route('**/api/v2/day-detail', async (route) => {
    const body = route.request().postDataJSON() as { date?: string }
    if (body?.date === '2026-08-15') await new Promise((r) => setTimeout(r, 2500)) // slow the first-fired date
    await route.continue()
  })
  const before = await dayScoreText(page)
  // fire three client navs back-to-back WITHOUT awaiting render between them (the race)
  await navToDate(page, '2026-08-15')
  await navToDate(page, '2026-08-16')
  await navToDate(page, '2026-08-17')
  // settle: the URL is 17; wait for its content, then hold to let 15's delayed response (if unguarded) try to land
  await page.waitForFunction((b) => {
    const el = document.querySelector('[data-testid="day-score"]')
    return !!el && (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim() !== b && (el as HTMLElement).innerText.trim().length > 0
  }, before, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(3500) // > the 2500ms slow-15 delay → if a stale-wins race existed, 15 would clobber now
  const finalUrl = new URL(page.url()).pathname
  const finalText = await dayScoreText(page)
  const set17 = sets['2026-08-07'] // not comparable; instead compare against a fresh 17 read below
  await page.screenshot({ path: path.join(OUT, 'g2-latch__final-should-be-17.png') })
  // ground the assertion: navigate cleanly to 17 (fresh) and compare the settled text
  await page.unroute('**/api/v2/day-detail')
  await page.goto(`${HOST}/v2/calendar/2026-08-17`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="day-score"]', { timeout: 20000 })
  await page.waitForTimeout(500)
  const clean17 = await dayScoreText(page)
  const latchOk = finalUrl === '/v2/calendar/2026-08-17' && finalText === clean17
  say(`  after race+3.5s hold: url=${finalUrl}`)
  say(`  raced-final text == clean 08-17 text ? ${finalText === clean17}  ${latchOk ? '✅ slow-15 was DROPPED (alive-guard has teeth)' : '❌ final ≠ 17 — stale response won'}`)
  void set17

  const feBuild = (() => { try { return execSync(`git -C "${process.cwd()}" rev-parse --short HEAD`).toString().trim() } catch { return '?' } })()
  say(`\n🏷️ FE build @capture: ${feBuild} (worktree feat/g4-g2-g3-daydetail)`)
  say(`console errors during run: ${consoleErrors.length}${consoleErrors.length ? ' — ' + consoleErrors.slice(0, 3).join(' | ') : ''}`)
  say(`captures → ${path.relative(process.cwd(), OUT)}/`)
  fs.writeFileSync(path.join(OUT, 'g2-verify-run.log'), log.join('\n'))
  await browser.close()
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) })
