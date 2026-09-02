// #585 — the co-worker cap is mirrored in three files. This holds them equal, because a comment could not.
//
// 🔴 WHY A TEST AND NOT THE COMMENT THAT WAS ALREADY THERE. colleague-candidates.ts said the constant was
// "the one place that has to move". ตู๋ measured it while reviewing mootech-fe#589: raising the SCREEN's
// copy reddens the screen suite, raising the SERVER's copy — the one the route actually enforces —
// reddened nothing at all. Drift was detectable in one direction only, and the sentence claiming a single
// source of truth was the reason nobody looked for the other two.
//
// The copies are deliberate and stay: `bazi-work-client` reads `process.env` at module scope and lives in
// the server lane. What was missing is something that fails when they disagree.
//
// 🔴 THE LITERAL 3 IN THE ASSERTION IS PINNED ON PURPOSE — DO NOT TIDY IT INTO `expect(SCREEN).toBe(SERVER)`.
// That edit looks like it preserves the intent and does not: an agreement-only assertion goes GREEN when
// all three copies are moved together, which is exactly what a well-meaning "raise the cap" change looks
// like. With the literal pinned, moving all three still reddens, and whoever raises it has to come here
// and say so. Fired both ways: one copy moved → RED (the failure names which one), all three moved → RED.
//
// ⚠️ WHAT THIS CANNOT SEE, and the earlier version of this note described the test as narrower than it is
// (ตู๋ caught that reviewing mootech-fe#589 — the note claimed agreement-only while the code also pinned
// the number). The real blind spot is UPSTREAM, not local: all three are mirrors of ONE value, the
// engine's own cap at bazi-sft-dataset `src/app/api/bazi/work/route.ts:13` (branch `pdf-dev`), in a
// repository this suite cannot read. The day the ENGINE raises its cap and we do not follow, all three
// stay 3, all three still agree, this stays green — and every one of them is wrong together. Catching
// that needs a check that runs against the other repo, and there is none.
import { describe, expect, it } from 'vitest'
import { MAX_CANDIDATES as SCREEN_CAP } from '@/features/v2-service/colleague-candidates'
import { MAX_CANDIDATES as SERVER_CAP } from '@/lib/matching/bazi-work-client'
import { resolveCompatibilityKind } from '@/features/v2-service/compatibility'

describe('#585 — the three copies of the co-worker cap', () => {
  it('จอ เซิร์ฟเวอร์ และจำนวนช่องที่วาด ต้องเป็นเลขเดียวกัน', () => {
    const slots = resolveCompatibilityKind('colleague')!.maxCandidates
    // named individually so a failure says WHICH pair drifted, not just that something did
    expect({ screen: SCREEN_CAP, server: SERVER_CAP, slots }).toEqual({ screen: 3, server: 3, slots: 3 })
  })

  it('เลนคู่รักต้องไม่ถูกดึงไปด้วย ⇒ ตัวเลข 3 ไม่ได้แปลว่า "จำนวนช่องของทุกเลน"', () => {
    // without this, changing love's maxCandidates to 3 would pass the case above and silently give the
    // single-pair screen two extra slots it has no room for
    expect(resolveCompatibilityKind('love')!.maxCandidates).toBe(1)
  })
})
