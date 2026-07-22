// Browser truth for the /v2 AUTH-GATE HYDRATION invariant (webgang v2 harness — goo's runtime anchor).
// STEP 2 (widen): step 1 anchored one page/one state and was penetrated in the adversary round for
// being EARLY. This version closes the holes the MUTANT proved real (not the hole-map's guesses):
//
//   • ALL gated pages, not one — the tested set is DERIVED from source (every page that imports
//     useV2AuthGate), so a new gated page cannot silently escape coverage. This is the real
//     anti-blind: the step-1 adversary hole was "a gated page the anchor never visits", and /v2 has
//     7 pages of which only 3 are gated — a hardcoded list would rot the moment a 4th is gated.
//   • CLS / mount-flash — a second, mechanism-independent lens (Lamun-visual). Under the mutant the
//     bad hydration re-render shifts layout (measured 0.027–0.031 vs baseline ≤0.004); a signal-less
//     mismatch (flash without a console error) is caught here even if the console channel is silent.
//
// DROPPED from the hole-map after the mutant DISPROVED it: "ban suppressHydrationWarning". Tested
// directly — a suppressHydrationWarning wrapper does NOT silence our mismatch (hydErr stayed 5, CLS
// stayed 0.027), because React only suppresses element-level text/attr diffs, never a structural
// tree mismatch (AuthLoadingGate vs the page body). It guards a non-threat, so it is not here. The
// mutant decides, not the hole-map.
//
// THE INVARIANT: for any useV2AuthGate-gated /v2 page, server HTML === client first paint. The
// MEMBER_ID cookie (`cookie-mumate-id`) is identity-truth but invisible to SSR (react-cookie reads
// document.cookie, empty on the server), so an AUTHED load resolves 'loading' on the server yet
// 'authed' on the first client paint → structural mismatch, unless the `!hasMounted` mount-gate in
// useV2AuthGate.showLoading holds both renders on <AuthLoadingGate/> until after mount. (ANON loads
// do NOT diverge: the client's first paint is still 'loading' — the session hasn't resolved — so it
// agrees with the server; those states are guarded to stay clean, not expected to fail.)
//
// Self-contained (imports only @playwright/test + node core) — the bundler-resolution trap forbids
// cross-file relative imports. Local-only: needs FE :3000 with V2_PREVIEW_KEY set.
// Run: npx playwright test e2e/v2-hydration-invariant.spec.ts
import { test, expect, type Page } from "@playwright/test";

const V2_PREVIEW_KEY = process.env.V2_PREVIEW_KEY ?? "lamun-local-dev";
const V2_COOKIE = "v2_access";
const MEMBER_ID_COOKIE = "cookie-mumate-id";
// A valid uuid so resolveAuth's UUID_RE reports 'authed' on the client from the cookie alone (no
// session needed — the cookie is identity-truth, which is exactly the SSR-invisible → client-authed skew).
const AUTHED_MEMBER_ID = "11111111-1111-1111-1111-111111111111";

// React 18 / Next dev emit these on a hydration mismatch; #418/#423 are the prod-minified equivalents.
const HYDRATION_SIGNAL =
  /hydrat|did not match|does not match|initial UI does not match|Text content|#418|#423/i;
// mount-flash budget — ADVISORY (Lamun-visual ratified 2026-07-22). Measured this build: baseline CLS
// ≤ 0.004, mutant CLS ≥ 0.027; 0.015 separates ~4x either side, well under web-vitals "good" (0.1).
// Scope + status, per the visual-lens owner:
//   • DEFAULT state only — do NOT apply to injected states (e.g. a font-size injection reflows and
//     measures CLS ~0.116, a TEST artifact, not app CLS). This anchor only drives default states.
//   • PER-SCREEN, not universal — re-ratify as screens gain content (robust form: ≤4× baseline, floor 0.015).
//   • ADVISORY, not blocking — for THIS bug the console signal fires first, so CLS is correlated, not
//     independent. Blocking now = vacuous (CLS riding console's teeth). It promotes to BLOCKING only
//     once `mut-cls-silent-flash` proves teeth: a mutant with hydrationErrors===0 AND CLS≥budget
//     simultaneously (console blind, CLS catches) — co-build w/ Lamun. Until then: measure + report.
const CLS_BUDGET = 0.015;

