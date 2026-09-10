// BFF proxy for the ดวงฉัน (destiny hub) lane — /api/destiny.
// Browser -> this route (identity from cookie-mumate-id) -> bazi engine, 5 calls in parallel.
// Same discipline as /api/chat/bazi: birth data is resolved SERVER-SIDE from the logged-in
// user's row; the browser never sends birth fields. Engine base = BAZI_BASE_URL.
//
// Engine body shapes differ per route (verified against bazi pdf-dev 2026-09-02):
//   { person: rawInput } → /api/bazi/element-summary, /api/bazi/life-timeline
//   rawInput (flat)      → /api/bazi/strength-score, /api/bazi/domain-power, /api/bazi/calculate
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  toBaziInput,
  userRowToFeCalcInput,
  isBirthProfileComplete,
} from "@/lib/bazi-bridge/input"
import { mergeEngineBirth } from "@/lib/bazi-bridge/engine-birth"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"

  // identity → birth profile (immutable, server-side only)
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  const userId = UUID_RE.test(rawId) ? rawId : ""
  if (!userId) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }

  let feInput: ReturnType<typeof userRowToFeCalcInput>
  let avatarUrl: string | null = null
  try {
    const row = rowsOf(
      await db.execute(sql`SELECT * FROM "user" WHERE user_id = ${userId} LIMIT 1`),
    )[0]
    if (!row) {
      res.status(401).json({ code: "not_authenticated" })
      return
    }
    if (!isBirthProfileComplete(row)) {
      res.status(409).json({ code: "profile_incomplete" })
      return
    }
    // A1: ให้วันเกิดที่ผู้ใช้แก้ล่าสุด (engine bazi_user_profile) ชนะ legacy user.dob ก่อนคำนวณดวง
    const merged = await mergeEngineBirth(userId, row)
    feInput = userRowToFeCalcInput(merged)
    avatarUrl = typeof row.picture_url === "string" ? row.picture_url : null
  } catch {
    res.status(500).json({ error: "profile lookup failed" })
    return
  }

  const { rawInput } = toBaziInput(feInput)

  // cache ต่อผู้ใช้ keyed ด้วยวันเวลาเกิด: ไม่เปลี่ยน = คืน payload เดิม ไม่ยิง engine ซ้ำ (0021_destiny_cache).
  // birthKey ครอบทุก field ที่ป้อน engine (วัน/เวลา/เพศ/จังหวัด) — แก้อันไหนก็ miss แล้วคำนวณใหม่.
  // + เดือนปัจจุบัน: payload มี "วันดีเดือนนี้" (goodDays) → เดือนใหม่ต้อง miss แล้วคำนวณใหม่ ไม่งั้นได้วันดีเก่า.
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const birthKey = [rawInput.birthDate, rawInput.birthTime, rawInput.gender, rawInput.province, currentMonth].join("|")
  try {
    const cached = rowsOf(
      await db.execute(sql`SELECT payload FROM "bazi_destiny_cache" WHERE user_id = ${userId} AND birth_key = ${birthKey} LIMIT 1`),
    )[0]
    if (cached?.payload) {
      // avatarUrl ดึงสดเสมอ (เปลี่ยนได้อิสระจากดวง); ส่วนที่มาจาก engine ใช้ของที่ cache ไว้
      res.status(200).json({ avatarUrl, ...(cached.payload as Record<string, unknown>) })
      return
    }
  } catch {
    /* cache อ่านไม่ได้ → คำนวณสดต่อ (best-effort ไม่ให้จอพัง) */
  }

  // perf: timeout ต่อ engine-call — เดิม 9-call allSettled ไม่มี timeout = ถ้า lane ไหนค้าง (เช่น
  // reading-essence/career-finance) ทั้งหน้าดวงรอไม่จบ. ให้ lane ที่ช้าเกิน 15s ล้ม แล้ว degrade เป็น null
  // (val() คืน null → จอเรนเดอร์เท่าที่มี) แทนที่จะแขวนทั้งคำขอ.
  const CALL_TIMEOUT_MS = 15000
  const post = async (path: string, body: unknown) => {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), CALL_TIMEOUT_MS)
    try {
      const r = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      })
      if (!r.ok) throw new Error(`${path} failed (${r.status})`)
      return await r.json()
    } finally {
      clearTimeout(timer)
    }
  }

  // engine reads in parallel — a failure in one lane degrades that lane to null
  // (the screen renders what it has); only the pillar chart is load-bearing.
  // reading-essence = ใจความ 15 บทเฉพาะที่ใช้ (payload เล็ก แทน newdata-reading ~1MB);
  // career-finance = อาชีพ/การเงิน (用神) แหล่งเดียว; man-vs-day(month) = วันดีเดือนนี้
  const [elementSummary, lifeTimeline, lifePath, strengthScore, domainPower, calculated, essence, careerFin, monthDays] =
    await Promise.allSettled([
      post("/api/bazi/element-summary", { person: rawInput }),
      post("/api/bazi/life-timeline", { person: rawInput }),
      post("/api/bazi/life-path", { person: rawInput }),
      post("/api/bazi/strength-score", rawInput),
      post("/api/bazi/domain-power", rawInput),
      post("/api/bazi/calculate", rawInput),
      post("/api/reading/reading-essence", rawInput),
      post("/api/reading/career-finance", rawInput),
      post("/api/bazi/man-vs-day", { person: rawInput, month: currentMonth }),
    ])

  const val = <T,>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null

  const calculatedState =
    val(calculated) && typeof val(calculated) === "object"
      ? (val(calculated) as { calculatedState?: unknown }).calculatedState ?? null
      : null

  // คำทำนายจาก reading-essence (engine สกัดใจความให้แล้ว); work มาจาก career-finance แหล่งเดียว
  type EssenceResp = { prediction?: { personality?: string | null; habit?: string | null; love?: string | null }; cautions?: string[]; deity?: string | null }
  type CareerResp = { career?: { essence?: string | null } | null }
  const essenceVal = val(essence) as EssenceResp | null
  const careerVal = val(careerFin) as CareerResp | null
  const prediction = {
    personality: essenceVal?.prediction?.personality ?? null,
    habit: essenceVal?.prediction?.habit ?? null,
    love: essenceVal?.prediction?.love ?? null,
    work: careerVal?.career?.essence ?? null, // อาชีพแหล่งเดียว (career-finance)
  }
  const cautions = Array.isArray(essenceVal?.cautions) ? essenceVal!.cautions! : []
  const deity = essenceVal?.deity ?? null

  // วันดีเดือนนี้: top 3 วันคะแนนสูงสุดจาก man-vs-day (เฉพาะใจความ ไม่เอาทั้งเดือน)
  type MonthDay = { date?: string; dayOfMonth?: number; weekday?: string; overallPercent?: number | null; grade?: string | null }
  const monthVal = val(monthDays) as { days?: MonthDay[] } | null
  const goodDays = (Array.isArray(monthVal?.days) ? monthVal!.days! : [])
    .filter((d) => typeof d.overallPercent === "number")
    .sort((a, b) => (b.overallPercent as number) - (a.overallPercent as number))
    .slice(0, 3)
    .map((d) => ({ date: d.date ?? null, dayOfMonth: d.dayOfMonth ?? null, weekday: d.weekday ?? null, percent: d.overallPercent ?? null, grade: d.grade ?? null }))

  // ก้อน engine-derived ที่ cache ได้ (ไม่รวม avatarUrl — ดึงสดทุกครั้ง)
  const engineOut = {
    elementSummary: val(elementSummary),
    lifeTimeline: val(lifeTimeline),
    lifePath: val(lifePath),
    strengthScore: val(strengthScore),
    domainPower: val(domainPower),
    calculatedState,
    prediction,
    cautions: cautions.slice(0, 4),
    deity,
    careerFinance: val(careerFin), // { career:{doElement,avoidElement,occupations,context,essence}, finance:{essence} }
    goodDays, // [{date,dayOfMonth,weekday,percent,grade}] top 3 วันดีเดือนนี้
  }

  // เก็บลง cache (ทับแถวเดิมของ user เมื่อ birthKey เปลี่ยน) — เฉพาะเมื่อดวงคำนวณได้จริง
  // (calculatedState ว่าง = engine ล่มบางส่วน → อย่า cache ผลพร่อง). best-effort ไม่บล็อกคำตอบ.
  if (calculatedState) {
    try {
      await db.execute(
        sql`INSERT INTO "bazi_destiny_cache" (user_id, birth_key, payload, updated_at)
            VALUES (${userId}, ${birthKey}, ${JSON.stringify(engineOut)}::jsonb, now())
            ON CONFLICT (user_id) DO UPDATE SET birth_key = EXCLUDED.birth_key, payload = EXCLUDED.payload, updated_at = now()`,
      )
    } catch {
      /* cache เขียนไม่ได้ → ปล่อยผ่าน (ยังตอบผู้ใช้ได้) */
    }
  }

  res.status(200).json({ avatarUrl, ...engineOut })
}
