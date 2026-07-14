// Shared ops-gate helpers used by pages/api/ops/* and pages/ops SSR — Node runtime only
// (touches the DB). middleware.ts must NOT import this: it runs in the Edge Runtime and only
// checks the cookie value against OPS_DASHBOARD_KEY directly.
import type { NextApiRequest } from 'next'

export const OPS_COOKIE = 'ops_access'

export function isOpsAuthenticated(req: NextApiRequest | { cookies: Partial<Record<string, string>> }): boolean {
  const key = process.env.OPS_DASHBOARD_KEY
  if (!key) return false
  return req.cookies?.[OPS_COOKIE] === key
}

export function opsCookieHeader(key: string): string {
  const parts = [
    `${OPS_COOKIE}=${key}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${60 * 60 * 24}`,
  ]
  return parts.join('; ')
}