type Seed = { authed: boolean; mismatch: boolean };
// path → the states this anchor drives it through. `mismatch: true` = under the mutant this state
// MUST turn red (a proof-of-teeth site); `false` = a gated state that legitimately can't diverge but
// is still guarded to stay clean.
const STATE_MAP: Record<string, Seed[]> = {
  "/v2": [{ authed: true, mismatch: true }, { authed: false, mismatch: false }],
  // login [authed] IS a mismatch site: `redirecting` is gated on hasMounted, so under the mutant the
  // client first paint renders LoginView (redirecting=false pre-mount) while the server renders the
  // loading gate — proven by the mutant catching it. (Fixed code holds both on the loading gate.)
  "/v2/login": [{ authed: false, mismatch: false }, { authed: true, mismatch: true }],
  "/v2/register": [{ authed: true, mismatch: true }, { authed: false, mismatch: false }],
};

// COVERAGE authority = ตู๋'s AST rule (verify-architecture.ts), NOT this file. A first-cut derived-glob
// lived here and ตู๋ (static lens) adversarially penetrated it: readdirSync is shallow (misses
// pages/v2/settings/profile.tsx) and a source regex misses `await import(...)` (dynamic). Static
// analysis is his lens (recursive ESTree traverse of ImportDeclaration + dynamic CallExpression, and
// fails in milliseconds without a browser), so coverage-drift moved there. This manifest is the set of
// gated pages this runtime anchor drives — ตู๋'s rule asserts every gated page it finds ∈ this set.
export const ANCHORED_GATED_PAGES: string[] = Object.keys(STATE_MAP).sort();

async function loadAndObserve(
  page: Page,
  path: string,
  authed: boolean,
): Promise<{ hydrationErrors: string[]; cls: number }> {
  const cookies = [
    { name: V2_COOKIE, value: V2_PREVIEW_KEY, domain: "localhost", path: "/" },
    ...(authed
      ? [{ name: MEMBER_ID_COOKIE, value: AUTHED_MEMBER_ID, domain: "localhost", path: "/" }]
      : []),
  ];
  await page.context().addCookies(cookies);

  const hydrationErrors: string[] = [];
  const record = (t: string) => {
    if (HYDRATION_SIGNAL.test(t)) hydrationErrors.push(t.slice(0, 200));
  };
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") record(m.text());
  });
  page.on("pageerror", (e) => record(e.message));

  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const s = e as unknown as { hadRecentInput: boolean; value: number };
        if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let the post-mount render settle; a mismatch fires DURING hydration
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls || 0);
  return { hydrationErrors, cls };
}

test.describe("v2 auth-gate hydration invariant (webgang v2 step 2 — goo runtime, seam w/ too+มุน)", () => {
  // Coverage (does every gated page get anchored?) is NOT tested here — it moved to ตู๋'s AST rule
  // after he penetrated the derived-glob version (nested routes + dynamic import). See ANCHORED_GATED_PAGES.

  // ── Runtime lens (goo, BLOCKING): every gated state hydrates cleanly — zero hydration signal on the
  // console/pageerror channel. One test per (path, state) for precise failure locality.
  // ── Visual lens (มุน, ADVISORY): mount-flash CLS is measured + attached, not asserted — promotes to
  // blocking only once mut-cls-silent-flash proves it independent (see CLS_BUDGET note).
  for (const [path, seeds] of Object.entries(STATE_MAP)) {
    for (const seed of seeds) {
      const label = `${path} [${seed.authed ? "authed" : "anon"}]${seed.mismatch ? " (mismatch site)" : ""}`;
      test(`hydrates clean: ${label}`, async ({ page }, testInfo) => {
        const { hydrationErrors, cls } = await loadAndObserve(page, path, seed.authed);
        // BLOCKING — the primary, independently teeth-proven signal.
        expect(
          hydrationErrors,
          `hydration mismatch at ${label} (mount-gate missing?):\n${hydrationErrors.join("\n---\n")}`,
        ).toHaveLength(0);
        // ADVISORY — report CLS vs budget; do not fail the run (would be vacuous while correlated).
        const over = cls >= CLS_BUDGET;
        testInfo.annotations.push({
          type: over ? "cls-advisory-over-budget" : "cls-advisory",
          description: `${label}: CLS ${cls.toFixed(4)} (budget ${CLS_BUDGET}, advisory)`,
        });
        if (over) console.log(`⚠️  ADVISORY mount-flash at ${label}: CLS ${cls.toFixed(4)} ≥ ${CLS_BUDGET}`);
      });
    }
  }
});
