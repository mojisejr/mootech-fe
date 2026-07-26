// harness/capture-route.ts — TEAM STANDARD CAPTURE (webgang · test-env). Any agent, any authed route,
// no more asking ฟีม. Logs into the test-env once, then screenshots the route at 393/360/320 (the three
// sizes Zone 1 got burned on) into a gitignored dir. Reuses the assets-ready + dsf2 + overflowX patterns
// from capture.ts (the anchor primitive) so a review-capture and an anchor see the SAME final pixels.
//
//   npx tsx harness/capture-route.ts --route /v2 --user default
//   npx tsx harness/capture-route.ts --route /v2/calendar --user longname --viewports 393,360
//
// Requires the test-env stack booted (goo): FE :3000 · BE :4000 · bazi :3100 · pg :5433.
// Passkey is read from testenv/env/fe.env at runtime — NEVER hardcoded, NEVER logged, NEVER committed.
//
// ⚠️ VERIFY-WHEN-BOOTED: the login selectors (dev-login user picker) are written to the flow บอง described
//    (POST /api/v2/login {passkey} → /dev-login → pick user → route) but not yet run against a live stack.
//    The three ⟨VERIFY⟩ marks below are the spots to confirm once goo says the stack is up.
import { chromium, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3000'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const PASSKEY_VAR = process.env.CAPTURE_PASSKEY_VAR ?? 'V2_PREVIEW_KEY' // confirmed from pages/api/v2/login.ts
const DEFAULT_VIEWPORTS = [393, 360, 320]

// /dev-login signs in by TYPING user_id + name into a form (sets MEMBER_ID/MEMBER_NAME cookies + a `dev`
// next-auth session) — see pages/dev-login.tsx. We drive it BY user_id, NEVER by clicking the real-name
// quick-picks, so no real PII is ever touched. `name` is the display name (drives header truncation),
// free to override. ⟨VERIFY⟩ userId: fill from goo's PII-stripped fake-user set once pushed (the current
// hardcoded SAMPLE_USERS in dev-login.tsx are real customers — do NOT use them).
const USERS: Record<string, { userId: string; name: string; note: string }> = {
  default: { userId: 'TODO_FAKE_DEFAULT', name: 'มิลา', note: 'normal user (dob + gender) → fortune + element render' },
  longname: { userId: 'TODO_FAKE_DEFAULT', name: 'มิลาวรรณวิไลอลงกรณ์ศรีสุวรรณภูมิ', note: 'long display name → header/element truncation (name drives it, any valid userId)' },
  'no-dob': { userId: 'TODO_FAKE_NO_DOB', name: 'ไร้ดวง', note: 'no birth profile → element line hidden / gap-C register redirect' },
}

function readPasskey(): string {
  const file = path.resolve(process.cwd(), ENV_FILE)
  if (!fs.existsSync(file)) throw new Error(`passkey env not found: ${ENV_FILE} (is the test-env checked out?)`)
  const line = fs.readFileSync(file, 'utf-8').split('\n').find((l) => l.trim().startsWith(`${PASSKEY_VAR}=`))
  if (!line) throw new Error(`${PASSKEY_VAR} not set in ${ENV_FILE}`)
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') // never printed
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// slug a route for a filename: "/v2/calendar" → "v2-calendar", "/v2" → "v2", "/" → "root"
const slug = (r: string) => r.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'root'

async function login(page: Page, passkey: string, userLabel: string) {
  const user = USERS[userLabel]
  if (!user) throw new Error(`unknown --user "${userLabel}" (have: ${Object.keys(USERS).join(', ')})`)
  if (user.userId.startsWith('TODO_')) throw new Error(`--user "${userLabel}" userId not set yet — awaiting goo's fake-user push (do NOT use the real SAMPLE_USERS)`)
  // 1. team gate: POST { passkey } → 303 + Set-Cookie v2_access (pages/api/v2/login.ts validates V2_PREVIEW_KEY).
  //    The Set-Cookie from the 303 lands in this context's jar even though we don't follow the redirect.
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  if (res.status() !== 303) throw new Error(`passkey gate failed: ${res.status()} (check ${PASSKEY_VAR} in ${ENV_FILE} + stack up)`)
  // 2. identity: /dev-login form — type user_id + name, submit (sets MEMBER_* + `dev` session). Driven by
  //    user_id, never the real-name quick-picks. The two inputs are [0]=user_id, [1]=name (dev-login.tsx).
  await page.goto(`${HOST}/dev-login`, { waitUntil: 'networkidle' })
  const inputs = page.locator('input')
  await inputs.nth(0).fill(user.userId)
  await inputs.nth(1).fill(user.name)
  await page.getByRole('button', { name: /dev login/i }).click()
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }).catch(() => {}) // dev-login reloads to "/"
}

async function main() {
  const route = arg('route', '/v2')!
  const userLabel = arg('user', 'default')!
  const viewports = (arg('viewports')?.split(',').map((s) => parseInt(s, 10)) ?? DEFAULT_VIEWPORTS).filter((n) => n > 0)
  const outDir = path.resolve(process.cwd(), arg('out', 'harness/captures')!)
  fs.mkdirSync(outDir, { recursive: true })

  const passkey = readPasskey()
  const browser = await chromium.launch()
  // log in once, reuse the authed session (storageState) across every viewport
  const authCtx = await browser.newContext()
  await login(await authCtx.newPage(), passkey, userLabel)
  const storageState = await authCtx.storageState()
  await authCtx.close()

  const results: { file: string; w: number; overflowX: boolean; errors: number }[] = []
  for (const w of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 2, storageState })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
    await page.goto(`${HOST}${route}`, { waitUntil: 'networkidle' })
    // ASSETS-READY gate (same as capture.ts) → the final pixels, not a mid-load frame
    await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
    await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(250)
    const overflowX = await page.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth)
    const file = path.join(outDir, `${slug(route)}__${userLabel}__${w}.png`)
    await page.screenshot({ path: file, fullPage: true })
    results.push({ file, w, overflowX, errors: errors.length })
    await ctx.close()
  }
  await browser.close()

  console.log(`\n📸 captured ${route} · user=${userLabel} · ${viewports.join('/')}  →  ${path.relative(process.cwd(), outDir)}/`)
  for (const r of results) console.log(`  ${r.overflowX ? '⚠️ overflowX' : '✓'} @${r.w}  errors=${r.errors}  ${path.basename(r.file)}`)
  console.log(`\nnext: Read the PNGs to eyeball, record findings in the zone's *.verify-evidence.md,`)
  console.log(`      and cite this exact command so too/บอง reproduce.\n`)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) }) // message only — never dump the passkey
