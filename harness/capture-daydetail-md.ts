// harness/capture-daydetail-md.ts — CAPTURE, not a gate: render /v2/calendar/[date] on real data-shaped
// payloads and photograph it @393, so the M-D swap is reviewed by looking at it.
//
// Deliberately NOT a set of assertions (บอง/ฟีม 2026-08-06: the enforced 393 screenshot already catches
// colour, overflow and layout; anchors are for what the eye cannot see). The two invariants that DO need
// a machine — the compass table's geometry and "all 8 gates place or surface" — live in
// scripts/gate-compass.test.ts, which CI runs.
//
// Two boards are captured on purpose:
//   complete — the 8 distinct compass directions a real man-vs-day payload sends
//   partial  — the fixture's own gates, which repeat ทิศตะวันออก and so CANNOT fill a compass. That is not
//              a hypothetical: features/v2-calendar/fixtures.ts ships it today, and the screen has to show
//              the gap rather than a board that is quietly missing a cell.
//
//   npx tsx --tsconfig harness/tsconfig.json harness/capture-daydetail-md.ts   (dev server up)
import { chromium, type Browser } from 'playwright'
import * as fs from 'fs'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3105'
function gateKey(): string {
  if (process.env.V2_PREVIEW_KEY) return process.env.V2_PREVIEW_KEY
  try {
    const l = fs.readFileSync('testenv/env/fe.env', 'utf-8').split('\n').find((x) => x.trim().startsWith('V2_PREVIEW_KEY='))
    if (l) return l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  } catch {}
  return 'lamun-local-dev'
}
const KEY = gateKey()
const isPath = (u: string, p: string) => { try { return new URL(u).pathname === p } catch { return false } }
const UID = 'harness-md-user'
// payment.is_not_expired drives lib/v2/tier.ts → isPaid true → the advanced sections exist to photograph
const USER = {
  user_id: UID, name: 'ทดสอบ เอ็มดี', dob: '1990-06-15', gender: 'MALE',
  place_name: 'กรุงเทพมหานคร', is_remember_time: false,
  payment: { is_not_expired: true, total_friend: 0, limit_friend: 3 },
}

const GATES_COMPLETE = [
  { name: '開', direction: 'S', meaning: 'เปิด' }, { name: '休', direction: 'SW', meaning: 'พักผ่อน' },
  { name: '生', direction: 'W', meaning: 'เกิด' }, { name: '傷', direction: 'NW', meaning: 'บาดเจ็บ' },
  { name: '杜', direction: 'N', meaning: 'อุดตัน' }, { name: '景', direction: 'NE', meaning: 'เสน่ห์' },
  { name: '死', direction: 'E', meaning: 'ตาย' }, { name: '驚', direction: 'SE', meaning: 'กลัว' },
]
// straight out of features/v2-calendar/fixtures.ts — ทิศตะวันออก appears twice
const GATES_PARTIAL = [
  { name: '開', direction: 'ทิศตะวันออก', meaning: 'เปิดโอกาส เริ่มต้น' },
  { name: '休', direction: 'ทิศเหนือ', meaning: 'พักผ่อน สงบ' },
  { name: '生', direction: 'ทิศตะวันออกเฉียงเหนือ', meaning: 'เติบโต งอกงาม' },
  { name: '傷', direction: 'ทิศตะวันออก', meaning: 'บาดเจ็บ ระวังของมีคม' },
  { name: '杜', direction: 'ทิศตะวันออกเฉียงใต้', meaning: 'ปิดกั้น อุดตัน' },
  { name: '景', direction: 'ทิศใต้', meaning: 'แสงสว่าง ชื่อเสียง' },
  { name: '死', direction: 'ทิศตะวันตกเฉียงใต้', meaning: 'จบสิ้น หยุดนิ่ง' },
  { name: '驚', direction: 'ทิศตะวันตก', meaning: 'ตื่นตระหนก เรื่องไม่คาดฝัน' },
]

