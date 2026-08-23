// BFF — v2 ปฏิทินดวง DAY DETAIL. Browser → this route → bazi man-vs-day(day) + almanac IN PARALLEL, then
// trims the ~2.3MB reply to only what the day screen renders (< 50KB). WHY a proxy (same as calendar-month):
// BAZI_BASE_URL is a SERVER env, birth data must not leave to a 3rd origin, no browser→bazi CORS.
//
// TWO upstreams (❗ must fire both): man-vs-day embeds only 9 almanac keys; deity · spirits(8เทพ) ·
// thaiLunar(วันพระ) · dayPillar/monthPillar/yearPillar(ธาตุ) come from the almanac fetch. The mapper
// (lib/v2-calendar/day-detail.ts) owns the field-by-field trim — every field traces to a raw upstream field.
//
// 🔴 GATE (#226) — the paid sections are now cut SERVER-SIDE. Before this, every field went to everyone and
// pages/v2/calendar/[date].tsx hid them with `{paid && …}`: the whole object was in the browser before the
// tier was even evaluated, so Network tab / curl read the paid content for free. Hiding is layout; this is
// access. The cut is an ALLOW-LIST (lib/v2-calendar/day-detail.ts pickFreeDayDetail) so a field bazi adds
// later is not sent by default.
//
// IDENTITY: the tier is resolved for the SESSION's user (resolveSessionUserId). It is deliberately NOT the
// `userId` the body used to carry — a gate whose subject the sender picks is the bug of #252 and #391, and
// this route would have been the third. The body no longer carries one at all.
//
// Cache per (SESSION user, birth-signature, date) — mirrors fortuneCacheKey so re-open a day is instant.
// 🔴 The cache stores the FULL day and the trim happens on the way OUT.
// ⚠️ NOT because one viewer could poison another's entry — they cannot: the user id is IN the key, so two
// people never share a slot (ตู๋ T1 corrected this sentence; the first version of it described a bug that
// cannot happen and would have taught the next reader the wrong model of this cache).
// The real reason is ONE person whose tier changes between two views — they subscribe, or their plan
// lapses. Storing the trimmed value would freeze whichever tier they had at first view: a member who just
// paid would keep getting the free shape until the entry expired. Storing the full day and deciding per
// response makes the upgrade visible on the very next request, with no recompute.
import type { NextApiRequest, NextApiResponse } from 'next'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { mapDayDetail, pickFreeDayDetail, type DayDetail } from '@/lib/v2-calendar/day-detail'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { resolveSubscription } from '@/lib/v2/subscription'
import { BAZI_BASE, BAZI_TIMEOUT_MS, fetchAlmanacDays, type AlmanacDay } from '@/lib/v2-calendar/month'

type AlmanacDated = AlmanacDay & { date?: unknown }

function parseDate(input: unknown): { y: number; m: number; d: number; yearBE: number } | null {
  if (typeof input !== 'string') return null
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim())
  if (!mm) return null
  const y = Number(mm[1]); const m = Number(mm[2]); const d = Number(mm[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d, yearBE: y + 543 }
}

async function fetchFortuneDay(rawInput: unknown, date: string, signal: AbortSignal): Promise<unknown> {
  const r = await fetch(`${BAZI_BASE}/api/bazi/man-vs-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person: rawInput, date }),
    signal,
  })
  if (!r.ok) throw new Error(`man-vs-day ${r.status}`)
  return r.json()
}

// day-detail cache per (user, birth-signature, date) — deterministic in the birth input + date.
const dayCache = new Map<string, DayDetail>()
const DAY_CACHE_MAX = 512
const dayCacheKey = (userId: string, rawInput: unknown, date: string) => `${userId}:${JSON.stringify(rawInput)}:${date}`

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  // `userId` is no longer destructured — this route has no notion of who the SENDER claims to be.
  const { person, date } = (req.body ?? {}) as { person?: FeCalcInput; date?: string }

  const parsed = parseDate(date)
  if (!parsed) return res.status(400).json({ error: 'Invalid date; expected "YYYY-MM-DD".' })
  if (!person) return res.status(400).json({ error: 'person (birth data) is required.' })

  // Identity, then tier. The old `!userId → 400` guard is gone: the caller no longer supplies one, and a
  // request without a usable session is refused here instead (401/404/409 straight from the resolver).
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })
  const userId = who.userId

  // The paid verdict comes from the v2 membership seam (#354) — the module whose header calls itself "the
  // ONE place that answers what tier is this user". `isPaid` is boolean | null there; only a literal true
  // unlocks, so an undetermined tier (an unrecognised tier_code) serves the FREE view rather than guessing.
  let paid = false
  try {
    paid = (await resolveSubscription(userId)).isPaid === true
  } catch {
    paid = false // cannot determine membership → free (fail closed; never serve paid content on an error)
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
  try {
    const { rawInput } = toBaziInput(person)
    const key = dayCacheKey(userId, rawInput, date as string)
    const cached = dayCache.get(key)
    if (cached) {
      clearTimeout(timer)
      return res.status(200).json({ detail: paid ? cached : pickFreeDayDetail(cached), cached: true })
    }

    const [mvd, almanacDays] = await Promise.all([
      fetchFortuneDay(rawInput, date as string, ac.signal),
      fetchAlmanacDays(parsed.yearBE, parsed.m, ac.signal).catch(() => [] as AlmanacDay[]),
    ])
    clearTimeout(timer)

    const almanacDay = (almanacDays as AlmanacDated[]).find((a) => a && a.date === date) ?? null
    const detail = mapDayDetail(mvd, almanacDay)
    if (dayCache.size >= DAY_CACHE_MAX) dayCache.clear()
    dayCache.set(key, detail) // FULL — see the header: the trim is a per-response view, never a stored one
    return res.status(200).json({ detail: paid ? detail : pickFreeDayDetail(detail) })
  } catch {
    clearTimeout(timer)
    // upstream unreachable/timeout → graceful, never 5xx (UI shows its own retry state)
    return res.status(200).json({ detail: null, degraded: true })
  }
}
