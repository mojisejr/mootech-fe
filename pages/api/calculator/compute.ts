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

// bazi-sft-dataset's DB-free enrichment route (#calculator-enrichment-FROZEN-v1) — daYun/liuNian
// 12-qi + element-reaction + clash flags, on top of the base pillars from mootech-be above. This
// is an ADD-ON, not a dependency: if it's slow/down, the calculator still works with the base
// pillars/timeline that already shipped in PR#57 — see fetchEnrichment below (bounded timeout,
// swallows failure, never blocks or fails the main response).
const BAZI_SFT_ENDPOINT = process.env.BAZI_BASE_URL || ''
const ENRICHMENT_TIMEOUT_MS = 5000
const ENRICHMENT_DEFAULT_PROVINCE = 'กรุงเทพมหานคร'

// Shape-only (not full calendar validity — mootech-be is the source of truth for that, verified
// live: an out-of-range date like "2026-99-99" gets a real 500 there, which this API surfaces as
// a clean "compute failed" 502 rather than crashing). Month/day are range-checked here anyway
// (01-12 / 01-31) so an obviously-bogus date fails fast locally instead of wasting a round trip
// to a backend call that's going to fail anyway.
const DOB_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

type ComputeBody = { dob?: unknown; time?: unknown; gender?: unknown }

export function validateInput(body: ComputeBody): { dob: string; time: string; gender: string } | null {
  if (typeof body.dob !== 'string') return null
  // `time` is optional (empty string = "จำไม่ได้"), but if present it must be a string — a
  // non-string time (wrong client type) is rejected outright rather than silently coerced to ''
  // ("no time provided" has a different meaning than "malformed time provided").
  if (body.time !== undefined && body.time !== null && typeof body.time !== 'string') return null
  if (typeof body.gender !== 'string') return null

  const dob = body.dob
  const time = typeof body.time === 'string' ? body.time : ''
  const gender = body.gender.toUpperCase()

  if (!DOB_RE.test(dob)) return null
  if (time !== '' && !TIME_RE.test(time)) return null
  if (gender !== 'MALE' && gender !== 'FEMALE') return null
  return { dob, time, gender }
}

export function sameOrigin(req: NextApiRequest): boolean {
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

export type DaYunRow = {
  ageRange: string
  symbol: string
  place: string
  qi: string
  reaction: string
  element: string
}

export type LiuNianRow = {
  year: number
  age: number
  stem: string
  branch: string
  element: string
  qi: string
  reaction: string
  clash: boolean
  harm: boolean
}

export type EnrichmentBadge = {
  point: string
  role: 'wealth' | 'power'
  element: string
  qi: string
  clash: boolean
}

// Per-pillar stages from bazi-sft's OWN engine (public-calc `pillars`, PR-A) — glyph + เชี่ยงแซ come
// from ONE engine so they can never mismatch (data-correctness rule, FROZEN v2). `*Element` are Thai
// labels (ไม้/ไฟ/ดิน/ทอง/น้ำ) → map with thaiToBaziElement. day pillar omits upper/sitting (ดิถี = no
// stage). Optional throughout: enrichment is best-effort and may be null/partial.
export type EnrichmentPillar = {
  stem: string
  branch: string
  stemElement: string
  branchElement: string
  upperStageDisplay?: string
  lowerStageDisplay?: string
  sittingStage?: string
}

export type EnrichmentPillars = {
  ascendant: EnrichmentPillar
  hour: EnrichmentPillar
  day: EnrichmentPillar
  month: EnrichmentPillar
  year: EnrichmentPillar
}

export type Enrichment = {
  dayMaster: string
  dayMasterElement: string
  strengthScore: number
  strengthBand?: { id: string; displayLabel: string }
  pillars?: EnrichmentPillars
  daYun: DaYunRow[]
  liuNian: LiuNianRow[]
  badges: EnrichmentBadge[]
}

// Best-effort only — timeout + swallow-all-errors by design (see comment at BAZI_SFT_ENDPOINT).
// No time entered ("จำไม่ได้") still gets enrichment: day/month/year pillars always render per
// FROZEN v1, and daYun/liuNian depend on date, not exact hour, so a noon placeholder is safe here
// (bazi-sft-dataset's RawInputSchema requires birthTime, unlike mootech-be's optional time).
export async function fetchEnrichment(input: { dob: string; time: string; gender: string }): Promise<Enrichment | null> {
  if (!BAZI_SFT_ENDPOINT) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ENRICHMENT_TIMEOUT_MS)
  try {
    const res = await fetch(`${BAZI_SFT_ENDPOINT}/api/bazi/public-calc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birthDate: input.dob,
        birthTime: input.time || '12:00',
        gender: input.gender,
        province: ENRICHMENT_DEFAULT_PROVINCE,
        calendarSystem: 'solar',
        timezone: 'Asia/Bangkok',
      }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    if (!json || !Array.isArray(json.daYun) || !Array.isArray(json.liuNian)) return null
    return json as Enrichment
  } catch (e: any) {
    console.error('[calculator] enrichment fetch failed', e?.message)
    return null
  } finally {
    clearTimeout(timeout)
  }
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

  // Fired alongside the required mootech-be call below — independent host, no shared connection
  // pool, so parallel is safe (unlike the DB-pool concurrency hang elsewhere in this codebase).
  const enrichmentPromise = fetchEnrichment(input)

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

  const enrichment = await enrichmentPromise

  const { dobThai, yearOfZodiac, summary, detail, cycleLife, cycleYearLife } = beJson
  res.status(200).json({ data: { dobThai, yearOfZodiac, summary, detail, cycleLife, cycleYearLife, enrichment } })
}