function libDetail(date: string, gates: typeof GATES_COMPLETE) {
  return {
    date, dayGanzhi: '己丑', overallPercent: 72, grade: 'B', verdict: 'good',
    summary: 'วันนี้ดวงดีมาก แค่เริ่มก็สำเร็จแล้ว',
    suitable: ['เจรจาต่อรอง', 'เริ่มงานใหม่'], avoid: ['เซ็นสัญญายาว', 'เดินทางไกล'],
    insight: 'วันนี้พลังแรงสุดตอนอยู่กับ “คนใกล้ตัว” (68%) — เลี่ยงงานที่ต้องออกไปเจอคนแปลกหน้า (45%)',
    // NOTE the field is `isStrength`, not `isMain`: the BFF returns the LIB shape, and lib/v2-calendar/
    // day-detail.ts is what maps facets[].isMain → isStrength. Stubbing the response means that mapper does
    // not run. The first version used isMain here and no card carried its advice lines — the STUB was wrong,
    // not the screen.
    compatAreas: [
      { key: 'home', label: 'อยู่บ้าน คุมลูกน้อง', percent: 68, grade: 'A-', isStrength: true },
      { key: 'companions', label: 'อยู่กับเพื่อน พี่น้อง', percent: 57, grade: 'B', isStrength: false },
      { key: 'workplace', label: 'ที่ทำงาน เจ้านาย', percent: 49, grade: 'C+', isStrength: false },
      { key: 'outside', label: 'นอกบ้าน คนแปลกหน้า', percent: 45, grade: 'C', isStrength: false },
    ],
    advice: ['คุยเรื่องสำคัญกับคนในบ้านได้ดี', 'มอบหมายงานให้ลูกน้องแล้วจะราบรื่น', 'เลี่ยงงานสังคมใหญ่ไว้ก่อน'],
    yams: [
      { id: 'y1', label: 'ยามมงคล มีลาภผล', window: '09:00-10:59' },
      { id: 'y2', label: 'ยามเจรจา', window: '13:00-14:59' },
      { id: 'y3', label: 'ยามลาภผล อนาคตดี', window: '21:00-22:59' },
    ],
    dithi: { officer: 'สะสาง', officerDesc: 'อับโชค เสียหาย เดียวดาย ทุกข์โศก', jianchu: '除 · ปัดกวาดสิ่งเก่า' },
    luckyDirection: 'NE',
    dayDeity: 'พระกษิติครรภ์',
    spirits: [
      { name: 'เทียน', keywords: ['วิสัยทัศน์', 'ดำเนินการตามแผน'] },
      { name: 'ฟู้', keywords: ['เพิ่มขวัญกำลังใจ', 'ฝันเป็นจริง'] },
      { name: 'เสอ', keywords: ['เหนือธรรมชาติ', 'สร้างเสน่ห์'] },
      { name: 'อิน', keywords: ['กลอุบาย', 'ข้อมูลสำคัญ'] },
      { name: 'เหอ', keywords: ['เยียวยา', 'ทำงานร่วมกัน'] },
      { name: 'เฉิน', keywords: ['ลิขสิทธิ์', 'ทวงหนี้'] },
      { name: 'เชวี่ย', keywords: ['โฆษณา', 'โน้มน้าว'] },
      { name: 'ตี้', keywords: ['วางโครงสร้าง', 'ลงทุนเน้นคุณค่า'] },
    ],
    wanPhra: { isWanPhra: true, label: 'แรม ๙ ค่ำ เดือน ๘' },
    dayPillars: { day: null, month: null, year: null },
    ownerPillars: {},
    gates,
    colors: [
      { element: 'ไม้', colors: 'เขียว' },
      { element: 'น้ำ', colors: 'ฟ้า น้ำเงิน เทา ดำ' },
      { element: 'ทอง', colors: 'ขาว' },
    ],
  }
}

// NOTE: the advanced toggle defaults to ON, so `clickToggle` turns it OFF. Found by capturing and
// reading the output (the first run photographed 8 gates as "basic" and 0 as "advanced").
async function shoot(browser: Browser, name: string, gates: typeof GATES_COMPLETE, clickToggle: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: new URL(HOST).hostname, path: '/' },
    { name: 'cookie-mumate-id', value: UID, domain: new URL(HOST).hostname, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.addInitScript(() => { const g = globalThis as unknown as { __name?: unknown }; if (!g.__name) g.__name = (f: unknown) => f })
  await page.route((u) => isPath(u.toString(), '/api/user'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route((u) => isPath(u.toString(), '/api/v2/day-detail'), (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: libDetail('2026-08-06', gates) }) }))
  await page.goto(`${HOST}/v2/calendar/2026-08-06`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="day-score"]').waitFor({ timeout: 20000 })
  if (clickToggle) {
    await page.locator('[role="switch"]').click()
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(300)
  await page.screenshot({ path: `harness/out/${name}.png`, fullPage: true })
  const board = await page.$$eval('[data-testid="gate-cell"]', (els) =>
    els.map((e) => `${e.getAttribute('data-dir')}:${e.querySelector('span:nth-child(2)')?.textContent ?? ''}`))
  const unplaced = await page.locator('[data-testid="gate-unplaced"]').count()
  console.log(`  ${name}: ${board.length} gate cells [${board.join(' ')}] · unplaced-notice=${unplaced}`)
  await ctx.close()
}

async function main() {
  const browser = await chromium.launch()
  console.log('— capturing /v2/calendar/2026-08-06 @393 —')
  await shoot(browser, 'md-daydetail-advanced-393', GATES_COMPLETE, false) // default = advanced ON
  await shoot(browser, 'md-daydetail-basic-393', GATES_COMPLETE, true)    // toggled OFF
  await shoot(browser, 'md-daydetail-partial-board-393', GATES_PARTIAL, false)
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
