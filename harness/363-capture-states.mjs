// harness/363-capture-states.mjs — #363 evidence for the QR and result screens.
//   npm run dev -- -p 3363   (needs .env.local: without V2_PREVIEW_KEY every /v2/* rewrites to /maintenance
//                             AND STILL ANSWERS 200 — assert page CONTENT, never the status code)
//   node harness/363-capture-states.mjs
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(REPO, 'harness', 'pixel-proof')
mkdirSync(OUT, { recursive: true })
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()
const BASE = 'http://localhost:3363'
const VPS = [320, 393, 1280]

// the six states the ticket names, driven through the real /result route
const RESULTS = ['PAYING', 'APPROVED', 'CARD_DECLINED', 'OFFLINE', 'ALREADY_PAID', 'QR_MAYBE_EXPIRED']
const rows = []
const b = await chromium.launch()

async function ctx(w, payments) {
  const c = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/v2/payment/status', (r) => r.fulfill({ json: { payments } }))
  return c
}

// ── QR screen ────────────────────────────────────────────────────────────────
for (const w of VPS) {
  const c = await ctx(w, [{ chargeId: 'chrg_demo', status: 'PENDING' }])
  const p = await c.newPage()
  // a local 1×1 stands in for Omise's signed CDN url, which expires and would photograph as a broken image
  await c.route('**/api.omise.co/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#fff"/><rect x="20" y="20" width="60" height="60" fill="#0B305B"/><rect x="160" y="20" width="60" height="60" fill="#0B305B"/><rect x="20" y="160" width="60" height="60" fill="#0B305B"/><rect x="110" y="110" width="30" height="30" fill="#0B305B"/></svg>' }))
  await p.goto(`${BASE}/v2/shop/qrcode?charge=chrg_demo&qr=${encodeURIComponent('https://api.omise.co/x.svg')}&amount=159000`, { waitUntil: 'networkidle' })
  await p.waitForSelector('[data-testid="qr-screen"]')
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: join(OUT, `363-qr-${w}.png`), fullPage: true })
  rows.push({ screen: 'qr', w, amount: await p.textContent('[data-testid="qr-amount"]'), waiting: await p.textContent('[data-testid="qr-waiting"]') })
  await c.close()
}

// ── result screen, all six ───────────────────────────────────────────────────
for (const s of RESULTS) {
  for (const w of VPS) {
    // APPROVED / ALREADY_PAID must be CONFIRMED by /status or the page refuses to claim payment — so the
    // fixture settles the charge for exactly those two.
    const settled = s === 'APPROVED' || s === 'ALREADY_PAID'
    const c = await ctx(w, settled ? [{ chargeId: 'chrg_demo', status: 'APPROVED' }] : [{ chargeId: 'chrg_demo', status: 'PENDING' }])
    const p = await c.newPage()
    await p.goto(`${BASE}/v2/shop/result?state=${s}&charge=chrg_demo`, { waitUntil: 'networkidle' })
    await p.waitForSelector('[data-testid="result-screen"]')
    await p.evaluate(() => document.fonts.ready)
    if (w === 393) await p.screenshot({ path: join(OUT, `363-result-${s}-${w}.png`), fullPage: true })
    rows.push({
      screen: `result:${s}`, w,
      shown: await p.getAttribute('[data-testid="result-screen"]', 'data-state'),
      paid: await p.getAttribute('[data-testid="result-screen"]', 'data-paid'),
      title: await p.textContent('[data-testid="result-title"]'),
      mark: await p.textContent('[data-testid="result-mark"]'),
    })
    await c.close()
  }
}
console.log(JSON.stringify(rows, null, 0).replace(/\},\{/g, '}\n{'))
await b.close()
