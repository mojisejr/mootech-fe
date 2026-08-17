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
  // webview ที่ *มี* Notification แต่ไม่มี PushManager
  unsupported:     { sw: false, push: false, notif: 'default', iosSafari: false, standalone: false },
  // 🔴 LINE ตัวจริง: ไม่มี Notification API เลย · ก่อนแก้ B1 เคสนี้ตกไปเป็น 'unknown' แล้วค้าง skeleton
  //    ถาวร (ตู๋จับได้ที่ #292) ⇒ ถ่ายไว้เป็นใบแยกเพื่อให้เห็นว่ามันพูดความจริงแล้ว
  'unsupported-line': { sw: false, push: false, notif: null,   iosSafari: false, standalone: false },
}
/** สถานะที่คาดหวังต่อ env — หลัง B1 ทั้งสอง webview ตกช่องเดียวกัน คนละทางเข้า */
const EXPECT_STATE: Record<string, string> = { 'unsupported-line': 'unsupported' }
/** `unknown` หลัง B1 เกิดได้เฉพาะ SSR/ก่อน effect แรก ⇒ ถ่ายด้วยการปิด JS (คือ markup ที่เซิร์ฟเวอร์ส่งจริง)
 *  ❌ ไม่ประกอบ env ปลอมให้มันค้าง — ถ้ามันค้างได้ในเบราว์เซอร์จริง นั่นแปลว่า B1 กลับมา */
const SSR_ROW = { state: 'unknown-ssr', expected: 'unknown' }

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
      // #307: permission เก็บในตัวแปร ไม่ใช่ค่าคงที่ และ requestPermission() เลื่อนมันไปตามที่ตกลง —
      // นี่คือการเล่นบทของ *เบราว์เซอร์+ผู้ใช้* ตามสัญญาที่ Notification API ประกาศไว้ ❌ ไม่ใช่การป้อน
      // ผลลัพธ์ให้ UI · สิ่งที่ถูกทดสอบคือโค้ดของเรา: กดแล้วเรียกมันจริงไหม และอ่านค่าใหม่หลังจากนั้นไหม
      : `try { if(!window.Notification) window.Notification = function(){};
             window.__notifPerm = ${JSON.stringify(e.notif)};
             window.__reqCalls = 0;
             Object.defineProperty(window.Notification,'permission',{get:()=>window.__notifPerm,configurable:true});
             window.Notification.requestPermission = () => { window.__reqCalls++;
               if (window.__notifPerm === 'default') window.__notifPerm = ${JSON.stringify('granted')};
               return Promise.resolve(window.__notifPerm) } } catch {}`}
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
interface Row { state: string; width: number; expected: string; painted: string | null; onRoute: boolean; guide: boolean; errors: string[]
  /** #307 — ปุ่มลงมือ (มีได้เฉพาะ default) · กล่องสี (ต้องหายเฉพาะ granted) · ผลของการกดปุ่มจริง */
  enable?: boolean; boxed?: boolean; afterClick?: string | null; reqCalls?: number }
