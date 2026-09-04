import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const PROFILE = { anonId: 'u', profile: { displayName: 'phimu', firstName: 'พี่มู', lastName: 'ใจดี', gender: 'FEMALE', email: 'mu@mumate.co', birthDate: '1990-05-12', birthTime: '08:30', birthProvince: 'ตรัง', timeUnknown: false }, quota: { birthEditFreeUsed: false, birthEditPriceQi: 100, pendingCorrection: null } }
const b = await chromium.launch()
async function shot(route, name, checks) {
  const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/profile**', (r) => r.fulfill({ json: PROFILE }))
  await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: { qi: 590 } }))
  const p = await c.newPage()
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1000)
  await p.evaluate(() => document.fonts.ready)
  const html = await p.content()
  for (const [label, needle] of checks) console.log(`  ${name} ${label}:`, html.includes(needle))
  await p.screenshot({ path: join(OUT, name), fullPage: true })
  console.log('shot', name)
  await c.close()
}
await shot('/v2/settings/edit-profile', 'editprofile-v2.png', [['email-field', 'ep-email'], ['email-val', 'mu@mumate.co'], ['helper', 'ใช้ส่งใบเสร็จ']])
await shot('/v2/settings/edit-birth', 'editbirth-v2.png', [['province-field', 'eb-province'], ['province-val', 'ตรัง'], ['helper', 'สุริยคติ']])
await b.close()
