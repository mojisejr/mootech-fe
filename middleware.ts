import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Maintenance gate.
//   MAINTENANCE_MODE=on        -> show /maintenance to everyone (server-side env, NOT public)
//   MAINTENANCE_BYPASS_KEY=xxx -> devs open `?bypass=xxx` once to set a cookie and pass through
// Turn off by setting MAINTENANCE_MODE to anything other than 'on' (or removing it).
const BYPASS_COOKIE = 'mnt_bypass';

// Glass Box console gate (#bazi-chat-anti-drift v2, Track B2).
//   GLASS_BOX_KEY=xxx -> ซินแส opens `?key=xxx` once to set a cookie and reach /glass-box.
// This is ORTHOGONAL to maintenance: the trace console is an internal ซินแส tool, so it must
// stay locked even when the site is fully live (maintenance off). Separate secret, separate cookie.
const GLASS_BOX_COOKIE = 'gb_access';

// What If campaign gate (temporary launch layer).
//   WHATIF_KEY=xxx -> tester opens `/what-if?key=xxx` once to set a cookie and reach /what-if.
// This is independent of maintenance and protects both the page and the generation proxy so
// AI cost cannot leak before launch. Unconfigured means the whole surface is hidden.
const WHATIF_COOKIE = 'whatif_access';
const WHATIF_PLAYED_COOKIE = 'whatif_played';

// Ops dashboard gate (#mumate-ops-dashboard-phase1).
//   OPS_DASHBOARD_KEY=xxx -> internal-only. Unlike Glass Box/What If, entry is a form submit
//   (passkey + name dropdown) via POST /api/ops/login, not a `?key=` link — so this guard only
//   checks the cookie/env at the edge. The page itself (getServerSideProps) renders the gate
//   form when the cookie is missing/invalid. Fail closed: unconfigured = feature hidden.
const OPS_COOKIE = 'ops_access';

// MuMate v2 preview gate.
//   V2_PREVIEW_KEY=xxx -> team-only. Entry is a form submit (passkey) via POST /api/v2/login,
//   not a `?key=` link — so this guard only checks the cookie/env at the edge. `/v2` itself renders
//   the gate form (getServerSideProps) when the cookie is missing/invalid. Fail closed:
//   unconfigured = the whole /v2 preview surface (pages + BFF) is hidden.
const V2_COOKIE = 'v2_access';

function noStore(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store, must-revalidate');
  return res;
}

// Returns a response when the request targets the Glass Box surface (page or its BFF), otherwise
// null so the normal middleware flow continues. Fails closed: with no key configured, the console
// does not exist. The same cookie protects both /glass-box and /api/glass-box/* (same-origin
// fetch sends it automatically), so the test-birth trace BFF can never be hit without the key.
function guardGlassBox(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl;
  const isGlassBox =
    pathname === '/glass-box' ||
    pathname.startsWith('/glass-box/') ||
    pathname.startsWith('/api/glass-box');
  if (!isGlassBox) return null;

  const key = process.env.GLASS_BOX_KEY;
  // Fail closed: unconfigured -> hide the console behind the existing deny surface.
  if (!key) return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));

  // Already holds a valid access cookie -> pass through.
  if (req.cookies.get(GLASS_BOX_COOKIE)?.value === key) {
    return noStore(NextResponse.next());
  }

  // Opens the secret link `?key=<GLASS_BOX_KEY>` -> set cookie, redirect to a clean URL, pass through.
  if (searchParams.get('key') === key) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('key');
    const res = NextResponse.redirect(url);
    res.cookies.set(GLASS_BOX_COOKIE, key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    });
    return noStore(res);
  }

  // No valid key -> hide the console.
  return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));
}

function guardWhatIf(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl;
  const isWhatIf =
    pathname === '/what-if' ||
    pathname.startsWith('/what-if/') ||
    pathname === '/api/what-if' ||
    pathname.startsWith('/api/what-if/');
  if (!isWhatIf) return null;

  const key = process.env.WHATIF_KEY;
  // Fail closed: unconfigured -> hide the campaign and proxy behind maintenance.
  if (!key) return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));

  if (req.cookies.get(WHATIF_COOKIE)?.value === key) {
    return noStore(NextResponse.next());
  }

  if (searchParams.get('key') === key) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('key');
    const res = NextResponse.redirect(url);
    res.cookies.set(WHATIF_COOKIE, key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    });
    return noStore(res);
  }

  return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));
}

