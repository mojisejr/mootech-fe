// BFF proxy for the bazi chat lane (#mootech-bazi-chat-lane).
// Browser -> this route (no token, no birth) -> bazi (/api/bazi/calculate then
// /api/v1/chat/completions). The OPEN_WEBUI_API_TOKEN stays server-side only.
//
// IDENTITY & IMMUTABILITY: birth data is resolved SERVER-SIDE from the logged-in user's row,
// keyed by the auth cookie (cookie-mumate-id, a uuid). The browser NEVER sends birth fields,
// so a user can't change their birthday by typing in chat. Streams OpenAI SSE back.
//
// DEV FALLBACK: outside production only, if there is no resolvable user row, we accept a
// body.birth profile so the dev playground (localStorage birth) keeps working. This path is
// impossible in a production build.
import type { NextApiRequest, NextApiResponse } from "next"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  toBaziInput,
  userRowToFeCalcInput,
  isBirthProfileComplete,
  type FeCalcInput,
} from "@/lib/bazi-bridge/input"
import type { DevBirthProfile } from "@/dev-access/birth-adapter"
import {
  fetchBalance,
  consumeCredit,
  creditEnforced,
} from "@/lib/credit/wallet-client"

export const config = {
  api: {
    responseLimit: false,
  },
}

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const rowsOf = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? [])

function devBirthToFeCalcInput(b: DevBirthProfile): FeCalcInput {
  return {
    dob: b.dob,
    time: b.isRememberTime ? b.time : "",
    gender: b.gender,
    place_name: null,
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }

  const token = process.env.OPEN_WEBUI_API_TOKEN
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  if (!token) {
    res.status(500).json({ error: "OPEN_WEBUI_API_TOKEN is not configured" })
    return
  }

  const body = req.body as { messages?: ChatMessage[]; birth?: DevBirthProfile; persona?: string }
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages[] is required" })
    return
  }
  // ลูกค้าเลือกคุยกับใคร: mu=เสี่ยวมู่(ชาย) · mi=เสี่ยวมี่(หญิง) — ส่งต่อให้ engine รู้
  const persona: "mu" | "mi" = body?.persona === "mi" ? "mi" : "mu"

  // 0) resolve birth SERVER-SIDE from the logged-in identity (immutable)
  let feInput: FeCalcInput | null = null
  const rawId = req.cookies["cookie-mumate-id"] ?? ""
  const userId = UUID_RE.test(rawId) ? rawId : ""
  if (userId) {
    try {
      const row = rowsOf(
        await db.execute(sql`SELECT * FROM "user" WHERE user_id = ${userId} LIMIT 1`),
      )[0]
      if (row) {
        if (!isBirthProfileComplete(row)) {
          res.status(409).json({ code: "profile_incomplete" })
          return
        }
        feInput = userRowToFeCalcInput(row)
      }
    } catch {
      res.status(500).json({ error: "profile lookup failed" })
      return
    }
  }

  // dev playground fallback (never reachable in production)
  if (!feInput && process.env.NODE_ENV !== "production" && body.birth) {
    feInput = devBirthToFeCalcInput(body.birth)
  }
  if (!feInput) {
    res.status(401).json({ code: "not_authenticated" })
    return
  }

  // Credit gate — AI_GENERAL wallet (shared with the old Mate chat). Members are
  // unlimited. The dev playground path (no resolvable userId) is exempt by design.
  let walletUnlimited = false
  if (userId) {
    const bal = await fetchBalance(userId)
    if (bal) {
      walletUnlimited = bal.unlimited
      if (creditEnforced() && !bal.unlimited && (bal.balance ?? 0) <= 0) {
        res.status(402).json({
          code: "OUT_OF_LIMIT",
          message: "เครดิตคำถาม AI หมดแล้ว กรุณาเติมเครดิตเพื่อถามต่อ",
        })
        return
      }
    }
  }

  const { rawInput } = toBaziInput(feInput)

  // 1) deterministic chart calculation (public bazi endpoint)
  let calculatedState: unknown
  try {
    const calcRes = await fetch(`${base}/api/bazi/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawInput),
    })
    if (!calcRes.ok) {
      res.status(502).json({ error: `bazi calculate failed (${calcRes.status})` })
      return
    }
    const calcJson = (await calcRes.json()) as { calculatedState?: unknown }
    calculatedState = calcJson.calculatedState
    if (!calculatedState) {
      res.status(502).json({ error: "bazi calculate returned no calculatedState" })
      return
    }
  } catch {
    res.status(502).json({ error: "bazi calculate unreachable" })
    return
  }

  // 2) chat completion (authenticated, streamed)
  let upstream: Response
  try {
    upstream = await fetch(`${base}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages,
        baziConsult: { rawInput, calculatedState },
        persona,
      }),
    })
  } catch {
    res.status(502).json({ error: "bazi chat unreachable" })
    return
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "")
    res
      .status(upstream.status || 502)
      .json({ error: `bazi chat failed (${upstream.status})`, detail: detail.slice(0, 300) })
    return
  }

  // stream SSE straight through
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  })
  // flush headers so the client starts reading immediately
  ;(res as unknown as { flushHeaders?: () => void }).flushHeaders?.()

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  // "answer success" = stream completed AND produced non-empty content.
  let gotContent = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      if (text.trim().length > 0) gotContent = true
      res.write(text)
      ;(res as unknown as { flush?: () => void }).flush?.()
    }
  } catch {
    // client disconnected or upstream aborted — fall through to end()
  } finally {
    res.end()
  }

  // Deduct exactly one credit only on a successful, non-empty answer. Members are
  // unlimited and never charged. Best-effort: a failed consume never affects the
  // already-delivered answer. (Idempotency across client retries is handled by the
  // BE wallet floor at 0; a per-turn key is a future refinement.)
  if (userId && gotContent && !walletUnlimited) {
    await consumeCredit(userId)
  }
}
