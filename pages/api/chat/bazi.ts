// dev-access lane — BFF proxy for the bazi chat lane.
// Browser -> this route (no token) -> bazi (/api/bazi/calculate then /api/v1/chat/completions).
// The OPEN_WEBUI_API_TOKEN stays server-side only. Streams OpenAI SSE back to the browser.
import type { NextApiRequest, NextApiResponse } from "next"
import { toBaziRawInput, type DevBirthProfile } from "@/dev-access/birth-adapter"

export const config = {
  api: {
    responseLimit: false,
  },
}

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }

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
  const birth = body?.birth
  if (!Array.isArray(messages) || messages.length === 0 || !birth) {
    res.status(400).json({ error: "messages[] and birth are required" })
    return
  }

  const rawInput = toBaziRawInput(birth)

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
