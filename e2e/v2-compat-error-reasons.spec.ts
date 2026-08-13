// Browser truth for #263 — the three causes really do reach the user as three different sentences.
//
// Why this exists on top of the two vitest specs: goo's spec proves the CLASSIFICATION (410 → 'quota')
// and mine proves the COPY given a reason, but both mock the seam between them. The thing that actually
// broke in prod is the join — a status that gets swallowed on the way from the browser to the screen
// (utils/fetch.ts used to collapse 410 and a network failure into the same `.catch(err.response.data)`
// blob). So this drives a REAL browser against a REAL dev server and only stubs the BE response itself:
// status → fetch → hook → screen is the shipped path, end to end.
//
// It also captures the evidence frames at 393 (UI rule) — same run, same conditions, so the pictures in
// the PR are of the same code the assertions passed against, not a separate hand-posed session.
//
// Local-only, no BE needed (every backend call is route-fulfilled). Run:
//   V2_PREVIEW_KEY=<key> npm run dev -- -p 3031          # a free port, never a shared :3000
//   E2E_BASE_URL=http://localhost:3031 npx playwright test e2e/v2-compat-error-reasons.spec.ts
//
// ⚠️ /v2/* is team-gated: with no V2_PREVIEW_KEY the middleware rewrites every /v2 route to the
// maintenance page AND STILL ANSWERS 200, so a spec that only checked status codes would pass against a
// page that never rendered. Hence the explicit "the real screen is here" assertion before each case.
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const DEV_USER_ID =
  process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "teamkey123";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.E2E_SHOT_DIR ?? "/tmp/263-shots";

const FRIEND = { id: "friend-1", name: "ปาล์ม", surname: "", picture_url: null, dob: "1994-05-12", time: "07:30", gender: "FEMALE" };
const ME = { user_id: DEV_USER_ID, name: DEV_USER_NAME, dob: "1990-01-01", time: "08:00", picture_url: null, gender: "FEMALE" };

/** Stub every backend read the screen needs, so no BE/DB has to be up. The calculate POST is left to
 *  each test — that is the one response under examination. */
async function stubReads(context: BrowserContext): Promise<void> {
  await context.route("**/api/user*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await context.route("**/api/member-with-friend/detail*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FRIEND) }));
  // A BARE ARRAY — that is what MemberWithFriendGetApi hands back (callApi returns response.data) and the
  // modal branches on Array.isArray(res); an envelope object silently becomes "failed to load".
  // Shape read off the real consumer, not guessed: FriendItem in CompatSelectFriendModal.tsx:19.
  await context.route("**/api/member-with-friend*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FRIEND]) }));
}

async function seedDevSession(page: Page): Promise<void> {
  await page.goto("/dev-login");
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);
  await page.getByRole("button", { name: /Dev Login/ }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
}

/** Land on the real compat screen with both people chosen, so the button is live. */
async function openWithFriendPicked(page: Page, context: BrowserContext): Promise<void> {
  await context.addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  await page.goto("/v2/service/compatibility/love");
  // The gate check: this testid only exists on the real screen, never on the maintenance rewrite.
  await expect(page.getByTestId("compat-view-result")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("compat-person2").click();
  await page.getByTestId(`compat-friend-${FRIEND.id}`).click();
  await expect(page.getByTestId("compat-person2-name")).toBeVisible();
}

/** Fire the button against one stubbed calculate outcome and return what the user can read. */
async function messageFor(
  page: Page,
  context: BrowserContext,
  outcome: { status: number; body?: unknown } | { abort: true },
): Promise<string> {
  await context.route("**/user-matching", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    if ("abort" in outcome) return route.abort("internetdisconnected");
    await route.fulfill({
      status: outcome.status,
      contentType: "application/json",
      body: JSON.stringify(outcome.body ?? {}),
    });
  });
  await page.getByTestId("compat-view-result").click();
  const msg = page.getByTestId("compat-result-error");
  await expect(msg).toBeVisible({ timeout: 20000 });
  return (await msg.textContent()) ?? "";
}

