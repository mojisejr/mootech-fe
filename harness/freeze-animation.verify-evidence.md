# verify-evidence — Phase 1: freeze animation before pixel-compared captures · goo

Harness-only change. No component / no page / no prod / no env touched. Ran live against the test-env FE
(`/v2/home-preview` @393, booted with the local test env; `V2_PREVIEW_KEY=local-testenv`).

## the problem (ตู๋ caught it)
มุน is adding 2s `infinite` CSS-loop animations to the /v2 home (Zone 4/5/6). A lens that diffs **two frames**
reads a huge pixel diff for a reason unrelated to the bug it hunts → a guaranteed false-red on every run.

## ✅ what I FIXED (harness)
`freezeAnimations(page)` renders the page in its **reduced-motion static state** before the first pixel-compared
screenshot, wired into `pixel-anchor.ts` (the only frame-vs-frame lens).

### the mechanism decision — measured, not guessed (บอง offered ก/ข, both team members proposed `animation:none`)
| option | verdict | why |
|---|---|---|
| `animation-play-state: paused` | ❌ rejected | freezes at the **current** frame → a slow-vs-fast load pauses at a different loop phase = a *timing-dependent* flaky (บอง retracted his own first instruction). |
| `animation: none` / WAAPI `currentTime=0` **as primary** | ❌ rejected | snaps an element to base/0%. **Measured:** `z3-pop`'s 0% is `opacity:0` → it would render **invisible**, capturing a state the user never sees. |
| **`reducedMotion: 'reduce'`** (Playwright `emulateMedia`) | ✅ chosen | fires the page's **own** `@media(prefers-reduced-motion:reduce)` guards → μุน's intended static (`opacity:1; transform:none`), entrances stay visible; platform-native; exercises the guard for free; μุน already proved it pixel-identical on Zone 3. A WAAPI `currentTime=0` pin is kept as a **belt** for any animation lacking a reduced-motion guard. |

## proof-of-teeth (`run-freeze-proof.ts`, live `/v2/home-preview`)
- **(A) determinism across load timing** — the SAME page frozen at **3 different** loop-phase offsets
  (0 / 660 / 1320 ms into the 2s loop): `diff(0,660)=0 · diff(660,1320)=0 · diff(0,1320)=0` px. (บอง's
  requirement: prove with 3 *different* timings, not 2 back-to-back in one condition — that would miss the flaky.)
- **(B) non-vacuous / verify-the-instrument** — `11` animations live **before** the freeze → `0` after
  (so the diff-0 is a real freeze of real motion, and every motion carries a reduced-motion guard).
- **done-condition 3 (nothing broke):** `run-pixel` (neg-control 0px · mut-persistent + sub-budget CAUGHT),
  `run-bg-continuity` (clean seam 64 ≤ 90 · teeth caught), `run-verdict-color` (verdicts distinct) — all still 🟢.
- **assumption #1 (บอง's ~):** no extra settle wait needed after the freeze — diff is 0 with 0ms wait. Confirmed.
- **assumption #2 (JS rAF):** all 11 animations are CSS/WAAPI (11→0 under reduce), so nothing escaped on the real
  page. A hand-rolled `requestAnimationFrame` loop is not freezable and carries no reduced-motion guard — but it
  would surface as a **non-zero diff** (fails loud), and μุน's plan is CSS keyframes.

## the sweep — all 8 harness `screenshot()` calls (the #167/#176 completeness trap)
| site | kind | frozen? | why |
|---|---|---|---|
| `pixel-anchor.ts:88,92` (frameA/frameB) | **frame-vs-frame diff** | ✅ **FROZEN** | the only lens where animation makes A≠B. |
| `run-bg-continuity.ts:42` (fullPage seam) | single-frame, samples static **left BG margin** (x=12) | exempt | one coherent frame can't false-red a row-vs-row seam; the margin carries no animation. Proven: still passes (64≤90) on the animated page. บอง's caution (don't distort the fullPage seam) → honoured by not touching it. |
| `run-verdict-color.ts:24` (svg) | single-frame **hue** read of the Zone-1 ring | exempt | reads colour, not motion; ring is static (not Zone 4/5/6); 400ms settle covers any draw-in. Proven: verdicts still distinct. |
| `capture.ts:78` | verdict from **measurements**; shot is human evidence | exempt | decisions use `getBoundingClientRect`/computed style, not the pixels. |
| `capture-route.ts:124,143,153` | **human-review** PNGs | exempt | eyeballed, not diffed. (If μุน wants deterministic review shots of the animated page, freezing capture-route is a cheap follow-up — out of the pixel-compare scope.) |

## ⚠️ what I FOUND but did NOT fix (UI — owner = มุน, queued by บอง)
Two **already-merged Zone-3** elements hold their base transform **only in the `@keyframe`** while their
reduced-motion guard forces `transform:none`, so under *any* remove-animation freeze they snap to identity:
- `.z3-rock-l` — base `rotate(7deg)` lives only in `@keyframes z3-rl` 0%/100% → freeze = `none` → **+7° tilt lost**.
- `.z3-rock-r` — base `scaleX(-1) rotate(8.55deg)` lives only in `@keyframes z3-rr` → freeze = `none` → **flip+tilt lost**.
(`.zone2-coin`, `.z3-heart`, `.z3-pop` rest at identity → fine.)

This is **not a harness bug and not fixed here**. It is also a **real accessibility bug** (บอง's reframe): a
user with reduce-motion enabled on their phone sees the right rock un-flipped — facing the wrong way. The UI fix
(μุน): move the base transform onto the element/class and stop forcing `transform:none` in the reduced-motion
guard. The same rule applies to μุน's new Zone-4/6 white frame (`-9.154°`) — its base must live on the element.

## adversary sign-off
**goo self-adversarial:** rejected two proposals (incl. บอง's own + μุน's) *because I measured the failure*
(paused=timing-flaky; animation:none hides `z3-pop`) rather than following the instruction blindly · determinism
proven the hard way (3 *different* load timings, not 2 back-to-back) · verify-the-instrument (11→0) so diff-0 is
not vacuous · the trap detector's runtime `currentTime=0` read was found flaky (races the style flush) and
**dropped** in favour of the CSS source as ground truth — the shipped proof asserts only what is reliable ·
never prints/commits the passkey (read from env) · captures are gitignored.
**Pending ตู๋ (too).**

ANCHOR: harness/freeze-animation.ts#freeze-animation
