import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 1000 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { firstName: 'พี่มู', displayName: 'phimu' } } }))
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: { qi: 590 } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/settings`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1100)
await p.evaluate(() => document.fonts.ready)
const html = await p.content()
console.log('group พลังชี่   :', html.includes('พลังชี่'))
console.log('group เกี่ยวกับ :', html.includes('เกี่ยวกับ'))
console.log('version         :', html.includes('Mumate v2.1.0'))
console.log('QI value 590    :', html.includes('590 QI'))
console.log('no emoji tiles  :', !html.includes('💎') && !html.includes('🔔'))
console.log('delete-permanent:', html.includes('ลบบัญชีถาวร'))
await p.screenshot({ path: join(OUT, 'settings-v2.png'), fullPage: true })
console.log('shot settings-v2.png')
await b.close()
