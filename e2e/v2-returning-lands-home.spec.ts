// Browser truth for parity gap C — a RETURNING user (has a computed chart) must LAND ON HOME, not be
// bounced back through register (webgang v2 slice-2, goo logic anchor). This anchor exists because the
// bug was an OMISSION: v2 slice-1 sent every authed user to /v2/register; the completeness-audit found
// the returning-user path was silently missing. The anchor pins the presence of that path + its inverse
// (no-chart → register), so the omission cannot re-appear green.
//
// Self-contained (imports only @playwright/test). Stubs the same-origin API routes so NO BE/DB is hit.
// Local-only: needs FE :3000 with V2_PREVIEW_KEY set. Run: npx playwright test e2e/v2-returning-lands-home.spec.ts
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const V2_PREVIEW_KEY = process.env.V2_PREVIEW_KEY ?? "lamun-local-dev";
const AUTHED_MEMBER_ID = "11111111-1111-1111-1111-111111111111"; // valid uuid → resolveAuth 'authed'

async function seedAuthed(context: BrowserContext) {
  await context.addCookies([
    { name: "v2_access", value: V2_PREVIEW_KEY, domain: "localhost", path: "/" },
    { name: "cookie-mumate-id", value: AUTHED_MEMBER_ID, domain: "localhost", path: "/" },
    { name: "cookie-mumate-name", value: "เกวลิน", domain: "localhost", path: "/" },
  ]);
}

/** Stub GET /user (returning-result) + GET /chinese-horoscope (chart→mascot). resultCode drives the
 * fork: a code → home; empty → register. */
async function stubApi(context: BrowserContext, opts: { resultCode: string; isRefresh?: boolean }) {
  await context.route((u) => u.pathname.endsWith("/user"), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user_id: AUTHED_MEMBER_ID, result_code: opts.resultCode, is_refresh: opts.isRefresh ?? false, dob: "1990-01-01" }),
    });
  });
  await context.route((u) => u.pathname.includes("chinese-horoscope"), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      // Shape useV2Home.toComputeSource reads: detail.yearBelow.constellation + detail.dayAbove.element.
      body: JSON.stringify({ detail: { yearBelow: { constellation: "PIG", id: 12 }, dayAbove: { element: "WOOD" } } }),
    });
  });
}

async function settled(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let useV2Home resolve the fetch + route
}

test.describe("v2 returning-user lands home (parity gap C — goo logic anchor)", () => {
  test("returning (has chart) → stays on /v2 HOME, NOT bounced to /v2/register", async ({ page, context }) => {
    await seedAuthed(context);
    await stubApi(context, { resultCode: "RC-ABC-123" });
    await settled(page, "/v2");
    expect(page.url(), "a returning user must land on /v2 home").not.toContain("/v2/register");
    expect(new URL(page.url()).pathname).toBe("/v2");
    await expect(page.getByText(/สวัสดี/)).toBeVisible(); // home greeting rendered
  });

  test("OMISSION inverse: no chart (empty result_code) → routed to /v2/register", async ({ page, context }) => {
    await seedAuthed(context);
    await stubApi(context, { resultCode: "" });
    await settled(page, "/v2");
    expect(page.url(), "an authed user with no chart still needs the register/compute path").toContain("/v2/register");
  });

  test("stale chart (is_refresh) → also routed to register (recompute deferred)", async ({ page, context }) => {
    await seedAuthed(context);
    await stubApi(context, { resultCode: "RC-STALE", isRefresh: true });
    await settled(page, "/v2");
    expect(page.url()).toContain("/v2/register");
  });
});
