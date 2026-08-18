// harness/verify-home-wireup.ts — home-screen entry points, walked by CLICKING them (webgang · มุน)
//
// The question this answers is "where does this actually take the user", which is not the question a
// grep answers. `grep -c href` counts links; it cannot tell a link pointing at the wrong service from a
// link pointing at the right one, and every wrong destination in this PR would still be a valid href to
// a page that loads. So every row below is produced by a real click on the real screen, and the
// destination recorded is `page.url()` afterwards.
//
// Each target is anchored on something stable — visible label, or the section heading it lives under.
// Never `.nth(i)` over the whole page: "ดูบริการทั้งหมด" appears TWICE (Zone 3 and Zone 4) and those two
// are exactly the pair a positional selector would silently swap.
//
//   npx tsx harness/verify-home-wireup.ts --host http://localhost:3000 --user default
//   npx tsx harness/verify-home-wireup.ts --host http://localhost:3000 --only A2      (one row)
//
// Reads the gate passkey at runtime from .env.local / .env (V2_PREVIEW_KEY) — never printed, never committed.
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = arg('host', process.env.CAPTURE_HOST ?? 'http://localhost:3000')!
const ONLY = arg('only')
// where the 11 live. Default is the REAL authed home. /v2/home-preview renders the same components with
// mock props and needs no backend — useful to shake out the walk itself, but it is NOT the user's screen:
// always record which one a result came from.
const ROUTE = arg('route', '/v2')!
const VIEWPORT = Number(arg('viewport', '393'))

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const CS = (title: string) => `/v2/service/coming-soon?service=${encodeURIComponent(title)}`

/** The order's table, restated as machine-checkable rows. `expect` is the URL the user must land on;
 *  `name` is what the destination page must NAME (empty = not a coming-soon page). `tab` is the bottom
 *  tab that must be lit when they get there. */
const TARGETS: { id: string; zone: string; what: string; sel: string; expect: string; name?: string; tab: string }[] = [
  { id: 'A1', zone: '2 มานิเฟส', what: 'ปุ่ม เพิ่มความปรารถนาของคุณ', sel: 'a:has-text("เพิ่มความปรารถนาของคุณ")', expect: CS('มานิเฟส'), name: 'มานิเฟส', tab: 'บริการ' },
  { id: 'A2', zone: '3 ดวงสมพงค์', what: 'การ์ด ดูดวงคู่รัก', sel: 'a:has(h3:text-is("ดูดวงคู่รัก"))', expect: '/v2/service/compatibility/love', tab: 'บริการ' },
  { id: 'A3', zone: '3 ดวงสมพงค์', what: 'การ์ด ดูดวงเพื่อนร่วมงาน', sel: 'a:has(h3:text-is("ดูดวงเพื่อนร่วมงาน"))', expect: '/v2/service/compatibility/colleague', tab: 'บริการ' },
  { id: 'A4', zone: '3 ดวงสมพงค์', what: 'ปุ่ม ดูบริการทั้งหมด', sel: 'section:has(h2:text-is("ดวงสมพงค์")) a:has-text("ดูบริการทั้งหมด")', expect: '/v2/service', tab: 'บริการ' },
  { id: 'A5', zone: '4 โหมดเซียน', what: 'การ์ด ออราเคิลเคี้ยงคุง', sel: 'a:has(img[src*="icon-oracle"])', expect: CS('เสี่ยงไพ่ออราเคิลเคี้ยงคุง'), name: 'เสี่ยงไพ่ออราเคิลเคี้ยงคุง', tab: 'บริการ' },
  { id: 'A6', zone: '4 โหมดเซียน', what: 'การ์ด จิตวิญญาณแดนสวรรค์', sel: 'a:has(img[src*="icon-spirit"])', expect: CS('เสี่ยงไพ่จิตวิญญาณแดนสวรรค์'), name: 'เสี่ยงไพ่จิตวิญญาณแดนสวรรค์', tab: 'บริการ' },
  { id: 'A7', zone: '4 โหมดเซียน', what: 'การ์ด เซียนเสี่ยงทาย', sel: 'a:has(img[src*="icon-sian"])', expect: CS('เสี่ยงเซียนเสี่ยงทาย'), name: 'เสี่ยงเซียนเสี่ยงทาย', tab: 'บริการ' },
  { id: 'A8', zone: '4 โหมดเซียน', what: 'ปุ่ม ดูบริการทั้งหมด', sel: 'section:has(h2:text-is("โหมดเซียน")) a:has-text("ดูบริการทั้งหมด")', expect: '/v2/service', tab: 'บริการ' },
  { id: 'A9', zone: '4 โหมดเซียน', what: 'CTA ซื้อเลย', sel: 'a:has-text("ซื้อเลย")', expect: CS('หนังสือเล่มเดียวในโลก'), name: 'หนังสือเล่มเดียวในโลก', tab: 'บริการ' },
  { id: 'A10', zone: '5 ซินแส', what: 'ปุ่ม ทักซินแสเพื่อจอง', sel: 'a:has-text("ทักซินแสเพื่อจอง")', expect: CS('ดูดวงส่วนตัว กับซินแส'), name: 'ดูดวงส่วนตัว กับซินแส', tab: 'บริการ' },
  { id: 'A11', zone: '6 เรียนปาจื่อ', what: 'CTA ดูรายละเอียดเพิ่มเติม', sel: 'a:has-text("ดูรายละเอียดเพิ่มเติม")', expect: CS('เรียนปาจื่อออนไลน์'), name: 'เรียนปาจื่อออนไลน์', tab: 'บริการ' },
]

