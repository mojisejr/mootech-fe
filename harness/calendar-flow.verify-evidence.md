# verify-evidence — calendar full-flow + notifications entry-points (Phase 7 · final of the set)

Co-located proof for `features/v2-calendar/components/day-detail/DayHeader.tsx` (A1: bell → notifications) +
`pages/v2/calendar/[date].tsx` (A2: post-save "ดูรายการทั้งหมด" button) + `harness/run-calendar-flow.ts`. Phase 7
closes the calendar set: give the notifications screen an entry-point, and walk the whole journey to prove no
dead-ends. goo's hooks untouched. **No API touched.**

## capability → gate (why this screen matters)
Phase 6 shipped the notifications list **unreachable** — no surface linked to it (my completeness lens had run
spatial/state-space/reference-parity but never the reachability axis). Phase 7 is the first live use of the
**reachability 4th axis** (ฟีม-ratified): does every screen have a real inbound entry-point, verified by a
comprehensive grep (href + string + router.push — a literal-href grep gives false positives on array-/push-
driven nav — บอง's lesson), not assumed. Plus: Phase 7 touches DayHeader + the day page, so **all 5 prior anchors
must stay green** (done-condition 5 — if a screen breaks, only the anchors tell).

## proof-of-teeth (run-calendar-flow.ts → ✅ PASSED)
| invariant | result |
|---|---|
| no-overflow-x @ **393 · 360 · 320** | ✓ all 3 sizes × month / day / notifications |
| **no dead-end** | every non-month screen has a way back (→ /v2/calendar); month has the tab nav |
| **menu state per screen** | month **1** (tabs) · day-unsaved **2** (primary-cta) · sheet-open **4** (form, no Mate AI) · saved **3** |
| **A1 entry-point** | DayHeader **bell → /v2/calendar/notifications** (was a static Mate AI glyph) |
| **A2 entry-point** | after save, **"ดูรายการทั้งหมด" → /v2/calendar/notifications** appears (menu is state 3) |
| within-page continuity | save on the day page → **reminder-count 0→1**; cancel on the list → **row AND summary both 3→2** |
| reachability (comprehensive grep) | `/v2/calendar/notifications` now has **2 inbound refs** (DayHeader bell + [date] A2) — **no longer orphan** |
| 5 prior anchors re-run | **month · day · advanced · save · notifications — all ✅ green** (no regression) |
| 0 app-fetch + 0 console | across the whole walk |
| `mut-orphan-notifications` (remove the bell or A2) | the entry-point checks fail → 🦷 **CAUGHT** (the reachability axis catches re-orphaning) |

## real-route artifact @393 (+ overflow @320)
`npx tsx harness/capture-p7.ts` → `p7-day-entrypoints-393.png` (day-detail: header **bell** top-right + post-save
**"✓ บันทึกแล้ว · ดูรายการทั้งหมด →"** button under the score card) · `p7-day-320.png` (no overflow @320). The
walk itself is the artifact — the anchor drives /v2 → month → day → toggle → sheet → save → list → cancel → back.

ANCHOR: harness/run-calendar-flow.ts#mut-orphan-notifications

## completeness-pass — all 4 axes (the reachability axis's first live pass)
1. **Spatial** — the walk touches every screen of the flow, not a spot.
2. **State-space** — month/day-unsaved/day-advanced/sheet-open/saved/list-populated/list-after-cancel, × 3 sizes.
3. **Reference parity** — n/a (flow, not a single reference frame); the 5 per-screen anchors hold parity.
4. **Reachability** — grep'd (href + import + push) that notifications has inbound links; walked both entry-points
   (bell + A2) end-to-end. **Also enumerated OTHER orphans** (per the axis's "is there another unreachable screen?"):
   `/v2/onboarding`, `/v2/home-preview`, `/v2/menu-preview` have no inbound route-link — see deviations.

## Deviations logged (A2, NOT claimed covered)
- **Cross-page state persistence is an INTENTIONAL mock limitation, not a bug.** `useReminders` is per-page
  `useState(MOCK_REMINDERS)` (no shared store/context) → a reminder saved on day X does **not** appear on the
  notifications page (a fresh instance shows the mock list). At API-time `useReminders` fetches from the server, so
  every page that mounts gets the same data automatically → cross-page continuity emerges **for free**, no shared
  store. Adding a context now would be code that gets torn out at API-time (real scope creep — บอง's call). So this
  round proves **within-page** continuity (save→count-up on the day page; cancel→count-down on the list); cross-page
  persistence is deferred to API-time by design.
- **Other orphan routes found (flagged to บอง, NOT fixed — outside Phase 7 scope):** `/v2/home-preview` +
  `/v2/menu-preview` are dev-preview pages (intentionally unlinked). `/v2/onboarding` renders a real component
  (OnboardingCarousel) but the standalone ROUTE has no inbound link — the carousel's real entry is `/v2` itself
  (anon users, via goo's `useV2AuthGate`), so the standalone route looks **redundant/vestigial**. Reported to บอง →
  ฟีม decides remove-or-link; I did not touch it.
- A1 bell: repurposed the DayHeader's Mate AI glyph → notifications (Mate AI still lives in the bottom CalendarMenu).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) do all 5 prior anchors still pass? — re-run in this anchor's context,
  all green; (2) is the notifications screen truly reachable now, or did I assume it? — comprehensive grep + a
  walked end-to-end click through both entry-points; `mut-orphan-notifications` bites; (3) no-op guard + cancel
  still work? — the save + notifications anchors re-run green; (4) overflow at 320? — asserted all 3 sizes;
  (5) is cross-page persistence a bug I hid? — no — documented as an intentional mock limitation that resolves at
  API-time (reasoning in Deviations).
- **goo** — hooks/contract untouched; the cross-page-persistence scoping is his layer (per-page useState → server-fed at API-time).