// Returns a response when the request targets the Ops surface, otherwise null. `/api/ops/login`
// is always reachable when the key is configured (it validates the submitted passkey itself and
// is how the cookie gets set in the first place). `/ops` itself always passes through when the
// key is configured — its getServerSideProps re-checks the cookie and renders the gate form or
// the dashboard accordingly. Every OTHER /api/ops/* route (health, metrics, activity) is a data
// endpoint and is denied here without a valid cookie (defense in depth — each of those routes
// also re-validates the cookie itself, per too's review note: don't rely on the edge gate alone).
function guardOps(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const isOps = pathname === '/ops' || pathname.startsWith('/ops/') || pathname.startsWith('/api/ops');
  if (!isOps) return null;

  const key = process.env.OPS_DASHBOARD_KEY;
  if (!key) return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));

  if (pathname === '/api/ops/login') return noStore(NextResponse.next());

  const authenticated = req.cookies.get(OPS_COOKIE)?.value === key;
  if (authenticated) return noStore(NextResponse.next());

  if (pathname === '/ops') return noStore(NextResponse.next());

  if (pathname.startsWith('/api/ops')) {
    return noStore(NextResponse.json({ error: { message: 'Not authenticated' } }, { status: 401 }));
  }

  return noStore(NextResponse.redirect(new URL('/ops', req.url)));
}

// Payment-lane Content-Security-Policy (#493).
//
// We keep our own card inputs (features/v2-shop/components/CardForm.tsx) instead of Omise's iframe —
// a decision recorded in #446 — so any script that runs on these screens can read the card number out
// of the DOM. The header below is the browser-enforced list of what those screens may load and talk to.
//
// SCOPE IS DELIBERATELY THE PAYMENT SCREENS ONLY, not the app. Two reasons: the rest of /v2 has never
// been audited for what it loads, and Google Tag Manager (pages/_app.tsx:36-42) is a console through
// which anyone with access injects JavaScript with no PR, no review and no deploy. Feem decided
// 2026-08-28: GTM stays everywhere else and is SHUT OUT of the payment lane. That is why `script-src`
// carries no 'unsafe-inline' — the GTM loader is an inline script, so omitting it is what blocks it.
//
// 'unsafe-inline' remains on style-src ONLY: React writes `style` attributes and Next ships a style
// block, and inline CSS cannot exfiltrate a card number the way a script can.
const PAYMENT_LANE_PREFIXES = ['/v2/shop/checkout', '/v2/shop/qrcode', '/v2/shop/result'] as const;

function isPaymentLane(pathname: string): boolean {
  return PAYMENT_LANE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const PAYMENT_LANE_CSP = [
  "default-src 'self'",
  // cdn.omise.co serves omise.js (pages/_document.tsx:19), which tokenises the card in the browser.
  "script-src 'self' https://cdn.omise.co",
  // api.omise.co is where the token request goes (features/v2-shop/omise-token.ts).
  "connect-src 'self' https://api.omise.co",
  // The PromptPay QR is an <Image> served straight from Omise (next.config.mjs:34, unoptimized).
  "img-src 'self' data: https://api.omise.co",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // No iframes at all on these screens. This is what shuts out the GTM <noscript> frame
  // (pages/_document.tsx:22-30). 3-D Secure is NOT affected: the bank is reached by a top-level
  // navigation (pages/v2/shop/checkout.tsx:88 sets window.location.href), which CSP does not police.
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Our own forms post to us. The bank hand-off is a navigation, not a form submit.
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

// Attaches the payment-lane CSP to a response when the REQUEST targets that lane. Keyed on the request
// path, not on where the response ends up, so a rewrite to /maintenance is still covered and the rule
// stays something a test can state in one line.
function withPaymentLaneCsp(req: NextRequest, res: NextResponse): NextResponse {
  if (!isPaymentLane(req.nextUrl.pathname)) return res;
  res.headers.set('Content-Security-Policy', PAYMENT_LANE_CSP);
  return res;
}

// Returns a response when the request targets the v2 preview surface, otherwise null. Mirrors
// guardOps: `/api/v2/login` is always reachable when the key is configured (it validates the
// submitted passkey and is how the cookie gets set). `/v2` itself passes through so its
// getServerSideProps can render the gate form when unauthenticated. Every OTHER /api/v2/* route is
// a data endpoint denied here without a valid cookie (defense in depth — each such route should
// also re-check the cookie itself). Fail closed: no key configured -> whole surface hidden.
function guardV2(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const isV2 = pathname === '/v2' || pathname.startsWith('/v2/') || pathname.startsWith('/api/v2');
  if (!isV2) return null;

  // 🔴 Omise webhook exemption — MUST come BEFORE the V2_PREVIEW_KEY read below (#355). The webhook's
  // caller is Omise's machine, not a browser, so it carries no v2_access cookie and its ONLY real gate
  // is the HMAC signature verified inside the route. If it fell through to `if (!key)` it would be
  // rewritten to /maintenance, and rewrite returns HTTP 200 → Omise reads 2xx as "delivered" and never
  // retries → a card was charged and NOBODY is provisioned, with no failed-delivery queue to notice.
  // That day is launch day: removing the preview gate (#247) means removing V2_PREVIEW_KEY, which is
  // exactly when `if (!key)` starts firing. Exact === (never startsWith): the only unauthenticated path
  // here is this one literal; `/webhookX` or `/webhook/extra` must still 401. The route itself fails
  // closed on a missing signing secret — this exemption only skips the COOKIE gate, not the signature.
  if (pathname === '/api/v2/payment/webhook') return noStore(NextResponse.next());

  const key = process.env.V2_PREVIEW_KEY;
  if (!key) return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));

  if (pathname === '/api/v2/login') return noStore(NextResponse.next());

  const authenticated = req.cookies.get(V2_COOKIE)?.value === key;
  if (authenticated) return noStore(NextResponse.next());

  if (pathname === '/v2') return noStore(NextResponse.next());

  if (pathname.startsWith('/api/v2')) {
    return noStore(NextResponse.json({ error: { message: 'Not authenticated' } }, { status: 401 }));
  }

  return noStore(NextResponse.redirect(new URL('/v2', req.url)));
}

