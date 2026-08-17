// harness/capture-notify-sheet.ts — #286 · ถ่าย "แถวมู่เมท" ในชีทตั้งเตือน ครบ 6 สถานะ บน route จริง
//
// คู่กับ capture-notify-states.ts (อันนั้นถ่ายแถบสถานะถาวรบนหน้ารายการ) — ใบ #286 ขอทั้งสองพื้นผิว
// พื้นผิวนี้แพงกว่าเพราะ /v2/calendar/[date] ต้องมีตัวตน + ดวงวัน ⇒ mock /api/user + /api/v2/day-detail
// ตามท่าที่ harness/capture-daydetail-md.ts วางไว้ (payload เป็น LIB shape — adapter ฝั่ง client เป็นคนแปลง)
//
//   V2_PREVIEW_KEY=<key> npx next dev -p 3399
//   CAPTURE_KEY=<key> npx tsx --tsconfig harness/tsconfig.json harness/capture-notify-sheet.ts
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3399'
const KEY = process.env.CAPTURE_KEY ?? ''
const DATE = process.env.CAPTURE_DATE ?? '2026-12-25' // อนาคต — ยามยังไม่ผ่าน ปุ่มบันทึกจึงมีความหมาย
const CURATED = process.argv.includes('--curated')
const WIDTHS = (process.env.CAPTURE_WIDTHS ?? '320,393,1280').split(',').map(Number)
const OUT = 'harness/captures/notify-sheet'

if (!KEY) {
  console.error('❌ ต้องมี CAPTURE_KEY — ไม่มีคีย์ = ถูกเด้งออกจาก /v2 แล้วยังได้ 200 (เขียวหลอก)')
  process.exit(1)
}

interface RuntimeEnv { sw: boolean; push: boolean; notif: string | null; iosSafari: boolean; standalone: boolean }
const ENVS: Record<string, RuntimeEnv> = {
  granted:         { sw: true,  push: true,  notif: 'granted', iosSafari: false, standalone: false },
  default:         { sw: true,  push: true,  notif: 'default', iosSafari: false, standalone: false },
  denied:          { sw: true,  push: true,  notif: 'denied',  iosSafari: false, standalone: false },
  'needs-install': { sw: true,  push: false, notif: 'default', iosSafari: true,  standalone: false },
  unsupported:     { sw: false, push: false, notif: 'default', iosSafari: false, standalone: false },
  // LINE ตัวจริง (ไม่มี Notification API) — ก่อนแก้ B1 ตกเป็น unknown แล้วค้าง ตอนนี้ตกช่องเดียวกับ unsupported
  'unsupported-line': { sw: false, push: false, notif: null,   iosSafari: false, standalone: false },
}
// 🔴 `unknown` ไม่มีอยู่ในตารางนี้ **โดยตั้งใจ** — หลังแก้ B1 มันเกิดได้เฉพาะช่วงก่อน effect แรกทำงาน
// ⇒ บังคับให้มันค้างในเบราว์เซอร์ไม่ได้อีกแล้ว ซึ่งคือผลลัพธ์ที่ถูกต้องของการแก้ · ❌ ไม่ประกอบ env ปลอม
// ให้ได้ภาพมาแปะ · สัญญาของสถานะนี้ถูกกันด้วยฟันยูนิต (โครงว่าง + ไม่มี mumate-toggle) แทน

const UID = 'harness-notify-user'
// payment.is_not_expired = true ⇒ สมาชิก ⇒ ชีทตั้งเตือนเปิดได้ (free ถูกกั้นคนละเส้นทาง)
const USER = {
  user_id: UID, name: 'ทดสอบ แจ้งเตือน', dob: '1990-06-15', gender: 'MALE',
  place_name: 'กรุงเทพมหานคร', is_remember_time: false,
  payment: { is_not_expired: true, total_friend: 0, limit_friend: 3 },
}

