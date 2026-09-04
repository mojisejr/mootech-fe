import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const WALLET = { anonId: 'demo', qi: 590, coins: 0, xp: 340, level: 2, nextLevelXp: 3000, levelStartXp: 2000, history: [] }
const CATALOG = { earn: [{ code: 'daily_login', qi: 5, limit: 'daily', title: 'เข้าใช้งานรายวัน', note: '' }], spend: [{ code: 'chat_question', qi: 30, title: 'ถามเซียนมู (AI Chat)', note: '' }] }
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: WALLET }))
await c.route('**/api/qi-catalog**', (r) => r.fulfill({ json: CATALOG }))
await c.route('**/api/qi-entitlements**', (r) => r.fulfill({ json: { tier: 'plus', credits: {} } }))
await c.route('**/api/referral', (r) => r.fulfill({ json: { code: 'MUMATE725', invitedCount: 3 } }))
await c.route('**/api/v2/display-name', (r) => r.fulfill({ json: { displayName: null } }))
await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { birthDate: '1990-05-12', birthTime: '08:30' } } }))
await c.route('**/api/bazi/element-summary', (r) => r.fulfill({ json: { summary: { elementTh: 'ไม้' } } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/qi`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1400)
await p.evaluate(() => document.fonts.ready)
const html = await p.content()
console.log('growth loop  :', html.includes('Growth Loop'))
console.log('loop arrows  :', (html.match(/[↻→↓←↗]/g) || []).length)
const g = await p.locator('[data-testid="qi-growth"]')
await g.scrollIntoViewIfNeeded()
await p.waitForTimeout(400)
await g.screenshot({ path: join(OUT, 'growth-loop.png') })
console.log('shot growth-loop.png')
await b.close()
