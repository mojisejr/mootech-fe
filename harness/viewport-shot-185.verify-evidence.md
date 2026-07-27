# verify-evidence — #185 viewport shot: make review captures that fixed/sticky can't fool · goo

Harness-only change: `capture-route.ts` (+ one stale-comment fix in `pixel-anchor.ts`). No component / no page /
no prod / no env touched. Ran live against the test-env stack (FE :3000 · BE :4000 · bazi :3100 · pg :5433,
booted via stack.sh up → all 🟢 practice).

## the bug
`capture-route.ts:123` took only `fullPage: true`. A fullPage shot renders `position: fixed/sticky` ONCE at its
document position, so a fixed element floats to the WRONG place in the tall image — a reviewer can't see what the
user actually sees on screen, and an overlap can pass review.

## the fix
Each viewport now also gets: (a) `vp-top` — the first screen, viewport-sized (cut at 852), no fullPage;
(b) `vp-bottom` — a viewport shot scrolled to the very BOTTOM of the page (`scrollTo(0, scrollHeight)`), taken
whenever the page is taller than one screen (`sh > ih`); (c) a printed list of every `fixed`/`sticky` element
(count + tag/class + box) so the overlap can't hide from a reviewer's eye. The existing `full` file name is
unchanged (backward-compat).

### false-green fix (บอง #123, same bug-class as the pixel-anchor docblock — the tool's OWN output must be true)
The first cut gated the second shot on `sh > ih * 1.5` yet the skip message said "page ≤ viewport → same as
vp-top, skipped". A page 1.0–1.5× the viewport is TALLER than one screen — its bottom differs from vp-top — but
the tool AFFIRMED "same as vp-top", i.e. it told the reviewer nothing was missed while a whole band went
unphotographed. That is the exact false-green this task exists to kill. Fix: (1) drop the magic 1.5 — shoot the
second frame whenever `sh > ih`; (2) scroll to the BOTTOM, not the middle, because a `fixed bottom-0` bites hardest
where it overlaps the LAST content; (3) rename `vp-mid` → `vp-bottom` so the name states what it does; (4) the
skip line now fires only when `sh <= ih` and reads "page fits in one viewport → the whole page IS vp-top; there is
no separate bottom screen" — which is literally true. No band is ever silently dropped.

## proof-of-teeth (ran live, `--route /v2 --user default --viewports 393`, FE build ff72ae7)
- **done#1 — three shots, correct sizes:** `full` 786×4064 (whole page), `vp-top` 786×1704, `vp-bottom` 786×1704
  (= 393×852 @dsf2, exactly one viewport). vp-bottom produced because /v2 (`sh`≈2032) is taller than the viewport.
- **done#2 — the tool tells you what floats (not the eye):** probe printed `fixed/sticky: 2 found` —
  `fixed <nav class="fixed inset-x-0 bottom-0 z-30 …"> box=[0,758 393x94]` (the bottom tab bar) and a 0×0 portal
  anchor `<div> box=[373,842 0x0]`. Count + tag/class + box, from the live DOM.
- **done#3 — honest double-evidence (full vs vp-bottom), and I looked at the pixels:**
  - `full`: the fixed bottom nav is rendered in the MIDDLE of the tall image (~y≈800 CSS-px, over the ดวงสมพงค์
    "ดูดวงคู่รัก / เพื่อนร่วมงาน" cards) — its `bottom-0` frozen at the initial-viewport bottom, so in the 2032-px
    page it lands mid-document, covering unrelated cards.
  - `vp-top`: the nav is correctly pinned to screen-bottom over the first screen.
  - `vp-bottom`: the SAME nav pinned to screen-bottom, now over the LAST content (เรียนปาจื่อ / "เร็วๆ นี้"
    placeholder + the footer "ดูบริการทั้งหมด" button) — the exact spot a `fixed bottom-0` most often overlaps
    real content, and the frame `full` cannot show. Here the nav clears the last button with a gap → no overlap bug.
  So full vs vp-bottom differ dramatically and visibly — the fix works.
  - ⚠️ this is a **screenshot artifact, NOT a UI bug**: the nav is a legit `fixed bottom-0`; it renders correctly
    in a real browser. The tool now makes the fullPage misplacement visible; per the plan, "the tool works, no UI
    bug" is the correct result — I did not hunt for a bug.
- **done#4 — old behavior intact:** the `full` shot + its filename (`…__393.png`) are unchanged; `--route`
  `--user` `--viewports` flags unchanged; tsc clean.
- **done#5 — bug-class sweep (#167/#176 trap), answered:** grep'd every harness screenshot call —
  - `capture-route.ts:123` = the real bug (fixed here).
  - `run-bg-continuity.ts:42` uses `fullPage: true` **on purpose** — it samples the BG margin down the WHOLE
    scroll to catch a seam; a viewport shot would break it. **Left untouched** (fixing it would be the regression).
  - `capture.ts:78` and `pixel-anchor.ts:88` already use viewport `screenshot()` — not this bug.
  - `run-verdict-color.ts:24` screenshots an SVG element — N/A.
  → only `capture-route.ts` had the bug. (Sibling comment fix: `pixel-anchor.ts:42` docblock said "fullPage
  frames" while the code is viewport — a lying header of the same class that cost us two days — fixed in a
  separate `docs()` commit at บอง's call; comment only, zero behavior change.)

## finding to report (verify-real-path — plan's code-read vs live truth)
The plan cited `header-v2.tsx:120` `fixed top-0 h-[60px]` as the demo target. The **live** /v2 @393 default shows
**no fixed top-0 header** — the top greeting/bell/avatar are normal flow content; the only meaningful fixed
element is the **bottom tab nav** (`fixed bottom-0`). So the double-evidence is best shown on the bottom nav (as
above), not a top header. Reported, not silently adjusted. (Not investigated further / not "fixed" — the UI is
not mine to touch, and the nav is correct.)

## adversary sign-off
**goo self-adversarial:** vp-bottom fires whenever `sh > ih` (no magic threshold), and the ONE skip message it
can print ("page fits in one viewport…") is true exactly when it prints — no band is silently dropped, no output
line can lie · scrolling to `scrollHeight` lands the bottom screen even on a 1.0–1.5× page (the band the old 1.5
gate left dark) · probe reads computed `position` on the live DOM (not class-name guessing, so a `sticky` via CSS
or an inline style is still caught) · never prints/commits the passkey (read from testenv/env/fe.env, message-only
errors) · captures are gitignored (the shots show the anonymized fake user "มิลา", not real PII).
**Live re-run after the false-green fix:** `--route /v2 --user default --viewports 393`, FE build ff72ae7 —
vp-bottom rendered the `fixed bottom-0` nav pinned to screen-bottom over the LAST content (เรียนปาจื่อ / เร็วๆ นี้
+ footer button), clearing it with a gap = no overlap bug; message read the truthful vp-bottom line, not a skip.
**Pending ตู๋ (too).**

ANCHOR: harness/capture-route.ts#viewport-shot
