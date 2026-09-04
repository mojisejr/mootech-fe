import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const PRICE = { QI_60: 3500, QI_200: 9900, QI_500: 21900, QI_1200: 44900 }
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 1000 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/payment-package**', (r) => {
  const u = new URL(r.request().url()); const code = u.searchParams.get('code') || ''
  r.fulfill({ json: { package_code: code, amount: (PRICE[code] ?? 0) / 100, is_active: true } })
})
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: { qi: 590 } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/qi/buy`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.evaluate(() => document.fonts.ready)
const html = await p.content()
console.log('ribbon ยอดนิยม   :', html.includes('ยอดนิยม'))
console.log('ribbon คุ้มที่สุด :', html.includes('คุ้มที่สุด'))
console.log('per-QI rate      :', html.includes('/QI'))
console.log('payment note     :', html.includes('ชำระผ่าน Omise'))
console.log('pro purple copy  :', html.includes('สมัครคุ้มกว่าซื้อ QI'))
await p.screenshot({ path: join(OUT, 'buy-v2.png'), fullPage: true })
console.log('shot buy-v2.png')
await b.close()