function redirectWhatIfFirstVisit(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== '/') return null;

  const key = process.env.WHATIF_KEY;
  if (!key) return null;

  // Temporary B-layer test gate: only testers who hold `whatif_access` get redirected.
  // Launch switch: remove this `whatif_access` condition so first-visit redirect applies to everyone.
  if (req.cookies.get(WHATIF_COOKIE)?.value !== key) return null;
  if (req.cookies.get(WHATIF_PLAYED_COOKIE)?.value) return null;

  return noStore(NextResponse.redirect(new URL('/what-if', req.url)));
}

export function middleware(req: NextRequest) {
  // Glass Box gate first — independent of maintenance mode.
  const glassBox = guardGlassBox(req);
  if (glassBox) return glassBox;

  // What If gate first — independent of maintenance mode and protects the proxy cost surface.
  const whatIf = guardWhatIf(req);
  if (whatIf) return whatIf;

  const whatIfRedirect = redirectWhatIfFirstVisit(req);
  if (whatIfRedirect) return whatIfRedirect;

  // Ops dashboard gate — internal-only, independent of maintenance mode.
  const ops = guardOps(req);
  if (ops) return ops;

  // MuMate v2 preview gate — team-only, independent of maintenance mode.
  const v2 = guardV2(req);
  // guardV2 has seven exits (:165 :168 :170 :173 :175 :178 :181) and a v2 request never reaches the
  // end of this file, so the CSP is attached here — the one point every v2 response passes through.
  if (v2) return withPaymentLaneCsp(req, v2);

  // Maintenance off -> behave normally (normal caching resumes).
  // (While maintenance is on, every gated response below uses the module-level noStore so the
  // CDN never caches the maintenance HTML under "/" and serves it to bypassed devs.)
  if (process.env.MAINTENANCE_MODE !== 'on') return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  // Always allow: the maintenance page itself, a health endpoint, the NextAuth
  // OAuth handshake, and the auth error page.
  //
  // The handshake (/api/auth/csrf | signin | callback | session) MUST run
  // UNGATED so login behaves exactly like live even while maintenance is on.
  // Gating it served NextAuth the maintenance HTML instead of JSON, which broke
  // login for any cold-cookie client (incognito / fresh mobile): the cross-site
  // OAuth callback could arrive without the `mnt_bypass` cookie, get rewritten to
  // /maintenance, and never set a session -> auth/after sees no session ->
  // bounce to /login -> the "เวียนเทียน login" loop. Warm desktops hid this
  // because cached cookies/session skip the cold handshake entirely.
  // This does NOT expose the app: every real page stays gated, so a user who
  // logs in still only sees /maintenance without a valid bypass cookie — only
  // the login handshake is allowed to complete. (#mootech-maint-gate-incognito-login)
  if (
    pathname === '/maintenance' ||
    pathname === '/api/health' ||
    pathname.startsWith('/api/auth') ||
    pathname === '/auth/error'
  ) {
    return noStore(NextResponse.next());
  }

  const key = process.env.MAINTENANCE_BYPASS_KEY;

  // Dev already holds a valid bypass cookie -> pass through (sees the real site).
  if (key && req.cookies.get(BYPASS_COOKIE)?.value === key) {
    return noStore(NextResponse.next());
  }

  // Dev opens the secret link `?bypass=<key>` -> set cookie, redirect to clean URL, pass through.
  if (key && searchParams.get('bypass') === key) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('bypass');
    const res = NextResponse.redirect(url);
    res.cookies.set(BYPASS_COOKIE, key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    });
    return noStore(res);
  }

  // Everyone else -> the maintenance page (URL stays the same; content is replaced).
  return noStore(NextResponse.rewrite(new URL('/maintenance', req.url)));
}

export const config = {
  // Gate pages + API (so NextAuth is also behind the gate for non-dev),
  // but never gate static assets / Next internals.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|mascot|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp|css|js)).*)',
  ],
};
