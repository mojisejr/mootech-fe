// Auth login-loop regression guard (#mootech-auth-e2e-smoke).
//
// THE VOW (from learnings/mootech-fe/authed-branch-loading.md and the v2 fix):
//   A logged-in user must NEVER be routed to /login. An empty refer-code cookie
//   is a DATA hydration problem -> backfill it, do NOT bounce to /login.
//
// The historical bug: logged-in + empty MEMBER_REFER_CODE -> menu "ดวงสมพงศ์"
//   -> router.replace('/login?refresh=2') -> loop. Fixed in FE PR #13 (menu
//   resolveMatchingTarget / backfillAndRoute) + BE PR #5 (ensureReferCode).
//
// Local-only: requires the full stack up (FE :3000 -> BE :4000 -> dev Supabase).
// See e2e/README.md. Run: npm run test:e2e:auth
//
// NOTE: helpers are co-located in this file on purpose. The app tsconfig uses
// moduleResolution "bundler", which makes Playwright 1.61 throw
// `context.conditions?.includes is not a function` on cross-file relative
// imports. Self-contained specs (importing only `@playwright/test`) sidestep it
// without touching the production tsconfig.
import { test, expect, type Page } from "@playwright/test";

// Default = first SAMPLE_USER in pages/dev-login.tsx (a real dev-Supabase user
// with a reading). Override via env so the test does not silently break if the
// dev DB content changes.
const DEV_USER_ID =
  process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";

const MEMBER_ID_COOKIE = "cookie-mumate-id";
const REFER_COOKIE = "cookie-mumate-refer";

/** Read a cookie value from the current browser context (null if absent). */
async function getCookie(page: Page, name: string): Promise<string | null> {
  const jar = await page.context().cookies();
  return jar.find((c) => c.name === name)?.value ?? null;
}

/**
 * Log in via /dev-login (the `dev` CredentialsProvider, no OAuth) and wait for a
 * genuinely settled authed state: full reload landed on "/" AND the identity
 * cookie is committed — not merely a navigation event (avoids the hydration race
 * the loop bug rode on). dev-login sets LOGIN_PROVIDER=DEV, so index.tsx skips
 * register-login and MEMBER_REFER_CODE stays empty — the v2 precondition.
 */
async function seedAuth(page: Page): Promise<void> {
  await page.goto("/dev-login");

  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);

  await page.getByRole("button", { name: /Dev Login/ }).click();

  // dev-login does signIn("dev") then window.location.href = "/" (full reload).
  await page.waitForURL(/\/$/, { timeout: 15000 });

  await expect
    .poll(() => getCookie(page, MEMBER_ID_COOKIE), { timeout: 10000 })
    .toBe(DEV_USER_ID);

  expect(page.url(), "seeded user must not be stranded on /login").not.toContain(
    "/login",
  );
}

/** Open the hamburger menu and tap the "ดวงสมพงศ์" (matching) entry. */
async function tapMatchingFromMenu(page: Page): Promise<void> {
  await page.getByRole("img", { name: "icon-menu" }).click();
  await page.getByText("ดวงสมพงศ์", { exact: true }).click();
}

/**
 * Assert post-tap routing: lands on /matching and NEVER /login, with a stability
 * window so a transient bounce-to-/login loop is also caught.
 */
async function expectMatchingNotLogin(page: Page): Promise<void> {
  // If the app looped to /login instead, this never resolves -> test fails.
  await page.waitForURL(/\/matching/, { timeout: 15000 });
  await page.waitForTimeout(1500); // stability: must not bounce away
  expect(page.url(), "should stay on /matching").toContain("/matching");
  expect(page.url(), "logged-in user must never reach /login").not.toContain(
    "/login",
  );
}

test.describe("login loop regression (#mootech-login-loop-fix-v2)", () => {
  // Case A — happy path: authed + refer-code present -> /matching directly.
  test("authed with refer-code -> ดวงสมพงศ์ goes to /matching", async ({
    page,
  }) => {
    await seedAuth(page);

    await page.context().addCookies([
      {
        name: REFER_COOKIE,
        value: "E2ESMOKEREFERCODE01",
        url: "http://localhost:3000",
      },
    ]);
    await page.goto("/");
    await expect
      .poll(() => getCookie(page, REFER_COOKIE))
      .toBe("E2ESMOKEREFERCODE01");

    await tapMatchingFromMenu(page);
    await expectMatchingNotLogin(page);
  });

  // Case B — THE regression: authed + empty refer-code -> menu must backfill
  // (UserGetById) and route to /matching, NEVER /login.
  test("authed with EMPTY refer-code -> ดวงสมพงศ์ backfills, never loops to /login", async ({
    page,
  }) => {
    await seedAuth(page);

    await page.context().clearCookies({ name: REFER_COOKIE });
    await page.goto("/");
    expect(await getCookie(page, REFER_COOKIE)).toBeNull();
    expect(await getCookie(page, MEMBER_ID_COOKIE)).toBe(DEV_USER_ID);

    await tapMatchingFromMenu(page);
    await expectMatchingNotLogin(page);
  });
});

// #mootech-register-anon-gate — defense-in-depth: /register itself must gate a
// genuinely anonymous visitor (not just the homepage CTA that links to it).
// Bug history this must not reintroduce: the OLD gate here read raw
// useSession().status === "unauthenticated" (commented out, never even wired
// live) — the SAME raw-status class of bug behind #mootech-login-loop-fix-v2 /
// #mootech-cta-race-gate elsewhere in this app. Fixed to key off
// useCurrentUser()'s cookie-validated authStatus instead.
test.describe("register page anon gate (#mootech-register-anon-gate)", () => {
  // Case C — a genuinely anonymous visitor landing on /register directly (bookmark
  // / shared link / typed URL) must be bounced to HOME (now the calculator — a
  // safe, useful landing spot), never stranded on the registration form.
  test("anon direct-navigate to /register -> redirected to HOME", async ({
    page,
  }) => {
    // No seedAuth() — this context has no session and no MEMBER_ID cookie.
    await page.goto("/register");
    await page.waitForURL(/\/$/, { timeout: 15000 });
    expect(page.url(), "anon visitor must land on HOME, not /register").not.toContain(
      "/register",
    );
  });

  // Case D — THE required regression case (ฟีม's explicit precondition): an authed
  // user filling out this form for the FIRST time (no chart computed yet) must
  // NEVER be bounced off /register. authStatus becomes 'authed' the instant
  // MEMBER_ID lands, independent of whether resultCode/a chart exists yet -- the
  // gate has no chart-presence condition, so this is true by construction, but a
  // real browser round-trip proves the cookie-truth gate genuinely never fires for
  // this user, not just that the code reads that way.
  test("authed first-time user (no chart yet) stays on /register -- never bounced", async ({
    page,
  }) => {
    await seedAuth(page); // dev-login: session authenticated + MEMBER_ID cookie committed

    await page.goto("/register");
    // Stability window: assert the URL holds at /register, not just the first paint,
    // to catch a transient bounce-then-settle as well as an immediate one.
    await page.waitForTimeout(1500);
    expect(page.url(), "authed user must stay on /register").toContain("/register");
  });
});
