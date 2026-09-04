// harness/qi-parity-capture.mjs — capture the rebuilt Qi-parity screens with mock data.
//   needs the dev server running on :3000 and .env.local with V2_PREVIEW_KEY.
//   node harness/qi-parity-capture.mjs
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = process.env.OUT_DIR || join(REPO, 'harness', 'pixel-proof')
mkdirSync(OUT, { recursive: true })
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()
if (!KEY) { console.error('no V2_PREVIEW_KEY in .env.local'); process.exit(1) }
const BASE = 'http://localhost:3000'
const W = 393
// fullPage + fixed bottom nav = ทับเนื้อหา (artifact) → un-fix ให้ไหลลงล่างจริง + collapse padding กันช่องว่าง
const MENU_CSS = 'nav[aria-label="เมนูหลัก"]{position:static!important;margin:14px auto 0} div.pb-40,div.pb-36,div.pb-24{padding-bottom:0.75rem!important}'

const iso = (daysAgo, h, m) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d.toISOString() }

const HISTORY_WALLET = {
  anonId: 'demo', qi: 590, coins: 0, xp: 120, level: 2,
  history: [
    { id: 6, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(0, 9, 12) },
    { id: 5, qiDelta: 10, reason: 'qi:earn:share', createdAt: iso(1, 21, 5) },
    { id: 4, qiDelta: -30, reason: 'qi:spend:chat_question', createdAt: iso(1, 19, 22) },
    { id: 3, qiDelta: 50, reason: 'referral:inviter', createdAt: iso(1, 13, 47) },
    { id: 2, qiDelta: 60, reason: 'mission:checkin_mu', createdAt: iso(2, 16, 30) },
    { id: 1, qiDelta: 200, reason: 'qi:buy:QI_200', createdAt: iso(3, 10, 0) },
  ],
}
const MISSIONS = { anonId: 'demo', date: '2026-09-04', missions: [{ id: 'checkin_mu', title: 'ภารกิจเช็คอินมู', description: '', period: 'daily', target: 1, rewardCoins: 60, rewardXp: 20, count: 1, completed: true, claimedAt: null }] }

const CHECKIN_WALLET = {
  anonId: 'demo', qi: 45, coins: 0, xp: 40, level: 1,
  history: [
    { id: 2, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(1, 8, 0) },
    { id: 1, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(2, 8, 0) },
  ],
}
const CATALOG = { earn: [{ code: 'daily_login', qi: 5, limit: 'daily', title: 'เช็คอินรายวัน', note: '' }], spend: [] }

const MISSIONS_WALLET = { anonId: 'demo', qi: 590, coins: 0, xp: 40, level: 1, history: [] }
const MISSIONS_BOARD = {
  anonId: 'demo', date: '2026-09-04',
  missions: [
    { id: 'read_fortune', title: 'อ่านดวงวันนี้', description: 'เปิดอ่านคำทำนายประจำวันให้จบ', period: 'daily', category: 'daily', target: 1, rewardCoins: 5, rewardXp: 10, count: 0, completed: false, claimedAt: null, actionHref: '/v2' },
    { id: 'share_fortune', title: 'แชร์ดวงวันนี้', description: 'การ์ดมีโค้ดชวนฝังอยู่ · แชร์ได้วันละ 1 ครั้ง', period: 'daily', category: 'daily', target: 1, rewardCoins: 10, rewardXp: 15, count: 0, completed: false, claimedAt: null, actionHref: '/v2/qi/referral' },
    { id: 'first_reading', title: 'ดูดวงครั้งแรก', description: 'ลองใช้บริการดูดวงสักอย่าง', period: 'once', category: 'once', target: 1, rewardCoins: 60, rewardXp: 30, count: 1, completed: true, claimedAt: '2026-09-03T02:00:00.000Z', actionHref: '/v2' },
    { id: 'connect_line', title: 'เชื่อมบัญชี LINE', description: 'รับแจ้งเตือนดวงรายวันทาง LINE', period: 'once', category: 'once', target: 1, rewardCoins: 20, rewardXp: 15, count: 0, completed: false, claimedAt: null, actionHref: '/v2/settings/connected' },
    { id: 'enable_notif', title: 'เปิดการแจ้งเตือน', description: 'กันลืมเช็คอินจนสถิติขาด', period: 'once', category: 'once', target: 1, rewardCoins: 10, rewardXp: 10, count: 0, completed: false, claimedAt: null, actionHref: '/v2/settings/notifications' },
    { id: 'streak_7', title: 'เช็คอิน 7 วันติด', description: 'นับใหม่ทุกสัปดาห์', period: 'once', category: 'longterm', target: 7, rewardCoins: 30, rewardXp: 40, count: 4, completed: false, claimedAt: null },
  ],
  goals: {
    referral: { invited: 3, rewardPerInviteQi: 50, earnedQi: 150 },
    element: { target: 5, collected: 3, bonusQi: 1000, elements: [{ key: 'wood', collected: true }, { key: 'metal', collected: true }, { key: 'fire', collected: true }, { key: 'earth', collected: false }, { key: 'water', collected: false }] },
  },
}

