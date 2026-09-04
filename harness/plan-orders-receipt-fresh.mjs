import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const iso = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString() }
const PAYMENTS = { payments: [
  { chargeId: 'chg_1', orderId: 'MUM-2569-004219', packageCode: 'QI_500', tierCode: 'QI', amountSatang: 21900, method: 'card', status: 'APPROVED', failureCode: null, createdAt: iso(1, 21, 5) },
  { chargeId: 'chg_2', orderId: 'MUM-2569-004180', packageCode: 'V2_PRO_YEARLY', tierCode: 'PRO', amountSatang: 159000, method: 'promptpay', status: 'APPROVED', failureCode: null, createdAt: iso(20, 10, 0) },
  { chargeId: 'chg_3', orderId: 'MUM-2569-004150', packageCode: 'QI_200', tierCode: 'QI', amountSatang: 9900, method: 'card', status: 'REJECT', failureCode: 'gateway_expired', createdAt: iso(40, 14, 0) },
] }
const b = await chromium.launch()
async function shot(route, mocks, name, checks) {
  const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  for (const [pat, json] of mocks) await c.route(pat, (r) => r.fulfill({ json }))
  const p = await c.newPage()
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1100)
  await p.evaluate(() => document.fonts.ready)
  const html = await p.content()
  for (const [label, needle] of checks) console.log(`  ${name} ${label}:`, html.includes(needle))
  await p.addStyleTag({ content: 'nav[aria-label="เมนูหลัก"]{position:static!important;margin:14px auto 0} div.pb-36{padding-bottom:.75rem!important}' })
  await p.screenshot({ path: join(OUT, name), fullPage: true })
  console.log('shot', name)
  await c.close()
}
await shot('/v2/account/plan',
  [['**/api/user**', { user_id: 'demo', membership: { isPaid: false, tier: 'free', source: 'v2', expireAt: null } }],
   ['**/api/payment-package**', { amount: 790, is_active: true }]],
  'plan-v2.png', [['purple-border', 'ring-[#6F1BAF]'], ['upsell-blue', 'bg-[#EAF3FF]']])
await shot('/v2/orders', [['**/api/v2/payment/status**', PAYMENTS]], 'orders-v2.png',
  [['bonus-title', '+ โบนัส 75'], ['white-summary', 'text-[#8A5A0C]'], ['grouped', 'divide-y']])
await shot('/v2/orders/chg_1', [['**/api/v2/payment/status**', PAYMENTS]], 'receipt-v2.png',
  [['receipt-no-label', 'เลขที่ใบเสร็จ'], ['vat-label', 'VAT 7%']])
await b.close()
