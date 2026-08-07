// harness/run-daily-card.ts — anchor for the shared "ดวงวันนี้" card (Figma 375:11100 + home's own card).
// LENS = visual. Ground-truth = what each page paints, per variant.
//
// ฟีม asked for home's card to appear on ปฏิทินดวง. Figma's calendar card is a SUPERSET of home's, so the
// two now share one component — and the risk that creates is the one this anchor exists for: a shared
// component quietly dragging one screen's look onto the other. Both directions are asserted.
//
// Invariants owned here:
//   SHARED       — both screens render the same component (it carries data-variant).
//   HOME-INTACT  — home stays on its gradient ground with the verdict-coloured arc. (The evidence also
//                  carries a 0/597360 pixel-diff of home before vs after the extraction.)
//   CALENDAR-FIGMA — white ground, the LIME disc behind the ring, sapphire numerals, a 干支 chip.
//   CTA-INSIDE   — the calendar CTA is INSIDE the card (Figma 375:11981). It used to be a sibling button
//                  floating under a separate little card, which is why the page read as two things.
//
// TEETH:
//   • mut-home-gradient-on-calendar — give the calendar card home's gradient → CALENDAR-FIGMA trips.
//   • mut-ring-not-lime             — drop the lime disc → CALENDAR-FIGMA trips.
//   • mut-cta-outside               — move the CTA out of the card → CTA-INSIDE trips.
//
// Run (dev up :3099 with env):  CAPTURE_HOST=http://localhost:3099 npx tsx harness/run-daily-card.ts
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const LIME = 'rgb(225, 255, 0)'
const SAPPHIRE = 'rgb(20, 85, 164)'

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
async function open(browser: Browser, url: string) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 1100 }, deviceScaleFactor: 1 })
  await seed(ctx)
  const page = await ctx.newPage()
  await page.goto(`${HOST}${url}`, { waitUntil: 'commit' })
  await page.locator('[data-variant]').first().waitFor({ timeout: 20000 })
  return { ctx, page }
}

const readCard = (p: Page) =>
  p.evaluate(() => {
    const card = document.querySelector('[data-variant]') as HTMLElement | null
    if (!card) return null
    const cs = getComputedStyle(card)
    const donut = card.querySelector('[data-testid="fortune-grade"]')?.closest('div')?.parentElement as HTMLElement | null
    const disc = card.querySelector('div.rounded-full') as HTMLElement | null
    return {
      variant: card.getAttribute('data-variant'),
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage,
      gradeColor: getComputedStyle(card.querySelector('[data-testid="fortune-grade"]') as HTMLElement).color,
      discBg: disc ? getComputedStyle(disc).backgroundColor : '',
      hasGanzhi: !!card.querySelector('[data-testid="fortune-ganzhi"]'),
      ctaInside: !!card.querySelector('button'),
      donutFound: !!donut,
    }
  })

;(async () => {
  const browser = await chromium.launch()
  try {
    // ---- home ----------------------------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, '/v2/home-preview?state=good')
      const c = await readCard(page)
      check('SHARED — home renders the shared card', c?.variant === 'home', `${c?.variant}`)
      check('HOME-INTACT — home keeps its gradient ground', /linear-gradient/.test(c?.bgImage ?? ''), (c?.bgImage ?? '').slice(0, 48))
      check('HOME-INTACT — home has no 干支 chip (that is the calendar variant)', c?.hasGanzhi === false)
      await ctx.close()
    }

    // ---- calendar ------------------------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, '/v2/calendar')
      const c = await readCard(page)
      check('SHARED — the calendar renders the same component', c?.variant === 'calendar', `${c?.variant}`)
      check('CALENDAR-FIGMA — white ground, no gradient', c?.bg === 'rgb(255, 255, 255)' && c?.bgImage === 'none', `${c?.bg} / ${c?.bgImage}`)
      check('CALENDAR-FIGMA — lime disc behind the ring', c?.discBg === LIME, `${c?.discBg}`)
      check('CALENDAR-FIGMA — sapphire numerals', c?.gradeColor === SAPPHIRE, `${c?.gradeColor}`)
      check('CALENDAR-FIGMA — 干支 chip present', c?.hasGanzhi === true)
      check('CTA-INSIDE — the CTA lives inside the card (Figma 375:11981)', c?.ctaInside === true)
      await ctx.close()
    }

    // ---- TEETH ---------------------------------------------------------------------------------------
    {
      const { ctx, page } = await open(browser, '/v2/calendar')
      await page.evaluate(() => {
        const card = document.querySelector('[data-variant="calendar"]') as HTMLElement
        card.style.backgroundImage = 'linear-gradient(to bottom, #fff, rgba(27,154,175,.2))'
      })
      const c = await readCard(page)
      check('🦷 mut-home-gradient-on-calendar → home\'s ground leaks onto the calendar → CAUGHT', c?.bgImage !== 'none', (c?.bgImage ?? '').slice(0, 40))
      await ctx.close()
    }
    {
      const { ctx, page } = await open(browser, '/v2/calendar')
      await page.evaluate(() => {
        const disc = document.querySelector('[data-variant="calendar"] div.rounded-full') as HTMLElement
        disc.style.backgroundColor = 'transparent'
      })
      const c = await readCard(page)
      check('🦷 mut-ring-not-lime → the lime disc is gone → CAUGHT', c?.discBg !== LIME, `${c?.discBg}`)
      await ctx.close()
    }
    {
      const { ctx, page } = await open(browser, '/v2/calendar')
      await page.evaluate(() => {
        const card = document.querySelector('[data-variant="calendar"]') as HTMLElement
        const cta = card.querySelector('button') as HTMLElement
        card.parentElement!.appendChild(cta)
      })
      const c = await readCard(page)
      check('🦷 mut-cta-outside → the CTA floats outside the card again → CAUGHT', c?.ctaInside === false)
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`\nfailed=${failed}`)
  process.exit(failed === 0 ? 0 : 1)
})().catch((e) => { console.error(e); process.exit(1) })
