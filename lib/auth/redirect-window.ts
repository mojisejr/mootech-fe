// Pure gate for the homepage logged-in auto-redirect window (#calculator-homepage-swap, option c).
//
// Extracted so it can be unit-tested HEADLESS (no React / timers): see
// scripts/redirect-window.test.ts. Companion to lib/auth/welcome-target.ts + cta-ready.ts — this
// whole area keeps its decisions in pure, tested functions because it has a long history of real
// login-loop / cta-race regressions (see #mootech-login-loop-fix-v2, #mootech-cta-race-gate).
//
// THE PROBLEM (goo's adversarial review of PR#64): the homepage auto-redirect effect cannot see the
// calculator's `phase` (separate component), so firing whenever the routing state settles could yank
// a logged-in user out of the form/result mid-interaction if it settles late (slow network) —
// contradicting the calculator's own "ฟรี ไม่ต้องล็อกอิน" copy.
//
// THE FIX (option c): only allow the redirect to fire within a short window after the calculator
// becomes visible. Common case — the routing state (one get-user call) settles well inside the window
// → the funnel works. Late settle → the window has closed → do NOT yank; the authed user keeps a
// usable calculator (and the always-present header avatar / secondary CTA to reach their account).

// Whether the auto-redirect is still allowed to fire.
//   elapsedMs — ms since the calculator became visible, or null if it isn't visible yet.
//   windowMs  — the allowed window length (REDIRECT_WINDOW_MS).
export function isWithinRedirectWindow(
  elapsedMs: number | null,
  windowMs: number,
): boolean {
  // Window hasn't started (calculator not visible yet) — never fire.
  if (elapsedMs === null) return false;
  // Guard against a nonsensical negative elapsed (clock skew / bad input): treat as within.
  if (elapsedMs < 0) return true;
  return elapsedMs <= windowMs;
}