const ok = (r: Row) => {
  const stateOk = (r.painted === r.expected || (r.expected === 'unknown' && r.painted === 'unknown(skeleton)')) && r.onRoute && !r.errors.length
  if (!stateOk) return false
  // ── #307 ─────────────────────────────────────────────────────────────────────────────────────
  const s = r.expected
  if (s === 'unknown') return true                                  // โครงว่าง ไม่มีปุ่ม ไม่มีกล่อง
  if (r.enable !== (s === 'default')) return false                  // ปุ่มลงมือ: เฉพาะ default
  if (r.boxed !== (s !== 'granted')) return false                   // กล่องสี: หายเฉพาะ granted
  if (s === 'default') {
    // กดแล้วต้องเกิดสองอย่าง: เรียก requestPermission จริง และแถบต้องอ่านค่าใหม่แล้วพลิกเป็น granted
    if (!r.reqCalls) return false
    if (r.afterClick !== 'granted') return false
  }
  return true
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
    // 🔴 #307 — รอให้ effect แรกอ่าน capability เสร็จก่อนอ่านค่า: `networkidle` บอกว่าเน็ตนิ่ง
    // ❌ ไม่ได้บอกว่า React commit effect แล้ว ⇒ รอบก่อนหน้านี้บางใบอ่านได้ 'unknown(skeleton)'
    // สลับที่กันไปมาทุกรอบ (granted@1280 รอบหนึ่ง · default@320 อีกรอบ) = แข่งกัน ไม่ใช่บั๊กของจอ
    //
    // 🔑 ฟันไม่หายไปกับการรอ: ถ้า `unknown` ค้างจริง (บั๊ก B1 ของ #292 กลับมา) แถบจะไม่มีวันโผล่
    // ⇒ หมดเวลา แล้ว painted ยังเป็น skeleton ⇒ ใบนั้น**แดง**ตามเดิม · การรอเปลี่ยนแค่ *ความเร็วเครื่อง*
    // ให้ไม่นับเป็นบั๊ก ❌ ไม่ได้ผ่อนเกณฑ์ว่าอะไรถือว่าถูก
    await page.waitForFunction(() => document.querySelector('[data-testid="notify-status"]') !== null, undefined, { timeout: 8000 })
      .catch(() => {})
    const bar = page.locator('[data-testid="notify-status"]')
    const skel = page.locator('[data-testid="notify-status-skeleton"]')
    const painted = (await bar.count()) ? await bar.getAttribute('data-notify-state')
                  : (await skel.count()) ? 'unknown(skeleton)' : 'NONE'

    await page.screenshot({ path: path.join(OUT, `${state}-${width}.png`), fullPage: true })
    if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-${state}-393.png`, fullPage: true })

    // #307 · ปุ่มลงมือ + กล่องสี — อ่านจาก DOM ที่วาดจริง ไม่ใช่จากสิ่งที่โค้ดตั้งใจ
    const enableBtn = page.locator('[data-testid="notify-status-enable"]')
    const hasEnable = (await enableBtn.count()) > 0
    const boxed = (await bar.count())
      ? ((await bar.getAttribute('class')) ?? '').includes('bg-v3-grade-yellow')
      : false

    const guideBtn = page.locator('[data-testid="notify-status-guide"]')
    const hasGuide = (await guideBtn.count()) > 0
    if (hasGuide) {
      await guideBtn.click()
      await page.waitForTimeout(150)
      await page.addStyleTag({ content: KILL_MOTION })
      await page.screenshot({ path: path.join(OUT, `${state}-${width}-guide.png`), fullPage: true })
      if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-${state}-guide-393.png`, fullPage: true })
    }

    // #307 · การกดปุ่มจริง — ทำหลังถ่ายภาพครบแล้ว เพื่อไม่ให้ภาพเปลี่ยนสถานะไปก่อน
    let afterClick: string | null = null
    let reqCalls: number | undefined
    if (hasEnable) {
      await enableBtn.click()
      // รอให้แถบพลิก ❌ ไม่ใช่ waitForTimeout คงที่ — ถ้ามันไม่พลิก ต้องหมดเวลาแล้วแดง ไม่ใช่ผ่านเพราะรอนาน
      await page.waitForFunction(
        () => document.querySelector('[data-testid="notify-status"]')?.getAttribute('data-notify-state') !== 'default',
        undefined, { timeout: 5000 },
      ).catch(() => {})
      afterClick = await page.locator('[data-testid="notify-status"]').getAttribute('data-notify-state').catch(() => null)
      reqCalls = await page.evaluate(() => (window as unknown as { __reqCalls?: number }).__reqCalls ?? 0)
      await page.addStyleTag({ content: KILL_MOTION })
      await page.screenshot({ path: path.join(OUT, `${state}-${width}-after-enable.png`), fullPage: true })
      if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-${state}-after-enable-393.png`, fullPage: true })
    }

    report.push({ state, width, expected: EXPECT_STATE[state] ?? state, painted, onRoute, guide: hasGuide, errors, enable: hasEnable, boxed, afterClick, reqCalls })
    await ctx.close()
  }
}

// ── unknown = ภาพ first paint จริง: ปิด JS ⇒ React ไม่ hydrate ⇒ เห็น UNKNOWN_CAPABILITY ที่ SSR ส่งมา ──
for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: width >= 1280 ? 1000 : 900 },
    deviceScaleFactor: CURATED && width === 393 ? 1 : 2,
    javaScriptEnabled: false, reducedMotion: 'reduce', locale: 'th-TH', timezoneId: 'Asia/Bangkok',
  })
  await ctx.addCookies([{ name: 'v2_access', value: KEY, url: HOST }])
  // 🔴 ปิด JS แล้ว `page.addStyleTag()` ค้างตลอดกาล (มันทำงานผ่านการ evaluate ในหน้า) ⇒ ยัด CSS เข้าไป
  //    ใน HTML ที่ตอบกลับแทน · เจอตอนเขียนจริง: รอบแรกค้างจนหมดเวลา ไม่มี error ให้เห็นสักบรรทัด
  await ctx.route(`${HOST}${ROUTE}`, async (route) => {
    const res = await route.fetch()
    const html = (await res.text()).replace('</head>', `<style>${KILL_MOTION}</style></head>`)
    await route.fulfill({ response: res, body: html, headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' } })
  })
  const page = await ctx.newPage()
  // 'domcontentloaded' ❌ ไม่ใช่ 'load'/'networkidle' — ปิด JS แล้ว Next dev ยังคา request ค้างไว้
  await page.goto(`${HOST}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  const onRoute = page.url().includes(ROUTE)
  const bar = page.locator('[data-testid="notify-status"]')
  const skel = page.locator('[data-testid="notify-status-skeleton"]')
  const painted = (await bar.count()) ? await bar.getAttribute('data-notify-state')
                : (await skel.count()) ? 'unknown(skeleton)' : 'NONE'
  await page.screenshot({ path: path.join(OUT, `${SSR_ROW.state}-${width}.png`), fullPage: true })
  if (CURATED && width === 393) await page.screenshot({ path: `harness/out/notify-${SSR_ROW.state}-393.png`, fullPage: true })
  report.push({ state: SSR_ROW.state, width, expected: SSR_ROW.expected, painted, onRoute, guide: false, errors: [], enable: false, boxed: false })
  await ctx.close()
}

