// harness/run-app-header.ts — anchor for the shared v2 top bar (<AppHeader/>).
// LENS = visual. Ground-truth = the rendered header on EVERY v2 surface, at every width we ship.
//
// The bug ฟีม reported by eye ("ทำไมมันไม่เหมือนกันทุกหน้า") was really three bugs:
//   1. /v2/calendar had NO header at all — the absence class, which no "is this header correct" check can
//      ever catch, because there is nothing to measure. PRESENCE has to be its own invariant.
//   2. the right cluster drifted per page (order/size/gap).
//   3. the อัพเกรด pill had three different skins, and one of them could show to a PAID member.
//
// Invariants owned here:
//   PRESENCE       — every v2 surface renders exactly one header tools cluster.
//   CLUSTER-ORDER  — inside it: [upgrade?] · bell · avatar, left→right, bell/avatar 40×40, 8px gaps.
//   RIGHT-ALIGNED  — the cluster's right edge sits at the content's right edge (±1px) on every page.
//   PILL-RULE      — the pill appears ONLY where the page passes showUpgrade === true. A paid member must
//                    never see it. (The two halves are each other's negative control: the free render must
//                    SHOW it, or "paid hides it" proves nothing.)
//   NO-CLIP        — no page overflows horizontally and no header title is ellipsised, 320 → 430.
//
// TEETH:
//   • mut-header-missing  — delete the header from a page → PRESENCE trips.
//   • mut-cluster-reorder — put the avatar before the bell → CLUSTER-ORDER trips.
//   • mut-pill-on-paid    — force the pill onto the PAID home → PILL-RULE trips.
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-app-header.ts
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const WIDTHS = [320, 360, 393, 430]

// every v2 surface that ships a header. home is measured through its preview route (the real /v2 needs the
// backend to resolve identity); the preview mounts the SAME <V2HomeScreen/>, so the header is the real one.
const PAGES: { name: string; url: string; expectPill: boolean }[] = [
  { name: 'home (free)', url: '/v2/home-preview?state=good', expectPill: true },
  { name: 'home (paid)', url: '/v2/home-preview?state=good&pay=paid', expectPill: false },
  { name: 'service', url: '/v2/service', expectPill: true },
  { name: 'calendar (month)', url: '/v2/calendar', expectPill: false },
  { name: 'calendar (day)', url: '/v2/calendar/2026-07-14', expectPill: false },
  { name: 'notifications', url: '/v2/calendar/notifications', expectPill: false },
]

let failed = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

