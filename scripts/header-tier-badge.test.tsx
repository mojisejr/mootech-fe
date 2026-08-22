// #384 — teeth for "the header says which package you hold, and NEVER guesses". MAIN lane.
//
// 🔴 MUTANT CONTRACT (each reddens `npm test`, and each reddens a DIFFERENT test — the point of #372's shape):
//   MU1  headerBadge: make `isPaid === null` fall through to the upgrade pill  → "ไม่รู้" test reddens
//   MU2  headerBadge: make `isPaid === null` fall through to the tier pill     → "ไม่รู้" test reddens
//   MU3  headerBadge: return the raw tier name for a paid row with no name     → "สมาชิก" test reddens
//   MU4  headerBadge: print the name for tier 'FREE' on a paid row             → "ห้ามพิมพ์ FREE" reddens
//   MU5  AppHeader: render the pill on `upgradeCta: false`                     → shop/notifications reddens
//   MU6  drop `membership=` from any one of the six screens                    → the wiring test reddens
//   MU7  V2HomeScreen: bring back a truthy badge fallback when membership absent → bug-A test reddens
//
// 🔑 WHY THE "ไม่รู้" CASE GETS TWO MUTANTS AND ITS OWN SECTION.
// Every other state on this screen fails LOUDLY — a wrong word is visible in the pill. "ไม่รู้" fails by
// rendering something perfectly plausible: the upsell. That is exactly how the home bug this PR closes
// survived on prod (an /api/user error settled with `user: null`, the boolean said "not paid", and a paying
// member was told to upgrade). A test that only checks free/PLUS/PRO/สมาชิก stays green through it.
//
// 🔴 WHAT THIS FILE DOES AND DOES NOT GUARD — so a green run is not read as more than it is:
//   headerBadge          the rule itself, exhaustively. This is the tooth.
//   HeaderTools          RENDERED — the pill's text and testid come off the real element.
//   the six screens      SOURCE-LEVEL only (a grep for the prop). It catches "somebody deleted the wire";
//                        it CANNOT catch "the wire carries the wrong value". The rendered proof for the
//                        screens is the viewport-strip in the PR, not this file.
//   what the pill LOOKS like   not here at all — 0 px² header drift is proven by pixel-diff, not by the DOM.
import React from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'
import { headerBadge, MEMBER_BADGE_LABEL, type MembershipLike } from '@/features/v2-shell/header-badge'
import { deriveHomeLoading } from '@/lib/home/loading'
import { deriveHomeProfile } from '@/lib/home/profile'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, isReady: true, push: vi.fn() }) }))
afterEach(cleanup)

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

// Source assertions must look at CODE, not at prose. This file's first draft asserted `not.toMatch(/showUpgrade/)`
// against the whole file and went red on the comment that EXPLAINS the removal — an instrument that cannot tell
// a decision from its documentation punishes writing the reason down. Strip line comments and block comments,
// then assert. (Not a parser, and it does not need to be: it only has to stop reading prose as code.)
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ''))
    .join('\n')

