// harness/menubar-proof.mjs — proves the bottom Menubar is FIXED (stays pinned at the viewport bottom on
// scroll), NOT floating. No MENU_CSS hack, fullPage:false, short viewport, two scroll positions.
import { chromium } from 'playwright'
import { join } from 'node:path'

const BASE = 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY || 'lamun-local-dev'
const OUT = process.env.OUT || 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const W = 393
const iso = (daysAgo, h, m) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString() }
const PAYMENTS = { payments: [
  { chargeId: 'chg_1', orderId: 'MUM-2569-004219', packageCode: 'QI_500', tierCode: 'QI', amountSatang: 21900, method: 'card', status: 'APPROVED', failureCode: null, createdAt: iso(1, 21, 5) },
  { chargeId: 'chg_2', orderId: 'MUM-2569-004180', packageCode: 'V2_PRO_YEARLY', tierCode: 'PRO', amountSatang: 159000, method: 'promptpay', status: 'APPROVED', failureCode: null, createdAt: iso(20, 10, 0) },
  { chargeId: 'chg_3', orderId: 'MUM-2569-004150', packageCode: 'QI_200', tierCode: 'QI', amountSatang: 9900, method: 'card', status: 'REJECT', failureCode: 'gateway_expired', createdAt: iso(40, 14, 0) },
] }

const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: W, height: 460 }, deviceScaleFactor: 2 })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/v2/payment/status**', (r) => r.fulfill({ json: PAYMENTS }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/orders`, { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
await p.evaluate(() => document.fonts.ready)

// frame 1 — top of page. Menubar pinned at the viewport bottom.
await p.evaluate(() => window.scrollTo(0, 0))
await p.waitForTimeout(150)
await p.screenshot({ path: join(OUT, 'menubar-top.png'), fullPage: false })
console.log('shot menubar-top.png')

// frame 2 — scrolled down. Menubar STILL pinned at the exact same viewport bottom → it is fixed, not floating.
await p.evaluate(() => window.scrollTo(0, 260))
await p.waitForTimeout(150)
await p.screenshot({ path: join(OUT, 'menubar-scrolled.png'), fullPage: false })
console.log('shot menubar-scrolled.png')

await b.close()
