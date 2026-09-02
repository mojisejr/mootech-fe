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

  // 5 engine reads in parallel — a failure in one lane degrades that lane to null
  // (the screen renders what it has); only the pillar chart is load-bearing.
  const [elementSummary, lifeTimeline, strengthScore, domainPower, calculated] =
    await Promise.allSettled([
      post("/api/bazi/element-summary", { person: rawInput }),
      post("/api/bazi/life-timeline", { person: rawInput }),
      post("/api/bazi/strength-score", rawInput),
      post("/api/bazi/domain-power", rawInput),
      post("/api/bazi/calculate", rawInput),
    ])

  const val = <T,>(r: PromiseSettledResult<T>): T | null =>
    r.status === "fulfilled" ? r.value : null

  const calculatedState =
    val(calculated) && typeof val(calculated) === "object"
      ? (val(calculated) as { calculatedState?: unknown }).calculatedState ?? null
      : null

  res.status(200).json({
    elementSummary: val(elementSummary),
    lifeTimeline: val(lifeTimeline),
    strengthScore: val(strengthScore),
    domainPower: val(domainPower),
    calculatedState,
  })
}
