import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Maintenance gate.
//   MAINTENANCE_MODE=on        -> show /maintenance to everyone (server-side env, NOT public)
//   MAINTENANCE_BYPASS_KEY=xxx -> devs open `?bypass=xxx` once to set a cookie and pass through
// Turn off by setting MAINTENANCE_MODE to anything other than 'on' (or removing it).
const BYPASS_COOKIE = 'mnt_bypass';

export function middleware(req: NextRequest) {
  // Maintenance off -> behave normally (normal caching resumes).
  if (process.env.MAINTENANCE_MODE !== 'on') return NextResponse.next();

  // While maintenance is on, NEVER let the CDN cache a gated response — otherwise the
  // maintenance HTML gets cached under "/" and even bypassed devs get served the stale page.
  const noStore = (res: NextResponse) => {
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  };

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
