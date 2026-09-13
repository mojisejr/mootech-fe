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
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { mapDayDetail, pickFreeDayDetail, type DayDetail } from '@/lib/v2-calendar/day-detail'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { resolveSubscription } from '@/lib/v2/subscription'
import { calendarMonthReachable } from '@/lib/v2/entitlement'
import { currentMonthBkk } from '@/lib/v2/clock'
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
// 2 ชั้น: in-memory Map (เร็วสุด แต่หายตอน cold start) + ตาราง DB bazi_day_detail_cache (ทน cold start/instance
// อื่น — 0026). ผล 1 วันของ birth คงที่ deterministic → เก็บได้ยาว. best-effort: ยังไม่ migrate → ใช้ Map อย่างเดียว.
const dayCache = new Map<string, DayDetail>()
const DAY_CACHE_MAX = 512
const DAY_CACHE_VERSION = 'v3' // bump เมื่อรูป DayDetail เปลี่ยน "หรือข้อมูล engine แก้" (v2: yam label ตัดคำจีน god; v3 2026-09-13: บัสต์ cache หลัง engine แก้คำเทพ ฮั่วท้อเซียงสือกง→ซือ / กุ้ยนั้ง)
const dayCacheKey = (userId: string, rawInput: unknown, date: string) => `${userId}:${JSON.stringify(rawInput)}:${date}`
const rowsOf = (r: unknown): Record<string, unknown>[] =>
  (Array.isArray(r) ? r : (r as { rows?: Record<string, unknown>[] })?.rows ?? []) as Record<string, unknown>[]

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
  let verdict: { isPaid: boolean | null; tier: string | null } = { isPaid: false, tier: null }
  try {
    const v = await resolveSubscription(userId)
    verdict = { isPaid: v.isPaid, tier: v.tier }
  } catch {
    verdict = { isPaid: false, tier: null } // cannot determine membership → free (fail closed)
  }
  const paid = verdict.isPaid === true

  // ── #358 Phase 3 — THE SPAN, the same one call the month route makes ──────────────────────────────
  //
  // 🔴 THIS ROUTE IS WHY THE SPAN CANNOT SHIP ON THE MONTH GATE ALONE. Blocking only the month grid leaves
  // this endpoint answering for any date a blocked person asks for — they curl it directly, one day at a
  // time, and the wall is decoration. #226 closed exactly that shape once already, for the paid FIELDS.
  //
  // 🔴 A refusal here is a 200 with no detail, NOT the trimmed free view. The trim answers "you may look at
  // this day but not the paid parts"; the span answers "this day is outside what your package sells at
  // all". Serving the trim for an out-of-span date would sell FREE the whole calendar minus some fields.
  // ⚠️ That is a real change for a FREE caller, who today gets the trimmed detail for ANY date. It is the
  // decided product rule (ฟีมเคาะ 2026-08-24, ทาง A: Free = the current month), written here rather than
  // left for someone to discover from a diff.
  // 🔴 From `parsed`, NOT from `date`. parseDate matches on input.trim() (line 41), so ' 2026-08-14'
  // passes the shape check while the raw string slices to ' 2026-0' — which is not a YYYY-MM, so
  // monthDistance THROWS and the handler answers nothing at all. ตู๋ drove it through the real handler:
  // free and plus got status 0 with no body, and PRO got 200 because isMonthReachable returns at
  // `span === null` before monthDistance is ever reached. ⇒ the tier we exercise most is the one blind
  // to it. pages/api/v2/calendar-month.ts:154 already built its month from `parsed`; this one had the
  // parsed value in hand at line 69 and used the raw string beside it.
  const wantedMonth = `${parsed.y}-${String(parsed.m).padStart(2, '0')}`
  if (!calendarMonthReachable(verdict, wantedMonth, currentMonthBkk())) {
    return res.status(200).json({ detail: null, outOfSpan: true })
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
  try {
    const { rawInput } = toBaziInput(person)
    const key = dayCacheKey(userId, rawInput, date as string)
    const dbKey = `${DAY_CACHE_VERSION}|${key}`

    // ชั้น 1: in-memory Map (เร็วสุด)
    const mem = dayCache.get(key)
    if (mem) {
      clearTimeout(timer)
      return res.status(200).json({ detail: paid ? mem : pickFreeDayDetail(mem), cached: true })
    }
    // ชั้น 2: DB (ทน cold start) — best-effort, ล้มก็คำนวณสด
    let durable: DayDetail | undefined
    try {
      const row = rowsOf(await db.execute(
        sql`SELECT payload FROM "bazi_day_detail_cache" WHERE cache_key = ${dbKey} LIMIT 1`,
      ))[0]
      if (row?.payload) durable = row.payload as DayDetail
    } catch {
      /* cache อ่านไม่ได้ (ยังไม่ migrate ฯลฯ) → คำนวณสด */
    }
    if (durable) {
      clearTimeout(timer)
      if (dayCache.size >= DAY_CACHE_MAX) dayCache.clear()
      dayCache.set(key, durable) // อุ่น mem
      return res.status(200).json({ detail: paid ? durable : pickFreeDayDetail(durable), cached: true })
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
    // เขียน DB best-effort (ทน cold start) — ล้มก็ไม่กระทบผล
    try {
      await db.execute(
        sql`INSERT INTO "bazi_day_detail_cache" (cache_key, payload, updated_at)
            VALUES (${dbKey}, ${JSON.stringify(detail)}::jsonb, now())
            ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      )
    } catch {
      /* เขียน cache ไม่ได้ → ข้าม */
    }
    return res.status(200).json({ detail: paid ? detail : pickFreeDayDetail(detail) })
  } catch {
    clearTimeout(timer)
    // upstream unreachable/timeout → graceful, never 5xx (UI shows its own retry state)
    return res.status(200).json({ detail: null, degraded: true })
  }
}