// LIB shape — client adapter เป็นคนแปลงเป็น feature shape (ถ้า stub เป็น feature shape adapter จะไม่ทำงาน
// แล้วจะได้จอที่ว่างโดยที่โค้ดจริงไม่ผิด — กับดักที่ capture-daydetail-md.ts เขียนเตือนไว้)
const libDetail = {
  date: DATE, dayGanzhi: '己丑', overallPercent: 72, grade: 'B', verdict: 'good',
  summary: 'วันนี้ดวงดีมาก แค่เริ่มก็สำเร็จแล้ว',
  suitable: ['เจรจาต่อรอง', 'เริ่มงานใหม่'], avoid: ['เซ็นสัญญายาว'],
  insight: 'วันนี้พลังแรงสุดตอนอยู่กับคนใกล้ตัว',
  compatAreas: [
    { key: 'home', label: 'อยู่บ้าน คุมลูกน้อง', percent: 68, grade: 'A-', isStrength: true },
    { key: 'outside', label: 'นอกบ้าน คนแปลกหน้า', percent: 45, grade: 'C', isStrength: false },
  ],
  advice: ['คุยเรื่องสำคัญกับคนในบ้านได้ดี'],
  yams: [
    { id: 'y1', label: 'ยามมงคล มีลาภผล ทรัพย์สิน', window: '09:00-10:59' },
    { id: 'y2', label: 'ยามเจรจา เหมาะคุยงาน', window: '13:00-14:59' },
    { id: 'y3', label: 'ยามลาภผล อนาคตดี', window: '21:00-22:59' },
  ],
  dithi: { officer: 'สะสาง', officerDesc: 'ปัดกวาดสิ่งเก่า', jianchu: '除' },
  luckyDirection: 'NE', dayDeity: 'พระกษิติครรภ์', spirits: [],
  wanPhra: { isWanPhra: false, label: '' },
  dayPillars: { day: null, month: null, year: null }, ownerPillars: {}, gates: [],
  colors: [{ element: 'ไม้', colors: 'เขียว' }],
}

function initScript(e: RuntimeEnv): string {
  return `(() => {
    ${e.sw ? '' : `try { Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined,configurable:true}); delete Navigator.prototype.serviceWorker } catch {}`}
    ${e.push ? '' : `try { delete window.PushManager } catch { window.PushManager = undefined }`}
    ${e.notif === null
      ? `try { delete window.Notification } catch { window.Notification = undefined }`
      : `try { if(!window.Notification) window.Notification = function(){};
             Object.defineProperty(window.Notification,'permission',{get:()=>${JSON.stringify(e.notif)},configurable:true}) } catch {}`}
    ${e.iosSafari
      ? `try { Object.defineProperty(navigator,'standalone',{get:()=>${e.standalone},configurable:true}) } catch {}`
      : `try { delete Navigator.prototype.standalone; delete navigator.standalone } catch {}
         (()=>{ const mm = window.matchMedia.bind(window)
           window.matchMedia = (q) => q === '(display-mode: standalone)'
             ? {matches:${e.standalone},media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent(){return false}}
             : mm(q) })()`}
  })()`
}

