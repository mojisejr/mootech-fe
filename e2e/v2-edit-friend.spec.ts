// Browser truth for #266 — editing a friend, through the real route in a real browser.
//
// 🔴 WHAT THIS IS AND IS NOT. The ใบ asks for e2e because "แก้แล้วผลเปลี่ยนตาม" crosses FE→BE→engine.
// This spec proves the FE half of that crossing: the values the user types leave the browser in the real
// PUT, serialised by the real client, and the row on screen is re-read afterwards. It does NOT prove the
// engine returns a different reading — that needs a live BE and is stated as unverified in the ใบ rather
// than implied by a green tick here.
//
// Every other claim of this ticket lives in scripts/edit-friend-ui.test.tsx, the lane CI runs. Nothing
// load-bearing is parked here alone (#271's lesson): e2e still has no runner (#270), so a spec here is
// documentation plus a hand-run check, not a gate.
//
// Local-only, no BE needed. Run:
//   V2_PREVIEW_KEY=<key> npm run dev -- -p 3034
//   E2E_BASE_URL=http://localhost:3034 npx playwright test e2e/v2-edit-friend.spec.ts
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

const DEV_USER_ID = process.env.E2E_DEV_USER_ID ?? "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f";
const DEV_USER_NAME = process.env.E2E_DEV_USER_NAME ?? "เกวลิน";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "teamkey123";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const ME = { user_id: DEV_USER_ID, name: DEV_USER_NAME, dob: "1990-01-01", time: "08:00", picture_url: null, gender: "FEMALE" };
// The friend HAS a surname the form never shows — the value this ticket must not destroy.
const FRIEND = { id: "friend-1", name: "ปาล์ม", surname: "ศรีสุข", picture_url: null, dob: "1994-05-12", time: "07:30", gender: "FEMALE", is_remember_time: true };

async function stub(context: BrowserContext, puts: string[]): Promise<void> {
  await context.route("**/api/user*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ME) }));
  await context.route("**/api/member-with-friend/detail*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FRIEND) }));
  await context.route("**/api/member-with-friend*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FRIEND]) }));
  await context.route("**/api/quota*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matching: { unlimited: false, limit: 100, used: 3, remaining: 97 }, friend: { unlimited: false, limit: 20, used: 3, remaining: 17 } }) }));
  // The edit endpoint itself: record what actually left the browser.
  await context.route("**/member-with-friend/profile*", (r) => {
    puts.push(r.request().postData() ?? "");
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

async function openScreen(page: Page, context: BrowserContext): Promise<void> {
  await page.goto("/dev-login");
  const inputs = page.locator("input");
  await inputs.nth(0).fill(DEV_USER_ID);
  await inputs.nth(1).fill(DEV_USER_NAME);
  await page.getByRole("button", { name: /Dev Login/ }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await context.addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  await page.goto("/v2/service/compatibility/love");
  // Gate check: this testid exists only on the real screen, never on the maintenance rewrite.
  await expect(page.getByTestId("compat-view-result")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("compat-person2").click();
  await page.getByTestId(`compat-friend-${FRIEND.id}`).click();
  await expect(page.getByTestId("compat-person2-name")).toBeVisible();
}

test.describe("#266 — แก้ไขข้อมูลเพื่อน (browser truth)", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("แก้เวลาเกิด → ค่าที่ออกจากเบราว์เซอร์เปลี่ยนจริง และนามสกุลที่ฟอร์มไม่แสดงยังอยู่", async ({ page, context }) => {
    const puts: string[] = [];
    await stub(context, puts);
    await openScreen(page, context);

    await page.getByTestId("compat-person2-edit").click();
    await expect(page.getByTestId("add-friend-sheet")).toBeVisible();
    await expect(page.getByTestId("add-friend-name")).toHaveValue("ปาล์ม");
    await expect(page.getByTestId("add-friend-year")).toHaveValue("2537"); // 1994 + 543

    await page.getByTestId("add-friend-time").fill("09:45");
    await page.getByTestId("add-friend-save").click();
    await expect(page.getByTestId("add-friend-sheet")).toHaveCount(0);

    expect(puts).toHaveLength(1);
    const body = JSON.parse(puts[0]);
    expect(body.time).toBe("09:45");
    expect(body.surname).toBe("ศรีสุข"); // never blanked by a save that did not touch it
    expect(body.name).toBe("ปาล์ม");
    expect(body.dob).toBe("1994-05-12");
    expect(body.is_remember_time).toBe(true);
  });

  test("ปุ่มบนแถวเพื่อนไปคนละที่จริง และทั้งคู่กดถึง (≥44px)", async ({ page, context }) => {
    const puts: string[] = [];
    await stub(context, puts);
    await openScreen(page, context);

    for (const id of ["compat-person2-change", "compat-person2-edit"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} must render`).not.toBeNull();
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(44);
    }

    await page.getByTestId("compat-person2-change").click();
    await expect(page.getByTestId("compat-select-modal")).toBeVisible();
    await expect(page.getByTestId("add-friend-sheet")).toHaveCount(0);
  });
});