const b = await chromium.launch()
async function shot(route, mocks, name) {
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  for (const [pattern, json] of mocks) await c.route(pattern, (r) => r.fulfill({ json }))
  const p = await c.newPage()
  await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.evaluate(() => document.fonts.ready)
  await p.addStyleTag({ content: MENU_CSS })
  await p.screenshot({ path: join(OUT, name), fullPage: true })
  console.log('shot', name)
  await c.close()
}

await shot('/v2/qi/history', [['**/api/qi-wallet**', HISTORY_WALLET], ['**/api/missions**', MISSIONS]], 'parity-qi-history.png')
await shot('/v2/qi/checkin', [['**/api/qi-wallet**', CHECKIN_WALLET], ['**/api/qi-catalog**', CATALOG]], 'parity-qi-checkin.png')
await shot('/v2/qi/missions', [['**/api/missions**', MISSIONS_BOARD], ['**/api/qi-wallet**', MISSIONS_WALLET]], 'parity-qi-missions.png')

const GUIDE_WALLET = { anonId: 'demo', qi: 590, coins: 0, xp: 340, level: 2, nextLevelXp: 3000, levelStartXp: 2000, history: [
  { id: 3, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(0, 9, 12) },
  { id: 2, qiDelta: -30, reason: 'qi:spend:chat_question', createdAt: iso(1, 19, 22) },
  { id: 1, qiDelta: 50, reason: 'referral:inviter', createdAt: iso(1, 13, 47) },
] }
const GUIDE_CATALOG = {
  earn: [
    { code: 'signup', qi: 50, limit: 'once', title: 'สมัครใหม่', note: 'โบนัสตั้งต้นครั้งแรกที่สมัครบัญชี — ได้ครั้งเดียว' },
    { code: 'daily_login', qi: 5, limit: 'daily', title: 'เข้าใช้งานรายวัน', note: 'ล็อกอิน/เปิดแอปในแต่ละวัน — วันละ 1 ครั้ง' },
    { code: 'share', qi: 10, limit: 'daily', title: 'แชร์คอนเทนต์', note: 'แชร์เนื้อหาออกโซเชียล — วันละ 1 ครั้ง' },
    { code: 'referral_free', qi: 50, limit: 'per_referral', title: 'ชวนเพื่อนสมัครฟรี', note: 'ผู้ถูกชวนสมัครสำเร็จ — ได้ 50 QI ต่อคน' },
  ],
  spend: [
    { code: 'card_use', qi: 10, grant: { type: 'credit', kind: 'card_use', credits: 1 }, title: 'เปิดการ์ด/เสี่ยงทาย +1 ครั้ง', note: 'แลกสิทธิ์เปิดไพ่/เสี่ยงทาย' },
    { code: 'chat_question', qi: 30, grant: { type: 'credit', kind: 'chat_question', credits: 1 }, title: 'ถาม AI +1 คำถาม', note: 'แลกสิทธิ์ถามแชท AI' },
    { code: 'course_destiny', qi: 500, grant: { type: 'owned', kind: 'course', sku: 'destiny' }, title: 'คอร์สลิขิตชีวิต', note: 'แลกสิทธิ์เข้าคอร์ส' },
    { code: 'book_lifecode', qi: 3000, grant: { type: 'owned', kind: 'book', sku: 'lifecode' }, title: 'หนังสือ Life Code', note: 'แลกสิทธิ์หนังสือดิจิทัล' },
  ],
}
const GUIDE_ENT = { anonId: 'demo', qi: 590, tier: 'plus', credits: { card_use: 1, chat_question: 0, matching_slot: 2 }, owned: [] }
const GUIDE_REF = { anonId: 'demo', code: 'MUMATE725', inviteUrl: '', invitedCount: 3, rewardPerInvite: 50 }
await shot('/v2/qi', [
  ['**/api/qi-wallet**', GUIDE_WALLET], ['**/api/qi-catalog**', GUIDE_CATALOG],
  ['**/api/qi-entitlements**', GUIDE_ENT], ['**/api/referral**', GUIDE_REF],
  ['**/api/v2/display-name**', { displayName: null }],
], 'parity-qi-guide.png')

