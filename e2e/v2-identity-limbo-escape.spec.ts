// Browser truth for the #246 identity-limbo ESCAPE hatch (companion to self-heal.spec.ts).
//
// The bug: an authed session with NO valid MEMBER_ID resolves to "loading" forever (resolveAuth,
// login-loop invariant). The global self-heal is the only recovery — and it can FAIL with no retry
// (BE returns a non-uuid user_id → the cookie is written with garbage → resolveAuth still "" → limbo
// stays, healingRef pinned). Without an exit the user stares at a /v2 skeleton that never releases.
// After 8s of continuous post-mount limbo, /v2 must show <ScreenIdentityStuck/> (re-login).
//
// This is the cross-layer proof the unit test cannot give: cookie ↔ NextAuth ↔ useV2AuthGate ↔ page.
// Self-heal is deliberately made to FAIL here (stub returns a non-uuid) so limbo persists and the
// escape is what we observe — the exact prod failure mode reported in the ใบ.
//
// Local-only: run MY branch's dev server on a free port, then:
//   npx playwright test e2e/v2-identity-limbo-escape.spec.ts
// /v2 is team-gated (v2_access cookie === V2_PREVIEW_KEY), so the spec seeds that cookie too.
import { test, expect, type Page } from "@playwright/test";

const DEV_USER_ID =
  process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "teamkey123";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// A NON-uuid identity: resolveAuth's UUID_RE rejects it, so the self-heal "succeeds" at the BE round-trip
// but leaves the user in limbo (this is the permanent-lock path the ใบ describes).
const NON_UUID_ID = "not-a-uuid-value";

const MEMBER_ID_COOKIE = "cookie-mumate-id";
const LOGIN_PROVIDER_COOKIE = "cookie-mumate-provider-login";
const V2_COOKIE = "v2_access";

async function seedDevSession(page: Page): Promise<void> {
  await page.goto("/dev-login");
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);
  await page.getByRole("button", { name: /Dev Login/ }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
}

test.describe("#246 — /v2 identity-limbo escape hatch", () => {
  test("authed + no MEMBER_ID (self-heal fails) → /v2 offers re-login instead of an infinite skeleton", async ({
    page,
    context,
  }) => {
    // Self-heal round-trip returns a NON-uuid → heal cannot lift the limbo (the reported prod lock).
    await context.route("**/user/register-login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user_id: NON_UUID_ID, name: "Stuck User", ref_code: "R" }),
      });
    });

    // 1) Real authenticated session.
    await seedDevSession(page);

    // 2) Manufacture the limbo: drop MEMBER_ID + the DEV bypass marker; keep the NextAuth session.
    const kept = (await context.cookies()).filter(
      (c) => c.name !== MEMBER_ID_COOKIE && c.name !== LOGIN_PROVIDER_COOKIE,
    );
    await context.clearCookies();
    await context.addCookies(kept);
    // 3) Pass the /v2 team gate (SSR checks v2_access === V2_PREVIEW_KEY).
    await context.addCookies([{ name: V2_COOKIE, value: V2_KEY, url: BASE }]);

    const before = await context.cookies();
    expect(before.some((c) => c.name === MEMBER_ID_COOKIE)).toBe(false);
    expect(before.some((c) => c.name.startsWith("next-auth"))).toBe(true);

    // 4) Enter /v2 in the limbo. The skeleton shows first; after the 8s timeout the escape appears.
    await page.goto("/v2");

    // 5) The escape hatch — the whole point of #246. Poll past the 8s timeout + self-heal 3s delay.
    await expect(
      page.getByRole("button", { name: /เข้าสู่ระบบอีกครั้ง/ }),
    ).toBeVisible({ timeout: 15000 });

    // 6) The button is a REAL exit, not a dead control: clicking it fires next-auth signOut. We assert the
    //    signOut round-trip is triggered (robust) rather than polling cookie-clear timing (a next-auth
    //    redirect detail, not the #246 escape logic).
    let signoutHit = false;
    await page.route("**/api/auth/signout*", async (route) => {
      signoutHit = true;
      await route.continue();
    });
    await page.getByRole("button", { name: /เข้าสู่ระบบอีกครั้ง/ }).click();
    await expect
      .poll(() => signoutHit, {
        timeout: 10000,
        message: "clicking re-login must fire next-auth signOut (a real exit, not a dead button)",
      })
      .toBe(true);
  });
});
