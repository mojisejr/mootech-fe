// Page-issued nonce for the public calculator compute endpoint (#public-bazi-calculator).
// Invisible to real users (no captcha, no visible challenge) — raises the bar against direct
// scripted POSTs that never load /calculator first, without adding any friction to the real
// form flow. Signed with HMAC-SHA256 so it can't be forged without the server secret; short TTL
// so a leaked/replayed nonce has a small window.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const NONCE_COOKIE = 'calc_nonce'
const TTL_MS = 10 * 60 * 1000 // 10 minutes — long enough to fill the form, short enough to limit replay

function secret(): string {
  const s = process.env.CALC_NONCE_SECRET
  if (!s) throw new Error('CALC_NONCE_SECRET is not configured')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

export function issueNonce(now: number = Date.now()): string {
  const payload = String(now)
  return `${payload}.${sign(payload)}`
}

export function verifyNonce(token: string | undefined | null, now: number = Date.now()): boolean {
  if (!token) return false
  const [payload, mac] = token.split('.')
  if (!payload || !mac) return false
  const expected = sign(payload)
  // Lengths must match before timingSafeEqual (it throws on mismatched buffer length).
  if (expected.length !== mac.length) return false
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(mac))) return false
  const issuedAt = Number(payload)
  if (!Number.isFinite(issuedAt)) return false
  return now - issuedAt <= TTL_MS && now >= issuedAt
}
