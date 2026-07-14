// Public Bazi Calculator compute endpoint (#public-bazi-calculator, Phase 1).
// Calls mootech-be's existing POST /chinese-horoscope WITHOUT user_id — its own identity gate
// (chinese-horoscope.service.ts:923, verified live) skips every user-bound side effect (log
// write, S3 image upload, profile update) when user_id is absent, so this is naturally
// anonymous/stateless on the be side. No new be endpoint needed.
//
// Defense layers (launch blocker per FROZEN v1 — no auth wall, so this is the only protection):
//   1. same-origin check (Origin header must match this host)
//   2. page-issued nonce (set when /calculator loads, see lib/calculator/nonce.ts) — blocks
//      direct scripted POSTs that never loaded the page
//   3. per-IP burst rate limit (lib/calculator/rate-limit.ts)
// None of these are visible to a real user filling the form — no captcha.
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/lib/db'
import { calculatorUsageLog } from '@/lib/db/schema'
import { NONCE_COOKIE, verifyNonce } from '@/lib/calculator/nonce'
import { checkCalculatorRateLimit, clientIpFromHeaders } from '@/lib/calculator/rate-limit'

const BE_ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
if (/bazichart\.mumate\.co/i.test(BE_ENDPOINT)) {
  throw new Error(`[GUARDRAIL] NEXT_PUBLIC_BACKEND_URL points at old prod (${BE_ENDPOINT}).`)
}

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

type ComputeBody = { dob?: unknown; time?: unknown; gender?: unknown }

function validateInput(body: ComputeBody): { dob: string; time: string; gender: string } | null {
  const dob = typeof body.dob === 'string' ? body.dob : ''
  const time = typeof body.time === 'string' ? body.time : ''
  const gender = typeof body.gender === 'string' ? body.gender.toUpperCase() : ''
  if (!DOB_RE.test(dob)) return null
  if (time !== '' && !TIME_RE.test(time)) return null
  if (gender !== 'MALE' && gender !== 'FEMALE') return null
  return { dob, time, gender }
}

function sameOrigin(req: NextApiRequest): boolean {
  const origin = req.headers.origin
  if (!origin) return false
  const host = req.headers.host
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

// Fire-and-forget: a usage-counter write must never fail or slow down the user's result.
function recordUsage(): void {
  db.insert(calculatorUsageLog)
    .values({})
    .catch((e) => console.error('[calculator] usage counter insert failed', e?.message))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } })
    return
  }

  if (!sameOrigin(req)) {
    res.status(403).json({ error: { message: 'Forbidden' } })
    return
  }

  if (!verifyNonce(req.cookies[NONCE_COOKIE])) {
    res.status(403).json({ error: { message: 'Session expired — please reload the page' } })
    return
  }

  const ip = clientIpFromHeaders((name) => {
    const v = req.headers[name]
    return Array.isArray(v) ? v[0] : v
  })
  const rate = checkCalculatorRateLimit(ip)
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    res.status(429).json({ error: { message: 'ยิงถี่ไปหน่อยนะครับ ลองใหม่อีกครั้งในสักครู่' } })
    return
  }

  const input = validateInput(req.body ?? {})
  if (!input) {
    res.status(400).json({ error: { message: 'Invalid input' } })
    return
  }

  let beJson: any
  try {
    const beRes = await fetch(`${BE_ENDPOINT}/chinese-horoscope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Deliberately no user_id/family_code/name/place_name — the anonymous, side-effect-free path.
      body: JSON.stringify({ dob: input.dob, time: input.time, gender: input.gender }),
    })
    beJson = await beRes.json().catch(() => null)
    if (!beRes.ok || !beJson) {
      res.status(502).json({ error: { message: 'คำนวณไม่สำเร็จ ลองใหม่อีกครั้ง' } })
      return
    }
  } catch {
    res.status(502).json({ error: { message: 'เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง' } })
    return
  }

  recordUsage()

  const { dobThai, yearOfZodiac, summary, detail, cycleLife, cycleYearLife } = beJson
  res.status(200).json({ data: { dobThai, yearOfZodiac, summary, detail, cycleLife, cycleYearLife } })
}
