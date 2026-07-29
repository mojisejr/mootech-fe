# verify-evidence — ปฏิทินดวง notifications list (screen 6 · NO Figma — designed) — calendar Phase 6

Co-located proof for `pages/v2/calendar/notifications.tsx` (the designed reminders list) + `harness/
run-calendar-notifications.ts`. Phase 6 — the **final** calendar screen, and **the only one with no Figma**: it
is designed within DESIGN.md by BORROWING existing primitives, not inventing. goo's `useReminders` (list =
upcoming/past/totalYams/totalDays + cancel) is UNCHANGED — the page only reads it, adds **no useState**. ฟีม:
empty state = **แบบ ก** (text + button, no mascot). **No API touched.**

## capability → gate (why this screen is different)
No Figma ⇒ only two things are measurable: **is it inside the DESIGN.md brand**, and **does it work**. A
no-reference screen can drift the brand SILENTLY (nobody has a frame to catch it). So the design **borrows**:
`CalendarShell` + `CalendarMenu`, `SectionCard` (the group cards), the day-detail row style (#F9F4F0), the
DayHeader top-bar pattern, and **v3 tokens only** — no new colour, no component that "looks like nothing else in
the app." And because cancel WRITES state, the anchor proves it through the UI — including that the **summary
count decreases with the row** (done-condition 2: "ตัวเลขสรุปลดตาม ไม่ใช่แค่แถวหาย"), read on the **same page** at
assert-time (บทเรียน P5 near-miss: never navigate away to count — that resets per-page state → a vacuous green).

## proof-of-teeth (run-calendar-notifications.ts against /v2/calendar/notifications → ✅ PASSED)
| invariant | result |
|---|---|
| no-app-fetch + console | **0 / 0** without a backend |
| real list (goo's comment: not a 1-row picture) | 3 mock reminders → **3 rows** · summary **3 ยาม** · 2 groups |
| past group | "เตือนไปแล้ว" rows **faded** (opacity<1) AND **no cancel button** (cancel buttons == upcoming count 2, not 3) |
| **CANCEL through UI** | click ยกเลิก → **row removed (3→2)** AND **summary total DECREASED (3→2)** — not just the row — read on THIS page |
| **brand tokens (no new hex)** | summary bg == **v3-sapphire #1455A4** · row bg == **lemon-chiffon #F9F4F0** · borrows `SectionCard` |
| `mut-summary-hardcoded` (hardcode the summary number instead of `list.totalYams`) | cancel drops the row but count STAYS 3 → the count-decrease gate rejects → 🦷 **CAUGHT** live |

## real-route artifact — 2 states @393 (no Figma to compare — this screen IS the design)
`npx tsx harness/capture-p6.ts` → `notif-list.png` (3 rows: 2 กำลังจะถึง w/ cancel + 1 เตือนไปแล้ว faded no-cancel;
summary card; CalendarMenu state 3) + `notif-empty.png` (แบบ ก: bell glyph, text, "ไปที่ปฏิทิน" button, no
mascot). `compare-p6-states.png` sets them side-by-side. The empty state is forced for the shot (the mock always
has reminders and past rows are non-cancellable by spec, so it is unreachable at runtime); the branch itself is
real (`isEmpty`). tsc + prod build clean.

ANCHOR: harness/run-calendar-notifications.ts#mut-summary-hardcoded

## completeness-pass + honest scope (visual-lens clause)
**Bounded reference** = the DESIGN.md brand (no Figma frame) + goo's list contract + viewport 393.
1. **Spatial** — the whole page: top bar, summary, both group cards + all rows, empty state.
2. **State-space** — **populated** (3 mock: 2 upcoming + 1 past) AND **empty** (แบบ ก) AND the **cancel
   transition** driven live (row + count both drop). The write-branch is exercised, not assumed.
3. **Brand parity** — every surface maps to an existing primitive/token (SectionCard · #F9F4F0 row · DayHeader
   bar · v3-sapphire/lemon-chiffon); no bespoke component, no new colour (asserted by computed-style).

**Deviations logged (A2, NOT claimed covered):**
- **Empty-state screenshot is a forced branch** — the mock seeds 3 reminders and past rows are non-cancellable
  (by spec), so 0-reminders is unreachable at runtime; the `isEmpty` branch is real code, captured by forcing it.
- **Summary hidden in the empty state** (a design call within my remit) — no "0 ยาม" above "ยังไม่มีการแจ้งเตือน".
- **CalendarMenu state 3** (per the brief) on the list page — semantically "you have reminders"; flagged as a
  slightly unusual choice for a standalone list but followed as dispatched.
- ยาม copy/dates/destinations are goo's illustrative fixtures.

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING** (Brand Guardian + cancel lens). Points to attack: (1) did the brand drift with no Figma? —
  computed-style asserts summary=sapphire, row=lemon-chiffon, and it borrows `SectionCard`/DayHeader/CalendarShell
  (no bespoke component); (2) does cancel really remove + **decrement the count**, or just hide the row? —
  asserts total 3→2 on the same page, `mut-summary-hardcoded` bites; (3) is the count read where it lives (not by
  navigating away → vacuous)? — read from the on-page summary at assert-time; (4) is the past group correctly
  non-cancellable + faded? — asserted; (5) new colours? — none, all v3 tokens.
- **goo** — the page consumes `useReminders` unchanged; no hook/contract touched.
