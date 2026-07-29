// harness/run-shared-topbar.ts — anchor for the SHARED top-bar (TopBarBell + TopBarAvatar, PR feat/v2-shared-topbar).
// ฟีม asked for ONE bell + ONE avatar reused across home / calendar / service, with behaviour changeable in a
// single place. Bug-class this anchor owns: EXTRACTING A SHARED COMPONENT SILENTLY CHANGES A CONSUMER —
// a page's bell/avatar loses its behaviour (nav vs in-page action) or its skin, OR home (shipped, ฟีม uses it)
// shifts. A refactor that "compiles" can still move pixels or break a click.
//
// Proves:
//   1. POLYMORPHISM — TopBarBell/TopBarAvatar render a <Link> (href) OR a <button> (onClick); this is the
//      single point where the bell's destination changes (give every call an href → nav everywhere).
//   2. SKIN per variant — 'solid' (home/service: cyan ground, glyph-A, unread-dot slot) vs 'mate' (calendar:
//      mate-gradient, lime glyph-B). Each reproduces its page's CURRENT pixels (verified byte-identical by the
//      before/after screenshot diff in the evidence: home header 0-diff, calendar 0-diff).
//   3. PER-PAGE BEHAVIOUR (in-browser) — home bell = a BUTTON (in-page panel, unchanged); calendar bell = a
//      LINK → /v2/calendar/notifications (unchanged); service bell = a LINK → notifications, service avatar =
//      a BUTTON that opens the logout confirm (ฟีม's new default).
//
// TEETH (component-level, demonstrated live in shared-topbar.verify-evidence.md):
//   • mut-ignore-href    — TopBarBell renders a <button> even when href is given → calendar/service bell stop
//                          navigating (checks #1b, calendar-link, service-link fail).
//   • mut-ignore-variant — TopBarBell always uses the solid skin → the 'mate' skin (calendar) is wrong
//                          (check #2-mate fails).
//
// Run (dev up on :3012): npx tsx --tsconfig harness/tsconfig.json harness/run-shared-topbar.ts
import { chromium, type Page, type BrowserContext } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as fs from 'fs'
import * as path from 'path'
import { TopBarBell } from '../features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '../features/v2-shell/components/TopBarAvatar'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3012'
function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no key')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}
let failed = 0
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}
const noop = () => {}
async function teamGate(ctx: BrowserContext) {
  await ctx.addCookies([{ name: 'v2_access', value: readPasskey(), domain: new URL(HOST).hostname, path: '/' }])
}

async function main() {
  console.log('\nrun-shared-topbar')

  // ── 1+2. component contract (no browser) ──
  const bellSolidBtn = renderToStaticMarkup(createElement(TopBarBell, { variant: 'solid', onClick: noop }))
  const bellSolidUnread = renderToStaticMarkup(createElement(TopBarBell, { variant: 'solid', onClick: noop, hasUnread: true }))
  const bellSolidHref = renderToStaticMarkup(createElement(TopBarBell, { variant: 'solid', href: '/x' }))
  const bellMateHref = renderToStaticMarkup(createElement(TopBarBell, { variant: 'mate', href: '/n' }))
  const avSapphire = renderToStaticMarkup(createElement(TopBarAvatar, { variant: 'sapphire', name: 'มิลา', onClick: noop }))
  const avMate = renderToStaticMarkup(createElement(TopBarAvatar, { variant: 'mate' }))

  check('#1a bell solid+onClick → <button>, cyan skin, glyph-A, no unread', bellSolidBtn.includes('<button') && bellSolidBtn.includes('bg-v3-cyan') && bellSolidBtn.includes('M18 8A6') && !bellSolidBtn.includes('unread-dot'))
  check('#1a+ bell solid+hasUnread → unread-dot present', bellSolidUnread.includes('unread-dot'))
  check('#1b bell solid+href → <a> (Link), href="/x", NOT a <button>', bellSolidHref.includes('<a') && bellSolidHref.includes('href="/x"') && !bellSolidHref.includes('<button'))
  check('#2-mate bell mate+href → gradient skin, lime, glyph-B, <a>', bellMateHref.includes('from-v3-mate-teal') && bellMateHref.includes('text-v3-lime') && bellMateHref.includes('M12 3.5a5') && bellMateHref.includes('<a'))
  check('#3 avatar sapphire → <button>, sapphire, letter fallback', avSapphire.includes('<button') && avSapphire.includes('bg-v3-sapphire') && avSapphire.includes('avatar-letter'))
  check('#4 avatar mate → decorative <span aria-hidden>, gradient, NOT a <button>', avMate.includes('<span') && avMate.includes('aria-hidden') && avMate.includes('from-v3-pastel-blue') && !avMate.includes('<button'))

  const browser = await chromium.launch()

  // ── 3. per-page behaviour ──
  // home (via home-preview harness route): bell stays a BUTTON (in-page panel), not a nav link
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
    await teamGate(ctx)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/home-preview?state=good&name=${encodeURIComponent('มิลา')}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('greeting-name').waitFor()
    const bell = p.locator('header [aria-label="การแจ้งเตือน"]')
    const tag = await bell.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'missing')
    check('home bell is a <button> (in-page action, unchanged)', tag === 'button', `got <${tag}>`)
    await ctx.close()
  }

  // calendar day: bell is a LINK → notifications (unchanged)
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
    await teamGate(ctx)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/calendar/2026-07-14`, { waitUntil: 'networkidle' })
    const bell = p.locator('[data-testid="header-notif-bell"]')
    const tag = await bell.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'missing')
    const href = await bell.getAttribute('href').catch(() => null)
    check('calendar bell is a <a> → /v2/calendar/notifications', tag === 'a' && href === '/v2/calendar/notifications', `<${tag}> href=${href}`)
    await ctx.close()
  }

  // service: bell → notifications link; avatar button → opens logout confirm
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
    await teamGate(ctx)
    const p = await ctx.newPage()
    await p.goto(`${HOST}/v2/service`, { waitUntil: 'networkidle' })
    const bell = p.locator('header [aria-label="การแจ้งเตือน"]')
    const bTag = await bell.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'missing')
    const bHref = await bell.getAttribute('href').catch(() => null)
    check('service bell is a <a> → /v2/calendar/notifications', bTag === 'a' && bHref === '/v2/calendar/notifications', `<${bTag}> href=${bHref}`)
    const avatar = p.locator('header [aria-label="โปรไฟล์"]')
    const aTag = await avatar.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'missing')
    check('service avatar is a <button>', aTag === 'button', `got <${aTag}>`)
    await avatar.click()
    await p.waitForTimeout(250)
    const modal = await p.locator('[role="dialog"][aria-label="ยืนยันออกจากระบบ"]').count()
    check('service avatar click → logout confirm opens', modal === 1)
    await ctx.close()
  }

  await browser.close()
  console.log(`\n${failed === 0 ? '✅ run-shared-topbar PASS' : `❌ run-shared-topbar FAIL (${failed})`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
