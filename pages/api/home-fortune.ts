// BFF for the Zone-1 daily-fortune card. Browser → this route (same-origin) → bazi POST /api/home.
// WHY a proxy (verified — every bazi call in FE goes this way): BAZI_BASE_URL is a SERVER env (never
// shipped to the browser), birth data must not leave to a 3rd origin, and there is no browser→bazi CORS.
//
// Normalizes the bazi manvsday `fortune` to the `DailyFortune` shape the UI consumes. Graceful by
// design: no person / bazi unreachable / bazi error → { fortune: null } (200) so the hook shows its
// fallback and the page never breaks — never a 5xx to the browser (same policy as the other bazi BFFs).
//
// NOTE (verified 2026-07-26 against live bazi): bazi /api/home now FORWARDS grade + summaryHeadline +
// summaryItems (keyed: best · worst · strength · element · officer). We normalize the shape here:
// headline ← summaryHeadline ?? summary; best/worst ← summaryItems matched BY KEY (never by position)
// else facets by percent; grade ← fortune.grade (bazi is the single source of the ratingJson thresholds
// — we do NOT reimplement gradeForPercent to avoid drift). Still graceful: a missing field degrades, never 5xx.
import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bkkDateStr } from '@/lib/usage-core'
import { toBaziInput, type FeCalcInput } from '@/lib/bazi-bridge/input'
import { mergeEngineBirth } from '@/lib/bazi-bridge/engine-birth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// bump เมื่อเปลี่ยนรูป payload { fortune, persona } → ผลเก่าที่ cache miss แล้วคำนวณใหม่เอง (0022_home_fortune_cache)
const CACHE_VERSION = 'v1'
const rowsOf = (r: unknown): Record<string, unknown>[] =>
  (Array.isArray(r) ? r : (r as { rows?: Record<string, unknown>[] })?.rows ?? []) as Record<string, unknown>[]

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}
const BAZI_TIMEOUT_MS = 12000

export type DailyFortune = {
  percent: number
  grade: string // gradeForPercent(percent) — from bazi (single-sourced ratingJson); '' until forwarded
  verdict: 'good' | 'neutral' | 'caution'
  headline: string
  date: string
  best: { text: string } // ⭐ เหมาะกับวันนี้ (facet %สูงสุด)
  worst: { text: string } // ⚠️ ควรเลี่ยง (facet %ต่ำสุด)
}

// Home "ธาตุของคุณ" line — day-master element + strength band. bazi /api/home forwards
// persona:{elementTh, strengthLabel} (route-level, same compute as the fortune → no drift).
export type HomePersona = {
  elementTh: string // day-master element, Thai label ("ไม้"/"ไฟ"/"ดิน"/"ทอง"/"น้ำ")
  strengthLabel: string // strength band — REAL engine vocab ("ดิถีแข็ง"/"ดิถีอ่อน"/…), never "แข็งแรง"
}

type Facet = { key: string; label: string; percent: number | null; grade: string; isMain: boolean }
type SummaryItem = { key: string; icon: string; label: string; text: string }

export function bestWorstText(f: { summaryItems?: SummaryItem[]; facets?: Facet[] }): { best: string; worst: string } {
  // bazi's summaryItems are KEYED (best · worst · strength · element · officer) — match by `key`, NOT by
  // position. The old code read summaryItems[0]/[last]: [0]=best happened to be right, but [last] is
  // 'officer' ("ดูแลเอาใจใส่"), so "ควรเลี่ยง" rendered officer instead of key==='worst'
  // ("อยู่บ้าน / คุมลูกน้อง / อยู่ในห้อง") — an inverted meaning the user read every day. Per field:
  // the keyed text first, then fall back to facets-by-percent when a keyed item is absent (schema-safe).
  const items = Array.isArray(f.summaryItems) ? f.summaryItems : []
  const byKey = (k: string) => items.find((x) => x?.key === k)?.text ?? ''
  const scored = (f.facets ?? []).filter((x) => x.percent != null)
  const facetLabel = (better: (a: Facet, c: Facet) => Facet) => (scored.length ? scored.reduce(better).label : '')
  const facetBest = facetLabel((a, c) => ((c.percent ?? 0) > (a.percent ?? 0) ? c : a))
  const facetWorst = facetLabel((a, c) => ((c.percent ?? 0) < (a.percent ?? 0) ? c : a))
  return { best: byKey('best') || facetBest, worst: byKey('worst') || facetWorst }
}

export function normalize(fortune: unknown): DailyFortune | null {
  const f = fortune as {
    percent?: unknown; grade?: unknown; verdict?: unknown; summary?: unknown
    summaryHeadline?: unknown; date?: unknown; summaryItems?: SummaryItem[]; facets?: Facet[]
  } | null
  // percent is the ground-truth field the card cannot render without — no percent → no card.
  if (!f || typeof f.percent !== 'number' || Number.isNaN(f.percent)) return null
  const { best, worst } = bestWorstText(f)
  return {
    // Clamp to [0,100] at the SOURCE too (defense-in-depth alongside Lamun's ring clamp): bad data
    // (percent >100 / <0) must never propagate to the arc or the "%" label. NaN already rejected above.
    percent: Math.max(0, Math.min(100, f.percent)),
    grade: typeof f.grade === 'string' ? f.grade : '',
    verdict: (f.verdict === 'good' || f.verdict === 'caution' ? f.verdict : 'neutral'),
    headline: (typeof f.summaryHeadline === 'string' && f.summaryHeadline) || (typeof f.summary === 'string' ? f.summary : ''),
    date: typeof f.date === 'string' ? f.date : '',
    best: { text: best },
    worst: { text: worst },
  }
}