// buy-qi: payment-package ตอบตามโค้ด (ราคา Figma)
{
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const PP = { QI_60: 35, QI_200: 99, QI_500: 219, QI_1200: 449 }
  await c.route('**/api/payment-package**', (r) => {
    const code = new URL(r.request().url()).searchParams.get('code')
    r.fulfill({ json: { package_code: code, amount: PP[code] ?? null, is_active: true } })
  })
  await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: { qi: 590, history: [] } }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/qi/buy`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.evaluate(() => document.fonts.ready)
  await p.addStyleTag({ content: MENU_CSS })
  await p.screenshot({ path: join(OUT, 'parity-qi-buy.png'), fullPage: true })
  console.log('shot parity-qi-buy.png')
  await c.close()
}

// account dashboard
{
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const ACC_WALLET = { anonId: 'demo', qi: 590, coins: 0, xp: 340, level: 2, nextLevelXp: 3000, levelStartXp: 2000, history: [
    { id: 3, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(0, 9, 12) },
    { id: 2, qiDelta: 10, reason: 'qi:earn:share', createdAt: iso(1, 21, 5) },
    { id: 1, qiDelta: -10, reason: 'qi:spend:card_use', createdAt: iso(1, 19, 22) },
  ] }
  await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: ACC_WALLET }))
  await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { firstName: 'พี่มู', displayName: 'phimu', birthDate: '1984-01-15', birthTime: '09:30' } } }))
  await c.route('**/api/bazi/element-summary', (r) => r.fulfill({ json: { summary: { elementTh: 'ไม้', tagline: 'ต้นไม้ใหญ่ที่เติบโตมั่นคง โอบอุ้มคนรอบข้าง มีเมตตาและมองการณ์ไกล', traits: ['ใจดี', 'มุ่งมั่น'], advice: [] } } }))
  await c.route('**/api/missions**', (r) => r.fulfill({ json: MISSIONS_BOARD }))
  await c.route('**/api/referral**', (r) => r.fulfill({ json: { code: 'MUMATE725', invitedCount: 8, rewardPerInvite: 50 } }))
  await c.route('**/api/v2/account/delete', (r) => r.fulfill({ json: { deletion: null } }))
  await c.route('**/api/user**', (r) => r.fulfill({ json: { user_id: 'demo', membership: { isPaid: false, tier: 'free', source: 'v2', expireAt: null } } }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/account`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  await p.evaluate(() => document.fonts.ready)
  await p.addStyleTag({ content: MENU_CSS })
  await p.screenshot({ path: join(OUT, 'parity-account.png'), fullPage: true })
  console.log('shot parity-account.png')
  await c.close()
}

