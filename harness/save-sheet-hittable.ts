// #299 negative-control: the SaveSheet's "บันทึก" button must be the TOP element at its own centre —
// i.e. actually clickable. The bug: SaveSheet overlay and the bottom Menubar are BOTH `z-40`, so at an
// equal stacking level the DOM order wins and the <nav> covers the save button → the click never lands.
// This asserts hit-testing (document.elementFromPoint), the same thing a real tap resolves, across the
// three viewports มุน measured. RED on `main` today (nav wins); GREEN once the sheet sits above the nav.
//
// Standalone + backend-independent (every call is Playwright-stubbed), so a CI box with no backend runs
// exactly what this owns. Run:  HARNESS_HOST=http://localhost:3000 V2_PREVIEW_KEY=<key> npx tsx harness/save-sheet-hittable.ts
//
// ── #302 · case C — TWO sheets open at once ────────────────────────────────────────────────────────
// InstallGuideSheet is opened by a button INSIDE SaveSheet, so it must paint above it. Both used to be
// `z-50`: correct only because [date].tsx happens to render the guide LAST. Case C therefore measures
// the invariant, not today's outcome — it hit-tests the guide, then MOVES the save-sheet node to the end
// of its own parent (hostile DOM order, same ancestry) and hit-tests again. Order-independence is the
// property; a z-index equal to SaveSheet's fails C2 while C1 still passes.
//   ⚠️ C2 is what has teeth. Reverting InstallGuideSheet to z-50 leaves C1 GREEN (DOM order still
//      favours the guide) and turns C2 RED — that is the whole point of moving the node in-run.
import { chromium, type Browser } from 'playwright'

const HOST = process.env.HARNESS_HOST ?? 'http://localhost:3000'
const KEY = process.env.V2_PREVIEW_KEY ?? 'lamun-local-dev'
const UID = 'harness-299-user'
const host = new URL(HOST).hostname
const isPath = (u: string, p: string) => new URL(u).pathname === p
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
// /api/user must carry birth data or useDayDetail never fetches the day → day-score never renders.
const USER = { user_id: UID, name: 'ทดสอบ #299', dob: '1990-06-15', gender: 'MALE', place_name: 'กรุงเทพมหานคร', is_remember_time: false }

const dayDetail = { detail: {
  date: today, dayGanzhi: '己丑', overallPercent: 72, grade: 'B', verdict: 'good', summary: 'วันนี้ดวงดีมาก',
  suitable: ['เจรจา'], avoid: ['เดินทางไกล'], insight: '', compatAreas: [], advice: [],
  yams: [{ id: 'y1', label: 'ยามมงคล', window: '09:00-10:59' }],
  dithi: { officer: '', officerDesc: '', jianchu: '' }, luckyDirection: '', dayDeity: '', spirits: [],
  wanPhra: { isWanPhra: false, label: '' }, dayPillars: { day: null, month: null, year: null },
  ownerPillars: {}, gates: [], colors: [],
} }

async function loadPage(browser: Browser, vw: number) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 852 } })
  await ctx.addCookies([
    { name: 'v2_access', value: KEY, domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: UID, domain: host, path: '/' },
  ])
  const page = await ctx.newPage()
  await page.route((u) => isPath(u.toString(), '/api/user'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }))
  await page.route((u) => isPath(u.toString(), '/api/v2/calendar-month'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"days":[]}' }))
  await page.route((u) => isPath(u.toString(), '/api/v2/day-detail'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dayDetail) }))
  await page.goto(`${HOST}/v2/calendar/${today}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="day-score"]').waitFor({ timeout: 20000 })
  return { ctx, page }
}

async function openSheetPage(browser: Browser, vw: number) {
  const { ctx, page } = await loadPage(browser, vw)
  // open the sheet from the bottom CTA, then enable "บันทึก" by picking a ยาม (it's disabled until then)
  await page.locator('nav button', { hasText: 'เพิ่มลงปฏิทิน' }).first().click()
  await page.locator('[data-testid="save-sheet"]').waitFor({ timeout: 10000 })
  await page.locator('[data-testid="save-sheet"] label').first().click()
  return { ctx, page }
}

/** #302 · open the save sheet, then the install/permission guide sheet from the "ดูวิธี" link inside it.
 *  The link only exists when notify state is `denied` or `needs-install` (notify-state.ts guideVariantFor).
 *  A plain chromium context has Notification.permission = 'denied' → state `denied` → the link is there.
 *  We ASSERT that precondition instead of skipping: a case that quietly finds no link would be a green
 *  gate that measured nothing. */
async function openBothSheetsPage(browser: Browser, vw: number) {
  const { ctx, page } = await openSheetPage(browser, vw)
  const state = await page.locator('[data-testid="dest-mumate"]').getAttribute('data-notify-state')
  if (state !== 'denied') {
    throw new Error(
      `[#302 case C] precondition unmet: notify state is "${state}", expected "denied". ` +
        `The "ดูวิธี" link only renders for denied/needs-install, so this case cannot measure stacking. ` +
        `Fix the environment (a bare chromium context must report Notification.permission=denied), not this check.`,
    )
  }
  await page.locator('[data-testid="mumate-guide"]').click()
  await page.locator('[data-testid="install-guide-sheet"]').waitFor({ timeout: 10000 })
  return { ctx, page }
}

