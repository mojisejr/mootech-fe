// harness/backend-hint.ts — turn "a 502 on /api during capture" into a plain-language infra diagnosis.
//
// WHY: when the BE (NestJS :4000) is not booted, the FE BFF (/api/*) answers 502 "upstream unreachable", the
// page falls back, and the browser logs a red console error. A reviewer reads that as a UI BUG — it is not, it
// is infra (BE not running). This NAMES it so nobody chases a phantom UI bug (มุน hit exactly this on Zone 4:
// GET /api/chinese-horoscope → 502 while everything else on the page was fine).
//
// NARROW ON PURPOSE (บอง: don't make it noise): fires ONLY on HTTP 502 to an /api path — the BFF's exact
// "upstream unreachable" branch (it 502s only when its fetch to BE throws; a bazi-overlay failure is graceful,
// and a BE that IS up but errors is PROXIED as its own 500). A 404 or 500 on /api is a DIFFERENT problem and is
// deliberately NOT claimed to be "BE not booted". We would rather stay silent than print a confident wrong line.

export type FailedResponse = { status: number; url: string }

// capture.ts already collects failed responses as "STATUS url" strings; accept those or structured objects.
export function parseFailed(entry: FailedResponse | string): FailedResponse | null {
  if (typeof entry !== 'string') return entry
  const m = entry.match(/^(\d{3})\s+(\S+)/)
  return m ? { status: Number(m[1]), url: m[2] } : null
}

function isApiPath(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith('/api/')
  } catch {
    // relative or malformed URL — fall back to a path check that still requires the /api/ segment
    return /^\/api\//.test(url) || url.includes('/api/')
  }
}

// ANCHOR: backend-unreachable-hint
/** The narrow "BE not reachable" signal: HTTP 502 to an /api path. Returns the offending entries (empty = none). */
export function detectBackendUnreachable(failed: Array<FailedResponse | string>): FailedResponse[] {
  return failed
    .map(parseFailed)
    .filter((e): e is FailedResponse => e !== null && e.status === 502 && isApiPath(e.url))
}

/** Human hint, or null when the signal is absent. Factual: it NAMES infra, it does not auto-fix the env. */
export function backendUnreachableHint(failed: Array<FailedResponse | string>): string | null {
  const hits = detectBackendUnreachable(failed)
  if (hits.length === 0) return null
  return (
    `⚠️  BE upstream unreachable: ${hits.length} request(s) to /api returned 502 (e.g. ${hits[0].url}). ` +
    `The backend (NestJS :4000) is likely not booted — run: bash testenv/scripts/stack.sh up. ` +
    `The page's fallback + this red console error are INFRA, not a UI bug.`
  )
}
