// #359 — teeth for "every membership CTA now points at the shop, and nothing else does". MAIN lane.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`):
//   MU1  point the header pill somewhere else / turn it back into an announce → header test reddens
//   MU2  point the calendar upsell CTA somewhere else                        → upsell test reddens
//   MU3  make one of the NON-membership coming-soon controls link to the shop → the "must not" test reddens
//   MU4  drop a call site from the checked list                              → the surface-size test reddens
//
// 🔑 Why this file asserts PER SITE instead of grepping for one string: the ticket originally listed
//     features/v2-service/services.ts and AddFriendSheet.tsx:192 as ComingSoonAction call sites. They are
//     not — `grep -rn ComingSoonAction` finds 19 hits across 6 files and neither is among them. A DoD
//     checked by grepping one symbol would have been ticked without anyone opening those files.
//
// 🔴 WHAT THIS FILE DOES AND DOES NOT GUARD — say it plainly, so nobody reads a green run as more than it is:
//     AppHeader + PersonalCalendarUpsell   RENDERED here; href is asserted on the real element.
//     YamTimes                             behaviour lives in scripts/yam-times-tier-gate.test.tsx
//                                          (locked pill is an <a href={SHOP_HREF}>).
//     tier-lock                            behaviour lives in scripts/reminder-cta.test.tsx and
//                                          scripts/day-cta-tier-gate.test.tsx (press() calls goToShop,
//                                          and the page pushes SHOP_HREF).
//     For those last two, the check BELOW is only "the file still references the destination" — a source
//     grep. Proven: deleting `press: () => o.goToShop()` leaves THIS spec green and reddens 5 tests in the
//     other two. The list is a coverage ledger, not the tooth; the teeth are where the behaviour is.
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, isReady: true, push: vi.fn() }) }))

afterEach(cleanup)

const ROOT = process.cwd()
// 🔴 #365 (ตู๋'s review of 8cbe56b) — CODE ONLY, NEVER PROSE. This read the raw file, so a comment that
// merely MENTIONS SHOP_HREF would keep the assertion below green after the real `href={SHOP_HREF}` was
// deleted. Not a hole today (ตู๋ grepped all four files: every hit is real code), but it is the same shape
// that DID bite in scripts/account-screen.test.tsx during this PR — a tooth held up by its own documentation.
// Widen the guard rather than wait for it to be exploited. Same helper as header-tier-badge.test.tsx:44.
const read = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // {/* jsx comment */}
    .replace(/\/\*[\s\S]*?\*\//g, '')                // /* block */
    .replace(/^\s*\/\/.*$/gm, '')                      // // line

/** Every control that means "you need a membership" — these MUST reach the shop. */
const MEMBERSHIP_SITES = [
  'features/v2-shell/components/AppHeader.tsx',
  'features/v2-calendar/components/upsell/PersonalCalendarUpsell.tsx',
  'features/v2-calendar/components/day-detail/YamTimes.tsx',
  'features/v2-calendar/tier-lock.ts',
] as const

/** Controls that are NOT about membership — routing them at the pricing screen would offer to sell a plan
 *  to someone who tapped "โปรไฟล์" or "อัพโหลดรูป".
 *
 *  🔴 The check is "does this file IMPORT the membership destination", NOT "does the string /v2/shop appear
 *  in it". The first version asserted the string and went red on features/v2-service/services.ts:60 —
 *  which carries `href: '/v2/shop'` for the ร้านค้าของเรา service card, a perfectly correct link to the
 *  shop TAB. The rule was wrong, not the code: a tooth named for a class it does not guard. */
const MUST_NOT_LINK = [
  'features/v2-shell/components/TopBarAvatar.tsx',
  'features/v2-service/services.ts',
  'features/v2-service/components/AddFriendSheet.tsx',
] as const

describe('#359 membership CTAs reach the shop', () => {
  it('all four membership call sites reference the shared destination', () => {
    // Surface size stated out loud: a shortened list must not read as "all sites pass".
    expect(MEMBERSHIP_SITES).toHaveLength(4)
    for (const rel of MEMBERSHIP_SITES) {
      const src = read(rel)
      expect(src, `${rel} lost its link to the shop`).toMatch(/SHOP_HREF|goToShop/)
    }
  })

  it('the header อัพเกรด pill is a link to the shop, not an announcement', async () => {
    const { AppHeader } = await import('@/features/v2-shell/components/AppHeader')
    // AppHeader → TopBarAvatar → useCookies ⇒ ต้องมี provider ไม่งั้นล้มก่อนถึงสิ่งที่จะวัด
    render(
      <CookiesProvider>
        {/* #384 — was `showUpgrade` (boolean). A free viewer is now expressed as the membership verdict
            itself, so this spec keeps asserting the same user-visible fact through the new seam. */}
        <AppHeader title="ทดสอบ" membership={{ isPaid: false }} />
      </CookiesProvider>,
    )
    const pill = screen.getByTestId('header-upgrade')
    expect(pill.tagName).toBe('A')
    expect(pill.getAttribute('href')).toBe(SHOP_HREF)
    // It must not have reverted to the announce mechanism.
    expect(pill.getAttribute('data-coming-soon')).toBeNull()
  })

  it('the calendar upsell CTA is a link to the shop, not an announcement', async () => {
    const { PersonalCalendarUpsell } = await import(
      '@/features/v2-calendar/components/upsell/PersonalCalendarUpsell'
    )
    // percent is REQUIRED (component:69) and feeds two rendered strings (component:89,97). Omitting it
    // rendered "—%" — percentText returns an em dash for anything unusable (percent-display.ts:50-51),
    // ON PURPOSE, so the screen never shows a confident wrong number. Which is exactly why nothing here
    // complained: the component degraded gracefully and the spec stayed green while calling it wrong.
    // tsc never sees this file either (tsconfig excludes scripts/, mootech-fe#351), so the compiler could
    // not say so. ตู๋ caught it by reading. 42 is arbitrary but valid — this spec asserts the CTA's
    // destination, not the number.
    render(<PersonalCalendarUpsell percent={42} />)
    const cta = screen.getByTestId('calendar-upsell-cta')
    expect(cta.tagName).toBe('A')
    expect(cta.getAttribute('href')).toBe(SHOP_HREF)
    expect(cta.getAttribute('data-coming-soon')).toBeNull()
  })

  it('non-membership coming-soon controls do NOT point at the shop', () => {
    expect(MUST_NOT_LINK).toHaveLength(3)
    for (const rel of MUST_NOT_LINK) {
      const src = read(rel)
      expect(src, `${rel} started routing at the membership screen — it is not a membership control`)
        .not.toContain('features/v2-shop/upgrade-cta')
    }
  })

  it('the two locked-reminder sentences that had to be hand-synced are gone', () => {
    // They were byte-identical in two files (YamTimes.tsx / tier-lock.ts). Both controls navigate now, so
    // neither sentence has a reason to exist — and a copy that comes back is a copy that can drift again.
    const sentence = 'การตั้งเตือนเป็นของสมาชิก · ระบบสมาชิกกำลังจะมา เร็วๆ นี้'
    for (const rel of [
      'features/v2-calendar/components/day-detail/YamTimes.tsx',
      'features/v2-calendar/tier-lock.ts',
    ]) {
      const code = read(rel)
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n')
      expect(code, `${rel} still carries the hand-synced sentence`).not.toContain(sentence)
    }
  })
})
