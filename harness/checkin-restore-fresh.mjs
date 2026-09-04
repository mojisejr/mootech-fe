import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
// เช็คอินล่าสุด = 2 วันก่อน (48 ชม.), ขาด "เมื่อวาน", วันนี้ยังไม่กด → canRestore = true
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()
const WALLET = { anonId: 'demo', qi: 590, xp: 40, level: 1, history: [
  { id: 3, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: twoDaysAgo, ref: null },
  { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), ref: null },
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
console.log('recovery banner:', await p.locator('[data-testid="qi-checkin-recovery"]').count())
console.log('restore button :', await p.locator('[data-testid="qi-checkin-restore"]').count())
console.log('restore label  :', (await p.locator('[data-testid="qi-checkin-restore"]').textContent().catch(() => '')))
await p.screenshot({ path: join(OUT, 'checkin-restore.png'), fullPage: false })
console.log('shot checkin-restore.png')
await b.close()
