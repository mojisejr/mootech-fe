// #363 — Browser Truth for the checkout flow (/v2/shop → checkout → QR / result).
//
// Run:  E2E_BASE_URL=http://127.0.0.1:3363 npx playwright test e2e/v2-checkout.spec.ts
// 🔴 The dev server needs NEXT_PUBLIC_OMISE_KEY_V2 set to ANY non-empty value as well as V2_PREVIEW_KEY
//    (#439). Without it features/v2-shop/omise-token.ts throws OmiseKeyMissingError before tokenising and
//    the card tests land on PAYMENT_SETUP_BROKEN — fail-closed, not a false green, but ตู๋ lost a run to it
//    following these instructions, so it is written down here rather than learned twice.
//    🔴 It said CARD_DECLINED until #492. A missing key is OUR failure and no longer wears the bank's
//    words — and an instruction that names the wrong screen is exactly what cost that run the first time.
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

// ─────────────────────────────────────────────────────────────────────────────
// #438 — the card lane's dead end. Everything above walks PromptPay; the card branch of checkout.tsx has
// never had a browser test at all, which is part of why the bug below survived.
//
// We enter the result screen directly rather than driving the card form: tokenisation calls Omise's CDN
// script, which this harness cannot stand up. What matters here is not how the charge was made — it is what
// the screen does once /payment/status says the charge was REFUSED, which is exactly what we stub.
const DECLINED_CARD = { chargeId: "chrg_e2e", status: "REJECT", method: "card", orderId: "o", packageCode: "V2_PRO_YEARLY", tierCode: "PRO", amountSatang: 159000, createdAt: new Date(0).toISOString() };

async function arriveDeclined(page: Page, opts: { withPackage?: boolean } = {}) {
  await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  await page.route("**/api/v2/payment/status", (r) => r.fulfill({ json: { payments: [DECLINED_CARD] } }));
  // the checkout the button should be able to return to must be able to price itself
  await page.route("**/api/v2/payment/preview", (r) => r.fulfill({ json: QUOTE }));
  const pkg = opts.withPackage === false ? "" : "&package_code=V2_PRO_YEARLY";
  await page.goto(`${BASE}/v2/shop/result?state=PAYING&charge=chrg_e2e${pkg}`);
}

