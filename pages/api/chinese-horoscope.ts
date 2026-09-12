// Hybrid BFF for /my-destiny (#my-destiny-bazi-engine-swap, Zone 1+2).
// Browser -> this route (same-origin) -> (1) be NestJS stored chart, then (2) bazi
// consumer readings overlaid onto 3 cards + love + work. UI shape is byte-for-byte the
// same `{ data: <chart> }`; only the text of those sections changes. Everything else
// (8 pillars, element grid, 5-power, mascot, occupations, colors, ...) stays be.
//
// Determinism: bazi consumer mode is pure compute (no LLM), so we compute live — no DB,
// no migration. If bazi is unreachable or a section fails to map, that section KEEPS its
// be value (graceful, page never breaks).
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { bkkDateStr } from "@/lib/usage-core"
import { mapChartFoundation } from "@/lib/destiny/map-chart-foundation"
import { mapLove, mapWork } from "@/lib/destiny/map-love-work"
import { mapBeCareful } from "@/lib/destiny/map-be-careful"

// be NestJS base (same guardrailed env as the rest of the calc-family). Never old-prod.
const BE_ENDPOINT = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000"
if (/bazichart\.mumate\.co/i.test(BE_ENDPOINT)) {
  throw new Error(`[GUARDRAIL] NEXT_PUBLIC_BACKEND_URL points at old prod (${BE_ENDPOINT}).`)
}
// our bazi engine (reading seams are public/no-token; same channel as the chat BFF)
const BAZI_BASE = process.env.BAZI_BASE_URL || "http://localhost:3000"

const BAZI_TIMEOUT_MS = 12000
const BE_TIMEOUT_MS = 12000 // BE fetch เดิมไม่มี timeout → BE ช้า = ค้างทั้ง request; ใส่กันค้าง

// §cache (0024) — overlays 4 หัวข้อ birth-deterministic → เก็บไว้ ข้ามการยิง bazi ซ้ำ (ดู migration 0024)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CACHE_VERSION = "v1" // bump เมื่อเปลี่ยนรูป payload { cf, love, career, turning }
const rowsOf = (r: unknown): Record<string, unknown>[] =>
  (Array.isArray(r) ? r : (r as { rows?: Record<string, unknown>[] })?.rows ?? []) as Record<string, unknown>[]