const USERS: Record<string, { userId: string; name: string }> = {
  default: { userId: '5c7befb3-ebd3-4740-989e-fd6a1cca9662', name: 'มิลา' },
  'no-dob': { userId: '1b48125d-a68c-4682-a318-84f93f79baf9', name: 'ไร้ดวง' },
}

function readPasskey(): string {
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), f)
    if (!fs.existsSync(p)) continue
    const line = fs.readFileSync(p, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  }
  throw new Error('V2_PREVIEW_KEY not found in .env.local/.env')
}

async function login(page: Page) {
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  const loc = res.headers()['location'] ?? ''
  if (res.status() !== 303 || loc.includes('gate_error')) throw new Error(`gate rejected (${res.status()} → ${loc})`)
  const u = USERS[arg('user', 'default')!]
  await page.goto(`${HOST}/dev-login`, { waitUntil: 'networkidle' })
  const inputs = page.locator('input')
  await inputs.nth(0).fill(u.userId)
  await inputs.nth(1).fill(u.name)
  await page.getByRole('button', { name: /dev login/i }).click()
  await page.waitForURL((x) => new URL(x).pathname === '/', { timeout: 10000 }).catch(() => {})
}

/** which bottom tab is lit — read from aria-current, which is what a screen reader (and the user) sees */
const activeTab = (page: Page) =>
  page.evaluate(() => document.querySelector('nav a[aria-current="page"]')?.textContent?.trim() ?? '(ไม่มีแท็บไหนเรือง)')

/** the name the destination page put on screen (the coming-soon page's own h1) */
const shownName = (page: Page) =>
  page.evaluate(() => document.querySelector('[data-testid="coming-soon-title"]')?.textContent?.trim() ?? '')

async function main() {
  const rows = ONLY ? TARGETS.filter((t) => t.id === ONLY) : TARGETS
  if (!rows.length) throw new Error(`--only ${ONLY} matched no target (ids: ${TARGETS.map((t) => t.id).join(',')})`)
  // A walk over an empty list would print a clean table and mean nothing.
  if (!ONLY && rows.length !== 11) throw new Error(`expected 11 targets, have ${rows.length}`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: VIEWPORT, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const httpErrors: string[] = []
  page.on('response', (r) => { if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/v2')) httpErrors.push(`${r.status()} ${new URL(r.url()).pathname}`) })

  await login(page)

  console.log(`# home wire-up walk · host=${HOST}${ROUTE} · user=${arg('user', 'default')} · viewport=${VIEWPORT}`)
if (ROUTE !== '/v2') console.log(`# ⚠️ เดินบน ${ROUTE} ไม่ใช่หน้าแรกจริง — คอมโพเนนต์ชุดเดียวกันแต่ props เป็นของจำลอง`)
  console.log(`# ${rows.length} จุด · เดินด้วยการ "กดจริง" ทีละอัน แล้วอ่าน URL ที่ได้`)
  console.log('\n| # | โซน | กดอะไร | ไปที่ไหนจริงๆ | ตรงกับใบ | หน้าปลายทางเรียกชื่อว่า | แท็บที่เรือง |')
  console.log('|---|---|---|---|---|---|---|')

  const fails: string[] = []
  for (const t of rows) {
    await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
    const el = page.locator(t.sel).first()
    const found = await el.count()
    if (!found) {
      console.log(`| ${t.id} | ${t.zone} | ${t.what} | **ไม่ใช่ลิงก์ — กดไม่ได้** | ❌ | — | — |`)
      fails.push(`${t.id} ไม่พบลิงก์ (selector: ${t.sel})`)
      continue
    }
    await el.scrollIntoViewIfNeeded()
    const before = page.url()
    await el.click()
    // a real navigation, not a hash change; if nothing happens we want to SEE "went nowhere", not hang
    await page.waitForURL((u) => u.toString() !== before, { timeout: 5000 }).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})
    const got = decodeURIComponent(page.url().replace(HOST, ''))
    const want = decodeURIComponent(t.expect)
    const okUrl = got === want
    const name = await shownName(page)
    const okName = t.name ? name === t.name : true
    const tab = await activeTab(page)
    const okTab = tab === t.tab
    const verdict = okUrl && okName && okTab ? '✅' : '❌'
    console.log(`| ${t.id} | ${t.zone} | ${t.what} | \`${got === decodeURIComponent(before.replace(HOST, '')) ? 'ไม่ไปไหน' : got}\` | ${verdict} | ${t.name ? (name || '**(ว่าง)**') : '—'} | ${tab} |`)
    if (!okUrl) fails.push(`${t.id} ไปที่ ${got} · ใบบอก ${want}`)
    if (!okName) fails.push(`${t.id} หน้าปลายทางเรียกชื่อว่า "${name || '(ว่าง)'}" · ต้องเป็น "${t.name}"`)
    if (!okTab) fails.push(`${t.id} แท็บที่เรืองคือ ${tab} · ต้องเป็น ${t.tab}`)
  }

  console.log(`\n- ผ่าน: **${rows.length - new Set(fails.map((f) => f.split(' ')[0])).size}/${rows.length}**`)
  console.log(`- response >=400 บนเส้นทาง /v2 ระหว่างเดิน: **${httpErrors.length}** ${httpErrors.length ? '❌ ' + httpErrors.slice(0, 5).join(' · ') : '✓'}`)
  if (fails.length) {
    console.log('\n**ที่ไม่ตรง:**')
    fails.forEach((f) => console.log(`- ${f}`))
    process.exitCode = 1
  }
  await browser.close()
}

main().catch((e) => {
  console.error('✗', e.message)
  process.exit(2)
})
