// Production bazi chat modal (#mootech-bazi-chat-lane).
// Transport: calls the BFF (/api/chat/bazi) which resolves birth SERVER-SIDE from the auth
// cookie — this component sends ONLY the message turns (no birth), so the birthday is
// immutable from the UI. Parses OpenAI-format SSE (choices[].delta.content).
// Persistence: conversation is kept in localStorage keyed per user (survives reload).
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { SUGGESTED_QUESTIONS } from "@/constants/suggested-questions"

type ComponentProps = {
  userId: string
  onClose: () => void
}

type ChatItem = {
  id: string
  message: string
  is_ai: boolean
  is_loading?: boolean
}

// --- resizable sizes: 3 docked + fullscreen. vh/dvh keeps it responsive; max-h caps big screens.
type Size = "compact" | "default" | "tall" | "full"
const SIZE_ORDER: Size[] = ["compact", "default", "tall", "full"]
const SIZE_CLASS: Record<Size, string> = {
  compact: "h-[45vh] max-h-[420px] rounded-t-[24px]",
  default: "h-[62vh] max-h-[560px] rounded-t-[24px]",
  tall: "h-[85vh] max-h-[760px] rounded-t-[24px]",
  full: "h-[100dvh] rounded-none",
}
const SIZE_KEY = "bazi-chat-size"
const historyKey = (userId: string) => `bazi-chat-history:${userId}`

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