async function baziConsumerTopic(topicId: string, rawInput: object): Promise<any | null> {
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
    const res = await fetch(`${BAZI_BASE}/api/reading/topic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, mode: "consumer", rawInput }),
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function toRawInput(chart: any): object | null {
  const birthDate = chart?.dob
  if (!birthDate) return null
  const gender = String(chart?.gender || "").toUpperCase() === "FEMALE" ? "female" : "male"
  return {
    birthDate,
    birthTime: chart?.time || "",
    gender,
    province: chart?.place_name || "Bangkok",
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.query.userId as string) || ""
  const code = (req.query.code as string) || ""

  // 1) be stored chart (compute-once result). Proxy its response/errors unchanged.
  let beJson: any
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BE_TIMEOUT_MS)
    const beRes = await fetch(
      `${BE_ENDPOINT}/chinese-horoscope?userId=${encodeURIComponent(userId)}&code=${encodeURIComponent(code)}`,
      { headers: { "Content-Type": "application/json" }, signal: ac.signal },
    )
    clearTimeout(timer)
    beJson = await beRes.json().catch(() => null)
    if (!beRes.ok || !beJson || !beJson.data) {
      return res.status(beRes.ok ? 200 : beRes.status).json(beJson ?? { error: "no data" })
    }
  } catch {
    return res.status(502).json({ error: "chinese-horoscope upstream unreachable" })
  }

  const chart = beJson.data
  const rawInput = toRawInput(chart)
  // No birth -> can't ground bazi; return be chart untouched (graceful).
  if (!rawInput || !chart.analytic) return res.status(200).json({ data: chart })

  // 2) bazi consumer readings — cache overlays (0024): birth-deterministic → hit = ข้ามการยิง 4 หัวข้อ
  //    (แต่ละหัวข้อคำนวณ chart เดิมซ้ำฝั่ง engine, คือต้นเหตุ ~9s). key ผูก birth (จาก BE — แก้วันเกิด→BE
  //    คืน birth ใหม่→key เปลี่ยน→miss) + เดือน(Bangkok). identity = userId (uuid). best-effort ทั้ง read/write.
  const ri = rawInput as { birthDate?: string; birthTime?: string; gender?: string; province?: string }
  const canCache = UUID_RE.test(userId)
  const cacheKey = [CACHE_VERSION, ri.birthDate ?? "", ri.birthTime ?? "", ri.gender ?? "", ri.province ?? "", bkkDateStr(new Date()).slice(0, 7)].join("|")

  let cf: any = null
  let love: any = null
  let career: any = null
  let turning: any = null
  let fromCache = false
  if (canCache) {
    try {
      const row = rowsOf(await db.execute(
        sql`SELECT payload FROM "bazi_chinese_horoscope_cache" WHERE user_id = ${userId} AND cache_key = ${cacheKey} LIMIT 1`,
      ))[0]
      const pay = row?.payload as { cf?: any; love?: any; career?: any; turning?: any } | undefined
      if (pay) {
        cf = pay.cf ?? null
        love = pay.love ?? null
        career = pay.career ?? null
        turning = pay.turning ?? null
        fromCache = true
      }
    } catch {
      /* cache อ่านไม่ได้ (ยังไม่ได้ migrate ฯลฯ) → คำนวณสด */
    }
  }

  if (!fromCache) {
    ;[cf, love, career, turning] = await Promise.all([
      baziConsumerTopic("chart_foundation", rawInput),
      baziConsumerTopic("love_partner", rawInput),
      baziConsumerTopic("career_potential", rawInput),
      baziConsumerTopic("turning_points", rawInput),
    ])
    // เก็บเฉพาะเมื่อได้ผลจริงอย่างน้อย 1 หัวข้อ (ไม่ cache null ทั้งชุดตอน bazi ล่มชั่วคราว) — best-effort
    if (canCache && (cf || love || career || turning)) {
      try {
        await db.execute(
          sql`INSERT INTO "bazi_chinese_horoscope_cache" (user_id, cache_key, payload, updated_at)
              VALUES (${userId}, ${cacheKey}, ${JSON.stringify({ cf, love, career, turning })}::jsonb, now())
              ON CONFLICT (user_id) DO UPDATE SET cache_key = EXCLUDED.cache_key, payload = EXCLUDED.payload, updated_at = now()`,
        )
      } catch {
        /* เขียน cache ไม่ได้ (ยังไม่ได้ migrate ฯลฯ) → ข้าม ไม่กระทบผล */
      }
    }
  }

  // 3) overlay — each guarded; on null we keep the be value.
  const a = chart.analytic
  const cfOverlay = mapChartFoundation(cf)
  if (cfOverlay) {
    if (a.base) a.base.description = cfOverlay.baseDescription
    if (a.habit) a.habit.note = cfOverlay.habitNote
    const keepElement = Array.isArray(a.behaviors) && a.behaviors[0]?.element ? a.behaviors[0].element : ""
    a.behaviors = [{ element: keepElement, behavior: cfOverlay.behaviorText }]
  }
  const loveOverlay = mapLove(love)
  if (loveOverlay && a.love) a.love.note = loveOverlay.note
  const workOverlay = mapWork(career)
  if (workOverlay && a.prediction_work) a.prediction_work.desc = workOverlay.desc
  // Zone 3 — ข้อพึงระวัง: real clash timeline (พ.ศ./age/ชง·ฮะ) deeper than be's
  // day-element lookup. occupations stays be (bazi's career occupation text has a
  // disposition-sentence bleed we can't fix read-only — see plan P0 NO-GO).
  const beCarefulOverlay = mapBeCareful(turning)
  if (beCarefulOverlay && a.be_careful) a.be_careful.description = beCarefulOverlay.description

  return res.status(200).json({ data: chart })
}
