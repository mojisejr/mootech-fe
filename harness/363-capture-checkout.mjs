// harness/363-capture-checkout.mjs — #363 evidence, committed so a reviewer can RERUN it.
//   npm run dev -- -p 3363          (needs .env.local with V2_PREVIEW_KEY — without it every /v2/* rewrites
//                                    to /maintenance AND STILL ANSWERS 200: assert page CONTENT, not status)
//   node harness/363-capture-checkout.mjs
//
// 🔴 THE QUOTE IS ROUTE-MOCKED, NOT INVENTED. /api/v2/payment/preview needs a session and a DB this harness
// does not have, so the CONTRACT is mocked and the SCREEN is real — the amounts below are the ones a server
// would send, and the page still refuses to do arithmetic on them. Mocking the screen instead would prove
// nothing about the screen.
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
const VPS = [320, 393, 430, 768, 1280]

const BASE_QUOTE = { quoteId: 'q_demo', packageCode: 'V2_PRO_YEARLY', listSatang: 159000, discountSatang: 0,
  amountSatang: 159000, vatSatang: 10402, vatPercent: 7, codeApplied: null, expiresAt: new Date(0).toISOString() }
const WITH_CODE = { ...BASE_QUOTE, discountSatang: 15900, amountSatang: 143100, vatSatang: 9400, codeApplied: 'SAVE10' }
const NO_VAT = { ...BASE_QUOTE, vatPercent: 0, vatSatang: 0 }

// 🔴 `base` is what the FIRST (codeless) preview returns, `withCode` what the second one does. The first
// version of this harness always answered BASE_QUOTE to a codeless request, so the vat0 case photographed a
// 7% screen and the run looked fine — the numbers read back off the DOM are what caught it, not the images.
const CASES = [
  { key: 'default', base: BASE_QUOTE, withCode: BASE_QUOTE, code: null },
  { key: 'code-success', base: BASE_QUOTE, withCode: WITH_CODE, code: 'SAVE10' },
  { key: 'code-error', base: BASE_QUOTE, withCode: BASE_QUOTE, code: 'EXPIRED99', refuse: true },
  { key: 'vat0', base: NO_VAT, withCode: NO_VAT, code: null },
]

const b = await chromium.launch()
const rows = []

for (const c of CASES) {
  for (const w of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 1200 }, deviceScaleFactor: 2 })
    await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
    await ctx.route('**/api/v2/payment/preview', (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      if (body.code && c.refuse) return route.fulfill({ status: 400, json: { error: 'no', codeError: 'INVALID' } })
      return route.fulfill({ json: body.code ? c.withCode : c.base })
    })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/v2/shop/checkout?package_code=V2_PRO_YEARLY`, { waitUntil: 'networkidle' })
    await p.waitForSelector('[data-testid="order-summary"]')
    if (c.code) {
      await p.fill('[data-testid="discount-input"]', c.code)
      await p.click('[data-testid="discount-apply"]')
      await p.waitForSelector(c.refuse ? '[data-testid="discount-helper"]' : '[data-testid="discount-chip"]')
    }
    await p.evaluate(() => document.fonts.ready)
    await p.screenshot({ path: join(OUT, `363-checkout-${c.key}-${w}.png`), fullPage: true })
    // read the rendered glyphs back — a filename is not evidence of what is in the frame
    rows.push({
      case: c.key, w,
      total: await p.textContent('[data-testid="summary-total"]'),
      vat: await p.$('[data-testid="summary-vat"]') ? await p.textContent('[data-testid="summary-vat"]') : null,
      codeLine: await p.$('[data-testid="summary-code-discount"]') ? await p.textContent('[data-testid="summary-code-discount"]') : null,
      chip: !!(await p.$('[data-testid="discount-chip"]')),
      helper: await p.$('[data-testid="discount-helper"]') ? await p.textContent('[data-testid="discount-helper"]') : null,
      renewalChecked: await p.$eval('[data-testid="card-renewal"]', (e) => e.checked).catch(() => null),
      secured: !!(await p.$('[data-testid="checkout-secured"]')),
      methods: await p.$$eval('[data-testid="method-picker"] > *', (n) => n.map((x) => x.getAttribute('data-testid'))),
    })
    await ctx.close()
  }
}
console.log(JSON.stringify(rows, null, 0).replace(/\},\{/g, '}\n{'))
await b.close()