const KILL_MOTION = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`
const isPath = (u: string, p: string) => { try { return new URL(u).pathname === p } catch { return false } }

interface Row { state: string; width: number; sheetOpen: boolean; toggleDisabled: boolean | null; toggle: boolean; reason: string | null; hasGuideLink: boolean; skeleton: boolean; errors: string[] }
/** สิ่งที่ต้องเป็นจริงต่อสถานะ — เขียนไว้ตรงนี้ให้ผลลัพธ์ตรวจตัวเองได้ ไม่ใช่ให้คนไล่ดูภาพเอง
 *
 *  `toggle` (มี/ไม่มี `mumate-toggle`) คือ negative control ของเคส unknown: ปุ่มของ*แถว* มีอยู่ทุกสถานะ
 *  (แค่ disabled) ⇒ ถ้าดูแค่ปุ่มแถว จะแยก "โครงว่าง" กับ "toggle ปิด" ไม่ออกเลย — รอบแรกผมตั้ง EXPECT
 *  ผิดเพราะเหตุนี้จริงๆ แล้วมันฟ้องว่า 3 ใบไม่ตรง ทั้งที่จอถูก ⇒ ซ่อมเครื่องมือ ไม่ใช่ลดเกณฑ์ */
const EXPECT: Record<string, { disabled: boolean; toggle: boolean; reason: boolean; guide: boolean; skeleton: boolean }> = {
  granted:         { disabled: false, toggle: true,  reason: false, guide: false, skeleton: false },
  default:         { disabled: false, toggle: true,  reason: false, guide: false, skeleton: false },
  denied:          { disabled: true,  toggle: true,  reason: true,  guide: true,  skeleton: false },
  'needs-install': { disabled: true,  toggle: true,  reason: true,  guide: true,  skeleton: false },
  unsupported:     { disabled: true,  toggle: true,  reason: true,  guide: false, skeleton: false }, // ❌ ไม่มีวิธีให้สอน
  'unsupported-line': { disabled: true, toggle: true, reason: true, guide: false, skeleton: false },
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  if (CURATED) fs.mkdirSync('harness/out', { recursive: true })
  const report: Row[] = []
  const browser = await chromium.launch()

  for (const [state, env] of Object.entries(ENVS)) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: width >= 1280 ? 1000 : 900 },
        deviceScaleFactor: CURATED && width === 393 ? 1 : 2,
        reducedMotion: 'reduce', locale: 'th-TH', timezoneId: 'Asia/Bangkok',
      })
      await ctx.addCookies([
        { name: 'v2_access', value: KEY, url: HOST },
        { name: 'cookie-mumate-id', value: UID, url: HOST },
      ])
      await ctx.addInitScript(initScript(env))
      const page = await ctx.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      await page.route((u) => isPath(u.toString(), '/api/user'), (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
      await page.route((u) => isPath(u.toString(), '/api/v2/day-detail'), (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ detail: libDetail }) }))
      await page.route((u) => isPath(u.toString(), '/api/v2/reminders'), (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reminders: [] }) }))

      await page.goto(`${HOST}/v2/calendar/${DATE}`, { waitUntil: 'networkidle' })
      // เปิดชีทผ่านปุ่มจริงบนจอ ❌ ไม่เรียก hook ตรงๆ — ทางที่ผู้ใช้เดินคือทางที่ต้องถ่าย
      const cta = page.getByRole('button', { name: /เพิ่มลงปฏิทิน/ })
      if (await cta.count()) await cta.first().click()
      const sheet = page.locator('[data-testid="save-sheet"]')
      const sheetOpen = await sheet.count() > 0
      if (sheetOpen) await page.waitForTimeout(120)
      await page.addStyleTag({ content: KILL_MOTION })

      const dest = page.locator('[data-testid="dest-mumate"]')
      const skeleton = (await page.locator('[data-testid="mumate-skeleton"]').count()) > 0
      const toggleDisabled = (await dest.count()) ? await dest.first().isDisabled() : null
      const reasonEl = page.locator('[data-testid="mumate-reason"]')
      const reason = (await reasonEl.count()) ? (await reasonEl.first().textContent())?.trim() ?? null : null
      const hasGuideLink = (await page.locator('[data-testid="mumate-guide"]').count()) > 0
      const toggle = (await page.locator('[data-testid="mumate-toggle"]').count()) > 0

      await page.screenshot({ path: path.join(OUT, `sheet-${state}-${width}.png`), fullPage: false })
      if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-sheet-${state}-393.png`, fullPage: false })

      report.push({ state, width, sheetOpen, toggleDisabled, toggle, reason, hasGuideLink, skeleton, errors })
      await ctx.close()
    }
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ host: HOST, date: DATE, rows: report }, null, 2))

  const ok = (r: Row) => {
    const e = EXPECT[r.state]
    return r.sheetOpen && !r.errors.length && r.skeleton === e.skeleton && r.toggle === e.toggle &&
      r.toggleDisabled === e.disabled && (!!r.reason) === e.reason && r.hasGuideLink === e.guide
  }
  console.log('    สถานะ            กว้าง  ชีทเปิด  ติ๊กไม่ได้  toggle  มีเหตุผล  ปุ่มดูวิธี  โครงว่าง')
  for (const r of report) {
    console.log(`  ${ok(r) ? '✓' : '✗'} ${r.state.padEnd(16)}${String(r.width).padEnd(7)}${(r.sheetOpen ? 'ใช่' : '❌').padEnd(8)}${String(r.toggleDisabled ?? '—').padEnd(11)}${(r.toggle ? 'มี' : '—').padEnd(8)}${(r.reason ? 'มี' : '—').padEnd(10)}${(r.hasGuideLink ? 'มี' : '—').padEnd(11)}${r.skeleton ? 'ใช่' : '—'}`)
  }
  const bad = report.filter((r) => !ok(r)).length
  console.log(bad ? `\n⚠️ ${bad}/${report.length} ใบไม่ตรงกับที่สัญญาไว้` : `\n✓ ${report.length}/${report.length} ใบตรงกับที่สัญญาไว้ · เขียนที่ ${OUT}`)
  process.exit(bad ? 1 : 0)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) })
