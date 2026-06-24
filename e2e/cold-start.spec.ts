// Cold-start login race — REPRODUCTION harness (#mootech-login-coldstart-investigation).
//
// Goal: pin the cause of two tester symptoms (find cause, NOT fix):
//   (A) after login the top-right icon disappears.
//   (B) in incognito you must log in twice to get in.
//
// Browser-truth (operator-assisted, real LINE, incognito) already showed the
// mechanism on 2026-06-24:
//   - POST /user/register-login fired 3x: 2x net::ERR_ABORTED then 1x 200.
//   - All three payloads were IDENTICAL and VALID (idToken/provider present) ->
//     the "empty token" hypothesis is RULED OUT.
//   - Console showed "Abort fetching component for route: /" x2, matching the 2
//     aborted POSTs -> repeated client navigations to "/" cancel the in-flight
//     register-login. Root: pages/auth/after/[provider].tsx re-runs
//     router.replace('/') because its effect deps [session, setCookie, router]
//     are unstable (+ reactStrictMode double-invoke in dev amplifies it).
//
// These specs encode that signature as a REGRESSION GUARD. They were RED before
// the fix (auth/after one-shot redirect guard + header identity from
// useCurrentUser, #mootech-login-coldstart-fix) and are GREEN once it is in
// place. If they go red again, the cold-start navigation churn has returned.
//
// Local-only: requires the full stack (FE :3000 -> BE :4000 -> dev Supabase).
// Run: npx playwright test e2e/cold-start.spec.ts
import { test, expect, type Page } from "@playwright/test";

const DEV_USER_ID =
  process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";

/** Sign in via /dev-login to get a real NextAuth session (no OAuth). */
async function seedDevSession(page: Page): Promise<void> {
  await page.goto("/dev-login");
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);
  await page.getByRole("button", { name: /Dev Login/ }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
}

test.describe("cold-start login race (#mootech-login-coldstart-investigation)", () => {
  // SYMPTOM B — auth/after must navigate to "/" without aborting route fetches.
  // The real bug: repeated router.replace('/') -> "Abort fetching component for
  // route: /" -> in-flight register-login is cancelled -> login appears to need
  // a second attempt. We recreate the auth/after entry with a live session but
  // no MEMBER_ID (the cold precondition) and assert no route-abort churn.
  test("auth/after -> home transition does not abort route fetches (B)", async ({
    page,
  }) => {
    await seedDevSession(page);

    // Recreate the cold precondition: authenticated session, identity not yet
    // resolved. Keep the NextAuth session; drop the app identity cookies.
    await page.context().clearCookies({ name: "cookie-mumate-id" });
    await page.context().clearCookies({ name: "cookie-mumate-provider-login" });

    const routeAborts: string[] = [];
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && t.includes("Abort fetching component for route")) {
        routeAborts.push(t);
      }
    });

    // Enter through the post-OAuth landing page, exactly like a real login.
    await page.goto("/auth/after/line");
    await page.waitForURL(/\/$/, { timeout: 15000 });
    await page.waitForTimeout(2500); // let the navigation churn (if any) settle

    expect(
      routeAborts,
      `auth/after caused ${routeAborts.length} route-abort(s) -> register-login can be cancelled (the 2-round bug)`,
    ).toHaveLength(0);
  });

  // SYMPTOM A — once authenticated and settled, the top-right must show the
  // avatar, never collapse to the "เข้าสู่ระบบ" text (which reads as "icon หาย").
  // With a fully settled identity this should pass; it documents the invariant
  // and will catch regressions where the header loses identity post-login.
  test("settled logged-in home shows avatar, not the login text (A)", async ({
    page,
  }) => {
    await seedDevSession(page);
    await page.goto("/");

    // top-right must NOT show the fallback "เข้าสู่ระบบ" text for a logged-in user
    await expect(page.getByText("เข้าสู่ระบบ", { exact: true })).toHaveCount(0);
  });

  // SYMPTOM A (returning / deep-link) — entering with MEMBER_IMAGE already in the
  // cookie (paste a link / open-in-external-browser from LINE) must render the
  // user's photo, NOT the fallback logo. Before the fix the home early-return
  // never re-hydrated the image so the avatar showed ic_logo.svg = "avatar หาย".
  test("returning entry shows the avatar photo from MEMBER_IMAGE cookie, not the logo (A)", async ({
    page,
  }) => {
    await seedDevSession(page);
    // a real, loadable local asset stands in for the user's photo cookie
    const photo = "/images/mumate/img_footer_login.png";
    await page.context().addCookies([
      { name: "cookie-mumate-image", value: photo, url: "http://localhost:3000" },
    ]);
    await page.goto("/");

    const avatar = page.locator("img.rounded-full").first();
    await expect(avatar).toHaveCount(1); // avatar present, not the login text
    const src = (await avatar.getAttribute("src")) ?? "";
    expect(src, "avatar must be the photo, not the fallback logo").not.toContain(
      "ic_logo.svg",
    );
  });
});
