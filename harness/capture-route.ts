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
import { execSync } from 'child_process'
import { backendUnreachableHint } from './backend-hint'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3000'
const ENV_FILE = process.env.CAPTURE_ENV_FILE ?? 'testenv/env/fe.env'
const PASSKEY_VAR = process.env.CAPTURE_PASSKEY_VAR ?? 'V2_PREVIEW_KEY' // confirmed from pages/api/v2/login.ts
const DEFAULT_VIEWPORTS = [393, 360, 320]

// /dev-login signs in by TYPING user_id + name into a form (sets MEMBER_ID/MEMBER_NAME cookies + a `dev`
// next-auth session) — see pages/dev-login.tsx. We drive it BY user_id, NEVER by clicking the real-name
// quick-picks, so no real PII is ever touched. `name` is the display name (drives header truncation),
// free to override. ⟨VERIFY⟩ userId: fill from goo's PII-stripped fake-user set once pushed (the current
// hardcoded SAMPLE_USERS in dev-login.tsx are real customers — do NOT use them).
// PII-stripped fake test users (goo, PR#109 — verified against the test DB; names/emails all fake).
const USERS: Record<string, { userId: string; name: string; note: string }> = {
  default: { userId: '5c7befb3-ebd3-4740-989e-fd6a1cca9662', name: 'มิลา', note: 'profile complete + chart (dob 1980-04-05) → fortune + element render' },
  longname: { userId: 'b54b765a-c01b-471f-bf7c-0c2a1a448bdd', name: 'มิลาวรรณวิไลอลงกรณ์ศรีสุวรรณภูมิ', note: 'returning + fortune (dob 1989-01-03), long display name → header/element truncation (name drives it)' },
  'no-dob': { userId: '1b48125d-a68c-4682-a318-84f93f79baf9', name: 'ไร้ดวง', note: 'no dob → isBirthProfileComplete false → element hidden / gap-C fallback' },
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
const slug = (r: string) => r.split('?')[0].replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'root' // drop the query

// A capture only proves "the build serving :PORT looked like this THEN". Which build? Best-effort: find the
// process on the port → its cwd (the serving worktree) → git HEAD. RECORD this in evidence — a stale FE
// makes a fixed bug look live (บอง's absence-vs-unchanged lesson: an image is a point-in-time, not "now").
function detectFeBuild(): string {
  try {
    const port = new URL(HOST).port || '3000'
    const pid = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0]
    if (!pid) return 'unknown (not localhost?)'
    const cwd = execSync(`lsof -a -p ${pid} -d cwd -Fn`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').find((l) => l.startsWith('n'))?.slice(1) ?? ''
    if (!cwd) return 'unknown (cwd)'
    const head = execSync(`git -C "${cwd}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const behind = execSync(`git -C "${cwd}" rev-list --count HEAD..origin/main 2>/dev/null || echo ?`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return `${head} (${path.basename(cwd)})${behind && behind !== '0' ? ` — ⚠️ ${behind} commits BEHIND origin/main` : ' — up to date w/ origin/main'}`
  } catch {
    return 'unknown (record the FE commit manually)'
  }
}

async function login(page: Page, passkey: string, userLabel: string, noUser = false) {
  // 1. team gate (always): POST { passkey } → 303 + Set-Cookie v2_access (pages/api/v2/login.ts validates
  //    V2_PREVIEW_KEY). The Set-Cookie from the 303 lands in this context's jar even without following it.
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey }, maxRedirects: 0 })
  const loc = res.headers()['location'] ?? '' // good key → /v2 ; wrong/unset key → /v2?gate_error=… (both 303)
  if (res.status() !== 303 || loc.includes('gate_error')) throw new Error(`passkey gate rejected (${res.status()} → ${loc || 'no redirect'}) — check ${PASSKEY_VAR} in ${ENV_FILE} + stack up`)
  // --no-user: gate-only — for dev routes that use MOCK props (e.g. /v2/home-preview?element=…), no identity
  // is needed, and dev-login/NEXTAUTH may be absent on a minimal-env FE. Still records the build hash.
  if (noUser) return
  const user = USERS[userLabel]
  if (!user) throw new Error(`unknown --user "${userLabel}" (have: ${Object.keys(USERS).join(', ')})`)
  if (user.userId.startsWith('TODO_')) throw new Error(`--user "${userLabel}" userId not set yet — awaiting goo's fake-user push (do NOT use the real SAMPLE_USERS)`)
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
  const noUser = process.argv.includes('--no-user')
  const label = arg('label', noUser ? 'preview' : userLabel)! // filename label (query is dropped from slug)
  const viewports = (arg('viewports')?.split(',').map((s) => parseInt(s, 10)) ?? DEFAULT_VIEWPORTS).filter((n) => n > 0)
  const outDir = path.resolve(process.cwd(), arg('out', 'harness/captures')!)
  fs.mkdirSync(outDir, { recursive: true })

  const passkey = readPasskey()
  const browser = await chromium.launch()
  // log in once, reuse the authed session (storageState) across every viewport
  const authCtx = await browser.newContext()
  await login(await authCtx.newPage(), passkey, userLabel, noUser)
  const storageState = await authCtx.storageState()
  await authCtx.close()

  type Floating = { pos: string; tag: string; cls: string; box: string }
  const results: { file: string; vpTop: string; vpBottom: string | null; w: number; overflowX: boolean; errors: number; floating: Floating[] }[] = []
  const allFailed: string[] = [] // 4xx/5xx responses across all viewports — feeds the BE-unreachable hint
  for (const w of viewports) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 852 }, deviceScaleFactor: 2, storageState })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
    page.on('response', (r) => { if (r.status() >= 400) allFailed.push(`${r.status()} ${r.url()}`) })
    await page.goto(`${HOST}${route}`, { waitUntil: 'networkidle' })
    // ASSETS-READY gate (same as capture.ts) → the final pixels, not a mid-load frame
    await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready).catch(() => {})
    await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete), null, { timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(250)
    const overflowX = await page.evaluate(() => document.scrollingElement!.scrollWidth > window.innerWidth)
    const file = path.join(outDir, `${slug(route)}__${label}__${w}.png`)
    await page.screenshot({ path: file, fullPage: true }) // FULL (unchanged — backward-compatible filename)

    // ANCHOR: viewport-shot — fullPage misplaces fixed/sticky; add viewport shots + list what floats.
    // #185: a fullPage shot renders position:fixed/sticky ONCE at its document position, so header/footer/menu
    // float to the WRONG place in the tall image and a review can't see what the user actually sees on screen.
    // Add (a) a viewport-sized shot of the first screen, (b) a mid-scroll viewport shot when the page is taller
    // than the viewport (where a fixed element keeps floating over content — invisible in fullPage), and
    // (c) a printed list of every fixed/sticky element so the overlap can't hide from a reviewer's eye.
    const floating: Floating[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).flatMap((el) => {
        const pos = getComputedStyle(el as Element).position
        if (pos !== 'fixed' && pos !== 'sticky') return []
        const r = (el as Element).getBoundingClientRect()
        return [{ pos, tag: (el as Element).tagName.toLowerCase(), cls: ((el as Element).getAttribute('class') || '').replace(/\s+/g, ' ').slice(0, 60),
                  box: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` }]
      }))
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(150) // (ตู๋ #123) settle after scroll — symmetric with vp-bottom; guards smooth-scroll/reflow
    const vpTop = file.replace(/\.png$/, '__vp-top.png')
    await page.screenshot({ path: vpTop }) // no fullPage → exactly the viewport (the first screen, cut at 852)
    const dims = await page.evaluate(() => ({ sh: document.scrollingElement!.scrollHeight, ih: window.innerHeight }))
    let vpBottom: string | null = null
    // (บอง #123) shoot the second frame whenever the page is TALLER than one screen — no magic threshold.
    // A page 1.0–1.5× the viewport is still taller than vp-top; skipping it AND printing "same as vp-top" would
    // be a false-green. Scroll to the very BOTTOM (where a fixed bottom-0 element overlaps the last content).
    if (dims.sh > dims.ih) {
      await page.evaluate((y) => window.scrollTo(0, y), dims.sh)
      await page.waitForTimeout(150)
      vpBottom = file.replace(/\.png$/, '__vp-bottom.png')
      await page.screenshot({ path: vpBottom })
    }
    results.push({ file, vpTop, vpBottom, w, overflowX, errors: errors.length, floating })
    await ctx.close()
  }
  await browser.close()

  const feBuild = detectFeBuild()
  console.log(`\n📸 captured ${route} · user=${userLabel} · ${viewports.join('/')}  →  ${path.relative(process.cwd(), outDir)}/`)
  console.log(`   🏷️  FE build @capture: ${feBuild}`)
  for (const r of results) {
    console.log(`  ${r.overflowX ? '⚠️ overflowX' : '✓'} @${r.w}  errors=${r.errors}`)
    console.log(`      full  : ${path.basename(r.file)}`)
    console.log(`      vp-top   : ${path.basename(r.vpTop)}  (first screen, cut at 852)`)
    console.log(`      vp-bottom: ${r.vpBottom ? `${path.basename(r.vpBottom)}  (bottom screen — where a fixed bottom-0 overlaps the LAST content)` : '— (page fits in one viewport → the whole page IS vp-top; there is no separate bottom screen)'}`)
    // the tool tells you what floats — a reviewer never has to eyeball whether something is fixed/sticky
    console.log(`      fixed/sticky: ${r.floating.length} found${r.floating.length ? '' : ' (none — nothing floats on this route/viewport)'}`)
    for (const f of r.floating) console.log(`         • ${f.pos} <${f.tag} class="${f.cls}"> box=[${f.box}]`)
  }
  // If any /api call 502'd, the BE isn't booted — say so, so the fallback + red console error above are not
  // mistaken for a UI bug (มุน's Zone-4 502). Narrow: only 502-on-/api; a 404/500 from a running BE is left alone.
  const beHint = backendUnreachableHint(allFailed)
  if (beHint) console.log(`\n${beHint}`)
  console.log(`\n⚠️  RECORD the FE build hash above in evidence — a stale FE makes a fixed bug look live (images expire).`)
  console.log(`next: Read the PNGs to eyeball, record findings in the zone's *.verify-evidence.md,`)
  console.log(`      and cite this exact command so too/บอง reproduce.\n`)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) }) // message only — never dump the passkey
