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
    feInput = userRowToFeCalcInput(row)
    avatarUrl = typeof row.picture_url === "string" ? row.picture_url : null
  } catch {
    res.status(500).json({ error: "profile lookup failed" })
    return
  }

  const { rawInput } = toBaziInput(feInput)
  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`${path} failed (${r.status})`)
    return r.json()
  }

  // engine reads in parallel — a failure in one lane degrades that lane to null
  // (the screen renders what it has); only the pillar chart is load-bearing.
  // newdata-reading = คำทำนายพื้นฐานตามดวง (chapters); response ~1MB + ช้า → ยอมให้ degrade เป็น null
  const [elementSummary, lifeTimeline, lifePath, strengthScore, domainPower, calculated, reading] =
    await Promise.allSettled([
      post("/api/bazi/element-summary", { person: rawInput }),
      post("/api/bazi/life-timeline", { person: rawInput }),
      post("/api/bazi/life-path", { person: rawInput }),
      post("/api/bazi/strength-score", rawInput),
      post("/api/bazi/domain-power", rawInput),
      post("/api/bazi/calculate", rawInput),
      post("/api/reading/newdata-reading", rawInput),
    ])

  const val = <T,>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null

  const calculatedState =
    val(calculated) && typeof val(calculated) === "object"
      ? (val(calculated) as { calculatedState?: unknown }).calculatedState ?? null
      : null

  // คำทำนายพื้นฐานตามดวง: ดึง body จาก chapter ตาม id (ดู engine chapter-newdata-map)
  // defensive: shape ไม่ตรง/ว่าง → null แล้วให้ FE fallback ไป element-summary
  type Box = { title?: string; body?: string }
  type Chapter = { id?: string; boxes?: Box[] }
  const readingVal = val(reading) as { chapters?: Chapter[] } | null
  const chapters = Array.isArray(readingVal?.chapters) ? readingVal!.chapters! : []
  const chap = (id: string): Box[] => chapters.find((c) => c?.id === id)?.boxes ?? []
  const bodyText = (boxes: Box[], match?: string): string | null => {
    const pick = match ? boxes.find((b) => b?.title?.includes(match) && b?.body) : boxes.find((b) => b?.body)
    const t = pick?.body ?? boxes.find((b) => b?.body)?.body
    return typeof t === "string" && t.trim() ? t.trim() : null
  }
  const foundation = chap("chart_foundation")
  const prediction = {
    personality: bodyText(foundation),
    habit: bodyText(foundation, "นิสัย"),
    love: bodyText(chap("love_partner")),
    work: bodyText(chap("career_potential")),
  }
  // ข้อควรระวัง: เก็บ box ที่ title มี "ระวัง" จากทุก chapter
  const cautions: string[] = []
  for (const c of chapters) {
    for (const b of c?.boxes ?? []) {
      if (b?.body && b?.title?.includes("ระวัง")) cautions.push(b.body.trim())
    }
  }
  // เทพประจำวัน: ชื่อเทพจาก chapter guardian_deities (box แรก) — title เป็นชื่อเทพ
  const deity = chap("guardian_deities")[0]?.title?.trim() || null

  res.status(200).json({
    avatarUrl,
    elementSummary: val(elementSummary),
    lifeTimeline: val(lifeTimeline),
    lifePath: val(lifePath),
    strengthScore: val(strengthScore),
    domainPower: val(domainPower),
    calculatedState,
    prediction,
    cautions: cautions.slice(0, 4),
    deity,
  })
}
