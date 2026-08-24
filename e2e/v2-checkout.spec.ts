// #363 — Browser Truth for the checkout flow (/v2/shop → checkout → QR / result).
//
// Run:  E2E_BASE_URL=http://127.0.0.1:3363 npx playwright test e2e/v2-checkout.spec.ts
// Needs a dev server with V2_PREVIEW_KEY set — without it the middleware REWRITES every /v2/* request to
// /maintenance AND STILL ANSWERS 200, so a status check proves nothing. Every test asserts it is on the real
// screen before measuring.
//
// 🔴 WHAT THIS FILE PROVES AND WHAT IT DOES NOT.
//   PROVES  the SCREENS join up: a real browser walks real routes, the money on screen is the money the
//           server sent, a refused code does not blank the page, PromptPay reaches the QR screen, and a
//           charge that never settles never produces a success screen.
//   DOES NOT the MONEY LANE. The payment APIs are route-mocked because /api/v2/payment/* needs a session and
//           a database this harness has not got. "กดซื้อจริง → จ่ายสำเร็จ → สิทธิ์เปลี่ยน" (the ticket's
//           first DoD line) needs testenv/scripts/stack.sh, which needs a prod dump that only ฟีม can make
//           (testenv/scripts/dump.sh:2). That line is Pending, and it is Pending for a reason nobody here
//           can remove — see the ticket.
//
// 🔑 The webhook tooth the ticket asks for IS here, in the form this harness can express: a charge that
// stays PENDING (i.e. the webhook never arrived) must leave the screen waiting and must NEVER say สำเร็จ.
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "devkey";

const QUOTE = {
  quoteId: "q_e2e", packageCode: "V2_PRO_YEARLY", listSatang: 159000, discountSatang: 0,
  amountSatang: 159000, vatSatang: 10402, vatPercent: 7, codeApplied: null, expiresAt: new Date(0).toISOString(),
};
const QUOTE_CODED = { ...QUOTE, discountSatang: 15900, amountSatang: 143100, vatSatang: 9400, codeApplied: "SAVE10" };

async function arrive(page: Page, opts: { refuseCode?: boolean; pending?: boolean } = {}) {
  await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  await page.route("**/api/v2/payment/preview", (r) => {
    const body = JSON.parse(r.request().postData() ?? "{}");
    if (body.code && opts.refuseCode) return r.fulfill({ status: 400, json: { error: "no", codeError: "INVALID" } });
    return r.fulfill({ json: body.code ? QUOTE_CODED : QUOTE });
  });
  await page.route("**/api/v2/payment/promptpay", (r) =>
    r.fulfill({ json: { chargeId: "chrg_e2e", status: "PENDING", amountSatang: 159000, discountSatang: 0, qr: "https://api.omise.co/x.png" } }));
  await page.route("**/api/v2/payment/status", (r) =>
    r.fulfill({ json: { payments: [{ chargeId: "chrg_e2e", status: opts.pending === false ? "APPROVED" : "PENDING" }] } }));
  await page.goto(`${BASE}/v2/shop/checkout?package_code=V2_PRO_YEARLY`);
  // on the REAL screen, not /maintenance
  await expect(page.getByTestId("order-summary")).toBeVisible();
}

test.describe("#363 checkout — browser truth", () => {
  test("the money on screen is the money the server sent", async ({ page }) => {
    await arrive(page);
    await expect(page.getByTestId("summary-total")).toHaveText("฿1,590");
    await expect(page.getByTestId("summary-vat")).toHaveText("฿104.02");
    await expect(page.getByTestId("checkout-secured")).toBeVisible();
  });

  test("applying a code re-prices from the server and shows both the chip and the line", async ({ page }) => {
    await arrive(page);
    await page.getByTestId("discount-input").fill("SAVE10");
    await page.getByTestId("discount-apply").click();
    await expect(page.getByTestId("discount-chip")).toBeVisible();
    await expect(page.getByTestId("summary-code-discount")).toHaveText("−฿159");
    await expect(page.getByTestId("summary-total")).toHaveText("฿1,431");
  });

  test("🔴 clearing the code re-prices — it does not do arithmetic on screen", async ({ page }) => {
    await arrive(page);
    await page.getByTestId("discount-input").fill("SAVE10");
    await page.getByTestId("discount-apply").click();
    await expect(page.getByTestId("summary-total")).toHaveText("฿1,431");
    await page.getByTestId("discount-clear").click();
    await expect(page.getByTestId("summary-total")).toHaveText("฿1,590");
    await expect(page.getByTestId("summary-code-discount")).toHaveCount(0);
  });

  test("🔴 a refused code leaves the price standing — a typo is not an outage", async ({ page }) => {
    await arrive(page, { refuseCode: true });
    await page.getByTestId("discount-input").fill("EXPIRED99");
    await page.getByTestId("discount-apply").click();
    await expect(page.getByTestId("discount-helper")).toContainText("โค้ดไม่ถูกต้อง");
    await expect(page.getByTestId("summary-total")).toHaveText("฿1,590"); // still there
    await expect(page.getByTestId("checkout-fatal")).toHaveCount(0);
  });

  test("PromptPay reaches the QR screen, and the charge id travels with it", async ({ page }) => {
    await arrive(page);
    await page.getByTestId("method-promptpay").click();
    await page.getByTestId("checkout-pay").click();
    await page.waitForURL(/\/v2\/shop\/qrcode\?/);
    await expect(page.getByTestId("qr-screen")).toBeVisible();
    expect(page.url()).toContain("charge=chrg_e2e");
  });

  test("🔴 a charge the webhook never settles NEVER produces a success screen", async ({ page }) => {
    // The ticket's tooth: "ทำให้ webhook ไม่มาถึง → จอต้องไม่บอกว่าสำเร็จ และบอกว่ากำลังรอ".
    await arrive(page, { pending: true });
    await page.getByTestId("method-promptpay").click();
    await page.getByTestId("checkout-pay").click();
    await page.waitForURL(/\/v2\/shop\/qrcode\?/);
    await expect(page.getByTestId("qr-waiting")).toBeVisible();
    await page.waitForTimeout(4000); // several poll rounds
    await expect(page.getByTestId("qr-waiting")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("สำเร็จ");
    expect(page.url()).not.toContain("/result");
  });

  test("a settled charge moves the screen on — and only then", async ({ page }) => {
    await arrive(page, { pending: false });
    await page.getByTestId("method-promptpay").click();
    await page.getByTestId("checkout-pay").click();
    await page.waitForURL(/\/v2\/shop\/result\?/, { timeout: 15000 });
    await expect(page.getByTestId("result-screen")).toHaveAttribute("data-paid", "1");
    await expect(page.getByTestId("result-title")).toHaveText("ชำระเงินสำเร็จ");
  });

  test("🔴 a typed ?state=APPROVED does not make the screen claim payment", async ({ page }) => {
    // /v2/shop/result?state=APPROVED is a URL anyone can type. Without a charge that /status confirms, the
    // screen must not say the money moved.
    await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
    await page.route("**/api/v2/payment/status", (r) => r.fulfill({ json: { payments: [] } }));
    await page.goto(`${BASE}/v2/shop/result?state=APPROVED`);
    await expect(page.getByTestId("result-screen")).toBeVisible();
    await expect(page.getByTestId("result-screen")).toHaveAttribute("data-paid", "0");
    await expect(page.locator("body")).not.toContainText("สิทธิ์ของคุณเปิดใช้งานแล้ว");
  });
});