await browser.close()

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ host: HOST, route: ROUTE, widths: WIDTHS, rows: report }, null, 2))

console.log('    สถานะ            กว้าง  วาดจริง             route  ดูวิธี  ปุ่มเปิด  กล่องสี  กดแล้วเป็น  เรียกขอสิทธิ์')
for (const r of report) {
  console.log(`  ${ok(r) ? '✓' : '✗'} ${r.state.padEnd(19)}${String(r.width).padEnd(7)}${String(r.painted).padEnd(20)}${(r.onRoute ? 'ใช่' : '❌').padEnd(7)}${(r.guide ? 'มี' : '—').padEnd(7)}${(r.enable ? 'มี' : '—').padEnd(9)}${(r.boxed ? 'มี' : '—').padEnd(9)}${String(r.afterClick ?? '—').padEnd(12)}${r.reqCalls ?? '—'}${r.errors.length ? ' ⚠️' + r.errors.length : ''}`)
}
const bad = report.filter((r) => !ok(r)).length
console.log(bad ? `\n⚠️ ${bad}/${report.length} ใบไม่ตรงกับสถานะที่ตั้งใจ` : `\n✓ ${report.length}/${report.length} ใบตรงกับสถานะที่ตั้งใจ · เขียนที่ ${OUT}`)
process.exit(bad ? 1 : 0)
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1) }) // message only — ห้ามพ่นคีย์ลง log