// ── the rule ────────────────────────────────────────────────────────────────────────────────────────
describe('#384 headerBadge — the rule all six screens share', () => {
  it('ไม่รู้ (isPaid null) draws NOTHING — not the upsell, not a level', () => {
    // Both directions asserted on purpose: a mutant that guesses free and a mutant that guesses paid are
    // different bugs with different victims, and `kind !== 'upgrade'` alone would let the second one pass.
    expect(headerBadge({ isPaid: null }, { upgradeCta: true })).toEqual({ kind: 'none' })
    expect(headerBadge({ isPaid: null, tier: 'PRO' }, { upgradeCta: true })).toEqual({ kind: 'none' })
  })

  it('a missing membership prop is treated as ไม่รู้, never as free', () => {
    // The direction a forgotten wire must fail in: losing a sale beats calling a member a non-member.
    expect(headerBadge(undefined, { upgradeCta: true })).toEqual({ kind: 'none' })
    expect(headerBadge(null, { upgradeCta: true })).toEqual({ kind: 'none' })
  })

  it('free → the upsell, and only where the screen allows selling', () => {
    expect(headerBadge({ isPaid: false, tier: null }, { upgradeCta: true })).toEqual({ kind: 'upgrade' })
    expect(headerBadge({ isPaid: false, tier: 'FREE' }, { upgradeCta: true })).toEqual({ kind: 'upgrade' })
    // shop + notifications: no CTA. A free viewer sees exactly what they see today — nothing.
    expect(headerBadge({ isPaid: false, tier: null }, { upgradeCta: false })).toEqual({ kind: 'none' })
  })

  it('paid with no level name → "สมาชิก" (the state EVERY member is in today)', () => {
    // goo #383: nobody has bought through the v2 lane yet, so every existing paying member arrives here.
    // This is the main screenshot in the PR for that reason — it is not the edge case, it is the common one.
    expect(headerBadge({ isPaid: true, tier: null }, { upgradeCta: true })).toEqual({ kind: 'tier', label: MEMBER_BADGE_LABEL })
    // and with no `tier` key at all — the shape the hook has BEFORE #383 merges.
    expect(headerBadge({ isPaid: true }, { upgradeCta: true })).toEqual({ kind: 'tier', label: MEMBER_BADGE_LABEL })
  })

  it('paid with a level name → that name, on every screen including the ones that cannot sell', () => {
    expect(headerBadge({ isPaid: true, tier: 'PLUS' }, { upgradeCta: true })).toEqual({ kind: 'tier', label: 'PLUS' })
    expect(headerBadge({ isPaid: true, tier: 'PRO' }, { upgradeCta: true })).toEqual({ kind: 'tier', label: 'PRO' })
    // upgradeCta is the screen's SALES policy; a level badge is not a sales control and ignores it.
    expect(headerBadge({ isPaid: true, tier: 'PRO' }, { upgradeCta: false })).toEqual({ kind: 'tier', label: 'PRO' })
  })

  it('never prints the word FREE on a paying member, whatever arrives', () => {
    // goo closes this pair at the source (resolveDisplayTier, #383). This is NOT a second copy of that rule —
    // it is the narrower one that belongs to a badge: which STRINGS may this pill print. The only reader who
    // could ever see "FREE" here is someone who paid, so the answer is never.
    const impossible = { isPaid: true, tier: 'FREE' } as MembershipLike
    expect(headerBadge(impossible, { upgradeCta: true })).toEqual({ kind: 'tier', label: MEMBER_BADGE_LABEL })
  })
})

// ── the rendered pill ───────────────────────────────────────────────────────────────────────────────
describe('#384 the header renders what the rule decided', () => {
  const renderHeader = async (membership: MembershipLike | undefined, upgradeCta = true) => {
    const { AppHeader } = await import('@/features/v2-shell/components/AppHeader')
    render(
      <CookiesProvider>
        <AppHeader title="ทดสอบ" membership={membership} upgradeCta={upgradeCta} />
      </CookiesProvider>,
    )
  }

  it('free sees อัพเกรด — a LINK to the shop, unchanged from #359', async () => {
    await renderHeader({ isPaid: false, tier: null })
    const pill = screen.getByTestId('header-upgrade')
    expect(pill.tagName).toBe('A')
    expect(screen.queryByTestId('header-tier')).toBeNull()
  })

  it('a member sees their level, and the text is the rendered glyphs — not a data attribute', async () => {
    await renderHeader({ isPaid: true, tier: 'PRO' })
    expect(screen.getByTestId('header-tier').textContent).toBe('PRO')
    expect(screen.queryByTestId('header-upgrade')).toBeNull()
  })

  it('a legacy member sees "สมาชิก"', async () => {
    await renderHeader({ isPaid: true, tier: null })
    expect(screen.getByTestId('header-tier').textContent).toBe(MEMBER_BADGE_LABEL)
  })

  it('🔴 ไม่รู้ renders NEITHER pill — the frame carries no badge at all', async () => {
    await renderHeader({ isPaid: null, tier: null })
    expect(screen.queryByTestId('header-upgrade')).toBeNull()
    expect(screen.queryByTestId('header-tier')).toBeNull()
    // Surface size stated out loud: the bell + avatar must still be there, or this assertion would also
    // pass on a header that failed to render anything at all (a gate answering over zero items).
    expect(screen.getByTestId('header-tools').children.length).toBe(2)
  })

  it('shop/notifications policy: a member still sees their level, a free viewer sees nothing', async () => {
    await renderHeader({ isPaid: true, tier: 'PLUS' }, false)
    expect(screen.getByTestId('header-tier').textContent).toBe('PLUS')
    cleanup()
    await renderHeader({ isPaid: false, tier: null }, false)
    expect(screen.queryByTestId('header-upgrade')).toBeNull()
    expect(screen.queryByTestId('header-tier')).toBeNull()
  })
})