test.describe("#438 a refused card is a road, not a wall", () => {
  test("the screen NAMES the refusal instead of waiting forever", async ({ page }) => {
    await arriveDeclined(page);
    const screen = page.getByTestId("result-screen");
    await expect(screen).toBeVisible();
    // the state itself, so a copy tweak cannot quietly turn this green
    await expect(screen).toHaveAttribute("data-state", "CARD_DECLINED");
    await expect(screen).toHaveAttribute("data-paid", "0");
    await expect(page.getByTestId("result-title")).toHaveText("ธนาคารปฏิเสธการชำระเงิน");
    // and it is NOT the old forever-screen
    await expect(page.getByTestId("result-title")).not.toHaveText("กำลังดำเนินการ");
  });

  test("there is something to press — the old screen offered nothing at all", async ({ page }) => {
    await arriveDeclined(page);
    await expect(page.getByTestId("result-try-another")).toBeVisible();
    await expect(page.getByTestId("result-done")).toBeVisible();
    // 🔴 never "ลองอีกครั้ง" on the same card — pressing it again sends the user in a circle
    await expect(page.getByTestId("result-retry-same")).toHaveCount(0);
  });

  // 🔴 THE TEST THIS TICKET GREW FOR. Asserting the URL alone would pass even when the destination answers
  // 400: checkout reads package_code from the query, and without it /api/v2/payment/preview refuses. So the
  // proof is that the destination can PRICE ITSELF — order-summary is only rendered when a quote arrived.
  test("pressing it lands on a checkout that WORKS, for the same package", async ({ page }) => {
    await arriveDeclined(page);
    await page.getByTestId("result-try-another").click();
    await expect(page).toHaveURL(/\/v2\/shop\/checkout\?package_code=V2_PRO_YEARLY/);
    await expect(page.getByTestId("order-summary")).toBeVisible();
  });

  test("with no package to return to, it goes to the list — never a checkout it cannot price", async ({ page }) => {
    await arriveDeclined(page, { withPackage: false });
    await page.getByTestId("result-try-another").click();
    await expect(page).toHaveURL(/\/v2\/shop(\?|$)/);
    expect(page.url()).not.toContain("/checkout");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #439 — 3-D Secure. The card lane finally gets driven for real here: we stub window.Omise so tokenisation
// resolves without loading Omise's CDN script, then stub the charge route to answer the way Omise answers a
// charge that needs authentication. What is under test is OUR half — do we send the cardholder to the bank.
test.describe("#439 the cardholder reaches their bank", () => {
  async function arriveCheckout(page: Page, chargeJson: Record<string, unknown>) {
    await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
    // 🔴 SERVE our own omise.js instead of the CDN's. addInitScript alone is not enough: _document.tsx:19
    // loads https://cdn.omise.co/omise.js with strategy beforeInteractive, and the real script overwrites
    // window.Omise — which then tries to tokenise for real against a fake public key, fails, and the page
    // lands on PAYMENT_SETUP_BROKEN (CARD_DECLINED until #492: a fake key is our problem, not the bank's).
    // Intercepting the script URL is the only way the stub survives.
    await page.route("**/cdn.omise.co/omise.js", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: "window.Omise={setPublicKey:function(){},createToken:function(k,f,cb){cb(200,{id:'tokn_e2e'})}};",
      }));
    await page.route("**/api/v2/payment/preview", (r) => r.fulfill({ json: QUOTE }));
    await page.route("**/api/v2/payment/charge", (r) => r.fulfill({ json: chargeJson }));
    await page.route("**/api/v2/payment/status", (r) =>
      r.fulfill({ json: { payments: [{ chargeId: "chrg_3ds", orderId: "ord_3ds", status: "PENDING", method: "card" }] } }));
    await page.goto(`${BASE}/v2/shop/checkout?package_code=V2_PRO_YEARLY`);
    await expect(page.getByTestId("order-summary")).toBeVisible();
    await page.getByTestId("method-card").click();
    await page.getByTestId("card-name").fill("David Watson");
    await page.getByTestId("card-number").fill("4242424242424242");
    await page.getByTestId("card-expiry").fill("04/2030");
    await page.getByTestId("card-cvc").fill("123");
  }

  // 🔴 THE WHOLE TICKET. Before #439 the adapter dropped authorize_uri, so this navigation could not happen
  // at all — and with 3DS switched on at Omise the charge was refused outright instead.
  test("a charge that needs authentication navigates AWAY to the bank", async ({ page }) => {
    await arriveCheckout(page, { chargeId: "chrg_3ds", status: "PENDING", authorizeUri: `${BASE}/__fake-bank__?x=1` });
    await page.getByTestId("checkout-pay").click();
    await page.waitForURL(/__fake-bank__/);
    expect(page.url()).toContain("__fake-bank__");
  });

  test("a charge that needs NO authentication still goes to our own result screen", async ({ page }) => {
    await arriveCheckout(page, { chargeId: "chrg_3ds", status: "PENDING" });
    await page.getByTestId("checkout-pay").click();
    await page.waitForURL(/\/v2\/shop\/result/);
    expect(page.url()).toContain("charge=chrg_3ds");
    expect(page.url()).not.toContain("__fake-bank__");
  });

  // The return leg: the bank sends them back with OUR orderId and no charge id anywhere.
  test("coming back from the bank with only an order id still finds the row", async ({ page }) => {
    await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
    await page.route("**/api/v2/payment/status", (r) =>
      r.fulfill({ json: { payments: [{ chargeId: "chrg_3ds", orderId: "ord_3ds", status: "REJECT", method: "card" }] } }));
    await page.goto(`${BASE}/v2/shop/result?state=PAYING&order=ord_3ds&package_code=V2_PRO_YEARLY`);
    // it resolved the row by orderId alone — otherwise the screen would still be "กำลังดำเนินการ"
    await expect(page.getByTestId("result-screen")).toHaveAttribute("data-state", "CARD_DECLINED");
  });
});
