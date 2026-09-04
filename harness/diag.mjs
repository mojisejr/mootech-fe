import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' .env.local | cut -d= -f2- | tr -d '"'`).toString().trim()
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 1 })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { displayName: 'phimu', firstName: 'พี่มู', lastName: 'ใจดี', gender: 'FEMALE', birthDate: '1984-01-15', birthTime: '09:30', timeUnknown: false } } }))
const p = await c.newPage()
await p.goto('http://localhost:3000/v2/settings/edit-profile', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
const rects = await p.evaluate(() => {
  const pick = (sel) => { const e = document.querySelector(sel); if (!e) return sel + ': MISSING'; const r = e.getBoundingClientRect(); return `${sel}: top=${Math.round(r.top)} h=${Math.round(r.height)}` }
  return [pick('header'), pick('[data-testid="ep-form"]'), pick('[data-testid="ep-first-name"]'), pick('[data-testid="ep-birth-link"]'), 'bodyH=' + document.body.scrollHeight].join('\n')
})
console.log(rects)
await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad/parity-edit-profile.png', fullPage: false })
await b.close()
