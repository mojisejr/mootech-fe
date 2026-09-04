import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const iso = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString() }
const WALLET = { anonId: 'demo', qi: 590, coins: 0, xp: 340, level: 2, nextLevelXp: 3000, levelStartXp: 2000, history: [
  { id: 3, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(0, 9, 12) },
  { id: 1, qiDelta: -10, reason: 'qi:spend:card_use', createdAt: iso(1, 19, 22) },
] }
const BOARD = { missions: [
  { id: 'read_fortune', title: 'อ่านดวงวันนี้', description: 'เปิดอ่านคำทำนายประจำวันให้จบ', period: 'daily', category: 'daily', target: 1, rewardCoins: 5, rewardXp: 10, count: 0, completed: false, claimedAt: null, actionHref: '/v2/calendar' },
  { id: 'share_fortune', title: 'แชร์ดวงวันนี้', description: 'แชร์การ์ดดวงออกโซเชียล', period: 'daily', category: 'daily', target: 1, rewardCoins: 10, rewardXp: 15, count: 0, completed: false, claimedAt: null, actionHref: '/v2/qi/referral' },
], goals: { referral: { invited: 3, rewardPerInviteQi: 50, earnedQi: 150 }, element: { target: 5, collected: 3, bonusQi: 1000, elements: [{ key: 'wood', collected: true }, { key: 'metal', collected: true }, { key: 'fire', collected: true }, { key: 'earth', collected: false }, { key: 'water', collected: false }] } } }

const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2, bypassCSP: true })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: WALLET }))
await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { firstName: 'พี่มู', displayName: 'phimu', birthDate: '1984-01-15', birthTime: '09:30' } } }))
await c.route('**/api/bazi/element-summary', (r) => r.fulfill({ json: { summary: { elementTh: 'ไม้', tagline: 'ต้นไม้ใหญ่ที่เติบโตมั่นคง', traits: [], advice: [] } } }))
await c.route('**/api/missions**', (r) => r.fulfill({ json: BOARD }))
await c.route('**/api/referral**', (r) => r.fulfill({ json: { code: 'MUMATE725', invitedCount: 8, rewardPerInvite: 50 } }))
await c.route('**/api/v2/account/delete', (r) => r.fulfill({ json: { deletion: null } }))
await c.route('**/api/user**', (r) => r.fulfill({ json: { user_id: 'demo', membership: { isPaid: false, tier: 'free', source: 'v2', expireAt: null } } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/account`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.evaluate(() => document.fonts.ready)
const html = await p.content()
console.log('checkin bonus footer:', html.includes('ครบ 7 วันรับโบนัส'))
console.log('back button        :', html.includes('account-back'))
console.log('element badge Wood :', html.includes('(Wood)'))
console.log('orb img present    :', html.includes('/images/v2/qi/qi-orb.png'))
console.log('OLD gear-settings  :', html.includes('ทำภารกิจเพิ่มพลังชี่'))
await p.addStyleTag({ content: 'nav[aria-label="เมนูหลัก"]{position:static!important;margin:14px auto 0} div.pb-40{padding-bottom:.75rem!important}' })
await p.screenshot({ path: join(OUT, 'account-fresh.png'), fullPage: true })
console.log('shot account-fresh.png')
await b.close()
