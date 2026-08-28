// #466 round 2 — CALL-SITE teeth for pages/v2/shop/checkout.tsx. MAIN lane.
//
// 🔴 THE DISEASE THIS GUARDS, IN THIS REPO'S OWN WORDS.
//   checkout.tsx:5                     "a page is the one place nobody writes unit tests for, so it should
//                                       hold as few decisions as possible"
//   result-declined-rule.test.ts:3-5   "…it was never tested — and the branch that was missing stayed
//                                       missing"
//   scripts/tier-prod-pages.test.tsx:1 "Call-site teeth" — the same shape: a hook with teeth, and a page
//                                       that never passed the value down.
//
// mootech-fe#466 was that disease twice over. Round 1 fixed the words and left the ORDER in the page;
// ตู๋ deleted the refusal check and reordered it, and `npm test` stayed green both times (883 passed, rc=0)
// while a paying member was told their bank had declined them.
//
// A unit test on the pure function cannot see that: the page can simply stop calling it. This file watches
// the page itself, as SOURCE.
//
// 🔴 AND SOURCE IS ALL IT WATCHES — read this before trusting the file name (ตู๋, review r2 of ec6e66c).
// It enforces VOCABULARY: that the page does not spell a result state or build a result URL. It cannot
// enforce BEHAVIOUR. ตู๋ put the whole bug back without typing one forbidden word, using a helper this very
// PR added:
//
//     + if (!r.ok) { setPaying(false); void router.push(tokenizationFailedDestination(packageCode).href); return }
//
// …and every assertion below stayed green while a paying member was told their bank had declined them.
// **409 is `!r.ok`.** A guard weaker than its own name is worse than no guard, because the next reviewer
// stops looking here.
//
// ⇒ The BEHAVIOUR is guarded by scripts/checkout-pay-mount.test.tsx, which mounts the page and presses the
// button. This file stays because it caught a real leftover the moment it was written (the catch block was
// still routing to CARD_DECLINED by hand) and because it keeps the page from re-growing decisions in
// vocabulary the mount test does not happen to exercise. It is a second net, not the net.
//
// 🔴 MUTANT CONTRACT:
//   MK1  put a result-state literal back in the page          → "names no destination" reddens
//   MK2  stop calling payDestination                          → "asks the pure function" reddens
//   MK3  hand the bank's authorizeUri to the Next router      → "leaves the app for an external URL" reddens
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PAGE = 'pages/v2/shop/checkout.tsx'
const src = readFileSync(resolve(PAGE), 'utf8')

describe('#466 the checkout page holds no routing decision', () => {
  it('the file is really there and really read — a 0-from-0 guard proves nothing', () => {
    expect(src.length).toBeGreaterThan(500)
    expect(src).toContain('async function pay()')
  })

  it('MK1 — the page names NO result state of its own', () => {
    // Every one of these used to be written here, and the wrong one was chosen for a year of a bug's life.
    for (const literal of ['CARD_DECLINED', 'OFFLINE', 'ALREADY_ON_THIS_TIER', 'CANNOT_DOWNGRADE', 'state=PAYING']) {
      expect(src, `${PAGE} decides "${literal}" by itself — that belongs in pay-destination.ts`).not.toContain(literal)
    }
  })

  it('MK1 — nor does it build a result URL of its own', () => {
    expect(src, `${PAGE} builds its own /v2/shop/result URL`).not.toMatch(/\/v2\/shop\/result\?/)
    expect(src, `${PAGE} builds its own /v2/shop/qrcode URL`).not.toMatch(/\/v2\/shop\/qrcode\?/)
  })

  it('MK2 — it asks the pure function instead', () => {
    expect(src).toContain('payDestination(')
    expect(src).toContain("from '@/features/v2-shop/pay-destination'")
  })

  it('MK3 — an external destination leaves the app; it is never pushed through the Next router', () => {
    // #439: window.location, not router.push. Pushing the bank's URL through Next lands on a 404 of ours.
    expect(src).toMatch(/kind === 'external'[\s\S]{0,120}window\.location\.href/)
  })

  it('🔴 the page cannot decide the button state either — that rides on the answer', () => {
    expect(src).toContain('dest.keepPaying')
  })
})
