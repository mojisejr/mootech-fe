import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 800 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/notification-prefs', (r) => r.fulfill({ json: { dailyFortune: true, reminders: true, updates: false } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/settings/notifications`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.evaluate(() => document.fonts.ready)
console.log('master switch  :', await p.locator('[data-testid="notif-master-toggle"]').count())
console.log('toggle switches:', await p.locator('[role="switch"]').count())
console.log('daily on       :', (await p.getByTestId('notif-daily').getAttribute('aria-checked')))
await p.screenshot({ path: join(OUT, 'notif-v2.png'), fullPage: true })
console.log('shot notif-v2.png')
await b.close()
