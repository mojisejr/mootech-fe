// harness/capture-notify-states.ts — #286 · ถ่ายแถบสถานะแจ้งเตือนครบ 6 สถานะ + ชีทสอนติดตั้ง
//
// ทำไมไม่ใช้ capture-route.ts (ท่ามาตรฐานของทีม): ท่านั้นถ่าย "route ตามที่เครื่องเป็น" — แต่ 6 สถานะนี้
// เป็นคุณสมบัติของ *เครื่อง* (มี/ไม่มี PushManager · iOS Safari ที่ยังไม่ติดตั้ง · สิทธิ์ที่ถูกปฏิเสธ)
// เครื่องเดียวให้ได้สถานะเดียว ⇒ ต้องประกอบ runtime เอง. ทุกอย่างอื่นตามบ้าน: dsf2 · widths ของทีม · out gitignored
//
// 🔴 เดินจาก env จริงของเบราว์เซอร์ (ลบ/ใส่ API ก่อน script ของเพจรัน) ❌ ไม่ยัด PwaCapability สำเร็จรูป
// นี่คือจุดที่ฟันยูนิตมองไม่เห็น: มันป้อน capability ที่ปั้นเอง จึงไม่มีวันรู้ว่า env จริงแบบไหน *ไปไม่ถึง*
// สถานะที่ตั้งใจ (เจอจริง: runtime ที่ไม่มี Notification API เลย → ค้างที่ unknown ตลอดไป)
//
//   V2_PREVIEW_KEY=<key> npx next dev -p 3399           # เทอร์มินัลหนึ่ง
//   CAPTURE_KEY=<key> npx tsx harness/capture-notify-states.ts
//
// ออกที่ harness/captures/notify/ (gitignored — ผลิตซ้ำได้ ไม่ commit binary กองใหญ่)
// ใส่ --curated เพื่อเขียนชุดเล็ก 393 ลง harness/out/ สำหรับแนบใน PR
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3399'
const KEY = process.env.CAPTURE_KEY ?? ''
const ROUTE = '/v2/calendar/notifications'
const CURATED = process.argv.includes('--curated')
const WIDTHS = (process.env.CAPTURE_WIDTHS ?? '320,393,1280').split(',').map(Number)

if (!KEY) {
  console.error('❌ ต้องมี CAPTURE_KEY (= V2_PREVIEW_KEY ของ dev server ที่กำลังเสิร์ฟอยู่)')
  console.error('   ไม่มีคีย์ = ถูกเด้งออกจาก /v2 แล้วยังได้ 200 — เขียวหลอก ⇒ สคริปต์นี้ปฏิเสธที่จะเดา')
  process.exit(1)
}

/** env ที่ readCapabilityEnv() อ่านได้จริง — ไม่ใช่ค่า capability สำเร็จรูป */
interface RuntimeEnv { sw: boolean; push: boolean; notif: string | null; iosSafari: boolean; standalone: boolean }
const ENVS: Record<string, RuntimeEnv> = {
  granted:         { sw: true,  push: true,  notif: 'granted', iosSafari: false, standalone: false },
  default:         { sw: true,  push: true,  notif: 'default', iosSafari: false, standalone: false },
  denied:          { sw: true,  push: true,  notif: 'denied',  iosSafari: false, standalone: false },
  'needs-install': { sw: true,  push: false, notif: 'default', iosSafari: true,  standalone: false },
  unsupported:     { sw: false, push: false, notif: 'default', iosSafari: false, standalone: false },
  // 🔴 ไม่มี Notification API เลย (webview เปล่า) → permission:'unknown' → notifyStateFrom คืน 'unknown'
  //    จอค้างเป็น skeleton ถาวร แยกจาก "กำลังโหลด" ไม่ออก — finding ของ #286 ยกไปถามในใบ
  unknown:         { sw: false, push: false, notif: null,      iosSafari: false, standalone: false },
}

const ROWS = [
  { id: 'r1', date: '2026-12-25', yamId: 'y2', yamLabel: 'ยามมงคล มีลาภผล ทรัพย์สิน', window: '09:00-11:00', destinations: ['mumate'], fireAtUtc: '2026-12-25T02:00:00.000Z' },
  { id: 'r2', date: '2026-12-25', yamId: 'y4', yamLabel: 'ยามดี เหมาะเจรจาการงาน',      window: '13:00-15:00', destinations: ['mumate', 'google'], fireAtUtc: '2026-12-25T06:00:00.000Z' },
  { id: 'r3', date: '2026-01-02', yamId: 'y1', yamLabel: 'ยามมงคล เริ่มสิ่งใหม่',        window: '07:00-09:00', destinations: ['mumate'], fireAtUtc: '2026-01-02T00:00:00.000Z' },
]

