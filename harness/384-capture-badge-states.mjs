// harness/384-capture-badge-states.mjs — #384 evidence, committed so a reviewer can RERUN it.
// (ตู๋ hit rc=127 on #359's scanner because it lived in an unmerged PR: a result nobody else can reproduce
//  is a claim, not a proof.)
//
//   npm run dev -- -p 3384                        # this branch
//   git worktree add --detach ../before origin/main && ln -s ../mootech-fe-384/node_modules ../before/
//   (cd ../before && npx next dev -p 3385)        # the BEFORE build, for the 0 px² diff
//   cp .env.local ../before/                      # 🔴 without V2_PREVIEW_KEY every /v2/* rewrites to
//                                                 #    /maintenance AND RETURNS 200 — curl looks green while
//                                                 #    you photograph the wrong page. Assert page CONTENT.
//   node harness/384-capture-badge-states.mjs
import { chromium } from '/Users/non/ghq/github.com/mojisejr/mootech-fe-384/node_modules/playwright/index.mjs'
import { PNG } from '/Users/non/ghq/github.com/mojisejr/mootech-fe-384/node_modules/pngjs/lib/png.js'
import pixelmatch from '/Users/non/ghq/github.com/mojisejr/mootech-fe-384/node_modules/pixelmatch/index.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

const OUT = '/Users/non/ghq/github.com/mojisejr/mootech-fe-384/harness/pixel-proof'
mkdirSync(OUT, { recursive: true })
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' /Users/non/ghq/github.com/mojisejr/mootech-fe-384/.env.local | cut -d= -f2- | tr -d '"'`).toString().trim()

const VIEWPORTS = [320, 393, 430, 768, 1280]
// "สมาชิก" first, on purpose: goo confirmed every member who exists today lands in that state, so it is
// the main image, not an illustration (บอง 2026-08-22).
const STATES = [
  { key: 'member', q: 'pay=paid',    label: 'สมาชิก (จ่ายแล้ว ไม่มีชื่อระดับ)' },
  { key: 'plus',   q: 'pay=plus',    label: 'PLUS' },
  { key: 'pro',    q: 'pay=pro',     label: 'PRO' },
  { key: 'free',   q: 'pay=free',    label: 'ฟรี — ป้ายอัพเกรดเหมือนเดิม' },
  { key: 'unknown',q: 'pay=unknown', label: 'ไม่รู้ (loading/error) — ต้องไม่มีป้าย' },
]

const browser = await chromium.launch()
async function shot(port, q, width, file) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}/v2/home-preview?${q}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="home-header"]')
  await page.evaluate(() => document.fonts.ready)
  const el = await page.$('[data-testid="home-header"]')
  await el.screenshot({ path: file })
  // read the badge back from RENDERED GLYPHS — a filename is not evidence of what is in the frame
  const badge = await page.evaluate(() => {
    const up = document.querySelector('[data-testid="header-upgrade"]')
    const tier = document.querySelector('[data-testid="header-tier"]')
    const tools = document.querySelector('[data-testid="header-tools"]')
    const box = (e) => (e ? { w: +e.getBoundingClientRect().width.toFixed(2), h: +e.getBoundingClientRect().height.toFixed(2) } : null)
    return { upgrade: up?.textContent ?? null, tier: tier?.textContent ?? null, tools: tools?.children.length ?? 0, box: box(up ?? tier) }
  })
  await ctx.close()
  return badge
}

const rows = []
for (const s of STATES) {
  for (const w of VIEWPORTS) {
    const f = `${OUT}/384-${s.key}-${w}.png`
    const b = await shot(3384, s.q, w, f)
    rows.push({ state: s.key, w, ...b })
  }
}

// ── DoD 7: the FREE header must not move a single pixel vs origin/main ──
const diffs = []
for (const w of VIEWPORTS) {
  const A = `${OUT}/384-before-free-${w}.png`
  const B = `${OUT}/384-free-${w}.png`
  await shot(3385, 'pay=free', w, A)
  const a = PNG.sync.read(readFileSync(A)), b = PNG.sync.read(readFileSync(B))
  if (a.width !== b.width || a.height !== b.height) { diffs.push({ w, px: 'SIZE MISMATCH', dims: `${a.width}x${a.height} vs ${b.width}x${b.height}` }); continue }
  const out = new PNG({ width: a.width, height: a.height })
  const px = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 })
  writeFileSync(`${OUT}/384-diff-free-${w}.png`, PNG.sync.write(out))
  diffs.push({ w, px, dims: `${a.width}x${a.height}` })
}

// ── negative control for the diff itself: before(free) vs after(MEMBER) MUST be non-zero ──
// A differ that reports 0 for two images it has never actually compared reports 0 for everything.
const ctl = []
for (const w of [393]) {
  const a = PNG.sync.read(readFileSync(`${OUT}/384-before-free-${w}.png`))
  const b = PNG.sync.read(readFileSync(`${OUT}/384-member-${w}.png`))
  const out = new PNG({ width: a.width, height: a.height })
  ctl.push({ w, px: pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 }) })
}

console.log(JSON.stringify({ rendered: rows, freeHeaderDiff: diffs, negativeControl: ctl }, null, 1))
await browser.close()
