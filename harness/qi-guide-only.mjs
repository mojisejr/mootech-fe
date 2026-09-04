// harness/qi-guide-only.mjs — re-capture just /v2/qi (guide) after a code change.
import { chromium } from 'playwright'
import { join } from 'node:path'
const BASE = 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY || 'lamun-local-dev'
const OUT = 'C:/Users/ASUS/AppData/Local/Temp/claude/C--Users-ASUS-Desktop-biz/0b74028a-445c-4acf-ab19-7b016aafc9fe/scratchpad'
const iso = (d, h, m) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, m, 0, 0); return x.toISOString() }
const WALLET = { anonId: 'demo', qi: 590, coins: 0, xp: 340, level: 2, nextLevelXp: 3000, levelStartXp: 2000, history: [
  { id: 3, qiDelta: 5, reason: 'qi:earn:daily_login', createdAt: iso(0, 9, 12) },
  { id: 2, qiDelta: -30, reason: 'qi:spend:chat_question', createdAt: iso(1, 19, 22) },
  { id: 1, qiDelta: 50, reason: 'referral:inviter', createdAt: iso(1, 13, 47) },
] }
const CATALOG = {
  earn: [
    { code: 'signup', qi: 50, limit: 'once', title: 'สมัครใหม่', note: 'โบนัสตั้งต้นครั้งแรกที่สมัครบัญชี' },
    { code: 'daily_login', qi: 5, limit: 'daily', title: 'เข้าใช้งานรายวัน', note: 'ล็อกอิน/เปิดแอปในแต่ละวัน' },
    { code: 'share', qi: 10, limit: 'daily', title: 'แชร์คอนเทนต์', note: 'แชร์เนื้อหาออกโซเชียล — วันละ 1 ครั้ง' },
    { code: 'referral_free', qi: 50, limit: 'per_referral', title: 'ชวนเพื่อนสมัครฟรี', note: 'ผู้ถูกชวนสมัครสำเร็จ — ได้ 50 QI ต่อคน' },
  ],
  spend: [
    { code: 'chat_question', qi: 30, title: 'ถามเซียนมู (AI Chat)', note: 'แลกสิทธิ์ถามแชท AI' },
    { code: 'card_use', qi: 10, title: 'เปิดไพ่/เซียมซี', note: 'แลกสิทธิ์เปิดไพ่/เสี่ยงทาย' },
    { code: 'matching_slot', qi: 150, title: '+1 Slot ดวงสมพงษ์ถาวร', note: 'เพิ่มช่องจับคู่ถาวร' },
    { code: 'course_destiny', qi: 500, title: 'คอร์สเรียนดวงชะตา', note: '' },
    { code: 'book_lifecode', qi: 3000, title: 'Life Code Book ฟรี', note: '' },
  ],
}
const ENT = { anonId: 'demo', qi: 590, tier: 'plus', credits: { card_use: 1, chat_question: 0, matching_slot: 2 }, owned: [] }
const REF = { anonId: 'demo', code: 'MUMATE725', inviteUrl: '', invitedCount: 3, rewardPerInvite: 50 }

const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
await c.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
await c.route('**/api/qi-wallet**', (r) => r.fulfill({ json: WALLET }))
await c.route('**/api/qi-catalog**', (r) => r.fulfill({ json: CATALOG }))
await c.route('**/api/qi-entitlements**', (r) => r.fulfill({ json: ENT }))
await c.route('**/api/referral**', (r) => r.fulfill({ json: REF }))
await c.route('**/api/v2/display-name**', (r) => r.fulfill({ json: { displayName: null } }))
const p = await c.newPage()
await p.goto(`${BASE}/v2/qi`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.evaluate(() => document.fonts.ready)
await p.addStyleTag({ content: 'nav[aria-label="เมนูหลัก"]{position:static!important;margin:14px auto 0} div.pb-36{padding-bottom:.75rem!important}' })
await p.screenshot({ path: join(OUT, 'qi-guide-new.png'), fullPage: true })
console.log('shot qi-guide-new.png')
await b.close()
