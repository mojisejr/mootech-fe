# verify-evidence — shared CalendarMenu (Figma 461:3224) multi-state + A1 mascot fix (calendar Phase 1)

Co-located proof for `features/v2-home/components/CalendarMenu.tsx` (extracted from `HomeBottomNav`),
`pages/v2/menu-preview.tsx` (dev preview), and `harness/run-calendar-menu.ts`. Phase 1 of the calendar dispatch:
the bottom menu becomes **one shared, presentational, multi-state component** that home + the calendar flow use, and
the merged **mascot-overflow bug is fixed** — done first because every later calendar screen depends on it.

## Figma enumeration (my verify-gate — before building)
- Menu symbol `461:3224` = state 1 exactly: Menubar (4 tabs) + Navbar {Mate AI label + mascot **(1, y=9) 75×92** in a
  70-tall Navbar → bottom 31px clipped, head in frame — matches บอง's measurement}.
- Notifications `636:10221` = a full-screen **sheet with an X-close, NO bottom menu** → NOT a hidden 5th menu state.
- **No 5th state found** → did not hit the stop condition. States 2/3/4 are left-slot button variants (บอง-inferred,
  ฟีม-confirmed count); their Figma screen frames returned empty/oversized from the API, so they are **pixel-verified
  per-screen when built** (Phases 3/4/5) — the presentational component is extensible to a 5th state if one appears.

## capability → gate
The menu is one component with **4 states** where className/tsc are blind to whether the RIGHT slot renders, whether
the mascot actually sits INSIDE the button (A1), and whether the CTA gets truncated at 320 (A2). Ground-truth =
rendered geometry (bbox, Range), not the className.

## proof-of-teeth (run-calendar-menu.ts against /v2/menu-preview → 🟢 PASSED)
| invariant | result |
|---|---|
| state-slot | default[4tab+AI] · primary-cta[1btn+AI] · saved[✓btn+AI] · **form[1btn, NO Mate AI]** — each state's slot + Mate AI presence correct |
| mascot-inside (A1) | mascot head **not above** the button top (poke −13px ≤ 0) + clip container `overflow:hidden` — the old build poked ~14px above |
| verify-instrument | forcing the mascot up (top:−14px) **is** read as poking-above → the probe is not vacuous |
| label-1-line | "Mate AI" renders on **1 line** (Figma) — not the 2-line wrap |
| nav-height | **94px** (button 70 + pad) → the home nav-clearance (74px) is **untouched** (ตู๋'s constraint) |
| no-word-cut (A2) @320 | CTA "…เพื่อแจ้งเตือน" present + fits (maxLine 152 ≤ 168 inner, 1 line) + no ellipsis — measured by a **Range** (a flex button clips internally so scrollWidth is blind) |
| no-overflow-x | @ **393 · 360 · 320** across states |
| `mut-text-truncate` (nowrap + font bump → a line wider than the button) | no-word-cut gate rejects → 🦷 **CAUGHT** |

## the mascot fix + the latent bug it exposed
A1 (ฟีม ก · อยู่ในปุ่ม): fixed by clipping the mascot to the button (head-in, bottom-31 cut), matching Figma. The
clip is a wrapper **around the mascot only** — a blanket `overflow-hidden` on the button would clip the "Mate AI"
label (**ตู๋'s coupling catch**), and would risk the nav height / the 74px home clearance. Fixing the mascot
**exposed a latent bug**: the "Mate AI" label was width-constrained by `left:50%` (no `right`) to ~37px and wrapped
to 2 lines — invisible before because the overflowing mascot painted over it. Fixed with `whitespace-nowrap` (1 line,
poking beyond the button like Figma's 102px label) + `z-index` so the label sits on top of the mascot head (Figma
order). Rendered @393 matches the Figma menu symbol.

## no home regression
Home renders `<CalendarMenu state="default" />`. The tab bar is byte-identical code to the old `HomeBottomNav` (a
1px flex-rounding difference between two independent dev builds is render nondeterminism, not a change). The only
intended home delta is the Mate AI button (mascot + the now-visible/1-line label). Verified green **with the nav
change**: `run-page-end.ts` (nav-clearance **74px** @393/360/320) and `run-zone4-sian.ts`. tsc clean · prod build
clean (`/v2` + `/v2/menu-preview`).

ANCHOR: harness/run-calendar-menu.ts#mut-text-truncate

## completeness-pass + honest scope (visual-lens clause)
**Bounded reference** = Figma `461:3224` + declared viewports 393/360/320 + the 4 states.
1. **Spatial** — the whole menu: left slot (per state), Mate AI slot (mascot + label), + the clip geometry.
2. **State-space** — all **4 states** rendered (via menu-preview) + **3 viewports** (393/360/320) + the A1 mascot
   geometry + the A2 320 CTA. Data-invariant (presentational).
3. **Reference parity** — vs Figma `461:3224` (state 1 mascot y9/clip-31, label 1-line) + the plan's state table.

**Deviations logged (A2, NOT claimed covered):**
- **Figma tab-icons NOT added** — Figma's tabs carry an icon above each label; the shipped home nav is text-only.
  Adding icons would change home beyond the A1 mascot fix (not in the A1/A2/A3 freeze) → **kept text-only** to honor
  done-condition-5 (home unchanged). **Flagged to ฟีม** for a menu-completion decision (in the PR body).
- **States 2/3/4 styling is a first pass** (sapphire buttons, plan spec + tokens) — pixel-verified against the
  actual day/save screens when those are built (Phases 3/4/5); this PR proves the states' *structure* + slot logic.
- **goo's enum contract** — I import a local `CalendarMenuState` aligned to the agreed semantics; reconciles with
  goo's labeled Phase-0 enum at integration (a 5th state → route บอง→ฟีม, goo re-codifies).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) does the mascot fix eat the 74px nav-clearance? — nav-height 94px +
  run-page-end green after the change; (2) did the button-level clip swallow the Mate AI label? — the clip is
  mascot-only, label-1-line asserts it renders; (3) 320 CTA truncation? — Range-measured, `mut-text-truncate` bites.
- **What I tried to refute myself:** I did not trust "extraction is clean" — I diffed the tab bar (byte-identical
  code; the 1px is flex-rounding, confirmed by reading the render); I did not trust the mascot "looks fixed" — I
  asserted its geometry + forced a poke to prove the probe reads it; I did not silently add the Figma tab-icons —
  I surfaced the fidelity-vs-home-unchanged tension for ฟีม. **Unproven by me:** states 2/3/4 exact per-screen
  styling (built later) + whether ฟีม wants the tab-icons — logged A2.