/** With both sheets open: at the guide sheet's own centre, hit-testing must land INSIDE the guide — and
 *  must keep landing there after the save-sheet node is moved last among its siblings. */
async function probeTwoSheets(page: import('playwright').Page) {
  return page.evaluate(() => {
    // `scrim` is the guide's own fixed/z-index box — the element that competes with save-sheet for a
    // layer. `guide` is the visible panel inside it and is what we aim the hit-test at.
    const scrim = document.querySelector('[data-testid="install-guide-scrim"]') as HTMLElement | null
    const guide = document.querySelector('[data-testid="install-guide-sheet"]') as HTMLElement | null
    const sheet = document.querySelector('[data-testid="save-sheet"]') as HTMLElement | null
    if (!scrim || !guide || !sheet) return { found: false } as const
    // Sibling-of-the-same-parent is what makes the reorder a fair test: moving the node must change DOM
    // ORDER ONLY, never its ancestry (a different parent can bring a different stacking context with it).
    if (scrim.parentElement !== sheet.parentElement) {
      return { found: true, sameParent: false, scrimParent: scrim.parentElement?.tagName ?? null, sheetParent: sheet.parentElement?.tagName ?? null } as const
    }
    // Two phases, measured with the same inlined code so nothing differs between them but DOM order.
    // (Written as a loop, not a helper: tsx/esbuild injects a `__name` call into named functions, which
    //  is undefined inside page.evaluate — the probe would crash instead of measuring.)
    const hits: { inGuide: boolean; inSaveSheet: boolean; topTestId: string | null }[] = []
    for (let phase = 0; phase < 2; phase++) {
      // phase 1 = hostile order: put the save sheet AFTER the guide among its siblings. If the guide only
      // wins by DOM order, this flips it and the guide's own centre starts resolving to the save sheet.
      if (phase === 1) sheet.parentElement!.appendChild(sheet)
      const r = guide.getBoundingClientRect()
      const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) as HTMLElement | null
      hits.push({
        inGuide: !!top?.closest('[data-testid="install-guide-sheet"]'),
        inSaveSheet: !!top?.closest('[data-testid="save-sheet"]'),
        topTestId: top?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
      })
    }
    return {
      found: true,
      sameParent: true,
      // reported for the log only — the pass/fail above is hit-testing, never these two numbers
      guideZ: getComputedStyle(scrim).zIndex,
      sheetZ: getComputedStyle(sheet).zIndex,
      asRendered: hits[0],
      afterReorder: hits[1],
    } as const
  })
}

/** Step 5: with NO sheet open, the bottom Menubar CTA must still be the top element at its own centre —
 *  raising the sheet's layer must not break the menu in its normal state. */
async function probeMenubar(page: import('playwright').Page) {
  return page.evaluate(() => {
    const cta = Array.from(document.querySelectorAll('nav[aria-label="เมนูหลัก"] button'))
      .find((b) => /เพิ่มลงปฏิทิน/.test(b.textContent ?? '')) as HTMLElement | undefined
    if (!cta) return { found: false } as const
    const r = cta.getBoundingClientRect()
    const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) as HTMLElement | null
    return { found: true, hitInNav: !!top?.closest('nav[aria-label="เมนูหลัก"]'), hitIsCta: cta === top || cta.contains(top!) } as const
  })
}

