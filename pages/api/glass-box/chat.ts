// Glass Box console BFF (#bazi-chat-anti-drift v2, Track B2).
//
// Deliberately ISOLATED from the production chat BFF (/api/chat/bazi). This route is the
// key-gated ซินแส trace console, so it differs on purpose:
//   - birth comes from a TEST profile in the body (never a real customer's user row)
//   - it always asks bazi for the Glass Box trace (forwards `x-glass-box: 1`)
//   - it skips the credit wallet (a test console must not charge anyone)
//   - it streams the upstream SSE straight through, so the trace frame + answer flow untouched
// PDPA-safe by construction: no real-user lookup, no persistence. Both this route and the
// /glass-box page are locked behind GLASS_BOX_KEY in middleware (cookie `gb_access`).
import type { NextApiRequest, NextApiResponse } from "next"
import { toBaziInput, type FeCalcInput } from "@/lib/bazi-bridge/input"
import type { DevBirthProfile } from "@/dev-access/birth-adapter"

export const config = {
  api: {
    responseLimit: false,
  },
}

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }

// Mirror the prod BFF's dev-birth mapping so the upstream contract is identical: the only
// difference is the source (test profile here vs. authenticated user row in prod).
function testBirthToFeCalcInput(b: DevBirthProfile): FeCalcInput {
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

  const body = req.body as { messages?: ChatMessage[]; birth?: DevBirthProfile }
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages[] is required" })
    return
  }
  if (!body.birth?.dob) {
    res.status(400).json({ error: "test birth (birth.dob) is required for the Glass Box console" })
    return
  }

  const { rawInput } = toBaziInput(testBirthToFeCalcInput(body.birth))

  // 1) deterministic chart calculation (public bazi endpoint) — same path as prod
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

  // 2) chat completion with the Glass Box trace flag ON (authenticated, streamed)
  let upstream: Response
  try {
    upstream = await fetch(`${base}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-glass-box": "1",
      },
      body: JSON.stringify({
        messages,
        baziConsult: { rawInput, calculatedState },
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

  // stream SSE straight through — the trace frame rides in front of the answer tokens, untouched
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  })
  ;(res as unknown as { flushHeaders?: () => void }).flushHeaders?.()

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
      ;(res as unknown as { flush?: () => void }).flush?.()
    }
  } catch {
    // client disconnected or upstream aborted — fall through to end()
  } finally {
    res.end()
  }
}
