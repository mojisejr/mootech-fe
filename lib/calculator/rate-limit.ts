// In-memory fixed-window rate limiter for the public calculator (#public-bazi-calculator).
// Mirrors the pattern already established in bazi-sft-dataset/src/lib/rate-limit.ts — same
// caveat applies: single-instance in-memory counting, each warm serverless/edge instance counts
// separately. Good enough for v1 (matches this codebase's own precedent); move to Redis/Upstash
// if traffic scales enough for multi-instance undercounting to matter.
//
// Unlike bazi's limiter this has NO daily cap by design — the product is free-unlimited for real
// people (one person filling a form takes far longer than the burst window). Only a per-minute
// burst limit, aimed at scripted abuse, not legitimate repeat use.
type Bucket = { count: number; resetAt: number }
const store = new Map<string, Bucket>()
let ops = 0

function sweep(now: number): void {
  if (++ops % 1000 !== 0) return
  for (const [k, b] of Array.from(store.entries())) {
    if (b.resetAt <= now) store.delete(k)
  }
}

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number; limit: number }

function hit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now()
  sweep(now)
  let b = store.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    store.set(key, b)
  }
  b.count += 1
  const ok = b.count <= limit
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    limit,
  }
}

export const CALC_RATE_PER_MIN = Number(process.env.CALC_RATE_PER_MIN) || 10

export function checkCalculatorRateLimit(ip: string): RateResult {
  return hit(`calc:min:${ip}`, CALC_RATE_PER_MIN, 60_000)
}

/** Caller-provided IP extraction (works for both NextApiRequest headers and NextRequest headers). */
export function clientIpFromHeaders(getHeader: (name: string) => string | null | undefined): string {
  const xff = getHeader('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return getHeader('x-real-ip')?.trim() || 'unknown'
}
