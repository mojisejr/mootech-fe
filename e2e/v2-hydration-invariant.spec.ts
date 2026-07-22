// Browser truth for the /v2 AUTH-GATE HYDRATION invariant (webgang v2 harness — goo's runtime anchor).
//
// THE INVARIANT (size-independent truth):
//   For any /v2 page gated by useV2AuthGate, the server-rendered HTML MUST equal the client's first
//   paint. The MEMBER_ID cookie (`cookie-mumate-id`) is identity-truth but is INVISIBLE to SSR
//   (react-cookie reads document.cookie, empty on the server), so useCurrentUser resolves 'loading'
//   on the server yet 'authed' on the first client paint. Without a mount-gate the two renders
//   diverge (AuthLoadingGate vs. home) → React hydration mismatch. The fix is the `!hasMounted` term
//   in useV2AuthGate.showLoading, which holds BOTH renders on <AuthLoadingGate/> until after mount.
//
// WHY THIS ANCHOR EXISTS (the bug it re-proves): Lamun caught this @393 via the dev overlay AFTER my
// Playwright asserted only that the form *rendered* — a render assertion is NOT a hydration check,
// because React patches the DOM after a mismatch so the element still ends up visible. This anchor
// closes that hole: it fails on the ABSENCE-of-hydration-error signal, the channel a render
// assertion is blind to. See learnings/2026-07-21_render-assertion-is-not-a-hydration-check.md.
//
// MUTANT / PROOF-OF-TEETH (capability-scoped to the runtime hydration class):
//   injection_recipe = strip `!hasMounted || ` from useV2AuthGate.showLoading → this anchor MUST turn
//   red. Runtime mutant, history-independent (no checkout), applied to CURRENT code. Verified by hand
//   this build: fix in → PASS, mutant in → FAIL, revert → PASS (the negative control). The mutant is
//   a SOURCE mutation, which the visual engine's mutantCss (harness/mutants.ts) cannot express — see
//   the step-1 schema feedback.
//
// Self-contained (imports only @playwright/test) to avoid the bundler-resolution trap. Local-only:
// needs FE :3000 with V2_PREVIEW_KEY set. Run: npx playwright test e2e/v2-hydration-invariant.spec.ts
import { test, expect, type Page } from "@playwright/test";

const V2_PREVIEW_KEY = process.env.V2_PREVIEW_KEY ?? "lamun-local-dev";
const V2_COOKIE = "v2_access";
const MEMBER_ID_COOKIE = "cookie-mumate-id";
// A valid uuid so resolveAuth's UUID_RE reports 'authed' on the client (identity-truth, no session
// needed — the cookie alone flips status, which is exactly the SSR-invisible → client-authed skew).
const AUTHED_MEMBER_ID = "11111111-1111-1111-1111-111111111111";

// React 18 / Next dev emit these on a hydration mismatch; #418/#423 are the prod-minified equivalents.
const HYDRATION_SIGNAL =
  /hydrat|did not match|does not match|initial UI does not match|Text content|#418|#423/i;

/** Seed the two cookies that put a /v2 page into the exact SSR-loading / client-authed skew. */
async function seedAuthedPreview(page: Page): Promise<string[]> {
  await page.context().addCookies([
    { name: V2_COOKIE, value: V2_PREVIEW_KEY, domain: "localhost", path: "/" },
    { name: MEMBER_ID_COOKIE, value: AUTHED_MEMBER_ID, domain: "localhost", path: "/" },
  ]);

  const hydrationErrors: string[] = [];
  const record = (t: string) => {
    if (HYDRATION_SIGNAL.test(t)) hydrationErrors.push(t.slice(0, 300));
  };
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") record(m.text());
  });
  page.on("pageerror", (e) => record(e.message));
  return hydrationErrors;
}

test.describe("v2 auth-gate hydration invariant (webgang v2 — goo runtime anchor)", () => {
  test("authed /v2 hydrates cleanly — server HTML === client first paint (no mismatch)", async ({
    page,
  }) => {
    const hydrationErrors = await seedAuthedPreview(page);

    await page.goto("/v2", { waitUntil: "networkidle" });
    // Let the post-mount render settle (mount-gate flips showLoading false → real content paints).
    // If the mismatch fires it is emitted DURING hydration, before this settles.
    await page.waitForTimeout(1500);

    // The invariant: zero hydration signals on the console/pageerror channel. A render-only
    // assertion (toBeVisible) would pass even under the mutant — this is the channel that catches it.
    expect(
      hydrationErrors,
      `hydration mismatch on authed /v2 (mount-gate missing?):\n${hydrationErrors.join("\n---\n")}`,
    ).toHaveLength(0);
  });
});
