// harness/run-home-chart-cache.ts — P3 home chart-cache WIRING proof (runtime lens · goo).
//
// The pure-module tests (scripts/chart-cache.test.ts + scripts/home-loading.test.ts) pin the cache's
// INVARIANTS (self-heal, memory-only, money-bug boundary) but they cannot see whether useV2Home actually
// CONSULTS the cache on the real screen — that wiring is exactly the class ตู๋ flagged on P2 (F1: "the
// wiring invariants were untested"). So prove it on the ship path by COUNTING the browser's chart fetch
// (GET /api/chinese-horoscope) across a real tab-switch, the same shape as harness/run-calendar-month.ts:
//
//   cold        first home mount → the chart IS fetched once (≥1) — we are exercising the real data path,
//               not a vacuous 0.
//   spa-return  leave home via the bottom-nav (CLIENT-SIDE next/link — JS memory survives) then come back:
//               the in-memory cache serves the mascot → the chart is NOT re-fetched (Δ = 0). ← DoD#1 wiring
//   reload      a FULL reload wipes module memory (the cache is memory-only by design, P3 DoD#4) → the
//               chart IS re-fetched again (Δ > 0). This is the harness's POSITIVE CONTROL: it proves the
//               counter is actually live and would turn RED if a spa-return ever re-fetched — without it,
//               "Δ = 0 on return" could be a 0-from-0 vacuum (e.g. if the fetch never fired at all).
//
// So the verdict rests on BOTH movements: return costs 0 (cache wired) AND reload costs >0 (counter real).
// Response bodies are STUBBED (route interception) so this needs NO backend and runs anywhere `next dev`
// is up — the COUNT of requests is decided in the browser's JS upstream of the network, so stubbing the
// reply never weakens it: the request either left the page or it did not.
//
//   npx tsx harness/run-home-chart-cache.ts        (dev server up; HARNESS_HOST + V2_PREVIEW_KEY env-overridable)
import { chromium, type Browser, type Page } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  for (const f of ['testenv/env/fe.env', '.env.local', '.env']) {
    try {
      const l = fs.readFileSync(f, 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
      if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
    } catch {}
  }
  return 'lamun-local-dev'
}
const KEY = gateKey()
const isPath = (url: string, p: string) => { try { return new URL(url).pathname === p } catch { return false } }

// A RETURNING user with a computed chart: user_id present + non-empty result_code + is_refresh=false →
// resolveReturningResult → home path (NOT register), so useV2Home reaches the ChineseHoroscopeGet call.
// The cookie-mumate-id MUST be a real uuid: resolveAuth only reports 'authed' for a UUID_RE-valid id
// (a non-uuid → 'loading'/'anon' → the home never renders). This is a fixed fixture uuid, not a real user.
const USER_ID = '00000000-0000-4000-8000-000000000001'
const RESULT_CODE = 'RCharness01' // constant → every remount's isChartFresh(userId, RESULT_CODE) MATCHES the cache
const RESULT_CODE_2 = 'RCharness02' // the "dob edited" code — simulates BE minting a NEW result_code (item A)
const userRow = (resultCode: string) => ({
  user_id: USER_ID, result_code: resultCode, is_refresh: false,
  name: 'ทดสอบ ชาร์ต', dob: '1990-06-15', gender: 'MALE', place_name: 'กรุงเทพมหานคร',
  is_remember_time: false, picture_url: null, payment: { is_not_expired: true },
})
// Minimal chart envelope { data: <chart> } — toComputeSource reads detail.yearBelow + detail.dayAbove.element,
// so the greeting ธาตุ row (element-line) renders (proving the mascot un-greyed with real data, not fallback).
const CHART = { data: { detail: { yearBelow: { constellation: 'ม้า', id: 6 }, dayAbove: { element: 'ไฟ' } } } }

async function newHome(browser: Browser): Promise<{ page: Page; chartCount: () => number; setResultCode: (c: string) => void }> {
  let liveResultCode = RESULT_CODE // mutable so a scenario can simulate a dob edit (BE mints a new code)
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const host = new URL(HOST).hostname
  // v2 preview gate cookie + identity — set directly, same as run-calendar-month.ts. On CI the gate key
  // comes from the job env (V2_PREVIEW_KEY, design-verify.yml:32) which gateKey() reads before any file,
  // so cookie and server agree.
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'ทดสอบ ชาร์ต', domain: host, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  // COUNT the chart fetch at the REQUEST level (fires even if upstream is down — the ground truth of "did
  // the page try to fetch the chart"), BEFORE any navigation so the very first mount is captured.
  const chartReqs: string[] = []
  page.on('request', (r) => { if (isPath(r.url(), '/api/chinese-horoscope')) chartReqs.push(r.url()) })
  // Stubs: identity row (→ home path) + the chart (→ mascot). home-fortune is stubbed benign so the fortune
  // zone doesn't error-spam; its failure would not touch the chart count regardless.
  await page.route((u) => isPath(u.toString(), '/api/user'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(userRow(liveResultCode)) }))
  await page.route((u) => isPath(u.toString(), '/api/chinese-horoscope'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CHART) }))
  await page.route((u) => isPath(u.toString(), '/api/home-fortune'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fortune: null, persona: null }) }))
  return { page, chartCount: () => chartReqs.length, setResultCode: (c) => { liveResultCode = c } }
}