function initScript(e: RuntimeEnv): string {
  return `(() => {
    ${e.sw ? '' : `try { Object.defineProperty(navigator,'serviceWorker',{get:()=>undefined,configurable:true}); delete Navigator.prototype.serviceWorker } catch {}`}
    ${e.push ? '' : `try { delete window.PushManager } catch { window.PushManager = undefined }`}
    ${e.notif === null
      ? `try { delete window.Notification } catch { window.Notification = undefined }`
      : `try { if(!window.Notification) window.Notification = function(){};
             Object.defineProperty(window.Notification,'permission',{get:()=>${JSON.stringify(e.notif)},configurable:true}) } catch {}`}
    ${e.iosSafari
      // navigator.standalone "มีอยู่" เฉพาะ iOS Safari/WebKit — โค้ดตรวจการมีอยู่ ไม่ใช่ UA string
      ? `try { Object.defineProperty(navigator,'standalone',{get:()=>${e.standalone},configurable:true}) } catch {}`
      : `try { delete Navigator.prototype.standalone; delete navigator.standalone } catch {}
         (()=>{ const mm = window.matchMedia.bind(window)
           window.matchMedia = (q) => q === '(display-mode: standalone)'
             ? {matches:${e.standalone},media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},onchange:null,dispatchEvent(){return false}}
             : mm(q) })()`}
  })()`
}

// deterministic: ถอด animation ❌ ไม่ freeze — freeze หยุดที่ playhead สุ่ม, ถอดแล้วตกกลับสภาพฐานเสมอ
const KILL_MOTION = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`

const OUT = 'harness/captures/notify'
interface Row { state: string; width: number; expected: string; painted: string | null; onRoute: boolean; guide: boolean; errors: string[] }
const ok = (r: Row) => (r.painted === r.expected || (r.expected === 'unknown' && r.painted === 'unknown(skeleton)')) && r.onRoute && !r.errors.length

async function main() {
fs.mkdirSync(OUT, { recursive: true })
if (CURATED) fs.mkdirSync('harness/out', { recursive: true })

const report: Row[] = []
const browser = await chromium.launch()

for (const [state, env] of Object.entries(ENVS)) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width >= 1280 ? 1000 : 900 },
      deviceScaleFactor: CURATED && width === 393 ? 1 : 2, // curated = ชุดเล็กพอจะ commit
      reducedMotion: 'reduce', locale: 'th-TH', timezoneId: 'Asia/Bangkok',
    })
    await ctx.addCookies([{ name: 'v2_access', value: KEY, url: HOST }])
    await ctx.addInitScript(initScript(env))
    await ctx.route('**/api/v2/reminders', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, reminders: ROWS }) }))

    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    // cold load ต่อหนึ่งภาพ — เดินในแอปจะซ่อนบั๊กตอน first paint
    await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'networkidle' })
    await page.addStyleTag({ content: KILL_MOTION })

    // ⚠️ negative control: คีย์ผิด/หาย = ถูกเด้งไป /v2 แต่ยังตอบ 200 ⇒ ต้องเช็ค url ไม่ใช่ status
    const onRoute = page.url().includes(ROUTE)
    const bar = page.locator('[data-testid="notify-status"]')
    const skel = page.locator('[data-testid="notify-status-skeleton"]')
    const painted = (await bar.count()) ? await bar.getAttribute('data-notify-state')
                  : (await skel.count()) ? 'unknown(skeleton)' : 'NONE'

    await page.screenshot({ path: path.join(OUT, `${state}-${width}.png`), fullPage: true })
    if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-${state}-393.png`, fullPage: true })

    const guideBtn = page.locator('[data-testid="notify-status-guide"]')
    const hasGuide = (await guideBtn.count()) > 0
    if (hasGuide) {
      await guideBtn.click()
      await page.waitForTimeout(150)
      await page.addStyleTag({ content: KILL_MOTION })
      await page.screenshot({ path: path.join(OUT, `${state}-${width}-guide.png`), fullPage: true })
      if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-${state}-guide-393.png`, fullPage: true })
    }

    report.push({ state, width, expected: state, painted, onRoute, guide: hasGuide, errors })
    await ctx.close()
  }
}
await browser.close()

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ host: HOST, route: ROUTE, widths: WIDTHS, rows: report }, null, 2))

console.log('    สถานะ            กว้าง  วาดจริง             อยู่บน route  ปุ่มดูวิธี  error')
for (const r of report) {
  console.log(`  ${ok(r) ? '✓' : '✗'} ${r.state.padEnd(16)}${String(r.width).padEnd(7)}${String(r.painted).padEnd(20)}${r.onRoute ? 'ใช่' : '❌ ไม่'}          ${r.guide ? 'มี' : '—'}       ${r.errors.length || ''}`)
}
const bad = report.filter((r) => !ok(r)).length
console.log(bad ? `\n⚠️ ${bad}/${report.length} ใบไม่ตรงกับสถานะที่ตั้งใจ` : `\n✓ ${report.length}/${report.length} ใบตรงกับสถานะที่ตั้งใจ · เขียนที่ ${OUT}`)
process.exit(bad ? 1 : 0)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) }) // message only — ห้ามพ่นคีย์ลง log