// ── bug A: the home error path ──────────────────────────────────────────────────────────────────────
describe('#384 bug A — an /api/user error must not tell a paying member to upgrade', () => {
  it('the home page reads the row-derived verdict, NEVER the old boolean', () => {
    const src = code('pages/v2/index.tsx')
    // #383 put the three-valued verdict on HomeProfile itself, so home now hands the seam straight to the
    // header — the same object the other five screens pass. What must never come back is the boolean: that
    // is the field that had no value for "we could not tell" and spent it as "not paid".
    expect(src).toMatch(/membership=\{profile\}/)
    expect(src).not.toMatch(/showUpgrade/)
  })

  it('the home screen has no truthy badge fallback left to fall into', () => {
    const src = code('features/v2-home/components/V2HomeScreen.tsx')
    // MU7: `const PROFILE_FALLBACK = { pictureUrl: null, showUpgrade: true }` was the second shape of the
    // same bug — remove the field but keep the fallback and the bug CHANGES FORM rather than leaving.
    expect(src).not.toMatch(/showUpgrade:\s*true/)
    expect(src).not.toMatch(/showUpgrade/)
  })

  it('the error path now answers "ไม่รู้" at the source — the bug is closed, not moved', () => {
    // This case has been rewritten twice and BOTH rewrites are the point.
    //   v1 (#384 draft) asserted deriveHomeProfile(null).showUpgrade === true — the bug, reproduced.
    //   v2 (after #383) asserted isPaid null WHILE showUpgrade stayed true — the two disagreeing.
    //   v3 (this one)   asserts the boolean is GONE and only the honest answer remains.
    // Deleting it at any step would have deleted the fact it pins; the fact outlived the field.
    const settledNoRow = { done: true, errored: false }
    expect(deriveHomeLoading('home', false).profile).toBe(false) // the header is NOT greyed on this path
    expect(deriveHomeProfile(null, settledNoRow).isPaid).toBeNull() // ...and the verdict refuses to guess
    expect('showUpgrade' in deriveHomeProfile(null, settledNoRow)).toBe(false)
    // ⇒ headerBadge turns that null into "no pill" — proven by MU1/MU2 in the mutant contract above.
  })
})

// ── the six screens are wired ───────────────────────────────────────────────────────────────────────
describe('#384 every screen that renders the shared header passes a membership', () => {
  // The ticket said FIVE screens. There are SIX <AppHeader/>/<HeaderTools/> call sites — the notifications
  // screen passed no tier at all, which is why it showed no badge to anyone. Naming the number here means a
  // seventh screen added later without a wire makes this list wrong out loud instead of quietly incomplete.
  const SCREENS = [
    { rel: 'features/v2-home/components/V2HomeScreen.tsx', cta: true },
    { rel: 'features/v2-service/components/ServiceHubScreen.tsx', cta: true },
    { rel: 'pages/v2/calendar.tsx', cta: true },
    { rel: 'pages/v2/calendar/[date].tsx', cta: true },
    { rel: 'features/v2-shop/components/ShopScreen.tsx', cta: false },
    { rel: 'pages/v2/calendar/notifications.tsx', cta: false },
  ] as const

  it('all six pass membership through', () => {
    expect(SCREENS).toHaveLength(6)
    for (const { rel } of SCREENS) {
      expect(code(rel), `${rel} stopped passing membership`).toMatch(/membership=\{/)
    }
  })

  it('exactly the two non-selling screens say so, and no others', () => {
    const off = SCREENS.filter((s) => !s.cta).map((s) => s.rel)
    expect(off).toEqual(['features/v2-shop/components/ShopScreen.tsx', 'pages/v2/calendar/notifications.tsx'])
    for (const { rel, cta } of SCREENS) {
      const hasFlag = /upgradeCta=\{false\}/.test(code(rel))
      expect(hasFlag, `${rel} upgradeCta={false} should be ${!cta}`).toBe(!cta)
    }
  })

  it('the count is measured, not remembered — a seventh call site fails this', () => {
    // The class this guards: a list hand-copied from a ticket goes stale silently. Counting the real call
    // sites in the source means the list has to be updated by whoever adds the next screen.
    const files = [
      'features/v2-home/components/V2HomeScreen.tsx', 'features/v2-service/components/ServiceHeader.tsx',
      'pages/v2/calendar.tsx', 'features/v2-calendar/components/day-detail/DayHeader.tsx',
      'features/v2-shop/components/ShopScreen.tsx', 'pages/v2/calendar/notifications.tsx',
      'features/v2-home/components/HomeSkeleton.tsx',
    ]
    const sites = files.reduce((n, rel) => n + (code(rel).match(/<(AppHeader|HeaderTools)\b/g) ?? []).length, 0)
    // 6 screens + HomeSkeleton's pre-mount frame (which renders V2HomeScreen, badge hidden by loading.profile)
    expect(sites).toBe(6)
  })
})
