// #298 — negative control at the DB for the reminder-save + push-register wire, moved out of a throwaway
// comment into a runnable tool (มุน's ask, bongbing-oracle#43: "manual negative control ที่ย้ายเข้าเครื่องมือ
// ได้ ให้ย้าย"). It drives the REAL endpoints with a REAL member session and asserts rows at the DB:
//
//   reminder     0 → POST /api/v2/reminders {destinations:['mumate']} → 1 → (2nd day) both persist
//   push_subscr  0 → POST /api/v2/push/subscribe → 1
//
// The bodies are byte-for-byte what reminders-api.ts / persist-subscription.ts send, so this proves the
// connection the reframe risks: ticking a ยาม (no destination picked) saves via the auto-filled ['mumate']
// instead of 400-ing. What it does NOT cover — the browser gesture, the permission prompt, and pushManager.-
// subscribe() minting the endpoint — is #290 (iPhone-real); the full day PAGE render needs BE+bazi and is an
// Eye-lane walk (#305). This is API-truth only, by design.
//
// Run (needs testenv stack DB + a next server pointed at it, ENVIRONMENT=develop for /dev-login):
//   DATABASE_URL=<testenv-pg-url> NEXTAUTH_SECRET=… V2_PREVIEW_KEY=local-testenv ENVIRONMENT=develop \
//     npx next dev -p 3055 &
//   HARNESS_HOST=http://localhost:3055 TEST_DB_URL=<testenv-pg-url> npx tsx harness/push-subscribe-e2e.ts
//   (both URLs = the testenv stack's local postgres, e.g. testenv/env/fe.env's DATABASE_URL — never inline it here)
import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'

const HOST = process.env.HARNESS_HOST || 'http://localhost:3055'
// TEST_DB_URL is REQUIRED and passed via env — never hardcode a connection string (even the trivial local
// testenv one) in committed source; a credential URI in the tree is exactly what the secret-scan gate flags.
const DB = process.env.TEST_DB_URL
if (!DB) { console.error('set TEST_DB_URL to the testenv postgres connection string (see the Run: header)'); process.exit(2) }
const KEY = process.env.V2_PREVIEW_KEY || 'local-testenv'
const USER = process.env.DEV_USER || '5c7befb3-ebd3-4740-989e-fd6a1cca9662' // dev seed + MEMBER (member_payment)

// psql via connection string; -tAc for a bare scalar
const psql = (sql: string) => execSync(`psql "${DB}" -tAc ${JSON.stringify(sql)}`).toString().trim()
const remRows = (d: string) => Number(psql(`select count(*) from reminder where user_id='${USER}' and reminder_date='${d}'`))
const remDest = (d: string) => psql(`select destinations from reminder where user_id='${USER}' and reminder_date='${d}' limit 1`)

const endpoint = 'https://push.test/e2e-298'
const subBody = { endpoint, expirationTime: null, keys: { p256dh: 'P', auth: 'A' }, userAgent: 'harness-298' }
const subRows = () => Number(psql(`select count(*) from push_subscription where endpoint='${endpoint}' and user_id='${USER}'`))

// exact shape onSheetSave builds → reminders.save({ date, yams, destinations: ['mumate'] })
const reminderBody = (date: string) => ({ date, yams: [{ yamId: 'y1', yamLabel: 'ยามมงคล', window: '09:00-10:59' }], destinations: ['mumate'] })

// two future days relative to "now" of the run; pass via env if the fixed dates drift into the past
const D1 = process.env.E2E_DATE1 || '2026-08-20'
const D2 = process.env.E2E_DATE2 || '2026-08-21'

let failed = false
const check = (l: string, c: boolean) => { console.log(`${c ? '✅' : '❌'} ${l}`); if (!c) failed = true }

async function main() {
  psql(`delete from reminder where user_id='${USER}' and reminder_date in ('${D1}','${D2}')`)
  psql(`delete from push_subscription where endpoint='${endpoint}'`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: HOST })
  await ctx.request.post('/api/v2/login', { form: { passkey: KEY }, maxRedirects: 0 }).catch(() => {})
  const page = await ctx.newPage()
  await page.goto('/dev-login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('input').nth(0).fill(USER)
  await page.locator('input').nth(1).fill('e2e-298')
  await page.getByRole('button', { name: /dev login/i }).click()
  // dev-login signs in then reloads to '/'; wait for that so the session cookie is committed before we POST
  // (a cold dev server compiles /api/auth/* on first hit, so a fixed sleep can fire before the session exists)
  await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(500)

  check(`ก่อนกด: 0 แถวใน reminder (${D1}) — negative control`, remRows(D1) === 0)
  const r1 = await ctx.request.post('/api/v2/reminders', { data: reminderBody(D1) })
  check(`POST /reminders (destinations:['mumate']) → 201 (ได้ ${r1.status()})`, r1.status() === 201)
  check('หลังกด: 1 แถวใน reminder', remRows(D1) === 1)
  check('แถวมีปลายทาง mumate (ระบบเติมเอง ผ่านด่าน 400)', remDest(D1).includes('mumate'))

  const r2 = await ctx.request.post('/api/v2/reminders', { data: reminderBody(D2) })
  check(`POST /reminders วันที่ 2 → 201 (ได้ ${r2.status()})`, r2.status() === 201)
  check(`ทั้งสองวันอยู่ครบ (${D1}=${remRows(D1)} · ${D2}=${remRows(D2)})`, remRows(D1) === 1 && remRows(D2) === 1)

  check('ก่อนเปิด push: 0 แถว — negative control', subRows() === 0)
  const p1 = await ctx.request.post('/api/v2/push/subscribe', { data: subBody })
  check(`POST /push/subscribe → 201 (ได้ ${p1.status()})`, p1.status() === 201)
  check('หลังเปิด: 1 แถวใน push_subscription', subRows() === 1)

  await browser.close()
  console.log(failed ? '\n🔴 FAILED' : '\n🟢 PASSED — reminder(mumate) + push rows created, negative control at DB')
  process.exit(failed ? 1 : 0)
}
main().catch((e) => { console.error('harness error', e); process.exit(2) })
