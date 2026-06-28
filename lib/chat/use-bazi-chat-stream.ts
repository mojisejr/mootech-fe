// Chat transport hook (#mootech-chat-mobile-ux, Phase 2).
// Unfuses the SSE transport from the chat UI: owns the fetch to the BFF (/api/chat/bazi),
// the OpenAI-format SSE parse loop, status branching (200/409/402/error), and abort.
// The UI keeps owning bubbles/state — it calls streamChat(messages, onToken) and reacts to the
// typed outcome. Birth stays server-side (we send ONLY message turns — birthday-immutable vow).
import { useCallback, useRef } from "react"

export type WireMessage = {
  role: "user" | "assistant" | "system"
  content: string
}

export type ChatStreamOutcome =
  | { type: "done"; text: string } // streamed assistant text (may be "" -> caller shows fallback)
  | { type: "profile_incomplete" } // 409 — birth not set; UI shows the profile CTA
  | { type: "out_of_credit" } // 402 — wallet empty; UI shows the top-up CTA
  | { type: "error"; status?: number; message: string }
  | { type: "aborted" } // caller aborted (session switch / unmount)

// Pure SSE frame parser — exported for deterministic tests. Splits on the SSE event
// delimiter ("\n\n"), reads `data:` lines, JSON-parses each, pulls choices[0].delta.content,
// and detects the [DONE] sentinel. Returns the trailing incomplete chunk as `remainder` so the
// caller can prepend it to the next network chunk. Keep-alives / non-JSON lines are ignored.
export function parseSseBuffer(buffer: string): {
  tokens: string[]
  done: boolean
  remainder: string
} {
  const tokens: string[] = []
  let done = false
  const parts = buffer.split("\n\n")
  const remainder = parts.pop() ?? ""

  for (const part of parts) {
    const dataLines = part
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
    for (const d of dataLines) {
      if (d === "[DONE]") {
        done = true
        break
      }
      try {
        const j = JSON.parse(d) as { choices?: Array<{ delta?: { content?: unknown } }> }
        const tok = j?.choices?.[0]?.delta?.content
        if (typeof tok === "string") tokens.push(tok)
      } catch {
        // keep-alive / non-JSON line — ignore
      }
    }
    if (done) break
  }

  return { tokens, done, remainder }
}

export type UseBaziChatStream = {
  /** POST the turns to the BFF and stream the reply; onToken fires per delta. */
  streamChat: (
    messages: WireMessage[],
    onToken: (token: string) => void,
  ) => Promise<ChatStreamOutcome>
  /** abort the in-flight stream (e.g. before switching session or on unmount) */
  abort: () => void
}

export function useBaziChatStream(): UseBaziChatStream {
  const abortRef = useRef<AbortController | null>(null)

  const streamChat = useCallback(
    async (
      messages: WireMessage[],
      onToken: (token: string) => void,
    ): Promise<ChatStreamOutcome> => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/chat/bazi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        })

        if (res.status === 409) return { type: "profile_incomplete" }
        if (res.status === 402) return { type: "out_of_credit" }

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "")
          return { type: "error", status: res.status, message: detail.slice(0, 120) }
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let text = ""
        let finished = false

        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSseBuffer(buffer)
          buffer = parsed.remainder
          for (const tok of parsed.tokens) {
            text += tok
            onToken(tok)
          }
          if (parsed.done) {
            finished = true
            break
          }
        }

        return { type: "done", text }
      } catch (err: unknown) {
        const aborted = (err as { name?: string })?.name === "AbortError"
        if (aborted) return { type: "aborted" }
        return {
          type: "error",
          message: err instanceof Error ? err.message : "network error",
        }
      }
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { streamChat, abort }
}