/** At the save button's own centre, what does hit-testing return? */
async function probe(page: import('playwright').Page) {
  return page.evaluate(() => {
    const btn = document.querySelector('[data-testid="sheet-save"]') as HTMLElement | null
    if (!btn) return { found: false } as const
    const r = btn.getBoundingClientRect()
    const x = Math.round(r.left + r.width / 2)
    const y = Math.round(r.top + r.height / 2)
    const top = document.elementFromPoint(x, y) as HTMLElement | null
    return {
      found: true,
      disabled: (btn as HTMLButtonElement).disabled,
      hitIsSaveButton: !!top?.closest('[data-testid="sheet-save"]'),
      hitInsideSheet: !!top?.closest('[data-testid="save-sheet"]'),
      hitInNav: !!top?.closest('nav[aria-label="เมนูหลัก"]'),
      topTag: top?.tagName ?? null,
      topTestId: top?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
    } as const
  })
}

async function main() {
  const browser = await chromium.launch()
  let fail = 0
  let total = 0
  for (const vw of [320, 393, 1280]) {
    // A) sheet open → the save button must be hittable (not covered by the Menubar) — the #299 bug
    total++
    const { ctx, page } = await openSheetPage(browser, vw)
    const p = await probe(page)
    if (!p.found) {
      console.log(`  ✗ [${vw}] save button not found (sheet did not render as expected)`); fail++
    } else {
      const ok = p.hitIsSaveButton && !p.hitInNav
      console.log(`  ${ok ? '✓' : '✗'} [${vw}] sheet open: save button is top at its centre` +
        ` · hit=${p.topTag}${p.topTestId ? `#${p.topTestId}` : ''} inNav=${p.hitInNav} disabled=${p.disabled}`)
      if (!ok) fail++
    }
    await ctx.close()

    // B) sheet CLOSED → the Menubar CTA must still be hittable — raising the sheet layer must not break the menu
    total++
    const { ctx: ctx2, page: page2 } = await loadPage(browser, vw)
    const m = await probeMenubar(page2)
    if (!m.found) {
      console.log(`  ✗ [${vw}] Menubar CTA not found`); fail++
    } else {
      const ok = m.hitInNav && m.hitIsCta
      console.log(`  ${ok ? '✓' : '✗'} [${vw}] no sheet: Menubar CTA is hittable · inNav=${m.hitInNav} isCta=${m.hitIsCta}`)
      if (!ok) fail++
    }
    await ctx2.close()

    // C) #302 — BOTH sheets open. C1 = the guide is on top as rendered. C2 = it stays on top after the
    //    save sheet is moved last among its siblings, i.e. it wins by LAYER and not by DOM order.
    total += 2
    const { ctx: ctx3, page: page3 } = await openBothSheetsPage(browser, vw)
    const t = await probeTwoSheets(page3)
    if (!t.found) {
      console.log(`  ✗ [${vw}] C1/C2 both sheets: guide sheet or save sheet not in the DOM`); fail += 2
    } else if (!t.sameParent) {
      console.log(`  ✗ [${vw}] C1/C2 unmeasurable: guide scrim and save sheet are not siblings` +
        ` (scrim→${t.scrimParent} sheet→${t.sheetParent}) — reordering would change ancestry, not just order`); fail += 2
    } else {
      const c1 = t.asRendered.inGuide && !t.asRendered.inSaveSheet
      console.log(`  ${c1 ? '✓' : '✗'} [${vw}] C1 as rendered: guide is top at its own centre` +
        ` · hit=#${t.asRendered.topTestId} z(guide)=${t.guideZ} z(sheet)=${t.sheetZ}`)
      if (!c1) fail++
      const c2 = t.afterReorder.inGuide && !t.afterReorder.inSaveSheet
      console.log(`  ${c2 ? '✓' : '✗'} [${vw}] C2 save sheet moved LAST in DOM: guide is STILL top` +
        ` · hit=#${t.afterReorder.topTestId}${c2 ? '' : ' ⇒ it was only winning by DOM order'}`)
      if (!c2) fail++
    }
    await ctx3.close()
  }
  await browser.close()
  console.log(`\n${fail === 0 ? '✅' : '🔴'} save-sheet-hittable — ${total - fail} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(2) })