test.describe("#263 — 3 สาเหตุ 3 ข้อความ (browser truth)", () => {
  // 393 — the phone width the UI rule captures at. The default project is Desktop Chrome (1280), which
  // is not a width any of this ships to, and the copy is centred multi-line text: it wraps differently.
  test.use({ viewport: { width: 393, height: 852 } });

  test.beforeEach(async ({ context }) => {
    await stubReads(context);
  });

  test("โควตาเต็ม (410) → บอกว่าใช้สิทธิ์ครบ ไม่ชวนกดซ้ำ และไม่ไปหน้าผล", async ({ page, context }) => {
    await seedDevSession(page);
    await openWithFriendPicked(page, context);
    // The exact prod shape, raw BE wording included — so the test also proves we do NOT echo it.
    const text = await messageFor(page, context, {
      status: 410,
      body: { code: 404, message: "เกิน Limit การใช้งาน", error: "Error" },
    });

    expect(text).toContain("ใช้สิทธิ์ดูดวงสมพงศ์ครบแล้ว");
    expect(text).not.toContain("ลองอีกครั้ง");
    expect(text).not.toContain("Limit"); // raw BE message must never reach the screen
    expect(text).not.toContain("ต่อวัน"); // ...especially this, which is the lie
    expect(page.url()).toContain("/v2/service/compatibility/love");
    await page.screenshot({ path: `${SHOTS}/01-quota-410.png`, fullPage: true });
  });

  test("ระบบขัดข้อง (500) → คนละข้อความกับโควตา และบอกว่าไม่ใช่ความผิดผู้ใช้", async ({ page, context }) => {
    await seedDevSession(page);
    await openWithFriendPicked(page, context);
    const text = await messageFor(page, context, { status: 500, body: { message: "boom" } });

    expect(text).toContain("ระบบขัดข้อง");
    expect(text).toContain("ไม่ใช่ข้อมูลของคุณผิด");
    expect(text).not.toContain("ใช้สิทธิ์");
    expect(text).not.toContain("boom");
    expect(page.url()).toContain("/v2/service/compatibility/love");
    await page.screenshot({ path: `${SHOTS}/02-system-500.png`, fullPage: true });
  });

  test("เชื่อมต่อไม่ได้ (ไม่มี response) → บอกให้ดูสัญญาณ ไม่ใช่ 'คำนวณไม่สำเร็จ'", async ({ page, context }) => {
    await seedDevSession(page);
    await openWithFriendPicked(page, context);
    const text = await messageFor(page, context, { abort: true });

    expect(text).toContain("เชื่อมต่อไม่ได้");
    expect(text).toContain("อินเทอร์เน็ต");
    expect(text).not.toContain("คำนวณไม่สำเร็จ");
    expect(page.url()).toContain("/v2/service/compatibility/love");
    await page.screenshot({ path: `${SHOTS}/03-network.png`, fullPage: true });
  });

  // ❌ NOT COVERED HERE — the 'navigate' case (calc succeeded, router.push failed). Attempted by aborting
  // the result route's /_next/data fetch; Next answered by falling back to a HARD navigation, so the push
  // resolved and the browser really did land on the result page. The test passed its own click but was no
  // longer exercising the branch it claimed, so it is not shipped — a green check pointing at the wrong
  // code is worse than an admitted gap. That branch is covered in scripts/compat-error-copy-ui.test.tsx
  // (push resolving false, the same signal the component reads); it has NO browser frame. See the ใบ.
  //
  // Found while attempting it, OUT OF SCOPE of #263: when navigation succeeds but the result cannot be
  // loaded, the result route says "ยังไม่พบผลลัพธ์ … ลองเริ่มใหม่จากหน้าบริการ" — which invites a fresh
  // calculation for a reading the user has already paid for. Same bug-class as this ticket, different
  // screen. Reported in the ใบ, deliberately not fixed here (that file is not in this ticket's list).

  test("สำเร็จ (200 + matching_id) → ไปหน้าผลตามเดิม", async ({ page, context }) => {
    // Negative control for the three above: without it, "ไม่ไปหน้าผล" would also hold on a screen whose
    // navigation was broken outright, and all three cases would pass for the wrong reason.
    await seedDevSession(page);
    await openWithFriendPicked(page, context);
    await context.route("**/user-matching", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matching_id: "m-e2e-1" }) });
    });
    await page.getByTestId("compat-view-result").click();
    await page.waitForURL(/\/v2\/service\/compatibility\/result\/m-e2e-1/, { timeout: 20000 });
    expect(page.url()).toContain("/result/m-e2e-1");
  });
});
