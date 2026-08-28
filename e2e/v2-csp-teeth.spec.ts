// #493 — the payment lane's CSP has TEETH: a real Chromium refuses an off-list script.
//
// Run:  E2E_BASE_URL=http://127.0.0.1:3493 npx playwright test e2e/v2-csp-teeth.spec.ts
// Needs a dev server with V2_PREVIEW_KEY set — without it the middleware REWRITES every /v2/* request
// to /maintenance and STILL ANSWERS 200, so a status check proves nothing. Every test asserts it is on
// the real screen first.
//
// 🔴 WHY THIS FILE EXISTS SEPARATELY FROM scripts/csp-payment-path.test.ts.
//   The unit spec proves the header is EMITTED and says the right words. It cannot tell an enforcing
//   policy from a Content-Security-Policy-Report-Only one — from Node both are just a string. Only a
//   browser can say "refused". That distinction is the trap written into the ticket itself.
//
// 🔴 WHY THE OFF-LIST SCRIPT IS SERVED, NOT JUST NAMED.
//   An unreachable host (evil.invalid) fails to load with or without a CSP, so a test using one is
//   green when the policy is absent — the exact "passes without the real thing" shape. So the request
//   is intercepted and fulfilled with a script that really would run, and the assertions are:
//     · the flag it sets never appears        (it did not execute)
//     · a securitypolicyviolation event fires (the BROWSER refused it, not the network)
//     · the route handler is never reached    (CSP blocks before the request leaves)
//   And the control below runs the identical injection on a screen with no CSP, where it MUST execute.
//   Without that control a green here would also be produced by a typo in the injected URL.
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "devkey";

const OFF_LIST = "https://cdn.jsdelivr.net/npm/left-pad@1.3.0/index.js";
const PAYLOAD = 'window.__OFF_LIST_SCRIPT_RAN__ = true;';

const QUOTE = {
  quoteId: "q_csp", packageCode: "V2_PRO_YEARLY", listSatang: 159000, discountSatang: 0,
  amountSatang: 159000, vatSatang: 10402, vatPercent: 7, codeApplied: null,
  expiresAt: new Date(0).toISOString(),
};

type Probe = { violations: string[]; served: number };

/** Arms the interception + violation listener BEFORE any navigation, and returns what it observed. */
async function armProbe(page: Page): Promise<Probe> {
  const probe: Probe = { violations: [], served: 0 };
  await page.route(OFF_LIST, (route) => {
    probe.served++;
    return route.fulfill({ status: 200, contentType: "application/javascript", body: PAYLOAD });
  });
  await page.addInitScript(() => {
    (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__ = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__.push(
        `${(e as SecurityPolicyViolationEvent).violatedDirective}|${(e as SecurityPolicyViolationEvent).blockedURI}`,
      );
    });
  });
  await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  return probe;
}

/** Injects the off-list script and reports whether it executed. */
async function injectOffListScript(page: Page): Promise<boolean> {
  await page.evaluate((src) => {
    const s = document.createElement("script");
    s.src = src;
    document.head.appendChild(s);
  }, OFF_LIST);
  // Give the browser a beat to either run it or refuse it. A fixed wait is honest here: there is no
  // event to await for "nothing happened".
  await page.waitForTimeout(1500);
  return page.evaluate(() => (window as unknown as { __OFF_LIST_SCRIPT_RAN__?: boolean }).__OFF_LIST_SCRIPT_RAN__ === true);
}

const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__ ?? []);

async function arriveCheckout(page: Page) {
  await page.route("**/api/v2/payment/preview", (r) => r.fulfill({ json: QUOTE }));
  await page.goto(`${BASE}/v2/shop/checkout?package_code=V2_PRO_YEARLY`);
  await expect(page.getByTestId("order-summary")).toBeVisible();
}

