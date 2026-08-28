// harness/491-capture-card-form.mjs — #491 evidence, committed so a reviewer can RERUN it.
//   V2_PREVIEW_KEY=local-shot-key npx next dev -p 3011
//   node harness/491-capture-card-form.mjs
//
// 🔴 A LOCAL TEST KEY, NOT .env.local. 363-capture-checkout.mjs greps the real key out of .env.local;
// this one sets its own throwaway value on the dev process and sends the matching cookie. The gate only
// compares the cookie to the env var, so a made-up pair proves the same thing without ever handling a
// real secret.
//
// 🔴 ASSERT CONTENT, NOT STATUS. Without a key every /v2/* rewrites to /maintenance AND STILL ANSWERS
// 200. The negative control for this run was: no cookie -> 307 to /v2, with cookie -> 200 AND the body
// contains หมายเลขบัตร/CVC and zero occurrences of "maintenance".
//
// The row height is MEASURED here rather than computed from the CSS, because the dispatch raised the
// 52px question and a computed answer would have agreed with itself.
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name: 'v2_access', value: 'local-shot-key', url: 'http://127.0.0.1:3011' }]);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:3011/v2/shop/checkout', { waitUntil: 'networkidle' });
await p.waitForSelector('[data-testid="card-form"]', { timeout: 20000 });

// The page may open on PromptPay; select the card method if a switch exists.
const cardTab = p.getByRole('button', { name: /บัตร|card/i }).first();
if (await cardTab.count()) { await cardTab.click().catch(()=>{}); await p.waitForTimeout(400); }
await p.waitForSelector('[data-testid="card-number"]', { timeout: 20000 });

// Measured, not computed: the 52px question the dispatch raised.
const h = await p.locator('[data-testid="card-number"]').evaluate(el => {
  const pill = el.closest('div');
  return { input: el.getBoundingClientRect().height, pill: pill.getBoundingClientRect().height };
});
console.log('row height measured  input=' + Math.round(h.input) + 'px  pill=' + Math.round(h.pill) + 'px');

await p.locator('[data-testid="card-form"]').screenshot({ path: 'harness/pixel-proof/491-checkout-clean-393.png' });

// Errored state: a short number, a past expiry, a wrong-length CVC, each blurred.
await p.fill('[data-testid="card-name"]', 'David Watson');
await p.fill('[data-testid="card-number"]', '4242');
await p.locator('[data-testid="card-number"]').blur();
await p.fill('[data-testid="card-expiry"]', '072026');
await p.locator('[data-testid="card-expiry"]').blur();
await p.fill('[data-testid="card-cvc"]', '12');
await p.locator('[data-testid="card-cvc"]').blur();
await p.waitForTimeout(500);
const marked = await p.locator('[data-testid="card-form"] [aria-invalid="true"]').count();
console.log('fields marked invalid = ' + marked + ' (expect 3: number, expiry, cvc)');
await p.locator('[data-testid="card-form"]').screenshot({ path: 'harness/pixel-proof/491-checkout-errors-393.png' });

// A good card, to prove the brand mark appears and nothing is marked.
await p.fill('[data-testid="card-number"]', '5555555555554444');
await p.fill('[data-testid="card-expiry"]', '042030');
await p.fill('[data-testid="card-cvc"]', '123');
await p.locator('[data-testid="card-cvc"]').blur();
await p.waitForTimeout(400);
const brand = await p.locator('[data-testid="card-brand"]').getAttribute('aria-label').catch(()=>null);
const stillMarked = await p.locator('[data-testid="card-form"] [aria-invalid="true"]').count();
console.log('brand mark = ' + brand + '   still marked = ' + stillMarked + ' (expect 0)');
await p.locator('[data-testid="card-form"]').screenshot({ path: 'harness/pixel-proof/491-checkout-valid-393.png' });
await b.close();
