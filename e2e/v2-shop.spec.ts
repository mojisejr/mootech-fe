// #359 — Browser Truth for "เลือกแพ็คเกจที่ใช่" (/v2/shop).
//
// Run:  E2E_BASE_URL=http://127.0.0.1:3359 npx playwright test e2e/v2-shop.spec.ts
// Needs a dev server with V2_PREVIEW_KEY set (see below) — the middleware REWRITES every /v2/* request to
// /maintenance and still answers 200 when that key is missing, so a status check proves nothing. Every
// test therefore asserts it is on the real screen before measuring anything.
//
// 🔴 The mascot gate measures RECTS WHILE SCROLLING, never a full-page screenshot.
//    Proven on this branch: Playwright's fullPage capture grows the canvas but leaves `position: fixed`
//    elements painted at their viewport coordinates, so the bottom Menubar appears half-way up the image,
//    on top of a card. A gate reading that image would report an overlap that does not exist — and could
//    equally hide a real one. getBoundingClientRect at each scroll step is what the user's tap actually hits.
import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const V2_KEY = process.env.V2_PREVIEW_KEY ?? "devkey";
const VIEWPORTS = [320, 393, 430, 768, 1280];

/** What a user can tap. Matches the repo's reality: locked controls are real <button>/<a>, never disabled. */
const TAPPABLE = "button, a, input, [role=button]";

async function openShop(page: Page) {
  await page.context().addCookies([{ name: "v2_access", value: V2_KEY, url: BASE }]);
  // The price row comes from a DB this harness does not have — mock the CONTRACT, not the screen.
  await page.context().route("**/api/payment-package**", (route) => {
    const code = new URL(route.request().url()).searchParams.get("code");
    const row =
      code === "MONTHLY"
        ? { package_code: "MONTHLY", amount: 790, expire: "1Y", buffer_day: 0 }
        : null;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(row) });
  });
  await page.goto(`${BASE}/v2/shop`, { waitUntil: "networkidle" });
  // Negative control before every measurement: are we even on the screen?
  await expect(page.getByTestId("shop-header")).toBeVisible();
  await expect(page.getByTestId(/^plan-card-/)).toHaveCount(3);
}

