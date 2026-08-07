// ANCHOR: strictmode-hang — regression teeth for the /v2 fortune-card skeleton hang.
//
// Bug class (bug-ledger: strictmode-fortune-card-hang): useHomeFortune latched a persistent doneRef
// BEFORE its async work. React StrictMode (dev) double-invokes the effect — run A latches + starts the
// fetch, its cleanup sets alive=false, run B short-circuits on the latch; run A's fetch then resolves
// into `if (alive)` (false) so setFortune AND `finally { setLoading(false) }` are both skipped →
// `loading` stays true → the ScoreRingCard shows the FortuneSkeleton forever (no empty-state, no error).
//
// This is LOCAL-ONLY teeth (like e2e/auth-loop): it needs the full test-env stack — FE:3000 with a real
// anonymized member in the DB, the v2 preview gate, and dev-login — so it is NOT wired into ci.yml
// (which runs only scripts/*.test.ts) nor design-verify (which runs run.ts + run-pixel.ts). Run it by
// hand against a booted testenv stack:  npx tsx harness/run-fortune-hang.ts
//
// Teeth proven (neg-control-first, run live 2026-07-26):
//   - MUTANT (restore the doneRef latch = the pre-fix code): skeleton persists 15s+, pulses=1,
//     fortune=false the whole window → CAUGHT (this runner exits 1).
//   - FIX (idempotent effect, no latch): skeleton clears ~1.5s → fortune 'B+ 70%' + ธาตุ line render,
//     pulses=0 → PASS. /api/user + /api/home-fortune both fire and return 200 in BOTH cases — the bug
//     was the discarded result (alive=false), not a missing request (verified via network capture).
import { chromium } from 'playwright'

const BASE = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const V2KEY = process.env.V2_PREVIEW_KEY ?? 'local-testenv'
// A member that exists in the anonymized test DB with a complete birth profile (dob+time+gender).
const USER = process.env.FORTUNE_TEST_USER ?? '5c7befb3-ebd3-4740-989e-fd6a1cca9662'
const RESOLVE_BUDGET_MS = 8000 // the card must leave the skeleton well within this; the bug hangs 15s+

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // 1) pass the /v2 preview gate (form POST /api/v2/login → sets v2_access cookie)
  await page.goto(`${BASE}/v2`, { waitUntil: 'networkidle' })
  const pw = page.locator('input[type="password"]')
  if (await pw.count()) {
    await pw.first().fill(V2KEY)
    await page.click('button:has-text("เข้าสู่ระบบ"), button[type="submit"]')
    await page.waitForTimeout(1200)
  }

  // 2) dev-login as the complete-profile member (sets member cookies + next-auth session)
  await page.goto(`${BASE}/dev-login`, { waitUntil: 'networkidle' })
  await page.fill('input >> nth=0', USER)
  await page.click('button:has-text("Dev Login")')
  await page.waitForTimeout(1800)

  // 3) land on the real /v2 home and assert the fortune card RESOLVES (skeleton gone, fortune shown)
  await page.goto(`${BASE}/v2`, { waitUntil: 'domcontentloaded' })
  let resolved = false
  const deadline = Date.now() + RESOLVE_BUDGET_MS
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      pulses: document.querySelectorAll('.animate-pulse').length,
      fortune: /วันนี้เป็นวันที่ดี|เหมาะ\s*\d+%|คะแนน/.test(document.body.innerText || ''),
    }))
    if (state.pulses === 0 && state.fortune) { resolved = true; break }
    await page.waitForTimeout(300)
  }

  await browser.close()
  if (!resolved) {
    console.error(`❌ [strictmode-hang] fortune card still on skeleton after ${RESOLVE_BUDGET_MS}ms — the hang regressed.`)
    process.exit(1)
  }
  console.log('✅ [strictmode-hang] fortune card resolved (skeleton cleared, fortune rendered).')
}

main().catch((e) => { console.error(e); process.exit(1) })
