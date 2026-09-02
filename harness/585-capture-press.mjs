// #585 ก้อน 4 — the press, end to end, in a real browser. Until this chunk the colleague result route
// could not be reached from inside the app at all, so this is the first time the whole path is walked.
//
// POST is mocked at the network edge per scenario; the GET that the result screen fires afterwards is
// mocked too, so the success run lands on a real rendered result instead of a 404.
import { chromium } from 'playwright'
import { evidenceDir } from './evidence-dir.mjs'

const BASE = 'http://localhost:3210'
const OUT = evidenceDir('585-press')

const role = (p, n) => ({ perspective: p, stageName: 'เจ๊าะ', narrative: n })
const ENTRY = {
  rank: 1, slot: 0,
  person: { slot: 0, friendId: 'f-1', name: 'กัสสรนาดี', surname: '', pictureUrl: '', timeKnown: true },
  rankScore: 95, grade: 'A', ratingText: 'เข้ากันได้ดีมาก',
  roles: [role('หุ้นส่วน/เพื่อนร่วมงาน', 'หุ้นส่วนที่กล้าลงทุน'), role('ตัวเรา → เจ้านาย', 'ทำงานกับหัวหน้า'), role('ลูกน้อง → ตัวเรา', 'ลูกน้องทำงานเร็ว')],
  rolesComplete: true, rolesMissing: 0, rankFromEngine: true,
}

// the five refusals, by the status the route actually answers with
const CASES = [
  { name: 'success', post: { status: 200, body: { ok: true, matching_id: 'm-1', entries: [ENTRY] } } },
  { name: 'quota', post: { status: 410, body: { ok: false, reason: 'quota', error: 'q' } } },
  { name: 'engine-down', post: { status: 503, body: { ok: false, reason: 'system', error: 'ระบบคำนวณไม่พร้อมใช้งานชั่วคราว' } } },
  { name: 'no-friend', post: { status: 404, body: { ok: false, reason: 'system', error: 'friend not found' } } },
  { name: 'unusable-birth', post: { status: 422, body: { ok: false, reason: 'system', error: 'ข้อมูลวันเกิดไม่ครบ' } } },
  { name: 'too-many', post: { status: 400, body: { ok: false, reason: 'system', error: 'เลือกได้สูงสุด 3 คน', max: 3 } } },
]

const b = await chromium.launch()
const seen = {}
for (const c of CASES) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 850 }, deviceScaleFactor: 2 })
  await ctx.addCookies([
    { name: 'v2_access', value: 'local-testenv', url: BASE },
    { name: 'cookie-mumate-id', value: 'b54b765a-c01b-471f-bf7c-0c2a1a448bdd', url: BASE },
  ])
  let posted = 0
  await ctx.route('**/api/v2/matching/work', async (route, req) => {
    if (req.method() !== 'POST') return route.fallback()
    posted++
    await route.fulfill({ status: c.post.status, contentType: 'application/json', body: JSON.stringify(c.post.body) })
  })
  await ctx.route('**/api/v2/matching/work/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, matching_id: 'm-1', create_at: 'x', entries: [ENTRY] }) }))
  // person1 is the LOGGED-IN user, and `canProceed` requires it. Without a database behind /api/user the
  // hook leaves it null and the button never enables — the run would then report "ปุ่มยังไม่เปิด" for all
  // six scenarios and prove nothing about any of them.
  await ctx.route('**/api/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      user_id: 'b54b765a-c01b-471f-bf7c-0c2a1a448bdd', name: 'ฟีม', dob: '1990-01-01', time: '08:00', picture_url: '',
    }) }))
  // the friend detail behind slot enrichment
  await ctx.route('**/api/member-with-friend/detail**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 'f-1', name: 'กัสสรนาดี', surname: '', picture_url: '', dob: '1990-06-15', time: '19:15', gender: 'FEMALE',
    }) }))
  // the friend list the picker reads. There is no backend here, so without this the sheet sits on
  // "กำลังโหลดรายชื่อ…" forever and the run measures a spinner rather than the press.
  await ctx.route('**/api/member-with-friend**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 'f-1', name: 'กัสสรนาดี', surname: '', picture_url: '', dob: '1990-06-15', time: '19:15', gender: 'FEMALE' },
      { id: 'f-9', name: 'ปินหยก', surname: '', picture_url: '', dob: '1992-08-01', time: '05:30', gender: 'MALE' },
    ]) }))
  const p = await ctx.newPage()
  await p.goto(`${BASE}/v2/service/compatibility/colleague`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await p.waitForSelector('[data-testid="compat-candidate-0"]', { timeout: 30000 })
  await p.click('[data-testid="compat-candidate-0"]')
  await p.waitForTimeout(900)
  // pick the first friend the real sheet offers; if the account has none, say so rather than pretend
  const row = p.locator('[data-testid^="compat-friend-f-"]').first()
  const has = await row.count()
  if (!has) { console.log(c.name, 'SKIPPED — ไม่มีเพื่อนในบัญชีทดสอบ ⇒ กดปุ่มไม่ได้'); await ctx.close(); continue }
  await row.click()
  await p.waitForTimeout(600)
  const btn = p.locator('[data-testid="compat-view-result"]')
  // wait for the pick to land rather than asserting on the first frame after the click
  await btn.waitFor({ state: 'visible' })
  const enabled = await p.waitForFunction(
    () => !(document.querySelector('[data-testid="compat-view-result"]')).disabled,
    null, { timeout: 8000 },
  ).then(() => true).catch(() => false)
  if (!enabled) { console.log(c.name, 'SKIPPED — ปุ่มยังไม่เปิดหลังเลือกคนแล้ว'); await ctx.close(); continue }
  await btn.click()
  await p.waitForTimeout(2500)
  const read = await p.evaluate(() => ({
    url: location.pathname,
    // ⚠️ NOT a "is it loading" flag. The first version of this line queried [role="status"] and reported
    // `true` on every refusal, because the blocked-tone error paragraph IS a role=status live region.
    // A field that answers the same on two different states is not a measurement — this one names the
    // screen that is actually mounted.
    onResultScreen: !!document.querySelector('[data-testid="work-result-screen"]'),
    err: document.querySelector('[data-testid="compat-result-error"]')?.textContent ?? null,
    roles: document.querySelectorAll('[data-testid="work-roles"] section').length,
  }))
  seen[c.name] = read
  console.log(c.name, 'posted=' + posted, JSON.stringify(read))
  await p.screenshot({ path: `${OUT}/press-${c.name}-393.png`, fullPage: false })
  await ctx.close()
}
const msgs = Object.entries(seen).filter(([k]) => k !== 'success').map(([, v]) => v.err)
console.log('\nข้อความปฏิเสธที่อ่านได้จริง:', JSON.stringify(msgs, null, 1))
console.log('ไม่ซ้ำกันกี่ประโยค:', new Set(msgs.filter(Boolean)).size, 'จาก', msgs.filter(Boolean).length)
await b.close()