// plan
{
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  const PY = { V2_PLUS_YEARLY: 790, V2_PRO_YEARLY: 1590 }
  await c.route('**/api/payment-package**', (r) => {
    const code = new URL(r.request().url()).searchParams.get('code')
    r.fulfill({ json: { package_code: code, amount: PY[code] ?? null, is_active: true } })
  })
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/account/plan`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.evaluate(() => document.fonts.ready)
  await p.addStyleTag({ content: MENU_CSS })
  await p.screenshot({ path: join(OUT, 'parity-plan.png'), fullPage: true })
  console.log('shot parity-plan.png')
  await c.close()
}

// edit-profile
{
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { displayName: 'phimu', firstName: 'พี่มู', lastName: 'ใจดี', gender: 'FEMALE', birthDate: '1984-01-15', birthTime: '09:30', timeUnknown: false } } }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/settings/edit-profile`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.evaluate(() => document.fonts.ready)
  await p.setViewportSize({ width: W, height: 720 })
  await p.screenshot({ path: join(OUT, 'parity-edit-profile.png'), fullPage: false })
  console.log('shot parity-edit-profile.png')
  await c.close()
}

// connected
{
  const c = await b.newContext({ viewport: { width: W, height: 760 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { displayName: 'phimu' } } }))
  await c.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'พี่มู', email: 'mu@mumate.co' }, provider: 'line', expires: '2027-01-01T00:00:00.000Z' } }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/settings/connected`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: join(OUT, 'parity-connected.png'), fullPage: false })
  console.log('shot parity-connected.png')
  await c.close()
}

// edit-birth (free state)
{
  const c = await b.newContext({ viewport: { width: W, height: 820 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/profile', (r) => r.fulfill({ json: { profile: { birthDate: '1984-01-15', birthTime: '09:30', timeUnknown: false }, quota: { birthEditFreeUsed: false, birthEditPriceQi: 100, pendingCorrection: null } } }))
  await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: { qi: 590 } }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/settings/edit-birth`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.evaluate(() => document.fonts.ready)
  await p.screenshot({ path: join(OUT, 'parity-edit-birth.png'), fullPage: false })
  console.log('shot parity-edit-birth.png')
  await c.close()
}

const PAYMENTS = { payments: [
  { chargeId: 'chg_1', orderId: 'MUM-2569-004219', packageCode: 'QI_500', tierCode: 'QI', amountSatang: 21900, method: 'card', status: 'APPROVED', failureCode: null, createdAt: iso(1, 21, 5) },
  { chargeId: 'chg_2', orderId: 'MUM-2569-004180', packageCode: 'V2_PRO_YEARLY', tierCode: 'PRO', amountSatang: 159000, method: 'promptpay', status: 'APPROVED', failureCode: null, createdAt: iso(20, 10, 0) },
  { chargeId: 'chg_3', orderId: 'MUM-2569-004150', packageCode: 'QI_200', tierCode: 'QI', amountSatang: 9900, method: 'card', status: 'REJECT', failureCode: 'gateway_expired', createdAt: iso(40, 14, 0) },
] }
// orders
{
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/v2/payment/status**', (r) => r.fulfill({ json: PAYMENTS }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/orders`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.evaluate(() => document.fonts.ready)
  await p.addStyleTag({ content: MENU_CSS })
  await p.screenshot({ path: join(OUT, 'parity-orders.png'), fullPage: true })
  console.log('shot parity-orders.png')
  await c.close()
}
// receipt
{
  const c = await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 2 })
  await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
  await c.route('**/api/v2/payment/status**', (r) => r.fulfill({ json: PAYMENTS }))
  const p = await c.newPage()
  await p.goto(`${BASE}/v2/orders/chg_1`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.evaluate(() => document.fonts.ready)
  await p.addStyleTag({ content: MENU_CSS })
  await p.screenshot({ path: join(OUT, 'parity-receipt.png'), fullPage: true })
  console.log('shot parity-receipt.png')
  await c.close()
}

await b.close()