test.describe("#359 /v2/shop", () => {
  test("มาสคอตไม่ทับ element ที่กดได้ — ทุก viewport ทุกตำแหน่ง scroll", async ({ page }) => {
    await openShop(page);

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);

      const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      // Walk the whole page a viewport at a time — "full-page", but measured, not photographed.
      for (let y = 0; y < docHeight; y += 700) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(80);

        const result = await page.evaluate((sel) => {
          const mascot = document.querySelector('[data-testid="shop-mascot"]');
          if (!mascot) return { checked: 0, overlaps: [] as string[], missed: [] as string[] };
          const m = mascot.getBoundingClientRect();
          const overlaps: string[] = [];
          const missed: string[] = [];
          let checked = 0;

          for (const el of Array.from(document.querySelectorAll(sel))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue; // not painted here
            if (r.bottom < 0 || r.top > window.innerHeight) continue; // off-screen at this scroll step
            checked++;
            const name = el.getAttribute("data-testid") ?? el.tagName + ":" + (el.textContent ?? "").slice(0, 20);

            // ① box overlap must be zero
            const overlap =
              Math.max(0, Math.min(m.right, r.right) - Math.max(m.left, r.left)) *
              Math.max(0, Math.min(m.bottom, r.bottom) - Math.max(m.top, r.top));
            if (overlap > 0) overlaps.push(name);

            // ② the point the user aims at must not be taken BY THE MASCOT.
            // 🔴 Deliberately narrower than "must reach the control": the first version of this gate
            // asserted that, and went red on plan-cta-pro at 393/scroll-700 — where the thing on top was
            // NAV.fixed (the Menubar), with the button at top 860 in a 900-tall viewport. A control that
            // is briefly under a sticky nav mid-scroll is not a bug; the user scrolls two more lines.
            // Widening rather than dropping it: "is every control reachable somewhere" moved to the
            // reachability test below, which is the question the user actually asks.
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight) {
              const hit = document.elementFromPoint(cx, cy);
              const takenByMascot = !!hit && (hit === mascot || mascot.contains(hit));
              if (takenByMascot && !el.contains(hit) && !hit.contains(el)) missed.push(name);
            }
          }
          return { checked, overlaps, missed };
        }, TAPPABLE);

        // 🔴 A gate that answers over zero items is green from testing nothing.
        expect(result.checked, `@${width} scroll ${y}: ไม่มี element ที่กดได้ให้ตรวจเลย`).toBeGreaterThan(0);
        expect(result.overlaps, `@${width} scroll ${y}: มาสคอตทับ`).toEqual([]);
        expect(result.missed, `@${width} scroll ${y}: กดกลางปุ่มแล้วไม่โดนปุ่ม`).toEqual([]);
      }
    }
  });

  test("ทุกปุ่มบนจอมีตำแหน่ง scroll ที่กดโดนจริงอย่างน้อยหนึ่งจุด", async ({ page }) => {
    // The half the mascot gate deliberately gave up, kept as its own question — and this one catches a
    // strictly worse bug: a control that is NEVER reachable at any scroll position, at any width.
    await openShop(page);
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      const reachable = new Set<string>();
      const all = new Set<string>();
      for (let y = 0; y < docHeight; y += 300) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(60);
        const step = await page.evaluate((sel) => {
          const seen: string[] = [];
          const hit: string[] = [];
          for (const el of Array.from(document.querySelectorAll(sel))) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const name = el.getAttribute("data-testid") ?? el.tagName + ":" + (el.textContent ?? "").slice(0, 20);
            seen.push(name);
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
            const top = document.elementFromPoint(cx, cy);
            if (top && (el.contains(top) || top.contains(el))) hit.push(name);
          }
          return { seen, hit };
        }, TAPPABLE);
        step.seen.forEach((n) => all.add(n));
        step.hit.forEach((n) => reachable.add(n));
      }

      expect(all.size, `@${width}: ไม่มีปุ่มให้ตรวจเลย`).toBeGreaterThan(0);
      // Array.from, not [...set]: the app tsconfig targets below es2015 and spreading a Set trips TS2802.
      const never = Array.from(all).filter((n) => !reachable.has(n));
      expect(never, `@${width}: ปุ่มที่กดไม่โดนเลยสักตำแหน่ง (ตรวจ ${all.size} ปุ่ม)`).toEqual([]);
    }
  });

  test("กดการ์ดที่ขายได้ → ถึง checkout พร้อม package_code ที่ถูกตัว", async ({ page }) => {
    await openShop(page);
    // The only sellable code today is MONTHLY (lib/payment/catalog.ts:35-43) ⇒ switch to รายเดือน.
    await page.getByRole("radio", { name: /รายเดือน/ }).click();
    await page.getByTestId("plan-cta-plus").click();
    // The checkout PAGE belongs to #363 and does not exist yet — assert the destination we send them to,
    // not that it renders. Recorded in the PR as an explicitly Pending lane.
    await page.waitForURL(/\/v2\/shop\/checkout\?package_code=MONTHLY/);
    expect(new URL(page.url()).searchParams.get("package_code")).toBe("MONTHLY");
  });

  test("ปุ่มของแพ็กฟรีไม่พาไปหน้าจ่ายเงิน", async ({ page }) => {
    await openShop(page);
    await page.getByTestId("plan-cta-free").click();
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain("/checkout");
  });

  test("ไม่มีลิงก์ไหนบนจอที่กดแล้วไม่ไปไหน", async ({ page }) => {
    await openShop(page);
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
        .filter((h) => h.startsWith("/")),
    );
    expect(hrefs.length, "ไม่มีลิงก์ให้ตรวจเลย").toBeGreaterThan(0);
    for (const href of hrefs) {
      // #363 owns the checkout page; everything else must already resolve.
      if (href.startsWith("/v2/shop/checkout")) continue;
      const res = await page.request.get(`${BASE}${href}`);
      expect(res.status(), `${href} ตอบ ${res.status()}`).toBeLessThan(400);
    }
  });
});
