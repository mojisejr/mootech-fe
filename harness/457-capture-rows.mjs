// harness/457-capture-rows.mjs — #457 evidence: what /v2/shop says to each of the FIVE viewer states.
//   npm run dev -- -p 3457   (needs .env.local: without V2_PREVIEW_KEY every /v2/* rewrites to /maintenance
//                             AND STILL ANSWERS 200 — so this file asserts page CONTENT, never the status code)
//   node harness/457-capture-rows.mjs
//
// 🔴 THE ROWS ARE DRIVEN THROUGH /api/user, NOT THROUGH A COMPONENT PROP. The screen must be photographed
// with the same seam a real viewer arrives through (useV2User → useV2Tier), or the picture proves the
// fixture rather than the screen. Pattern copied from harness/363-capture-states.mjs.
// 🔴 THE OUTPUT PATH IS IMPORTED, NOT SPELLED OUT. The first draft of this file hard-coded
// `harness/pixel-proof/` — which is TRACKED — and produced 24 PNGs that git offered to commit. That is
// exactly the seventh harness evidence-dir.mjs's own header predicts ("a seventh harness gets the rule by
// importing rather than by remembering it"), and I remembered instead. #419 measures what that costs:
// images outweighed the code they proved by 231×, invisible on the PR header because git reports binaries
// as 0+ 0-.
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { evidenceDir, REPO_ROOT as REPO } from './evidence-dir.mjs'

const OUT = evidenceDir('457')
const KEY = execSync(`grep '^V2_PREVIEW_KEY=' ${join(REPO, '.env.local')} | cut -d= -f2- | tr -d '"'`).toString().trim()
const BASE = `http://localhost:${process.env.PORT ?? 3457}`
const VPS = (process.env.VPS ?? '320,393,768,1280').split(',').map(Number)
const MEMBER = '11111111-1111-1111-1111-111111111111'

const user = (payment, membership) => ({ user_id: MEMBER, payment, membership })

// The five rows of the matrix, each expressed as the /api/user answer that produces it.
const ROWS = {
  // KNOWN not-paid. `payment.is_not_expired` false is what tier.ts:22-24 reads.
  free: { user: user({ is_not_expired: false }, { isPaid: false, tier: null, source: 'v2', expireAt: null }) },
  plus: { user: user({ is_not_expired: true }, { isPaid: true, tier: 'PLUS', source: 'v2', expireAt: '2027-08-26' }) },
  pro: { user: user({ is_not_expired: true }, { isPaid: true, tier: 'PRO', source: 'v2', expireAt: '2027-08-26' }) },
  // paid, but the row predates the tier catalogue ⇒ no level NAME (the 2 MANUAL_VIP accounts)
  legacy: { user: user({ is_not_expired: true }, { isPaid: true, tier: null, source: 'legacy', expireAt: null }) },
  // 🔴 settled-but-failed: computeTier answers isPaid null with loading FALSE (tier.ts:64) — the row that
  // must say "we could not find out", never "still checking".
  unavailable: { status: 500 },
  // 🔴 in flight: the fetch never settles, so loading stays true (tier.ts:62).
  loading: { hang: true },
}

const b = await chromium.launch()
const rows = []

const ONLY = process.env.ROWS ? process.env.ROWS.split(',') : null
for (const [name, spec] of Object.entries(ROWS)) {
  if (ONLY && !ONLY.includes(name)) continue
  for (const w of VPS) {
    const c = await b.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 2 })
    await c.addCookies([
      { name: 'v2_access', value: KEY, domain: 'localhost', path: '/' },
      { name: 'cookie-mumate-id', value: MEMBER, domain: 'localhost', path: '/' },
    ])
    await c.route('**/api/user*', async (r) => {
      if (spec.hang) return // never fulfilled: the hook stays in flight, which IS the state being photographed
      if (spec.status) return r.fulfill({ status: spec.status, json: { error: 'boom' } })
      return r.fulfill({ json: spec.user })
    })
    // Both paid packages priced and on sale, so the buy path is REACHABLE — otherwise a missing button
    // would be the catalogue answering, not #457.
    await c.route('**/api/payment-package*', (r) =>
      r.fulfill({ json: { amount: String(r.request().url()).includes('PRO') ? 1590 : 790, is_active: true } }),
    )
    const p = await c.newPage()
    await p.goto(`${BASE}/v2/shop`, { waitUntil: spec.hang ? 'domcontentloaded' : 'networkidle' })
    // 🔴 CONTENT, not status: assert we are on the shop and not on /maintenance wearing a 200.
    await p.waitForSelector('[data-testid="shop-plan-list"]')
    await p.waitForFunction(() => !document.body.textContent?.includes('กำลังโหลดราคา'), null, { timeout: 15000 }).catch(() => {})
    await p.evaluate(() => document.fonts.ready)
    await p.screenshot({ path: join(OUT, `457-${name}-${w}.png`), fullPage: true })
    // 🔴 A fullPage screenshot paints `position: fixed` chrome (the Menubar, the Mate AI pill) at its
    // VIEWPORT offset, i.e. across the middle of the tall image — where it covers card content. That is a
    // capture artefact, not an overlap bug, but it hides the very rows this ticket changes. So each paid
    // card is also shot on its own, which is the picture that can actually be read.
    // 🔴 Scroll the card to the TOP of the viewport first. `element.screenshot()` still composites the
    // fixed chrome that sits over the element, so the first version of this photographed the Menubar
    // parked across the very status line the shot exists to show — the numbers said the line was there
    // and the picture could not read it. Fixed chrome lives at the bottom; a card at the top is clear of it.
    for (const id of ['plus', 'pro']) {
      const card = await p.$(`[data-testid="plan-card-${id}"]`)
      if (!card) continue
      await card.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }))
      await p.waitForTimeout(150)
      await card.screenshot({ path: join(OUT, `457-${name}-${w}-card-${id}.png`) })
    }
    // 🔴 `$` first, never `p.textContent(sel)`: the latter WAITS for a selector that is meant to be
    // absent, so every correctly-missing element cost a 30s timeout — 13 minutes of the first run was
    // the harness waiting to be told what it already knew.
    const read = async (sel) => {
      const el = await p.$(sel)
      return el ? (await el.textContent())?.trim() ?? null : null
    }
    rows.push({
      row: name,
      w,
      plusCta: await read('[data-testid="plan-cta-plus"]'),
      plusStatus: await read('[data-testid="plan-status-plus"]'),
      plusPending: await read('[data-testid="plan-cta-pending-plus"]'),
      proCta: await read('[data-testid="plan-cta-pro"]'),
      proStatus: await read('[data-testid="plan-status-pro"]'),
      carryPro: await read('[data-testid="plan-carry-note-pro"]'),
      // #457 — the payment terms must appear only where a payment is on offer.
      legalPlus: (await read('[data-testid="plan-legal-plus"]')) ? 'มี' : null,
      legalPro: (await read('[data-testid="plan-legal-pro"]')) ? 'มี' : null,
      // 🔴 negative control on the measurement itself: a page that never painted answers null to EVERYTHING,
      // which would read as "no wrong words found". Prove the page is really there.
      freeCta: await read('[data-testid="plan-cta-free"]'),
      bodyHasUpgradeWord: (await p.textContent('body')).includes('อัปเกรดเป็น'),
    })
    await c.close()
  }
}
await b.close()
writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2))
console.table(rows.filter((r) => r.w === 393))
console.log(`\n${rows.length} rows → ${OUT}`)
