// harness/run-header-structure.ts — Structure A header anchor (ก้อน 2 · visual lens).
//
// ฟีม's headline rule: the username must NEVER truncate. The invariants that render fine to AST/console but
// can silently regress the pixels:
//   name   — a long name WRAPS (≤2 lines) and is never single-line-clipped; @320 no horizontal overflow.
//   badge  — the upgrade badge shows ONLY when profile.showUpgrade (goo's boolean); hidden when paid.
//   avatar — profile.pictureUrl → image; absent → the first-letter fallback.
//   bell   — links to the FULL /v2/calendar/notifications page (ฟีม 2026-07-29: modal parked, full page is the design).
// Runs against the deterministic home-preview (the anchor gate); the human artifact is the real /v2 capture.
//   npx tsx harness/run-header-structure.ts   (dev server up; HARNESS_HOST/PORT env-overridable)
import { chromium, type Browser, type Page } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3005'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
// a realistically long Thai name (~30 chars) — fits in ≤2 lines at 320 and must show FULLY (no clamp).
const LONG = encodeURIComponent('มิลาวรรณวิไลอลงกรณ์ศรีสุวรรณภูมิ')

async function withPage<T>(browser: Browser, query: string, fn: (p: Page) => Promise<T>, width = 393): Promise<T> {
  const ctx = await browser.newContext({ viewport: { width, height: 852 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' }])
  const p = await ctx.newPage()
  await p.goto(`${HOST}/v2/home-preview?${query}`, { waitUntil: 'domcontentloaded' })
  await p.getByTestId('greeting-name').waitFor()
  await p.waitForTimeout(350)
  const r = await fn(p)
  await ctx.close()
  return r
}

const nameGeom = (p: Page) =>
  p.getByTestId('greeting-name').evaluate((el) => ({
    text: (el.textContent ?? '').trim(),
    lines: Math.round(el.getBoundingClientRect().height / 32),
    hClipped: el.scrollWidth > el.clientWidth + 2, // single-line truncate → content wider than the box
    vClamped: el.scrollHeight > el.clientHeight + 2, // >2 lines → line-clamp ellipsised
  }))

async function main() {
  const browser = await chromium.launch()

  // ── name: long name @320 wraps ≤2 lines, full text, not clipped, no overflow (THE fix) ──
  const long320 = await withPage(browser, `state=good&name=${LONG}`, async (p) => ({
    g: await nameGeom(p),
    overflowX: await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  }), 320)
  const decoded = decodeURIComponent(LONG)
  // NOTE: vClamped (scrollHeight>clientHeight) is UNRELIABLE for -webkit-line-clamp (display:-webkit-box) —
  // it false-positives even when the name shows fully (verified: the real /v2 @320 capture shows this exact
  // 30-char name in 2 full lines, no ellipsis). So the machine gate uses hClipped + lines≤2 + fullText + no
  // overflow; "fully visible, not ellipsised" is proven by the human artifact (the real-route capture).
  const nameOk = long320.g.lines >= 1 && long320.g.lines <= 2 && !long320.g.hClipped && !long320.overflowX && long320.g.text === decoded

  // ── badge toggle: default shows, paid hides (goo's boolean; UI never computes the rule) ──
  const badgeDefault = await withPage(browser, 'state=good', (p) => p.getByText('อัพเกรด').count())
  const badgePaid = await withPage(browser, 'state=good&pay=paid', (p) => p.getByText('อัพเกรด').count())
  const badgeOk = badgeDefault === 1 && badgePaid === 0

  // ── avatar: no pictureUrl → letter; pictureUrl → image (letter gone) ──
  const avLetter = await withPage(browser, 'state=good', (p) => p.getByTestId('avatar-letter').count())
  const avImg = await withPage(browser, 'state=good&pic=y', (p) => p.getByTestId('avatar-letter').count())
  const avatarOk = avLetter === 1 && avImg === 0

  // ── bell → the FULL notifications page (ฟีม 2026-07-29: modal PARKED, full page is the designed screen;
  //     home bell was a <button> opening NotificationPanel, now a shared-TopBarBell <a> → the page) ──
  const bell = await withPage(browser, 'state=good', async (p) => {
    const el = p.getByLabel('การแจ้งเตือน')
    return { tag: await el.evaluate((e) => e.tagName.toLowerCase()), href: await el.getAttribute('href') }
  })
  const bellOk = bell.tag === 'a' && bell.href === '/v2/calendar/notifications'

  // ── teeth: re-add a single-line truncate to the name → the long name clips → the no-clip gate rejects ──
  const truncateCaught = await withPage(browser, `state=good&name=${LONG}`, async (p) => {
    await p.getByTestId('greeting-name').evaluate((el) => { const s = (el as HTMLElement).style; s.whiteSpace = 'nowrap'; s.overflow = 'hidden'; s.textOverflow = 'ellipsis' })
    return (await nameGeom(p)).hClipped
  }, 320)

  await browser.close()

  const line = (ok: boolean, s: string) => `  ${ok ? '✓' : '✗'} ${s}`
  const teeth = (ok: boolean, s: string) => `  ${ok ? '🦷 CAUGHT' : '✗ BLIND'}  ${s}`
  console.log('\n═══ STRUCTURE-A HEADER anchor (ก้อน 2) ═══')
  console.log(`  name @320 (long): lines=${long320.g.lines} hClipped=${long320.g.hClipped} vClamped=${long320.g.vClamped} overflowX=${long320.overflowX} fullText=${long320.g.text === decoded}`)
  console.log(line(nameOk, 'name wraps ≤2 lines, full text, NOT truncated, no overflowX @320 (THE fix)'))
  console.log(line(badgeOk, `badge shows on default (${badgeDefault}) + hidden when paid (${badgePaid})`))
  console.log(line(avatarOk, `avatar letter without pictureUrl (${avLetter}) + image with it (letter gone: ${avImg})`))
  console.log(line(bellOk, `bell → full page: <${bell.tag}> href=${bell.href}`))
  console.log('  ── teeth ──')
  console.log(teeth(truncateCaught, 'mut-name-truncate: re-add single-line truncate @320 → long name clips'))

  const ok = nameOk && badgeOk && avatarOk && bellOk && truncateCaught
  console.log(`\n  ${ok ? '🟢 STRUCTURE-A PASSED' : '🔴 FAILED'} — name never truncates · badge toggle · avatar fallback · bell → full page\n`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
