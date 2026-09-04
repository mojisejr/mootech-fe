import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const iso = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString() }
const BOARD = { missions: [
  { id: 'read_fortune', title: 'อ่านดวงวันนี้', description: 'เปิดอ่านคำทำนายประจำวันให้จบ', category: 'daily', target: 1, rewardCoins: 5, count: 0, completed: false, claimedAt: null, actionHref: '/v2/calendar' },
  { id: 'share_fortune', title: 'แชร์ดวงวันนี้', description: 'การ์ดมีโค้ดชวนฝังอยู่ · แชร์วันละ 1 ครั้ง', category: 'daily', target: 1, rewardCoins: 10, count: 0, completed: false, claimedAt: null, actionHref: '/v2/qi/referral' },
  { id: 'first_reading', title: 'ดูดวงครั้งแรก', description: 'ลองใช้บริการดูดวงสักอย่าง', category: 'once', target: 1, rewardCoins: 60, count: 1, completed: true, claimedAt: iso(1,10,0), actionHref: '/v2/service' },
  { id: 'connect_line', title: 'เชื่อมบัญชี LINE', description: 'รับแจ้งเตือนดวงรายวันทาง LINE', category: 'once', target: 1, rewardCoins: 20, count: 0, completed: false, claimedAt: null, actionHref: '/v2/settings/connected' },
  { id: 'streak_7', title: 'เช็คอิน 7 วันติด', description: 'นับใหม่ทุกสัปดาห์', category: 'longterm', target: 7, rewardCoins: 30, count: 4, completed: false, claimedAt: null },
], goals: {
  referral: { invited: 3, rewardPerInviteQi: 50, earnedQi: 150 },
  element: { target: 5, collected: 3, bonusQi: 1000, elements: [{ key: 'wood', collected: true }, { key: 'metal', collected: true }, { key: 'fire', collected: true }, { key: 'earth', collected: false }, { key: 'water', collected: false }] },
} }
const WALLET = { anonId: 'demo', qi: 590, history: [] }
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/missions**', (r) => r.fulfill({ json: BOARD }))
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: WALLET }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/qi/missions`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.evaluate(() => document.fonts.ready)
console.log('daily section:', (await p.content()).includes('ทำได้ทุกวัน'))
console.log('grouped cards :', await p.locator('.divide-y.rounded-\\[18px\\]').count())
await p.addStyleTag({ content: 'nav[aria-label="เมนูหลัก"]{position:static!important;margin:14px auto 0}' })
await p.screenshot({ path: join(OUT, 'missions-v2.png'), fullPage: true })
console.log('shot missions-v2.png')
await b.close()