test.describe("#493 the checkout CSP refuses, it does not merely report", () => {
  test("🔴 the header on the real checkout response is ENFORCING, not report-only", async ({ request }) => {
    const res = await request.get(`${BASE}/v2/shop/checkout?package_code=V2_PRO_YEARLY`, {
      headers: { cookie: `v2_access=${V2_KEY}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-security-policy"]).toBeTruthy();
    // The trap the ticket names: a report-only policy is a DIFFERENT header and enforces nothing.
    expect(res.headers()["content-security-policy-report-only"]).toBeUndefined();
  });

  test("🔴 an off-list script is REFUSED BY THE BROWSER on checkout", async ({ page }) => {
    const probe = await armProbe(page);
    await arriveCheckout(page);

    const ran = await injectOffListScript(page);
    expect(ran).toBe(false);

    const seen = await violations(page);
    expect(seen.some((v) => v.startsWith("script-src"))).toBe(true);
    // CSP blocks before the network, so our interceptor never even got asked for the file.
    expect(probe.served).toBe(0);
  });

  test("Tag Manager is shut out of this screen", async ({ page }) => {
    await armProbe(page);
    await arriveCheckout(page);
    await page.waitForTimeout(1500);
    const seen = await violations(page);
    expect(seen.some((v) => v.includes("googletagmanager") || v.startsWith("script-src"))).toBe(true);
    // and it truly never ran: GTM's own global is absent
    const gtmRan = await page.evaluate(
      () => Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer) &&
            ((window as unknown as { dataLayer: unknown[] }).dataLayer.length > 0),
    );
    expect(gtmRan).toBe(false);
  });

  test("omise.js — the one script the lane DOES need — still loads", async ({ page }) => {
    await armProbe(page);
    await arriveCheckout(page);
    await page.waitForFunction(() => typeof (window as unknown as { Omise?: unknown }).Omise !== "undefined", null, {
      timeout: 10_000,
    });
    expect(await page.evaluate(() => typeof (window as unknown as { Omise?: unknown }).Omise)).not.toBe("undefined");
  });
});

// ── The tooth that the off-list-script test cannot be ────────────────────────────────────────────────
//
// 🔴 WHY THIS EXISTS, in ตู๋'s words on PR #505: "the teeth only fire at a script that is OUTSIDE the
// list, so a host MISSING from the list is invisible by construction". That is precisely what happened:
// connect-src named api.omise.co and omise.js posts the card token to vault.omise.co, so the policy
// allowed PromptPay and forbade every card payment. Three passes did not see it, because
// e2e/v2-checkout.spec.ts:202-207 REPLACES omise.js with a stub, so the request to the vault was never
// made in any run.
//
// So this block drives the REAL omise.js and asserts the ABSENCE of any connect-src violation. It does
// not need to know which hosts the script uses — a host we failed to list shows up as a violation
// whatever its name is. That is the difference between a tooth that guards a list and one that guards
// the lane.
//
// Both Omise hosts are intercepted locally, so no request reaches Omise and no key is used. CSP is
// evaluated BEFORE the interception, which is what makes the interceptor a usable witness: reached
// means the policy allowed it, never reached means the policy blocked it.
test.describe("#493 the real card lane runs under the policy", () => {
  // ⚠️ READ THIS CASE WITH THE FILE, NEVER ALONE. Its main assertion is an ABSENCE (no connect-src
  // violation), and an absence is also what you get when there is no policy at all. What keeps it
  // honest is the `expect.poll(vaultHits).toBeGreaterThan(0)` above it: the token request must really
  // have been permitted and reached the interceptor. ตู๋ walked the failure modes on c8282e6 and they
  // all land red — CSP blocks cdn.omise.co → window.Omise never appears → waitForFunction times out;
  // CSP blocks the vault → vaultHits stays 0; the pay button does not fire → vaultHits stays 0; some
  // other host is missing → the violation filter catches it. The one world where this case alone goes
  // green is "the CSP vanished entirely", and that world is already red two cases up, where the
  // enforcing-header and off-list-script cases live. That is why they belong in one file.
  test("🔴 driving the REAL omise.js raises NO connect-src violation, and the card token gets out", async ({ page }) => {
    let vaultHits = 0;
    let sourcesHits = 0;

    await page.route("https://vault.omise.co/**", (route) => {
      vaultHits++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ object: "token", id: "tokn_csp_e2e", card: {} }) });
    });
    await page.route("https://api.omise.co/sources/**", (route) => {
      sourcesHits++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ object: "source", id: "src_csp_e2e" }) });
    });

    await page.addInitScript(() => {
      (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__ = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        const ev = e as SecurityPolicyViolationEvent;
        (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__.push(
          `${ev.violatedDirective}|${ev.blockedURI}`,
        );
      });
    });
    await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);

    // Our own money endpoints are mocked; the Omise call is the thing under test and it is REAL code.
    await page.route("**/api/v2/payment/preview", (r) => r.fulfill({ json: QUOTE }));
    await page.route("**/api/v2/payment/charge", (r) =>
      r.fulfill({ json: { chargeId: "chrg_csp", status: "PENDING" } }));
    await page.route("**/api/v2/payment/status", (r) =>
      r.fulfill({ json: { payments: [{ chargeId: "chrg_csp", orderId: "ord_csp", status: "PENDING", method: "card" }] } }));

    await page.goto(`${BASE}/v2/shop/checkout?package_code=V2_PRO_YEARLY`);
    await expect(page.getByTestId("order-summary")).toBeVisible();
    // The real script must be the one that answers, not a leftover stub.
    await page.waitForFunction(() => typeof (window as unknown as { Omise?: unknown }).Omise !== "undefined", null, { timeout: 10_000 });

    await page.getByTestId("method-card").click();
    await page.getByTestId("card-name").fill("David Watson");
    await page.getByTestId("card-number").fill("4242424242424242");
    await page.getByTestId("card-expiry").fill("04/2030");
    await page.getByTestId("card-cvc").fill("123");
    await page.getByTestId("checkout-pay").click();

    await expect.poll(() => vaultHits, { timeout: 10_000 }).toBeGreaterThan(0);

    const seen = await page.evaluate(() => (window as unknown as { __CSP_VIOLATIONS__: string[] }).__CSP_VIOLATIONS__ ?? []);
    expect(seen.filter((v) => v.startsWith("connect-src"))).toEqual([]);
    // Nothing actually left for Omise: both hosts were served from this process.
    expect(sourcesHits).toBe(0);
  });
});

test.describe("#493 CONTROL — the same injection on a screen with no CSP", () => {
  // If this goes red, the test above proves nothing: it would mean the injection never works and the
  // "refused" result is an artefact of the harness, not of the policy.
  test("🔴 the identical off-list script DOES run on /v2/shop, which carries no CSP", async ({ page }) => {
    const probe = await armProbe(page);
    await page.route("**/api/payment-package**", (route) =>
      route.fulfill({ json: { package_code: "V2_PRO_YEARLY", amount: 1590, expire: "1Y", is_active: true, buffer_day: 0 } }));
    await page.goto(`${BASE}/v2/shop`);
    await expect(page.getByTestId("shop-header")).toBeVisible();

    const ran = await injectOffListScript(page);
    expect(ran).toBe(true);
    expect(probe.served).toBe(1);
    expect(await violations(page)).toEqual([]);
  });
});