// strengthLabel is REQUIRED (bazi is the only source of the strength band). Missing / non-string /
// WHITESPACE-ONLY → no persona, the ธาตุ line is hidden. The whitespace case matters: a truthy blank
// like '   ' would otherwise render as a bare "·" bullet (Forbidden Bare Bullet — too's find), so we
// .trim() before the truthiness gate and store the trimmed value. This BFF does NOT police the strength
// VOCABULARY — bazi owns that (its home-persona anchor guards it); FE is a faithful transport so it
// never reimplements the vocab (that would drift, same reason we never reimplement gradeForPercent).
// elementTh may be '' (degraded) without voiding the persona — the /v2 wire binds the compute/mascot
// element for the text anyway, so a blank forwarded element is harmless.
export function normalizePersona(persona: unknown): HomePersona | null {
  const p = persona as { elementTh?: unknown; strengthLabel?: unknown } | null
  const strengthLabel = typeof p?.strengthLabel === 'string' ? p.strengthLabel.trim() : ''
  if (!strengthLabel) return null
  return {
    elementTh: typeof p?.elementTh === 'string' ? p.elementTh.trim() : '',
    strengthLabel,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { person, anonId } = (req.body ?? {}) as { person?: FeCalcInput; anonId?: string }
  if (!person) return res.status(200).json({ fortune: null, persona: null }) // no birth data → graceful skip

  // §cache (0022): ผลดวงวันนี้ของคนเดิม ในวันเดียวกัน = เท่ากันเสมอ → คืนทันที ไม่ยิง engine (mergeEngineBirth + bazi) ซ้ำ.
  // key ผูก birth (แก้วันเกิด → miss) + วันที่ Bangkok (ขึ้นวันใหม่ → miss). cache เฉพาะผู้ใช้ที่มี cookie identity.
  const rawId = req.cookies['cookie-mumate-id'] ?? ''
  const hasUser = UUID_RE.test(rawId)
  const p = person as FeCalcInput & { gender?: string | null; place_name?: string | null }
  const cacheKey = [CACHE_VERSION, p.dob ?? '', p.time ?? '', p.gender ?? '', p.place_name ?? '', bkkDateStr(new Date())].join('|')
  if (hasUser) {
    try {
      const cached = rowsOf(await db.execute(
        sql`SELECT payload FROM "bazi_home_fortune_cache" WHERE user_id = ${rawId} AND cache_key = ${cacheKey} LIMIT 1`,
      ))[0]
      if (cached?.payload) return res.status(200).json(cached.payload as Record<string, unknown>)
    } catch {
      /* cache อ่านไม่ได้ (ยังไม่ได้ migrate ฯลฯ) → คำนวณสดตามปกติ */
    }
  }

  try {
    // A1 — persona/ธาตุ ต้องมาจากวันเกิดที่ "แก้ล่าสุด" (engine bazi_user_profile) เหมือนหน้า "ดวงของฉัน"
    // (/api/destiny ก็ mergeEngineBirth). client ส่ง person จาก legacy user row; ถ้ามี cookie identity
    // ให้ทับ dob/time ด้วยค่า engine ก่อนคำนวณ — ไม่งั้นหน้าหลักโชว์ธาตุจากวันเกิดเก่า (legacy) ที่ไม่ตรง
    // ดวงของฉัน และแก้วันเกิดแล้วไม่ตาม. best-effort: ไม่มีแถว engine → คืน person เดิม (ไม่พังจอ).
    let effectivePerson: FeCalcInput = person
    if (hasUser) {
      const merged = await mergeEngineBirth(rawId, person)
      effectivePerson = { ...person, dob: merged.dob ?? person.dob, time: merged.time ?? person.time }
    }
    const { rawInput } = toBaziInput(effectivePerson) // reuse the FE→bazi person mapper (birthDate/time/gender/province)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
    const r = await fetch(`${BAZI_BASE}/api/home`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // anonId only feeds bazi's manifest queries (goals/streak/wallet) — irrelevant to the fortune,
      // but the schema requires a non-empty value; a stable placeholder is fine for the fortune card.
      body: JSON.stringify({ anonId: anonId || 'home-fortune', person: rawInput }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return res.status(200).json({ fortune: null, persona: null }) // bazi 4xx/5xx → graceful
    const data = (await r.json()) as { fortune?: unknown; persona?: unknown }
    const out = { fortune: normalize(data.fortune), persona: normalizePersona(data.persona) }
    // เก็บ cache เฉพาะเมื่อดวงคำนวณได้จริง (ไม่ cache ค่า null จาก engine ขัดข้องชั่วคราว) — best-effort
    if (hasUser && out.fortune) {
      try {
        await db.execute(
          sql`INSERT INTO "bazi_home_fortune_cache" (user_id, cache_key, payload, updated_at)
              VALUES (${rawId}, ${cacheKey}, ${JSON.stringify(out)}::jsonb, now())
              ON CONFLICT (user_id) DO UPDATE SET cache_key = EXCLUDED.cache_key, payload = EXCLUDED.payload, updated_at = now()`,
        )
      } catch {
        /* เขียน cache ไม่ได้ (ยังไม่ได้ migrate ฯลฯ) → ข้าม ไม่กระทบผล */
      }
    }
    return res.status(200).json(out)
  } catch {
    return res.status(200).json({ fortune: null, persona: null }) // timeout/unreachable → graceful
  }
}
