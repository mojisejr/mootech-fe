// Browser truth for the GLOBAL identity self-heal (#mumate-line-webview-oauth, Fix B).
//
// The bug: a user who deep-links into an auth-gated page (e.g. from a LINE rich
// menu) with a valid NextAuth session but NO MEMBER_ID lands in the "loading"
// limbo — resolveAuth returns "loading" forever, so the ScreenLoading gate never
// releases and never redirects. <IdentitySelfHeal/> (mounted globally in _app.tsx)
// must mint the missing MEMBER_ID in place, once, without a redirect loop.
//
// This spec reproduces the exact limbo and stubs the register-login round-trip so
// NO backend or database is touched (the BE lives at :4000; we intercept it).
// Self-contained (imports only @playwright/test) to avoid the bundler-resolution trap.
//
// Local-only: requires FE :3000 (next dev). Run: npx playwright test e2e/self-heal.spec.ts
import { test, expect, type Page } from "@playwright/test";

const DEV_USER_ID =
  process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";

// The identity the stubbed register-login "mints". Must be a valid uuid so
// resolveAuth's UUID_RE accepts it and reports "authed".
const MINTED_ID = "11111111-1111-1111-1111-111111111111";

const MEMBER_ID_COOKIE = "cookie-mumate-id";
const LOGIN_PROVIDER_COOKIE = "cookie-mumate-provider-login";

/** Sign in via /dev-login to get a real NextAuth session (no OAuth, no BE). */
async function seedDevSession(page: Page): Promise<void> {
  await page.goto("/dev-login");
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);
  await page.getByRole("button", { name: /Dev Login/ }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
}

test.describe("global identity self-heal (#mumate-line-webview-oauth Fix B)", () => {
  test("deep-link limbo (authed + no MEMBER_ID) self-heals and does not loop", async ({
    page,
    context,
  }) => {
    // Count + stub the register-login round-trip so no BE/DB is touched.
    let registerHits = 0;
    await context.route("**/user/register-login", async (route) => {
      registerHits++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_id: MINTED_ID,
          name: "Healed User",
          ref_code: "REF123", // non-empty -> no UserGetById backfill call
          picture_url: "/images/mumate/ic_avatar.svg",
        }),
      });
    });

    // Fail loudly on the React #310 "rendered more hooks" crash that green tsc/unit
    // cannot see (the whole reason browser truth is mandatory here).
    const hookErrors: string[] = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (/Rendered more hooks|Minified React error #310|#310/i.test(t)) {
        hookErrors.push(t);
      }
    });

    // 1) Real authenticated session (dev-login sets session + MEMBER_ID + LOGIN_PROVIDER=DEV).
    await seedDevSession(page);

    // 2) Manufacture the limbo: drop MEMBER_ID (so identity is missing) AND the
    //    DEV provider marker (so the self-heal does not take the DEV bypass).
    const kept = (await context.cookies()).filter(
      (c) => c.name !== MEMBER_ID_COOKIE && c.name !== LOGIN_PROVIDER_COOKIE,
    );
    await context.clearCookies();
    await context.addCookies(kept);

    // Precondition sanity: session cookie still present, MEMBER_ID gone.
    const before = await context.cookies();
    expect(before.some((c) => c.name === MEMBER_ID_COOKIE)).toBe(false);
    expect(before.some((c) => c.name.startsWith("next-auth"))).toBe(true);

    // 3) Deep-link straight into an auth-gated page (bypassing "/").
    await page.goto("/my-destiny");

    // 4) The self-heal mints MEMBER_ID in place (3s delay + round-trip).
    await expect
      .poll(
        async () =>
          (await context.cookies()).find((c) => c.name === MEMBER_ID_COOKIE)
            ?.value ?? null,
        { timeout: 15000, message: "self-heal should mint MEMBER_ID" },
      )
      .toBe(MINTED_ID);

    // 5) It fired exactly once (single-fire guard — no register double-fire).
    expect(registerHits).toBe(1);

    // 6) No redirect loop: never bounced to /login (the historical failure mode).
    expect(page.url()).not.toContain("/login");

    // 7) No #310 crash from adding the global hook.
    expect(hookErrors, hookErrors.join("\n")).toHaveLength(0);
  });

  test("no spurious fire: an already-authed user (MEMBER_ID present) never triggers register", async ({
    page,
    context,
  }) => {
    let registerHits = 0;
    await context.route("**/user/register-login", async (route) => {
      registerHits++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user_id: MINTED_ID }),
      });
    });

    // Normal authed user: dev-login leaves MEMBER_ID in place -> authStatus is
    // "authed", so the self-heal's limbo condition is never met. This is the
    // production-relevant guarantee: the global hook must not re-register users
    // who already have an identity.
    await seedDevSession(page);
    await page.goto("/my-destiny");
    await page.waitForTimeout(6000); // well past the 3s self-heal delay

    expect(registerHits).toBe(0);
  });
});