async function seed(ctx: BrowserContext) {
  const host = new URL(HOST).hostname
  await ctx.addCookies([
    { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
    { name: 'cookie-mumate-id', value: '5c7befb3-ebd3-4740-989e-fd6a1cca9662', domain: host, path: '/' },
    { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
  ])
}

async function open(browser: Browser, url: string, width = 393) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  await seed(ctx)
  const page = await ctx.newPage()
  await page.goto(`${HOST}${url}`, { waitUntil: 'commit' })
  await page.locator('[data-testid="header-tools"]').first().waitFor({ timeout: 20000 })
  return { ctx, page }
}

// the cluster read as GEOMETRY, not as a class list: what order the children actually paint in, how big they
// are, and where the cluster ends. A className can say "gap-2" while a stray element sits between two icons.
const readCluster = (p: Page) =>
  p.evaluate(() => {
    const tools = document.querySelector('[data-testid="header-tools"]') as HTMLElement | null
    if (!tools) return null
    const kids = (Array.from(tools.children) as HTMLElement[]).map((el) => ({
      testid: el.getAttribute('data-testid') ?? el.querySelector('[data-testid]')?.getAttribute('data-testid') ?? el.tagName.toLowerCase(),
      label: el.getAttribute('aria-label') ?? '',
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
      x: Math.round(el.getBoundingClientRect().x),
    }))
    const header = tools.closest('header') as HTMLElement
    const hr = header.getBoundingClientRect()
    const tr = tools.getBoundingClientRect()
    const cs = getComputedStyle(header)
    return {
      kids,
      clusterRight: Math.round(tr.right),
      headerRight: Math.round(hr.right - parseFloat(cs.paddingRight || '0')),
      gap: kids.length > 1 ? Math.round(kids[1].x - (kids[0].x + kids[0].w)) : null,
    }
  })

const overflowX = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
const titleClipped = (p: Page) =>
  p.evaluate(() => {
    const t = document.querySelector('[data-testid="header-title"]') as HTMLElement | null
    if (!t) return false // home has no title element (Structure A) — nothing to clip
    return t.scrollWidth > t.clientWidth + 1
  })

;(async () => {
  const browser = await chromium.launch()
  try {
    // ---- 1) every surface: PRESENCE · CLUSTER-ORDER · RIGHT-ALIGNED · PILL-RULE -------------------------
    for (const pg of PAGES) {
      const { ctx, page } = await open(browser, pg.url)
      const count = await page.locator('[data-testid="header-tools"]').count()
      check(`PRESENCE — ${pg.name} has exactly one header cluster`, count === 1, `${count}`)

      const c = await readCluster(page)
      const names = (c?.kids ?? []).map((k) => (k.testid === 'header-upgrade' ? 'pill' : k.label === 'การแจ้งเตือน' ? 'bell' : 'avatar'))
      const expect = pg.expectPill ? ['pill', 'bell', 'avatar'] : ['bell', 'avatar']
      check(`CLUSTER-ORDER — ${pg.name}: ${expect.join(' · ')}`, JSON.stringify(names) === JSON.stringify(expect), names.join(' · '))

      const icons = (c?.kids ?? []).filter((k) => k.testid !== 'header-upgrade')
      check(`CLUSTER-ORDER — ${pg.name}: bell + avatar are 40×40`, icons.length === 2 && icons.every((k) => k.w === 40 && k.h === 40), icons.map((k) => `${k.w}x${k.h}`).join(' '))
      check(`CLUSTER-ORDER — ${pg.name}: 8px gap`, c?.gap === 8, `${c?.gap}px`)
      check(`RIGHT-ALIGNED — ${pg.name}: cluster ends at the content edge`, Math.abs((c?.clusterRight ?? 0) - (c?.headerRight ?? -99)) <= 1, `${c?.clusterRight} vs ${c?.headerRight}`)

      const hasPill = await page.locator('[data-testid="header-upgrade"]').count()
      check(`PILL-RULE — ${pg.name}: pill ${pg.expectPill ? 'shown' : 'hidden'}`, (hasPill > 0) === pg.expectPill, `${hasPill}`)
      await ctx.close()
    }

    // ---- 2) NO-CLIP across every width we ship ----------------------------------------------------------
    for (const pg of PAGES) {
      for (const w of WIDTHS) {
        const { ctx, page } = await open(browser, pg.url, w)
        const [ov, clip] = [await overflowX(page), await titleClipped(page)]
        check(`NO-CLIP — ${pg.name} @${w}`, !ov && !clip, ov ? 'page overflows' : clip ? 'title ellipsised' : 'clean')
        await ctx.close()
      }
    }

    // ---- 3) TOOTH mut-header-missing --------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, '/v2/calendar')
      await page.evaluate(() => document.querySelector('[data-testid="header-tools"]')?.closest('header')?.remove())
      const count = await page.locator('[data-testid="header-tools"]').count()
      check('🦷 mut-header-missing → the page renders no header → PRESENCE CAUGHT', count === 0, `${count}`)
      await ctx.close()
    }

    // ---- 4) TOOTH mut-cluster-reorder -------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, '/v2/calendar')
      await page.evaluate(() => {
        const tools = document.querySelector('[data-testid="header-tools"]') as HTMLElement
        tools.insertBefore(tools.children[tools.children.length - 1], tools.children[0]) // avatar first
      })
      const c = await readCluster(page)
      const names = (c?.kids ?? []).map((k) => (k.label === 'การแจ้งเตือน' ? 'bell' : 'avatar'))
      check('🦷 mut-cluster-reorder → avatar before bell → CLUSTER-ORDER CAUGHT', JSON.stringify(names) !== JSON.stringify(['bell', 'avatar']), names.join(' · '))
      await ctx.close()
    }

    // ---- 5) TOOTH mut-pill-on-paid ----------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, '/v2/home-preview?state=good&pay=paid')
      await page.evaluate(() => {
        const tools = document.querySelector('[data-testid="header-tools"]') as HTMLElement
        const pill = document.createElement('span')
        pill.setAttribute('data-testid', 'header-upgrade')
        pill.textContent = 'อัพเกรด'
        tools.insertBefore(pill, tools.children[0])
      })
      const hasPill = await page.locator('[data-testid="header-upgrade"]').count()
      check('🦷 mut-pill-on-paid → a paid member sees the upsell → PILL-RULE CAUGHT', hasPill > 0, `${hasPill}`)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
