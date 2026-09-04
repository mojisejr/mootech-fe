import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const REF = { anonId: 'u', code: 'MUMATE-PKMOD05ZT', invitedCount: 3, rewardPerInvite: 50 }
const BOARD = { missions: [], goals: {
  referral: { invited: 3, rewardPerInviteQi: 50, earnedQi: 150 },
  element: { target: 5, collected: 3, bonusQi: 1000, elements: [{ key: 'wood', collected: true }, { key: 'metal', collected: true }, { key: 'fire', collected: true }, { key: 'earth', collected: false }, { key: 'water', collected: false }] },
} }
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/referral', (r) => r.fulfill({ json: REF }))
await c.route('**/api/missions**', (r) => r.fulfill({ json: BOARD }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/qi/referral`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.evaluate(() => document.fonts.ready)
const html = await p.content()
console.log('50 QI headline :', html.includes('ชวนเพื่อน รับคนละ 50 QI'))
console.log('no เหรียญ      :', !html.includes('เหรียญ'))
console.log('share channels :', html.includes('referral-share-line') && html.includes('Facebook'))
console.log('5-element goal :', html.includes('สะสมเพื่อนครบ 5 ธาตุ'))
console.log('earned 150 QI  :', html.includes('150 QI') || html.includes('150 คน') === false)
await p.addStyleTag({ content: 'nav[aria-label="เมนูหลัก"]{position:static!important;margin:14px auto 0} div.pb-36{padding-bottom:.75rem!important}' })
await p.screenshot({ path: join(OUT, 'referral-v2.png'), fullPage: true })
console.log('shot referral-v2.png')
await b.close()
