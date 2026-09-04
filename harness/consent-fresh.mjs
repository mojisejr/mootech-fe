import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 1000 }, deviceScaleFactor: 2, bypassCSP: true, serviceWorkers: 'block' })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
// history ปิดไว้ (accepted:false) เพื่อโชว์กล่องผลกระทบสีแดง
await c.route('**/api/consent', (r) => r.fulfill({ json: { consents: [{ kind: 'history', version: '2026-09', accepted: false, createdAt: new Date().toISOString() }] } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/privacy/consent`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.evaluate(() => document.fonts.ready)
console.log('5 switches   :', await p.locator('[data-testid^="consent-"][role="switch"]').count())
console.log('pdpa locked  :', await p.getByTestId('consent-pdpa').getAttribute('aria-disabled'))
console.log('impact red   :', await p.locator('[data-testid="consent-impact-history"]').count())
console.log('log row      :', await p.locator('[data-testid="consent-log"]').count())
await p.screenshot({ path: join(OUT, 'consent-v2.png'), fullPage: true })
console.log('shot consent-v2.png')
await b.close()
