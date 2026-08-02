// harness/capture-compat-3b.ts — 3B @393: the compat result screen, mascots resolved through the
// REAL fe proxy (pages/api/bazi/mascot). Point the fe's BAZI_BASE_URL at the REAL bazi prod
// (https://bazi-sft-dataset.vercel.app) → the ENTIRE chain is real: bazi prod endpoint (returns
// imageUrlV2) → prod storage image (…/mootech-v2/mascot/*.png) → proxy → screen. Only get-detail is
// intercepted (that flow needs the BE/matching side, out of scope here).
//   shows  : persons 甲子 + 丙子 → two v2 mascots render in μุน's hero.
//   hidden : person b = an UNKNOWN ganzhi (甲甲) → bazi prod 404 → proxy { mascot: null } → card hides clean.
// (The subtler "has-a-row-but-no-imageUrlV2 → hide, no legacy fallback" branch is unit-tested +
//  mutant-proven in scripts/compat-mascot-proxy.test.ts; real prod has no such row — all 60 carry v2.)
// Boot fe with BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app + V2_PREVIEW_KEY, then:
//   CAPTURE_HOST=http://localhost:3097 npx tsx harness/capture-compat-3b.ts shows  out/shows.png
//   CAPTURE_HOST=http://localhost:3097 npx tsx harness/capture-compat-3b.ts hidden out/hidden.png
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3097'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const scenario = (process.argv[2] ?? 'shows') as 'shows' | 'hidden'
const OUT = path.resolve(process.cwd(), process.argv[3] ?? `harness/pixel-proof/compat-3b-${scenario}.png`)

function readPasskey(): string {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n')
    .find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

function body(aGanzhi: string, bGanzhi: string) {
  const overall = {
    percent: 82,
    grade: 'A',
    gradeLabel: 'เข้ากันดีมาก',
    hearts: 4,
    emoji: '💞',
    ratingText: 'โดยรวมหนุนกันได้ดี เข้าใจกันในระยะยาว',
  }
  const dimensions = [
    { key: 'love', label: 'ความรัก', percent: 78, grade: 'A' },
    { key: 'work', label: 'การงาน', percent: 61, grade: 'B' },
    { key: 'trust', label: 'ความไว้ใจ', percent: 44, grade: 'C' },
  ]
  const pairMatch = {
    overall,
    dimensions,
    persons: {
      a: { displayName: 'มิลา', dayGanzhi: aGanzhi },
      b: { displayName: 'ก้อง', dayGanzhi: bGanzhi },
    },
  }
  return JSON.stringify({ result: JSON.stringify({ pairMatch }) })
}

;(async () => {
  const aGanzhi = '甲子'
  const bGanzhi = scenario === 'shows' ? '丙子' : '甲甲' // hidden: b is an unknown ganzhi → bazi 404 → hide
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  })
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.route(
    (u) => u.pathname.endsWith('/user-matching/detail'),
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: body(aGanzhi, bGanzhi) }),
  )
  await page.goto(`${HOST}/v2/service/compatibility/result/CAP-3B`, { waitUntil: 'commit' })
  await page.locator('[data-testid="compat-result-screen"][data-state="ready"]').waitFor({ timeout: 15000 })

  // shows: a v2 mascot image (through the real proxy→stub) must appear
  if (scenario === 'shows') {
    await page.waitForFunction(
      () => Array.from(document.images).filter((i) => i.src.includes('mootech-v2') && i.complete).length >= 1,
      { timeout: 15000 },
    )
  } else {
    await page.waitForTimeout(1500) // let the mascot fetch settle so the hide is real, not un-fetched
  }
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready)
  await page.waitForTimeout(300)

  const v2imgs = await page.evaluate(
    () => Array.from(document.images).filter((i) => i.src.includes('mootech-v2')).map((i) => i.src),
  )
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await page.screenshot({ path: OUT, fullPage: true })
  console.log(`📸 ${scenario} → ${OUT}\n   v2 mascot imgs on screen: ${v2imgs.length}${v2imgs[0] ? ' · ' + v2imgs[0] : ''}`)
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
