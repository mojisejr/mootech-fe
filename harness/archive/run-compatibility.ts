// harness/run-compatibility.ts — EYE PROOF for ดวงสมพงศ์ Slice 1 (goo: route + gate + contract).
// Bug-class this anchor owns: a [kind] entry that renders the WRONG matching_type, or that shows a
// blank/half screen for an unknown kind instead of redirecting, or a preview page that renders without the
// v2 gate. Proven on the REAL route (SSR getServerSideProps → hook), FE-only (no BE): the two real gates and
// the kind→title/type contract need no backend. person1's real-DB name + the 2-state/button-blue screenshots
// are μุน's UI-PR evidence (her screen boots the full stack via dev-login).
//
// Run (FE dev up on :3013 with V2_PREVIEW_KEY):
//   V2_PREVIEW_KEY=$(grep V2_PREVIEW_KEY= testenv/env/fe.env | cut -d= -f2) npx next dev -p 3013
//   CAPTURE_HOST=http://localhost:3013 npx tsx harness/run-compatibility.ts
import { chromium, type BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3013'
function readPasskey(): string {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n')
    .find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY in testenv/env/fe.env')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}
async function gated(browser: Awaited<ReturnType<typeof chromium.launch>>, withV2: boolean, cookies: { name: string; value: string }[] = []) {
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
  const host = new URL(HOST).hostname
  const all = [...(withV2 ? [{ name: 'v2_access', value: readPasskey() }] : []), ...cookies].map((c) => ({ ...c, domain: host, path: '/' }))
  if (all.length) await ctx.addCookies(all)
  return ctx
}

async function main() {
  console.log('\nrun-compatibility')
  const browser = await chromium.launch()
  const captureDir = path.resolve(process.cwd(), 'harness/captures')
  fs.mkdirSync(captureDir, { recursive: true })

  // ── 1. love → "ดูดวงคู่รัก" + matching_type LOVE (real SSR route) ──
  {
    const ctx = await gated(browser, true)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' })
    const title = await p.getByTestId('compat-title').textContent().catch(() => null)
    const mtype = await p.getByTestId('compat-screen').getAttribute('data-matching-type').catch(() => null)
    check('love → title "ดูดวงคู่รัก"', title?.trim() === 'ดูดวงคู่รัก', `got ${JSON.stringify(title)}`)
    check('love → data-matching-type LOVE (the value, not just the heading)', mtype === 'LOVE', `got ${mtype}`)
    const btn = p.getByTestId('compat-view-result')
    check('button disabled when person2 empty (done-cond #5)', (await btn.getAttribute('disabled')) !== null || (await btn.getAttribute('aria-disabled')) === 'true')
    await p.screenshot({ path: path.join(captureDir, 'v2-compatibility-love__393.png') })
    await ctx.close()
  }

  // ── 2. colleague → "ดูดวงเพื่อนร่วมงาน" + matching_type FRIEND ──
  {
    const ctx = await gated(browser, true)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/service/compatibility/colleague`, { waitUntil: 'networkidle' })
    const title = await p.getByTestId('compat-title').textContent().catch(() => null)
    const mtype = await p.getByTestId('compat-screen').getAttribute('data-matching-type').catch(() => null)
    check('colleague → title "ดูดวงเพื่อนร่วมงาน"', title?.trim() === 'ดูดวงเพื่อนร่วมงาน', `got ${JSON.stringify(title)}`)
    check('colleague → data-matching-type FRIEND', mtype === 'FRIEND', `got ${mtype}`)
    await p.screenshot({ path: path.join(captureDir, 'v2-compatibility-colleague__393.png') })
    await ctx.close()
  }

  // ── 3. unknown kind → redirect to /v2/service (ห้ามเงียบ) ──
  {
    const ctx = await gated(browser, true)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/service/compatibility/boss`, { waitUntil: 'networkidle' })
    check('unknown kind "boss" → redirected to /v2/service', new URL(p.url()).pathname === '/v2/service', `landed ${new URL(p.url()).pathname}`)
    await ctx.close()
  }

  // ── 4. no v2 cookie → redirect to /v2 (auth gate holds on this page too) ──
  {
    const ctx = await gated(browser, false)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' })
    check('unauthed → redirected to /v2 (gate)', new URL(p.url()).pathname === '/v2', `landed ${new URL(p.url()).pathname}`)
    await ctx.close()
  }

  // ── 5. person1 no-strand: with a name cookie but no BE, row 1 resolves to the real cookie name (NOT a
  //      spinner forever, NOT fabricated). Proves the state-table error branch on the real route. ──
  {
    const ctx = await gated(browser, true, [
      { name: 'cookie-mumate-id', value: 'harness-user' },
      { name: 'cookie-mumate-name', value: 'ทดสอบ' },
    ])
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/service/compatibility/love`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(500)
    const loading = await p.getByTestId('compat-person1-loading').count()
    const name = await p.getByTestId('compat-person1-name').textContent().catch(() => null)
    check('person1 resolves (no infinite loading) even when BE is unreachable', loading === 0)
    check('person1 falls back to the real cookie name, not fabricated', name?.trim() === 'ทดสอบ', `got ${JSON.stringify(name)}`)
    await ctx.close()
  }

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ run-compatibility PASS' : `❌ run-compatibility FAIL (${failed})`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