// element-line present (not its skeleton) == the mascot ธาตุ row is showing real data (un-greyed).
const mascotShown = (page: Page) => page.locator('[data-testid="element-line"]').count().then((n) => n > 0)

async function main() {
  const browser = await chromium.launch()
  const { page, chartCount, setResultCode } = await newHome(browser)

  // ── cold: first home mount ──
  await page.goto(`${HOST}/v2`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="home-header"]').waitFor({ timeout: 15000 })
  await page.locator('[data-testid="element-line"]').waitFor({ timeout: 15000 }) // chart landed → mascot shows
  await page.waitForTimeout(400)
  const cold = chartCount()
  const coldMascot = await mascotShown(page)

  // ── spa-return: leave home CLIENT-SIDE via bottom-nav (JS memory survives), then come back ──
  // target the TAB by its label span — a[href="/v2/service"] also matches the Mate AI button (same href).
  await page.locator('nav[aria-label="เมนูหลัก"] a:has(span:text-is("บริการ"))').click()
  await page.waitForURL((u) => new URL(u).pathname.startsWith('/v2/service'), { timeout: 10000 })
  await page.waitForTimeout(300)
  const afterLeave = chartCount() // home unmounted; no chart fetch happens off-home
  await page.locator('nav[aria-label="เมนูหลัก"] a:has(span:text-is("หน้าหลัก"))').click()
  await page.waitForURL((u) => new URL(u).pathname === '/v2', { timeout: 10000 })
  await page.locator('[data-testid="home-header"]').waitFor({ timeout: 10000 })
  // the mascot must be present WITHOUT waiting for a fetch — the cache serves it. give the effect a beat,
  // then assert element-line is up and NO new chart request was made.
  await page.waitForTimeout(600)
  const afterReturn = chartCount()
  const returnMascot = await mascotShown(page)
  const returnDelta = afterReturn - cold

  // ── reload: full reload wipes module memory (memory-only cache) → chart IS re-fetched (positive control) ──
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-testid="element-line"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  const afterReload = chartCount()
  const reloadDelta = afterReload - afterReturn

  // ── self-heal (DoD#2, the axis ตู๋ scrutinizes hardest): the live row now returns a NEW result_code
  //    (dob edited → BE mints a new code, item A). A spa-return finds the cached chart STALE
  //    (isChartFresh false) → it MUST re-fetch, not serve the stale mascot forever. ──
  setResultCode(RESULT_CODE_2)
  const beforeHeal = chartCount()
  await page.locator('nav[aria-label="เมนูหลัก"] a:has(span:text-is("บริการ"))').click()
  await page.waitForURL((u) => new URL(u).pathname.startsWith('/v2/service'), { timeout: 10000 })
  await page.locator('nav[aria-label="เมนูหลัก"] a:has(span:text-is("หน้าหลัก"))').click()
  await page.waitForURL((u) => new URL(u).pathname === '/v2', { timeout: 10000 })
  await page.locator('[data-testid="home-header"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  const afterHeal = chartCount()
  const healDelta = afterHeal - beforeHeal

  await browser.close()

  const coldOk = cold >= 1 && coldMascot
  const returnOk = returnDelta === 0 && returnMascot // cache served the mascot with 0 refetch (DoD#1 wiring)
  const controlOk = reloadDelta > 0 // the counter is live — a real refetch moves it (not a 0-from-0 vacuum)
  const healOk = healDelta > 0 // a new result_code → cache is stale → refetch fires (DoD#2 self-heal wired)
  const ok = coldOk && returnOk && controlOk && healOk

  const line = (b: boolean, s: string) => `  ${b ? '✓' : '✗'} ${s}`
  console.log('\n═══ HOME CHART-CACHE wiring (P3) ═══')
  console.log(line(coldOk, `cold mount: chart fetched ${cold}× (≥1) · mascot ธาตุ row shown=${coldMascot}`))
  console.log(line(returnOk, `spa-return (leave→back, client-side): chart Δ=${returnDelta} ⇒ ${returnDelta === 0 ? 'served from memory, 0 refetch' : 'RE-FETCHED ✗'} · mascot instant=${returnMascot}  [leave off-home=+${afterLeave - cold}]`))
  console.log(line(healOk, `self-heal (DoD#2): live row returns NEW result_code → spa-return re-fetches Δ=+${healDelta} ⇒ ${healOk ? 'stale cache healed, not stuck' : 'STALE served ✗'}`))
  console.log('  ── positive control (harness teeth) ──')
  console.log(line(controlOk, `full reload wipes memory → chart re-fetched Δ=+${reloadDelta} ⇒ ${controlOk ? 'counter is LIVE (would catch a broken cache)' : 'counter DEAD ✗'}`))
  // exit code IS the gate signal — print it IN the final summary line so a log reader sees the verdict tied
  // to the process code (ตู๋: a gate that runs but whose result nobody reads is not a gate). The CI job
  // captures $? right after this run and unions it into the pass/fail line.
  const code = ok ? 0 : 1
  console.log(`\n  ${ok ? '🟢 CHART-CACHE WIRING PASSED' : '🔴 FAILED'} — return costs 0 (cache wired) · new-code refetches (self-heal) · reload costs >0 (counter real)  [exit ${code}]\n`)
  process.exit(code)
}

main().catch((e) => { console.error('✗', e); process.exit(2) })
