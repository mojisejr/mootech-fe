// harness/assert-no-app-fetch.ts — SHARED assertion (goo → Lamun · one code path, both lenses).
//
// The calendar Phase-0 mock must make 0 app-fetch, so a page can hit console-0 WITHOUT booting BE
// (there is nothing to reach). This helper is imported by BOTH goo's capture and Lamun's calendar
// anchor so the two lenses assert the SAME thing with the SAME code — they cannot diverge.
//
// CRITICAL — REQUEST-level, not response-level: we hook `page.on('request')`, not `page.on('response')`.
// A request fired at /api whose upstream is down never emits a `response` event (ECONNREFUSED), so a
// response-level check reads "0 app-fetch" while a fetch actually left the page — a vacuous pass (the
// same shape that let a broken guard go green in Zone 3). request-level captures the ATTEMPT itself,
// which is the ground truth of "did the page try to reach the app backend".
//
// "app-fetch" = a request to our application DATA layer: a same-origin `/api/...` route (e.g.
// /api/user, /api/home-fortune, /api/chinese-horoscope), or the BE (:4000) / bazi (:3100) hosts —
// the things that would require booting a backend. These MUST be 0 on the calendar mock.
//
// NOT an app-fetch (framework/shell infra that runs on EVERY /v2 page and needs no backend of ours):
//   • `_next/*`, HMR websocket, favicon, fonts — build/runtime assets.
//   • `/api/auth/*` — NextAuth's own session/csrf endpoints. SessionProvider fires /api/auth/session on
//     every v2 page (home included); it validates the local session cookie/JWT, reaches no BE/DB-of-ours,
//     and is not something the calendar feature introduces. Treated as framework infra (like _next),
//     verified against a real FE-only capture — NOT an arbitrary allowlist.
import type { Page, Request } from 'playwright'

/** Hosts/ports that count as the app backend, in addition to any same-origin `/api` path. */
export const DEFAULT_APP_HOSTS = [':4000', ':3100'] as const

/** Same-origin `/api` paths that are FRAMEWORK infra, not app-data (excluded from app-fetch). */
export const FRAMEWORK_API_PREFIXES = ['/api/auth/'] as const

export interface AppFetchTracker {
  /** `"<METHOD> <url>"` for every app-fetch seen since attach — should be EMPTY for a 0-network page. */
  readonly appFetches: string[]
  /** Throw if any app-fetch was captured (lists them). Call after the page has settled (networkidle). */
  assertNone(context?: string): void
}

/** True when `url` targets the application data layer (a /api path or a BE/bazi host). */
export function isAppFetch(url: string, appHosts: readonly string[] = DEFAULT_APP_HOSTS): boolean {
  let pathname = ''
  try {
    pathname = new URL(url).pathname
  } catch {
    pathname = url
  }
  // framework auth (/api/auth/*) is infra, not app-data — exclude before the /api check.
  if (FRAMEWORK_API_PREFIXES.some((p) => pathname.startsWith(p))) return false
  if (pathname === '/api' || pathname.startsWith('/api/')) return true
  return appHosts.some((h) => url.includes(h))
}

/**
 * Attach a request-level app-fetch tracker to `page`. Call this BEFORE navigating to the route under
 * test (so it captures that page's requests), then `tracker.assertNone()` after networkidle.
 */
export function trackAppFetches(
  page: Page,
  opts: { appHosts?: readonly string[] } = {},
): AppFetchTracker {
  const appHosts = opts.appHosts ?? DEFAULT_APP_HOSTS
  const appFetches: string[] = []
  page.on('request', (req: Request) => {
    const url = req.url()
    if (isAppFetch(url, appHosts)) appFetches.push(`${req.method()} ${url}`)
  })
  return {
    appFetches,
    assertNone(context?: string) {
      if (appFetches.length > 0) {
        const where = context ? ` (${context})` : ''
        throw new Error(
          `assertNoAppFetch${where}: expected 0 app-fetch, saw ${appFetches.length}:\n` +
            appFetches.map((f) => `  • ${f}`).join('\n'),
        )
      }
    },
  }
}
