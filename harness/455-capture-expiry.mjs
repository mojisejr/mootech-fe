// harness/455-capture-expiry.mjs — #455 slice 2 evidence: จอพูดอะไรตอน QR หมดอายุ
//   npm run dev -- -p 3455
//   node harness/455-capture-expiry.mjs
//
// 🔴 ต้องมี .env.local ที่มี V2_PREVIEW_KEY — ไม่มีคีย์ = ทุก /v2/* rewrite ไป /maintenance **แล้วตอบ 200**
//    ⇒ ห้ามยืนยันด้วย status code เด็ดขาด ต้องยืนยันด้วย "เนื้อของหน้า" (เกาะ data-testid)
//    worktree ใหม่ไม่มีไฟล์นี้เพราะมัน gitignored — คัดลอกจาก clone กลางก่อนรัน
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(REPO, 'harness', 'pixel-proof')
mkdirSync(OUT, { recursive: true })
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()
const SHA = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim()
const BASE = 'http://localhost:3455'
const VPS = [320, 393, 768, 1280]

// สามค่าของ qrDeadline คือทั้งหมดที่ server ตอบได้ ⇒ ถ่ายให้ครบ ไม่เลือกเฉพาะตัวที่สวย
// 🔴 นาฬิกาเสมือน แบบ "กระโดดครั้งเดียว" ❌ ไม่ใช่ "เร่งให้เร็วขึ้น"
//
// phase มาจาก elapsed = now() - startedAt เทียบกับ 15 นาที (POLL_UNTIL_MS) และ 30 นาที
// (RECONCILE_HORIZON_MS) ⇒ ถ่ายตามเวลาจริงต้องรอ 30 นาทีต่อหนึ่งภาพ และภาพจะขึ้นกับว่ารอนานพอไหม
//
// การเร่งนาฬิกา (คูณเวลาจริง) ให้ผลที่ **ขึ้นกับความเร็วเครื่อง** ⇒ ภาพต่างกันได้ระหว่างรอบ
// วิธีนี้แทน: ตรึงส่วนชดเชยไว้ที่ 0 จนกว่า hook จะตั้ง timer รอบแรก แล้ว **กระโดดครั้งเดียว** ไปยังจุดที่ต้องการ
// ⇒ ทุกรอบได้ elapsed ค่าเดิมเป๊ะ ไม่ว่าเครื่องจะเร็วหรือช้า
function clockJump(jumpMs) {
  return `(() => {
    const JUMP_MS = ${jumpMs}
    window.__clockPatched = true
    let offset = 0
    let armed = false
    const realNow = Date.now.bind(Date)
    Date.now = () => realNow() + offset
    const realST = window.setTimeout.bind(window)
    window.setTimeout = (fn, delay, ...rest) => {
      // timer รอบแรกที่ยาวระดับ poll (>= 1000ms) คือ slow poll ของ useChargeStatus
      if (!armed && typeof delay === 'number' && delay >= 1000) { armed = true; offset = JUMP_MS; window.__clockJumped = JUMP_MS }
      return realST(fn, delay, ...rest)
    }
  })()`
}

// สาม phase ที่ผู้ใช้เดินผ่านจริง — ถ่ายให้ครบ ❌ ไม่ถ่ายเฉพาะอันที่พิสูจน์สิ่งที่เราอยากพิสูจน์
const PHASES = [
  { id: 'waiting', jumpMs: 5 * 60_000, expect: 'PAYING' },
  { id: 'reconciling', jumpMs: 20 * 60_000, expect: 'RECONCILING' },
  { id: 'exhausted', jumpMs: 40 * 60_000, expect: null },
]

const CASES = [
  { id: 'expired', qrDeadline: 'expired', liveUntil: null, note: 'gateway บอกเองว่าตายแล้ว' },
  { id: 'unknown', qrDeadline: 'unknown', liveUntil: null, note: 'ไม่มีใครบอกเรา — 124/184 charge เป็นแบบนี้' },
  // 🔴 เคสที่เกิดทุกวัน: server ตอบ live พร้อม liveUntil แล้วผู้ใช้ถือคำตอบไว้จน liveUntil เป็นอดีต
  //    จอต้อง **ไม่** พูดว่าหมดอายุจากการเปรียบเทียบนั้น
  { id: 'live-stale', qrDeadline: 'live', liveUntil: new Date(Date.now() - 60_000).toISOString(), note: 'live + liveUntil เป็นอดีตบนเครื่องผู้ใช้' },
  // ── slice 3 (mojisejr/mootech-fe#481) เริ่มเขียนแถวแบบนี้ ─────────────────────────────────────
  // 🔴 wire ใช้ 'REJECT' ❌ ไม่ใช่ 'REJECTED' — statusOf โยนค่าอื่นทั้งหมดไปเป็น PENDING
  //    โพรบฉบับแรกของผมส่ง 'REJECTED' ⇒ วัดเส้น PENDING มาตลอดโดยไม่รู้ตัว
  { id: 'rejected-gateway-expired', status: 'REJECT', failureCode: 'gateway_expired', qrDeadline: 'expired', liveUntil: null, note: 'slice 3 บอกว่าหมดอายุ' },
  { id: 'rejected-unexplained', status: 'REJECT', failureCode: 'failed', qrDeadline: 'expired', liveUntil: null, note: 'จบแล้ว แต่เหตุไม่ใช่หมดอายุ — #443' },
  { id: 'rejected-no-failurecode', status: 'REJECT', failureCode: null, qrDeadline: 'expired', liveUntil: null, note: 'server ยังไม่ deploy #481' },
  // ── mojisejr/mootech-fe#484 — จ่ายแล้วเงินถูกตีกลับ ──────────────────────────────────────────────
  // 🔴 แถวคง status APPROVED ไว้โดยตั้งใจ (การจ่ายเกิดขึ้นจริงในอดีต) ⇒ ถ้ากิ่งอยู่ผิดที่ จอจะขึ้น
  //    "ชำระเงินสำเร็จ" พร้อม paid: true ในวินาทีที่เงินถูกคืนและสิทธิ์ถูกถอน
  { id: 'reversed-approved', status: 'APPROVED', failureCode: 'gateway_reversed', qrDeadline: 'unknown', liveUntil: null, note: 'ให้สิทธิ์แล้ว แล้วเอาคืน' },
  // ผู้ผลิตรายที่สองของค่าเดียวกัน — ไม่เคยมีสิทธิ์ให้ถอน ⇒ ต้องไม่ได้คำเดียวกัน (mojisejr/mootech-fe#488)
  { id: 'reversed-never-granted', status: 'REJECT', failureCode: 'gateway_reversed', qrDeadline: 'unknown', liveUntil: null, note: 'ตีกลับ โดยไม่เคยได้สิทธิ์' },
]

