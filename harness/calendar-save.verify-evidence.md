# verify-evidence — ปฏิทินดวง save sheet + saved state (Figma 375:13316 / 375:16355) — calendar Phase 5

Co-located proof for `features/v2-calendar/components/day-detail/SaveSheet.tsx` (new) + `pages/v2/calendar/
[date].tsx` (wires goo's `useReminderDraft` machine) + `harness/run-calendar-save.ts`. Phase 5: the "เพิ่มลง
ปฏิทิน" CTA opens a slide-up sheet to pick ยาม + destinations + note; committing flips the menu 2→3 and grows
the reminder list; the sheet is a **mask over goo's save-flow machine**. **No API touched.**

## capability → gate (why this screen is different)
This is the **first day-detail screen that WRITES state** — the previous 3 (normal/advanced/pillars) were
read-only. A write surface is the PR#97-class trap: mapping only the happy path is exactly what looped PR#97 six
times. So the anchor proves **both outcomes + the replay guard**, not just success: success AND cancel AND the
no-op/double-submit guard (spam บันทึก → exactly ONE row). Ground-truth = the observable reminder-count + the
live DOM state driven purely through the UI.

## masking goo's machine — no invented state, no hand guard
`SaveSheet` binds every field to `useReminderDraft` (goo's save-flow.ts): checkboxes → `draft.toggleYam`,
destination toggles → `draft.toggleDest`, note → `draft.setNote`, the save button's `disabled` is goo's
`canCommit` (NOT a hand-written guard), commit + list-growth follow goo's scaffold pattern (`draft.commit()` +
`reminders.add(rows)`). The page adds **zero `useState`** of its own — the menu state is derived
(`sheetOpen ? draft.menuState(4) : menuStateForDay(saved)`). The no-op guard is goo's: `commit` is a NO-OP once
`saving` (the transition-table latch) and `reminders.add` de-dupes by id — so spamming บันทึก yields exactly
one row per ยาม.

## proof-of-teeth (run-calendar-save.ts, driven through the UI → ✅ PASSED)
| invariant | result |
|---|---|
| no-app-fetch + console | **0 / 0** without a backend |
| OPEN | click "เพิ่มลงปฏิทิน" → sheet appears · menu FormMode(4) → **Mate AI HIDDEN** |
| commit guard | save **DISABLED** with 0 ยาม (goo's `canCommit`); tick 1 ยาม → **ENABLED** |
| **CANCEL path** | backdrop → sheet gone · Mate AI back · **reminder-count STILL 0** (draft discarded, menu stays 2) |
| **SUCCESS path** | tick 2 ยาม → บันทึก → sheet closed · **reminder-count == 2** · menu **state 3** (saved · "✓ คุณบันทึกลงปฏิทินแล้ว" · Mate AI back) |
| **NO-OP guard** | fresh date, tick 1 ยาม, fire บันทึก **×3 synchronously** → **reminder-count == 1** (latch + de-dup, not 3) |
| no-regress (#130) | after open→close: the base sections + **C+ #374151** + 0 overflow + 0 animations all survive |
| **anchor 3a + 3b re-run** | both still ✅ **PASS** (the sheet adds behaviour without distorting the read-only screens) |
| `mut-nonidempotent-save` (mint a unique id per click → bypass de-dup) | NO-OP guard reads count **3 not 1** → 🦷 **CAUGHT** live |

## real-route artifact — rendered vs Figma @393
`npx tsx harness/capture-p5.ts` → `compare-p5-sheet.png` (rendered sheet-open | Figma 375:13316 — title · date
row · โน้ต · 5 ยาม checkboxes w/ ticked navy+teal+lavender · sticky บันทึก · 3 destination toggles, faithful);
`save-sheet-saved.png` (menu state 3 = 375:16355). Per-ยาม windows/copy are goo's illustrative fixtures; the
SHAPE + state-machine binding are what this PR proves. tsc + prod build clean.

ANCHOR: harness/run-calendar-save.ts#mut-nonidempotent-save

## completeness-pass + honest scope (visual-lens clause)
**Bounded reference** = Figma `375:13316` (sheet) + `375:16355` (saved) + viewport 393.
1. **Spatial** — the whole sheet: title, date row, note, all 5 ยาม rows, sticky save, all 3 destinations.
2. **State-space** — captured/driven across **idle → editing (sheet open) → saving → saved** AND the **cancel**
   branch AND the **replay** branch (×3 synchronous commit) — the write-surface's full outcome set, not one path.
3. **Reference parity** — sheet vs 375:13316; saved menu vs 375:16355; the read-only screens (3a/3b) re-proven
   un-distorted.

**Deviations logged (A2, NOT claimed covered):**
- **Reminders are per-page client state** (goo's `useReminders`, not persisted this phase — his documented
  reload-behaviour); the anchor proves count via an on-page `data-testid="reminder-count"` (the list page would
  reset the mock on navigation). At API-time this becomes a persisted read; the machine/UI are unchanged.
- **Date row** (วัน/เดือน/ปี) is a static display of the route date — changing the date is out of scope this round
  (the sheet is for THIS day); the draft model has no date-change action, so no invented state.
- **§11 per-ยาม quick-add** stays (single-ยาม fast path); the sheet is the multi-ยาม path. Both grow the same
  de-duped list — not a conflict.
- Per-ยาม windows/copy + default destinations (`['mumate']`) are goo's illustrative fixtures (Figma shows more on).

## adversary sign-off
Cross-oracle, RUN-PROVEN — I do **not** self-certify.
- **ตู๋ — ⏳ PENDING**. Points to attack: (1) is it a real machine or two static images? — the anchor drives
  idle→editing→saving→saved through the UI; (2) is the **cancel** path proven, not just success? — cancel asserts
  count stays 0 + menu stays 2; (3) does spamming บันทึก duplicate? — ×3 synchronous → count 1, `mut-nonidempotent
  -save` bites; (4) is the guard goo's or hand-written? — `disabled` is `canCommit`, the page adds no `useState`;
  (5) does open/close distort 3a/3b? — both anchors re-run green + a no-regress assert.
- **goo** — the sheet consumes his `useReminderDraft` + save-flow.ts unchanged; no contract/hook touched.
