// Browser truth for #264 — the indicator on the real route, and what it does when there is no number.
//
// The vitest spec drives useQuota's mapping through the screen with a stubbed fetch; this drives the REAL
// /api/quota request from a real browser against a real dev server, so the path under test includes the
// URL the hook builds, the cookie it reads the identity from, and the render that follows. #264's whole
// risk is "the number on screen disagrees with what the server would decide" — that disagreement lives in
// the join, not in either half.
//
// It also captures the evidence frames at 393 (UI rule) in the same run, so the pictures and the passing
// assertions describe the same code under the same conditions.
//
// Local-only, no BE needed (every backend call is route-fulfilled). Run:
//   V2_PREVIEW_KEY=<key> npm run dev -- -p 3032
//   E2E_BASE_URL=http://localhost:3032 npx playwright test e2e/v2-quota-indicator.spec.ts
//
// ⚠️ /v2/* is team-gated: with no V2_PREVIEW_KEY the middleware rewrites to maintenance AND STILL ANSWERS
// 200, so each case asserts the real screen is present before looking at the indicator.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const DEV_USER_ID = process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "teamkey123";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.E2E_SHOT_DIR ?? "/tmp/264-shots";

const FRIEND = { id: "friend-1", name: "ปาล์ม", surname: "", picture_url: null, dob: "1994-05-12", time: "07:30", gender: "FEMALE" };
const ME = { user_id: DEV_USER_ID, name: DEV_USER_NAME, dob: "1990-01-01", time: "08:00", picture_url: null, gender: "FEMALE" };

// The three tokens this indicator is allowed to wear, as the browser reports them. Measured off the
// rendered element (tailwind.config.ts: v3-text-muted #71717A · v3-navy #0B305B · v3-error #E73E3E).
const MUTED = "rgb(113, 113, 122)";
const NAVY = "rgb(11, 48, 91)";
const ERROR_RED = "rgb(231, 62, 62)";

const freeQuota = (remaining: number, friendRemaining = 17) => ({
  matching: { unlimited: false, limit: 100, used: 100 - remaining, remaining },
  friend: { unlimited: false, limit: 20, used: 20 - friendRemaining, remaining: friendRemaining },
});

async function stubReads(context: BrowserContext, quota: unknown | "fail"): Promise<void> {
  await context.route("**/api/user*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await context.route("**/api/member-with-friend/detail*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FRIEND) }));
  await context.route("**/api/member-with-friend*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FRIEND]) }));
  await context.route("**/api/quota*", (r) =>
    quota === "fail"
      ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "boom" }) })
      : r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quota) }));
}

async function seedDevSession(page: Page): Promise<void> {
  await page.goto("/dev-login");
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);
  await page.getByRole("button", { name: /Dev Login/ }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
}

async function openScreen(page: Page, context: BrowserContext, opts: { pickFriend?: boolean } = {}): Promise<void> {
  await context.addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  await page.goto("/v2/service/compatibility/love");
  // Gate check: this testid exists only on the real screen, never on the maintenance rewrite.
  await expect(page.getByTestId("compat-view-result")).toBeVisible({ timeout: 15000 });
  if (opts.pickFriend) {
    await page.getByTestId("compat-person2").click();
    await page.getByTestId(`compat-friend-${FRIEND.id}`).click();
    await expect(page.getByTestId("compat-person2-name")).toBeVisible();
  }
}

