import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const iso = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString() }
const WALLET = { anonId: 'demo', qi: 590, xp: 40, level: 1, history: [
  { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(2, 9, 0) },
  { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(3, 9, 0) },
] }
const CATALOG = { earn: [{ code: 'daily_login', qi: 5, limit: 'daily', title: 'เข้าใช้งานรายวัน', note: '' }], spend: [] }
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 760 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: WALLET }))
await c.route('**/api/qi-catalog**', (r) => r.fulfill({ json: CATALOG }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/qi/checkin`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.evaluate(() => document.fonts.ready)
console.log('rect cells (rounded-11):', await p.locator('[data-testid^="qi-checkin-day-"].rounded-\\[11px\\]').count())
console.log('old round cells        :', await p.locator('[data-testid^="qi-checkin-day-"].rounded-full').count())
console.log('KitButton sapphire     :', await p.locator('[data-testid="qi-checkin-btn"].bg-v3-sapphire').count())
await p.screenshot({ path: join(OUT, 'checkin-fresh.png'), fullPage: false })
console.log('shot checkin-fresh.png')
await b.close()
