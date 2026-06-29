// Glass Box console stream hook (#bazi-chat-anti-drift v2, Track B2).
// Mirrors lib/chat/use-bazi-chat-stream but for the key-gated ซินแส console: it posts a TEST
// birth to the isolated BFF (/api/glass-box/chat) and surfaces BOTH channels — the answer tokens
// (onToken) and the Glass Box trace frame (onTrace) — by reusing the shared pure SSE parser.
import { useCallback, useRef } from "react"
import type { DevBirthProfile } from "@/dev-access/birth-adapter"
import {
  parseSseBuffer,
  type GlassBoxTrace,
  type WireMessage,
} from "@/lib/chat/use-bazi-chat-stream"

export type { GlassBoxTrace } from "@/lib/chat/use-bazi-chat-stream"

export type GlassBoxStreamOutcome =
  | { type: "done"; text: string; trace: GlassBoxTrace | null }
  | { type: "error"; status?: number; message: string }
  | { type: "aborted" }

export type UseGlassBoxStream = {
  streamChat: (
    messages: WireMessage[],
    birth: DevBirthProfile,
    onToken: (token: string) => void,
    onTrace: (trace: GlassBoxTrace) => void,
  ) => Promise<GlassBoxStreamOutcome>
  abort: () => void
}

export function useGlassBoxStream(): UseGlassBoxStream {
  const abortRef = useRef<AbortController | null>(null)

  const streamChat = useCallback(
    async (
      messages: WireMessage[],
      birth: DevBirthProfile,
      onToken: (token: string) => void,
      onTrace: (trace: GlassBoxTrace) => void,
    ): Promise<GlassBoxStreamOutcome> => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/glass-box/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, birth }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "")
          return { type: "error", status: res.status, message: detail.slice(0, 160) }
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let text = ""
        let trace: GlassBoxTrace | null = null
        let finished = false

        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parsed = parseSseBuffer(buffer)
          buffer = parsed.remainder
          for (const t of parsed.traces) {
            trace = t
            onTrace(t)
          }
          for (const tok of parsed.tokens) {
            text += tok
            onToken(tok)
          }
          if (parsed.done) {
            finished = true
            break
          }
        }

        return { type: "done", text, trace }
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