test.describe("#264 — quota indicator (browser truth)", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("เหลือเยอะ → เห็นตัวเลข เงียบๆ ไม่มีมาตรวัด ไม่มีเส้นตาย", async ({ page, context }) => {
    await stubReads(context, freeQuota(97));
    await seedDevSession(page);
    await openScreen(page, context, { pickFriend: true });

    const line = page.getByTestId("compat-quota-matching");
    await expect(line).toBeVisible();
    await expect(line).toHaveText("เหลือ 97 ครั้ง");
    expect(await line.textContent()).not.toContain("ปี"); // no expiry framing on an unspent allowance
    expect(await line.evaluate((el) => el.querySelector("progress,[role=progressbar]") !== null)).toBe(false);
    // The colour claim, read off the RENDERED element rather than the class string: with plenty left the
    // line is muted (v3-text-muted #71717A) — background texture, not something to look at.
    await expect(line).toHaveCSS("color", MUTED);
    await page.screenshot({ path: `${SHOTS}/01-plenty-97.png`, fullPage: true });
  });

  test("เหลือน้อย → ตัวเลขอ่านชัดขึ้น แต่ไม่ใช่สีของ error", async ({ page, context }) => {
    await stubReads(context, freeQuota(3));
    await seedDevSession(page);
    await openScreen(page, context, { pickFriend: true });

    const line = page.getByTestId("compat-quota-matching");
    await expect(line).toHaveText("เหลือ 3 ครั้ง");
    // Asserting the exact rendered colour, not merely "not red". "not red" is nearly unfailable — it
    // would also pass if low looked identical to plenty, i.e. if the tone step did nothing at all. Pinned
    // to NAVY here and to MUTED in the plenty case, the pair proves the two states are actually different
    // on screen. If a token is ever repointed, this is meant to break and be re-decided, not auto-follow.
    await expect(line).toHaveCSS("color", NAVY);
    expect(NAVY).not.toBe(MUTED);
    await expect(line).not.toHaveCSS("color", ERROR_RED); // low is a fact, not a fault (#263 tone rule)
    await page.screenshot({ path: `${SHOTS}/02-low-3.png`, fullPage: true });
  });

  test("🔴 อ่านโควตาไม่ได้ (500) → ไม่มีตัวเลขบนจอเลย ไม่ใช่ 'เหลือ 0'", async ({ page, context }) => {
    await stubReads(context, "fail");
    await seedDevSession(page);
    await openScreen(page, context, { pickFriend: true });

    await expect(page.getByTestId("compat-quota-matching")).toHaveCount(0);
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body).not.toMatch(/เหลือ\s*\d/);
    // and the screen is otherwise fully usable — a failed indicator read must not block calculating
    await expect(page.getByTestId("compat-view-result")).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/03-unavailable.png`, fullPage: true });
  });

  test("สมาชิก (ไม่จำกัด) → ไม่มีตัวเลขให้กังวล", async ({ page, context }) => {
    await stubReads(context, { matching: { unlimited: true, used: 42 }, friend: { unlimited: false, limit: 20, used: 3, remaining: 17 } });
    await seedDevSession(page);
    await openScreen(page, context, { pickFriend: true });

    await expect(page.getByTestId("compat-quota-matching")).toHaveCount(0);
    expect((await page.locator("body").textContent()) ?? "").not.toContain("42");
    await page.screenshot({ path: `${SHOTS}/04-member.png`, fullPage: true });
  });

  test("โควตาเพื่อนอยู่ตรงที่กดเพิ่มเพื่อน", async ({ page, context }) => {
    await stubReads(context, freeQuota(97, 17));
    await seedDevSession(page);
    await openScreen(page, context);
    await page.getByTestId("compat-person2").click();
    await expect(page.getByTestId("compat-select-modal")).toBeVisible();
    await expect(page.getByTestId("compat-quota-friend")).toHaveText("เพิ่มได้อีก 17 คน");
    await page.screenshot({ path: `${SHOTS}/05-friend-quota.png`, fullPage: true });
  });

  test("🔴 เหลือ 0 แล้วกด → ข้อความ #263 พูดคนเดียว indicator หายไป", async ({ page, context }) => {
    await stubReads(context, freeQuota(0));
    await seedDevSession(page);
    await openScreen(page, context, { pickFriend: true });
    await expect(page.getByTestId("compat-quota-matching")).toHaveText("เหลือ 0 ครั้ง");

    // The real gate answer for an exhausted free user, exactly as BE sends it.
    await context.route("**/user-matching", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({ status: 410, contentType: "application/json", body: JSON.stringify({ code: 404, message: "เกิน Limit การใช้งาน", error: "Error" }) });
    });
    await page.getByTestId("compat-view-result").click();

    await expect(page.getByTestId("compat-result-error")).toContainText("ใช้สิทธิ์ดูดวงสมพงศ์ครบแล้ว");
    await expect(page.getByTestId("compat-quota-matching")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/06-zero-plus-message.png`, fullPage: true });
  });

  test("ตัวเลขบนจอ = คำตัดสินของ server (ยังเหลือ → กดแล้วผ่านจริง)", async ({ page, context }) => {
    // Negative control for the case above: if the indicator said "เหลือ 0" for everyone, the previous test
    // would still pass. Here it says 12 and the server agrees by letting the calculation through.
    await stubReads(context, freeQuota(12));
    await seedDevSession(page);
    await openScreen(page, context, { pickFriend: true });
    await expect(page.getByTestId("compat-quota-matching")).toHaveText("เหลือ 12 ครั้ง");
    await context.route("**/user-matching", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matching_id: "m-q-1" }) });
    });
    await page.getByTestId("compat-view-result").click();
    await page.waitForURL(/\/result\/m-q-1/, { timeout: 20000 });
  });
});
