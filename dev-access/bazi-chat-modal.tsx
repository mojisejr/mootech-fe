// dev-access lane — bazi chat modal.
// Presentation copied from components/modal-ai-chat-general-streaming.tsx (visual grammar),
// but transport is rewritten: calls the BFF (/api/chat/bazi) and parses OpenAI-format SSE
// (choices[].delta.content), holding the message array client-side (stateless continuity).
import { useEffect, useRef, useState } from "react"
import type { DevBirthProfile } from "./birth-adapter"

type ComponentProps = {
  birth: DevBirthProfile
  onClose: () => void
}

type ChatItem = {
  id: string
  message: string
  is_ai: boolean
  is_loading?: boolean
}

const TypingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.2s]" />
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.1s]" />
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce" />
    <span className="ml-2 text-white/90 text-[12px]">ซินแสกำลังตอบ...</span>
  </span>
)

let idSeq = 0
const nextId = () => `m_${++idSeq}`

const BaziChatModal = ({ birth, onClose }: ComponentProps) => {
  const [historyChat, setHistoryChat] = useState<ChatItem[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const [isCallAI, setIsCallAI] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [historyChat])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const updateAi = (id: string, fn: (prev: ChatItem) => ChatItem) =>
    setHistoryChat((list) => list.map((m) => (m.id === id ? fn(m) : m)))

  const onSubmitChat = async () => {
    const msg = chatMessage.trim()
    if (!msg || isCallAI) return

    const userItem: ChatItem = { id: nextId(), message: msg, is_ai: false }
    const aiId = nextId()
    const aiItem: ChatItem = { id: aiId, message: "", is_ai: true, is_loading: true }

    // wire messages = full prior turns + this user turn (stateless continuity)
    const wireMessages = [
      ...historyChat
        .filter((m) => !(m.is_ai && m.is_loading))
        .map((m) => ({
          role: m.is_ai ? ("assistant" as const) : ("user" as const),
          content: m.message,
        })),
      { role: "user" as const, content: msg },
    ]

    setHistoryChat((list) => [...list, userItem, aiItem])
    setChatMessage("")
    setIsCallAI(true)

    const controller = new AbortController()
    abortRef.current = controller
    let started = false
    let finished = false

    const pushToken = (tok: string) => {
      if (!tok) return
      updateAi(aiId, (prev) => ({
        ...prev,
        is_loading: started ? false : false,
        message: prev.message + tok,
      }))
      started = true
    }

    try {
      const res = await fetch("/api/chat/bazi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wireMessages, birth }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "")
        updateAi(aiId, (prev) => ({
          ...prev,
          is_loading: false,
          message: `เกิดข้อผิดพลาด (${res.status}) ${detail.slice(0, 120)}`,
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
              if (typeof tok === "string") pushToken(tok)
            } catch {
              // ignore keep-alives / non-JSON lines
            }
          }
          if (finished) break
        }
      }

      // if nothing streamed, surface a fallback so the bubble isn't stuck loading
      updateAi(aiId, (prev) => ({
        ...prev,
        is_loading: false,
        message: prev.message || "ไม่ได้รับคำตอบจากซินแส ลองใหม่อีกครั้งนะคะ",
      }))
    } catch (err: unknown) {
      const aborted = (err as { name?: string })?.name === "AbortError"
      updateAi(aiId, (prev) => ({
        ...prev,
        is_loading: false,
        message: prev.message || (aborted ? "ยกเลิกแล้ว" : "การเชื่อมต่อมีปัญหา"),
      }))
    } finally {
      setIsCallAI(false)
    }
  }

  return (
    <div className="fixed z-[9999] bottom-0 left-0 w-full h-[410px] rounded-t-[24px] overflow-hidden shadow-2xl flex flex-col">
      {/* header */}
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(37,153,174,1) 0%, rgba(58,120,169,1) 100%)",
        }}
        className="flex-none w-full flex flex-nowrap p-[24px] items-center"
      >
        <span className="text-white font-medium">ซินแส Bazi (dev)</span>
        <div className="w-full grow flex justify-center">
          <span className="h-[3px] bg-white w-[50px] rounded-[100px]" />
        </div>
        <button
          onClick={onClose}
          className="text-white text-[20px] leading-none cursor-pointer flex-none"
          aria-label="close"
        >
          ✕
        </button>
      </div>

      {/* body */}
      <div className="w-full flex-1 min-h-0 flex flex-col bg-[#44588B]">
        <div className="flex-1 min-h-0 overflow-y-auto w-full py-[20px]">
          <div className="w-full flex flex-wrap px-[24px]">
            <div className="w-full text-white/70 text-[12px] mb-2">
              ดวงจาก: {birth.dob} {birth.time || "(ไม่ระบุเวลา → 12:00)"} · {birth.gender}
            </div>
            {historyChat.map((item) => (
              <div
                key={item.id}
                className={
                  (item.is_ai ? "justify-start" : "justify-end") +
                  " w-full flex flex-wrap"
                }
              >
                <div
                  className={
                    (item.is_ai ? "justify-start" : "justify-end") +
                    " w-3/4 flex flex-wrap my-2 text-white whitespace-pre-line"
                  }
                >
                  <span
                    className={
                      (item.is_ai
                        ? "bg-moumate_blue rounded-[8px] py-[8px] px-[12px]"
                        : "bg-[#4B4F88CC] rounded-[8px] py-[8px] px-[12px]") + " flex-wrap"
                    }
                  >
                    {item.is_ai && item.is_loading ? <TypingDots /> : item.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* input */}
        <div className="flex-none h-[80px] w-full flex items-center px-[24px]">
          <div
            style={{
              background:
                "linear-gradient(268.72deg, rgba(174,240,243,0.2) 1.75%, rgba(159,184,232,0.2) 49.8%, rgba(251,217,226,0.2) 97.85%)",
            }}
            className="w-full py-[12px] px-[20px] rounded-[100px] border-white border-[2px] flex items-center gap-3"
          >
            <input
              type="text"
              disabled={isCallAI}
              value={chatMessage}
              placeholder={isCallAI ? "กำลังรอคำตอบ..." : "พิมพ์คำถาม..."}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  onSubmitChat()
                }
              }}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 min-w-0 text-white text-[16px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 placeholder:text-white/70"
            />
            <button
              onClick={() => onSubmitChat()}
              disabled={isCallAI}
              className={
                (isCallAI ? "opacity-50" : "cursor-pointer") +
                " flex-none text-white text-[14px] font-medium"
              }
            >
              ส่ง
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BaziChatModal
