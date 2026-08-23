// The personalised-month membership gate switch, in a module of its own (#391).
//
// WHY IT MOVED OUT OF pages/api/v2/calendar-month.ts: it used to be a `const` inside the handler, which
// meant NO test could ever reach the `if (!GATE_OPEN)` branch — the branch that decides whether a
// non-member gets a paid month. The only way to exercise it was to hand-edit the route during a review,
// i.e. prove it once and never again. #391's whole point is that the closed-gate path must be SAFE and
// must STAY safe, so that path needs a permanent test, so the switch needs a seam a test can move.
//
// 🔒 CLOSED (mootech-fe#293 · ฟีมเคาะ 2026-08-23). The personalised month is members-only again.
//
// The history matters more than the value, because the value is one character and the story is why it sat
// wrong for 18 days: it was opened on 2026-08-05 (PR #177, Track B-4) as a DELIBERATE temporary debt —
// announced in the PR title, the PR body, three lines of code comment, and the variable's own name. But
// that PR closed no issue, so nothing carried the debt forward; it surfaced only when ตู๋ checked a
// citation on an unrelated ticket 11 days later. Announcing a debt is not the same as someone holding it.
//
// ⚠️ WHOEVER OPENS THIS AGAIN: `true` here means every visitor gets a paid, personalised month. It is a
// pricing decision, not a technical one — it needs ฟีม, and it needs a ticket holding it, or the next
// person to notice will again be someone auditing something else.
export const CALENDAR_MONTH_GATE_OPEN = false
