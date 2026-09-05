// features/v2-chat/useBaziChatStream.ts — the bazi-chat transport for /v2/chat.
//
// Adapted from dev-access/bazi-chat-modal.tsx (the dev playground) minus the dev-birth escape
// hatch: production identity is resolved server-side from cookie-mumate-id by /api/chat/bazi,
// so this hook only ever sends `messages[]` and interprets the guard codes the BFF answers with:
//   401 not_authenticated → identity limbo (offer re-login)
//   409 profile_incomplete → birth profile missing (offer /v2/register)
//   402 OUT_OF_LIMIT → the AI_GENERAL wallet is empty (offer the shop)
// The stream is OpenAI-format SSE (choices[].delta.content), stateless continuity — the client
// replays the full turn list each call, exactly like the prototype.
import { useCallback, useEffect, useRef, useState } from "react"

export type ChatRole = "user" | "assistant"

export type ChatTurn = {
  id: string
  role: ChatRole
  content: string
  loading?: boolean
}

/** the BFF guard codes the page needs to react to (everything else stays an inline error bubble) */
export type ChatGuardCode = "not_authenticated" | "profile_incomplete" | "OUT_OF_LIMIT"

let seq = 0
const nextId = () => `m_${++seq}`

export function useBaziChatStream(persona: "mu" | "mi" = "mu") {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [busy, setBusy] = useState(false)
  const [guard, setGuard] = useState<ChatGuardCode | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // persona ล่าสุด (ผู้ใช้สลับได้ระหว่างแชท) — ใช้ ref เพื่อไม่ต้อง re-create send
  const personaRef = useRef(persona)
  useEffect(() => { personaRef.current = persona }, [persona])

  useEffect(() => () => abortRef.current?.abort(), [])

  const update = useCallback((id: string, fn: (prev: ChatTurn) => ChatTurn) => {
    setTurns((list) => list.map((t) => (t.id === id ? fn(t) : t)))
  }, [])

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim()
      if (!msg || busy) return

      const prior = turns.filter((t) => !t.loading)
      const aiId = nextId()
      setTurns((list) => [
        ...list,
        { id: nextId(), role: "user", content: msg },
        { id: aiId, role: "assistant", content: "", loading: true },
      ])
      setBusy(true)
      setGuard(null)

      const controller = new AbortController()
      abortRef.current = controller
      let finished = false

      try {
        const res = await fetch(
          "/api/chat/bazi",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                ...prior.map((t) => ({
                  role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
                  content: t.content,
                })),
                { role: "user", content: msg },
              ],
              persona: personaRef.current,
            }),
            signal: controller.signal,
          },
        )

        if (!res.ok || !res.body) {
          let code: string | undefined
          try {
            code = (await res.json())?.code
          } catch {
            // non-JSON error body — fall through to the inline bubble
          }
          if (res.status === 401 && code === "not_authenticated") setGuard("not_authenticated")
          else if (res.status === 409 && code === "profile_incomplete") setGuard("profile_incomplete")
          else if (res.status === 402 && code === "OUT_OF_LIMIT") setGuard("OUT_OF_LIMIT")

          update(aiId, (prev) => ({
            ...prev,
            loading: false,
            content:
              prev.content ||
              (res.status === 402
                ? "เครดิตคำถาม AI หมดแล้ว เติมเครดิตเพื่อถามต่อได้เลย"
                : "เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะคะ"),
          }))
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (!finished) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n\n")
          buffer = parts.pop() ?? ""
          for (const part of parts) {
            const dataLines = part
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trim())
            for (const d of dataLines) {
              if (d === "[DONE]") {
                finished = true
                break
              }
              try {
                const j = JSON.parse(d)
                const tok: string | undefined = j?.choices?.[0]?.delta?.content
                if (typeof tok === "string" && tok) {
                  update(aiId, (prev) => ({ ...prev, content: prev.content + tok }))
                }
              } catch {
                // keep-alives / non-JSON lines are expected
              }
            }
            if (finished) break
          }
        }

        update(aiId, (prev) => ({
          ...prev,
          loading: false,
          content: prev.content || "ไม่ได้รับคำตอบจากมิว ลองใหม่อีกครั้งนะคะ",
        }))
      } catch (err: unknown) {
        const aborted = (err as { name?: string })?.name === "AbortError"
        update(aiId, (prev) => ({
          ...prev,
          loading: false,
          content: prev.content || (aborted ? "ยกเลิกแล้ว" : "การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้งนะคะ"),
        }))
      } finally {
        setBusy(false)
      }
    },
    [busy, turns, update],
  )

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setTurns([])
    setGuard(null)
    setBusy(false)
  }, [])

  return { turns, busy, guard, send, clear }
}
