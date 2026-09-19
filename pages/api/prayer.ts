// BFF proxy for the prayer generator (คำอธิษฐาน) lane.
// Browser -> this route (no birth) -> bazi (/api/prayer). Birth is resolved SERVER-SIDE from the
// logged-in user's row (cookie-mumate-id) so the browser can't spoof a birthday, same rule as the
// chat lane. If the user isn't logged in / has no birth, we still generate a prayer "by topic"
// (no 用神 layer) — a prayer never needs a chart to exist.
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  toBaziInput,
  userRowToFeCalcInput,
  isBirthProfileComplete,
  type FeCalcInput,
} from "@/lib/bazi-bridge/input"
import { mergeEngineBirth } from "@/lib/bazi-bridge/engine-birth"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

const TOPICS = new Set(["love", "wealth", "career", "health", "study", "fixluck", "general"])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"

  const body = req.body as {
    topic?: string
    placeName?: string
    deity?: string
    dateTimeLabel?: string
  }
  const topic = typeof body?.topic === "string" && TOPICS.has(body.topic) ? body.topic : "general"

  // resolve birth SERVER-SIDE (immutable) — optional: prayer works without it
  let feInput: FeCalcInput | null = null
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  const userId = UUID_RE.test(rawId) ? rawId : ""
  if (userId) {
    try {
      const row = rowsOf(await db.execute(sql`SELECT * FROM "user" WHERE user_id = ${userId} LIMIT 1`))[0]
      if (row && isBirthProfileComplete(row)) {
        feInput = userRowToFeCalcInput(await mergeEngineBirth(userId, row))
      }
    } catch {
      // ดึงดวงไม่ได้ → สร้างพร "ตามเรื่อง" ล้วน (ไม่มีชั้น用神)
    }
  }

  const birth = feInput ? toBaziInput(feInput).rawInput : undefined

  try {
    const upstream = await fetch(`${base}/api/prayer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        birth,
        placeName: typeof body?.placeName === "string" ? body.placeName.slice(0, 120) : undefined,
        deity: typeof body?.deity === "string" ? body.deity.slice(0, 120) : undefined,
        dateTimeLabel: typeof body?.dateTimeLabel === "string" ? body.dateTimeLabel.slice(0, 120) : undefined,
      }),
    })
    const json = await upstream.json().catch(() => null)
    if (!upstream.ok || !json) {
      res.status(502).json({ error: `prayer generate failed (${upstream.status})` })
      return
    }
    res.status(200).json(json)
  } catch {
    res.status(502).json({ error: "prayer upstream unreachable" })
  }
}