const BaziChatModal = ({ userId, onClose }: ComponentProps) => {
  const [historyChat, setHistoryChat] = useState<ChatItem[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const [isCallAI, setIsCallAI] = useState(false)
  const [needProfile, setNeedProfile] = useState(false)
  const [size, setSize] = useState<Size>("default")
  const [hydrated, setHydrated] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // restore last chosen size + per-user conversation history
  useEffect(() => {
    if (typeof window === "undefined") return
    const savedSize = window.localStorage.getItem(SIZE_KEY)
    if (savedSize && (SIZE_ORDER as string[]).includes(savedSize)) setSize(savedSize as Size)
    if (userId) {
      try {
        const raw = window.localStorage.getItem(historyKey(userId))
        if (raw) {
          const parsed = JSON.parse(raw) as ChatItem[]
          if (Array.isArray(parsed)) setHistoryChat(parsed)
        }
      } catch {
        // corrupt entry — start fresh
      }
    }
    setHydrated(true)
  }, [userId])

  // persist conversation (drop in-flight loading bubbles) once hydrated
  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || !userId) return
    const persistable = historyChat.filter((m) => !m.is_loading)
    try {
      window.localStorage.setItem(historyKey(userId), JSON.stringify(persistable))
    } catch {
      // storage full / unavailable — non-fatal
    }
  }, [historyChat, hydrated, userId])

  const stepSize = (dir: 1 | -1) => {
    setSize((prev) => {
      const i = SIZE_ORDER.indexOf(prev)
      const next = SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, Math.max(0, i + dir))]
      if (typeof window !== "undefined") window.localStorage.setItem(SIZE_KEY, next)
      return next
    })
  }

  const sizeIdx = SIZE_ORDER.indexOf(size)

  // "next suggested questions": show the ones not asked yet (so the list shrinks as you go)
  const askedSet = new Set(
    historyChat.filter((m) => !m.is_ai).map((m) => m.message.trim()),
  )
  const remainingSuggestions = SUGGESTED_QUESTIONS.filter((q) => !askedSet.has(q))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [historyChat])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const onClearChat = () => {
    setHistoryChat([])
    setNeedProfile(false)
    if (typeof window !== "undefined" && userId) {
      window.localStorage.removeItem(historyKey(userId))
    }
  }

  const updateAi = (id: string, fn: (prev: ChatItem) => ChatItem) =>
    setHistoryChat((list) => list.map((m) => (m.id === id ? fn(m) : m)))

  const onSubmitChat = async (overrideText?: string) => {
    const msg = (overrideText ?? chatMessage).trim()
    if (!msg || isCallAI) return

    const userItem: ChatItem = { id: nextId(), message: msg, is_ai: false }
    const aiId = nextId()
    const aiItem: ChatItem = { id: aiId, message: "", is_ai: true, is_loading: true }

    // wire messages = full prior turns + this user turn (stateless continuity, no birth)
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
    let finished = false

    const pushToken = (tok: string) => {
      if (!tok) return
      updateAi(aiId, (prev) => ({ ...prev, is_loading: false, message: prev.message + tok }))
    }

    try {
      const res = await fetch("/api/chat/bazi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wireMessages }),
        signal: controller.signal,
      })

      // birth profile not set yet -> prompt the user to fill it in (no streaming)
      if (res.status === 409) {
        setHistoryChat((list) => list.filter((m) => m.id !== aiId && m.id !== userItem.id))
        setNeedProfile(true)
        return
      }

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
    <div
      className={
        "fixed z-[9999] bottom-0 left-0 w-full overflow-hidden shadow-2xl flex flex-col" +
        " transition-[height,border-radius] duration-300 ease-out " +
        SIZE_CLASS[size]
      }
    >
      {/* header */}
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(37,153,174,1) 0%, rgba(58,120,169,1) 100%)",
        }}
        className="flex-none w-full flex flex-nowrap p-[24px] items-center gap-3"
      >
        <span className="text-white font-medium whitespace-nowrap">ซินแส Mumate</span>
        <div className="w-full grow flex justify-center">
          <span className="h-[3px] bg-white w-[50px] rounded-[100px]" />
        </div>
        <div className="flex-none flex items-center gap-1">
          <button
            onClick={onClearChat}
            title="เริ่มแชทใหม่"
            aria-label="เริ่มแชทใหม่"
            className="cursor-pointer hover:bg-white/15 text-white w-[28px] h-[28px] rounded-full flex items-center justify-center text-[15px] leading-none"
          >
            ↻
          </button>
          <button
            onClick={() => stepSize(-1)}
            disabled={sizeIdx === 0}
            title="ย่อ"
            aria-label="ย่อหน้าต่างแชท"
            className={
              (sizeIdx === 0 ? "opacity-40 cursor-default" : "cursor-pointer hover:bg-white/15") +
              " text-white w-[28px] h-[28px] rounded-full flex items-center justify-center text-[18px] leading-none"
            }
          >
            −
          </button>
          <button
            onClick={() => stepSize(1)}
            disabled={sizeIdx === SIZE_ORDER.length - 1}
            title={sizeIdx === SIZE_ORDER.length - 2 ? "เต็มจอ" : "ขยาย"}
            aria-label="ขยายหน้าต่างแชท"
            className={
              (sizeIdx === SIZE_ORDER.length - 1
                ? "opacity-40 cursor-default"
                : "cursor-pointer hover:bg-white/15") +
              " text-white w-[28px] h-[28px] rounded-full flex items-center justify-center text-[16px] leading-none"
            }
          >
            {sizeIdx >= SIZE_ORDER.length - 2 ? "⛶" : "+"}
          </button>
        </div>
        <button
          onClick={onClose}
          className="text-white text-[20px] leading-none cursor-pointer flex-none w-[28px] h-[28px] rounded-full flex items-center justify-center hover:bg-white/15"
          aria-label="close"
        >
          ✕
        </button>
      </div>

      {/* body */}
      <div className="w-full flex-1 min-h-0 flex flex-col bg-[#44588B]">
        <div className="flex-1 min-h-0 overflow-y-auto w-full py-[20px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="w-full flex flex-wrap px-[24px]">
            {needProfile ? (
              <div className="w-full text-white text-[14px] bg-white/10 rounded-[12px] p-4 my-2">
                ยังไม่มีข้อมูลวันเกิดของคุณค่ะ กรอกวันเกิดและเพศก่อนเพื่อให้ซินแสดูดวงให้ได้
                <Link
                  href="/profile/edit"
                  className="inline-block mt-3 rounded-full bg-moumate_blue px-4 py-2 text-[13px] cursor-pointer"
                >
                  ไปกรอกข้อมูลวันเกิด
                </Link>
              </div>
            ) : null}
            {historyChat.map((item) => (
              <div
                key={item.id}
                className={
                  (item.is_ai ? "justify-start" : "justify-end") + " w-full flex flex-wrap"
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

        {/* suggested "next questions" — horizontal slider, hidden scrollbar, responsive */}
        {remainingSuggestions.length > 0 && (
          <div className="flex-none w-full">
            <div className="flex gap-2 overflow-x-auto px-[24px] pb-[10px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {remainingSuggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => onSubmitChat(q)}
                  disabled={isCallAI}
                  title={q}
                  className={
                    (isCallAI
                      ? "opacity-50 cursor-default"
                      : "cursor-pointer hover:bg-white/20 active:scale-[0.98]") +
                    " flex-none whitespace-nowrap rounded-full border border-white/40 bg-white/10" +
                    " text-white/90 text-[13px] py-[7px] px-[14px] transition"
                  }
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

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