const b = await chromium.launch()
const rows = []

for (const c of CASES) {
 for (const ph of PHASES) {
  for (const w of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
    await ctx.addCookies([{ name: 'v2_access', value: KEY, domain: 'localhost', path: '/' }])
    await ctx.route('**/api/v2/payment/status', (r) =>
      r.fulfill({ json: { payments: [{ chargeId: 'chrg_demo', status: c.status ?? 'PENDING', method: 'promptpay', qrDeadline: c.qrDeadline, liveUntil: c.liveUntil, failureCode: c.failureCode ?? null }] } }),
    )
    const p = await ctx.newPage()
    await p.addInitScript(clockJump(ph.jumpMs))
    // claimed=APPROVED = "URL อ้างว่าจ่ายแล้ว" ซึ่งเป็นทางเดียวที่เดินเข้ากิ่งที่ ticket นี้แก้
    // (result-state.ts — `if (RESULT_COPY[claimed].paid)`) · server ยัง PENDING ⇒ ยังไม่ยืนยัน
    await p.goto(`${BASE}/v2/shop/result?state=APPROVED&charge=chrg_demo`, { waitUntil: 'networkidle' })
    await p.waitForSelector('[data-testid="result-screen"]')
    // 🔴 ตัวคุมเครื่องมือ — ยิงก่อนอ่านผลทุกครั้ง
    // ฉบับแรกของไฟล์นี้ฉีดสคริปต์ที่ syntax error (เขียน ${'${jumpMs}'} ไว้ในซอร์ส) ⇒ นาฬิกาไม่เคยถูก patch
    // แต่ harness ยัง "ถ่ายสำเร็จ" และรายงาน 36 ช่องเป็น PAYING ทั้งหมดอย่างมั่นใจ
    // ⇒ เครื่องมือที่พังแล้วยังตอบ อันตรายกว่าเครื่องมือที่ล้ม
    const patched = await p.evaluate(() => ({ patched: !!window.__clockPatched, jumped: window.__clockJumped ?? null }))
    if (!patched.patched) throw new Error(`นาฬิกาไม่ถูก patch (${c.id}/${ph.id}/${w}) — ผลที่ได้หลังจากนี้ไม่ใช่หลักฐาน`)
    if (patched.jumped !== ph.jumpMs) throw new Error(`นาฬิกาไม่ได้กระโดด: คาด ${ph.jumpMs} ได้ ${patched.jumped} (${c.id}/${ph.id}/${w})`)
    // รอให้ผลของการกระโดดปรากฏ — ❌ ไม่ใช่ sleep ลอย ๆ: รอจนสถานะ "หยุดนิ่ง" สองครั้งติด
    await p.waitForFunction(() => {
      const el = document.querySelector('[data-testid="result-screen"]')
      if (!el) return false
      const s = el.getAttribute('data-state')
      const w = window
      const same = w.__lastState === s
      w.__lastState = s
      return same
    }, null, { timeout: 15_000, polling: 400 })
    await p.evaluate(() => document.fonts.ready)
    await p.screenshot({ path: join(OUT, `455-${ph.id}-${c.id}-${w}.png`), fullPage: true })
    rows.push({
      phase: ph.id, case: c.id, w,
      state: await p.getAttribute('[data-testid="result-screen"]', 'data-state'),
      paid: await p.getAttribute('[data-testid="result-screen"]', 'data-paid'),
      // 🔴 อ่าน "ตัวอักษรที่วาดออกมาจริง" ❌ ไม่ใช่ค่าใน data attribute — attribute ถูกต้องได้ทั้งที่คำผิด
      title: (await p.textContent('[data-testid="result-title"]'))?.trim(),
      body: (await p.textContent('[data-testid="result-body"]'))?.trim(),
    })
    await ctx.close()
  }
 }
}
await b.close()

writeFileSync(join(OUT, `455-readout-${SHA}.json`), JSON.stringify({ sha: SHA, capturedAt: new Date().toISOString(), rows }, null, 2))
console.log(`SHA ${SHA} · ${rows.length} ช่อง (${PHASES.length} phase × ${CASES.length} เคส × ${VPS.length} viewport)`)
for (const r of rows) if (r.w === 393) console.log(`  ${r.phase.padEnd(12)} ${r.case.padEnd(12)} state=${String(r.state).padEnd(18)} "${r.title}"`)
