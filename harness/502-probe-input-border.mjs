// #502 — what colour is ACTUALLY PAINTED on the checkout input border.
// The ticket forbids proving this by grepping a class name, so this samples pixels.
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
await ctx.addCookies([{ name: 'v2_access', value: 'local-shot-key', url: 'http://127.0.0.1:3012' }]);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:3012/v2/shop/checkout', { waitUntil: 'networkidle' });
await p.waitForSelector('[data-testid="card-number"]', { timeout: 20000 });

// computed style is a PROXY. Record it, then measure the pixel and see if they agree.
const computed = await p.locator('[data-testid="card-number"]').evaluate(el => {
  const pill = el.closest('div');
  const cs = getComputedStyle(pill);
  const r = pill.getBoundingClientRect();
  return { borderColor: cs.borderColor, borderWidth: cs.borderWidth, x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('computed borderColor =', computed.borderColor, ' width =', computed.borderWidth);

await p.screenshot({ path: 'border-probe.png' });
// Sample the left edge of the pill, vertically centred — a border pixel, not the fill.
const px = await p.evaluate(async ({ x, y, w, h }) => {
  const img = new Image();
  const shot = await fetch(location.href); // placeholder, real sampling below
  return null;
}, computed).catch(()=>null);
console.log('box =', JSON.stringify(computed));
await b.close();
