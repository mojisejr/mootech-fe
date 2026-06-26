// Production bazi chat modal (#mootech-bazi-chat-lane, sessions: #mootech-chat-sessions).
// Transport: calls the BFF (/api/chat/bazi) which resolves birth SERVER-SIDE from the auth
// cookie — this component sends ONLY the message turns (no birth), so the birthday is
// immutable from the UI. Parses OpenAI-format SSE (choices[].delta.content).
// Persistence: MULTI-SESSION via useChatSessions (localStorage today, DB-swap seam later).
// The view (historyChat) mirrors the active session; turns persist on settle.
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence, type PanInfo } from "framer-motion"
import { SUGGESTED_QUESTIONS } from "@/constants/suggested-questions"
import { useChatSessions } from "@/lib/chat/use-chat-sessions"
import type { ChatSessionMessage } from "@/lib/chat/session-store"
import { Menu, SquarePen, Minimize2, Maximize2, X, Pencil, Trash2, SendHorizontal } from "lucide-react"

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

const toChatItems = (messages: ChatSessionMessage[]): ChatItem[] =>
  messages.map((m) => ({ id: m.id, message: m.message, is_ai: m.is_ai, is_loading: false }))

const toSessionMessages = (items: ChatItem[]): ChatSessionMessage[] =>
  items
    .filter((m) => !m.is_loading)
    .map((m) => ({ id: m.id, message: m.message, is_ai: m.is_ai }))

const relativeTime = (ts: number): string => {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return "เมื่อกี้"
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชม.ที่แล้ว`
  const day = Math.floor(hr / 24)
  return `${day} วันก่อน`
}

const BaziChatModal = ({ userId, onClose }: ComponentProps) => {
  const { sessions, activeId, ready, newSession, switchTo, rename, remove, persist } =
    useChatSessions(userId)

  const [historyChat, setHistoryChat] = useState<ChatItem[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const [isCallAI, setIsCallAI] = useState(false)
  const [needProfile, setNeedProfile] = useState(false)
  const [size, setSize] = useState<Size>("default")
  const [showSessions, setShowSessions] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  // AI_GENERAL credit wallet — counter shown in the chat; refreshed after each turn.
  const [wallet, setWallet] = useState<{
    balance: number
    unlimited: boolean
    enforced: boolean
  } | null>(null)
  const [outOfCredit, setOutOfCredit] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  // true while loading a session's messages into the view, so the persist effect doesn't
  // clobber a session with a hydration-triggered write.
  const hydratingRef = useRef(false)
  const loadedForRef = useRef<string | null>(null)

  // restore last chosen size
  useEffect(() => {
    if (typeof window === "undefined") return
    const savedSize = window.localStorage.getItem(SIZE_KEY)
    if (savedSize && (SIZE_ORDER as string[]).includes(savedSize)) setSize(savedSize as Size)
  }, [])

  // wallet balance — fetched on open, refreshed after each successful turn.
  const refreshBalance = async () => {
    try {
      const r = await fetch("/api/chat/balance")
      if (!r.ok) return
      const b = (await r.json()) as {
        balance?: number
        unlimited?: boolean
        enforced?: boolean
      }
      setWallet({
        balance: b.balance ?? 0,
        unlimited: !!b.unlimited,
        enforced: b.enforced !== false,
      })
      if (b.unlimited || (b.balance ?? 0) > 0) setOutOfCredit(false)
    } catch {
      // best-effort; counter stays hidden on failure
    }
  }

  useEffect(() => {
    refreshBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load the active session's messages into the view once the store is ready (first mount /
  // identity resolved). Switching/new/remove load directly in their handlers.
  useEffect(() => {
    if (!ready || !activeId || loadedForRef.current === activeId) return
    const active = sessions.find((s) => s.id === activeId)
    loadInto(active?.messages ?? [], activeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeId, sessions])

  // persist the active session when a turn settles (not mid-stream, not during hydration)
  useEffect(() => {
    if (!ready || isCallAI || hydratingRef.current) return
    persist(toSessionMessages(historyChat))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyChat, isCallAI, ready])

  const loadInto = (messages: ChatSessionMessage[], id: string) => {
    hydratingRef.current = true
    setHistoryChat(toChatItems(messages))
    setNeedProfile(false)
    loadedForRef.current = id
    queueMicrotask(() => {
      hydratingRef.current = false
    })
  }

  const onNewSession = () => {
    abortRef.current?.abort()
    const id = newSession()
    if (id) loadInto([], id)
    setShowSessions(false)
  }

  const onSwitchSession = (id: string) => {
    if (id === activeId) {
      setShowSessions(false)
      return
    }
    abortRef.current?.abort()
    loadInto(switchTo(id), id)
    setShowSessions(false)
  }

  const onRemoveSession = (id: string) => {
    if (!window.confirm("ลบแชทนี้?")) return
    const remaining = remove(id)
    if (id === activeId && activeId) loadInto(remaining, activeId)
  }

  const commitRename = (id: string) => {
    if (editingTitle.trim()) rename(id, editingTitle)
    setEditingId(null)
    setEditingTitle("")
  }

  const stepSize = (dir: 1 | -1) => {
    setSize((prev) => {
      const i = SIZE_ORDER.indexOf(prev)
      const next = SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, Math.max(0, i + dir))]
      if (typeof window !== "undefined") window.localStorage.setItem(SIZE_KEY, next)
      return next
    })
  }

  const sizeIdx = SIZE_ORDER.indexOf(size)

  // swipe-down-to-dismiss (handle/header region only — never the scrollable body)
  const onHandleDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) onClose()
  }

  const activeSession = sessions.find((s) => s.id === activeId)

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

      // out of credit -> drop the empty AI bubble and surface the top-up CTA strip
      if (res.status === 402) {
        setHistoryChat((list) => list.filter((m) => m.id !== aiId))
        setOutOfCredit(true)
        setWallet((w) => (w ? { ...w, balance: 0 } : w))
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
      // reflect the credit just spent (members/unlimited unaffected)
      void refreshBalance()
    }
  }

  return (
    <>
      {/* backdrop scrim — fades in/out behind the sheet, tap to close */}
      <motion.div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* bottom sheet — spring slide-up; exit slides down + fades */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={
          "fixed z-[9999] bottom-0 left-0 w-full overflow-hidden shadow-2xl flex flex-col" +
          " transition-[height,border-radius] duration-300 ease-out " +
          SIZE_CLASS[size]
        }
      >
        {/* header — ONE gradient strip. Top-center grab-bar + 3-zone controls row, swipe
            DOWN to dismiss. The grab-bar lives INSIDE the header so there's no second
            strip / seam, and the gesture region never overlaps the scrollable body. */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.4}
          onDragEnd={onHandleDragEnd}
          style={{
            background:
              "linear-gradient(180deg, rgba(37,153,174,1) 0%, rgba(58,120,169,1) 100%)",
          }}
          className="flex-none w-full flex flex-col pt-[8px] pb-[18px] cursor-grab active:cursor-grabbing touch-none"
        >
          {/* grab-bar (top-center) */}
          <div className="w-full flex justify-center pb-[8px]">
            <span className="h-[4px] w-[40px] bg-white/70 rounded-full" />
          </div>

          {/* controls — 3 zones: [☰ menu] | [title + subtitle] | [new][size−][size+][✕] */}
          <div className="w-full flex flex-nowrap px-[24px] items-center gap-3">
            {/* LEFT: toggle sessions */}
            <button
              onClick={() => setShowSessions((v) => !v)}
              title="รายการแชท"
              aria-label="รายการแชท"
              className="flex-none cursor-pointer hover:bg-white/15 text-white w-[32px] h-[32px] rounded-full flex items-center justify-center"
            >
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>

            {/* CENTER: title + active session subtitle */}
            <div className="flex-1 min-w-0 flex flex-col items-center text-center">
              <span className="text-white font-medium whitespace-nowrap leading-tight">ซินแส Mumate</span>
              {activeSession ? (
                <span className="text-white/70 text-[11px] truncate max-w-full leading-tight">
                  {activeSession.title}
                </span>
              ) : null}
            </div>

            {/* RIGHT GROUP: new-chat + size controls + close */}
            <div className="flex-none flex items-center gap-1">
              <button
                onClick={onNewSession}
                title="เริ่มแชทใหม่"
                aria-label="เริ่มแชทใหม่"
                className="flex-none cursor-pointer hover:bg-white/15 text-white w-[32px] h-[32px] rounded-full flex items-center justify-center"
              >
                <SquarePen className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                onClick={() => stepSize(-1)}
                disabled={sizeIdx === 0}
                title="ย่อ"
                aria-label="ย่อหน้าต่างแชท"
                className={
                  (sizeIdx === 0 ? "opacity-40 cursor-default" : "cursor-pointer hover:bg-white/15") +
                  " text-white w-[32px] h-[32px] rounded-full flex items-center justify-center"
                }
              >
                <Minimize2 className="w-5 h-5" strokeWidth={2} />
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
                  " text-white w-[32px] h-[32px] rounded-full flex items-center justify-center"
                }
              >
                <Maximize2 className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                onClick={onClose}
                className="text-white cursor-pointer flex-none w-[32px] h-[32px] rounded-full flex items-center justify-center hover:bg-white/15 ml-1"
                aria-label="close"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </motion.div>

      {/* body */}
      <div className="relative w-full flex-1 min-h-0 flex flex-col bg-[#44588B]">
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
            {historyChat.map((item) => {
              // AI is "actively streaming" once tokens arrive (is_loading flips false) while the
              // call is still in flight → show a blinking cursor at the tail.
              const streaming = item.is_ai && !item.is_loading && isCallAI
              return (
                <motion.div
                  key={item.id}
                  initial={{
                    opacity: 0,
                    x: item.is_ai ? -8 : 8,
                    scale: 0.96,
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 26, stiffness: 320 }}
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
                      {item.is_ai && item.is_loading ? (
                        <TypingDots />
                      ) : (
                        <>
                          {item.message}
                          {streaming ? (
                            <span className="inline-block animate-pulse ml-[1px]">▋</span>
                          ) : null}
                        </>
                      )}
                    </span>
                  </div>
                </motion.div>
              )
            })}
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

        {/* credit status — remaining questions / unlimited, with top-up CTA when empty */}
        {wallet && (
          <div className="flex-none w-full px-[24px] pb-[6px] flex items-center justify-between gap-3">
            <span className="text-white/80 text-[12px]">
              {wallet.unlimited
                ? "✨ ถามได้ไม่จำกัด"
                : `เหลือ ${Math.max(0, wallet.balance)} คำถาม`}
            </span>
            {!wallet.unlimited && (outOfCredit || wallet.balance <= 0) && (
              <Link
                href="/package-price?tab=PAYASUSE"
                className="flex-none rounded-full bg-white text-[#3A78A9] text-[12px] font-medium px-3 py-[5px] cursor-pointer hover:bg-white/90 active:scale-95 transition"
              >
                ซื้อเพิ่ม
              </Link>
            )}
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
              aria-label="ส่ง"
              className={
                (isCallAI ? "opacity-50" : "cursor-pointer hover:scale-110 active:scale-95") +
                " flex-none text-white flex items-center justify-center transition-transform"
              }
            >
              <SendHorizontal className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* session panel — slides in from the left; tap a row to switch */}
        <AnimatePresence>
          {showSessions && (
            <motion.div
              key="sessions-panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute inset-0 z-10 flex flex-col bg-[#3a4a78]"
            >
            <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={
                    (s.id === activeId ? "bg-white/10" : "") +
                    " group flex items-center gap-2 px-[24px] py-[12px] hover:bg-white/10"
                  }
                >
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(s.id)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      onBlur={() => commitRename(s.id)}
                      className="flex-1 min-w-0 bg-white/10 text-white text-[14px] rounded-md px-2 py-1 outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => onSwitchSession(s.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {s.id === activeId ? (
                          <span className="w-[6px] h-[6px] rounded-full bg-moumate_blue flex-none" />
                        ) : null}
                        <span className="text-white text-[14px] truncate">{s.title}</span>
                      </div>
                      <span className="text-white/50 text-[11px]">{relativeTime(s.updatedAt)}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(s.id)
                      setEditingTitle(s.title)
                    }}
                    title="เปลี่ยนชื่อ"
                    aria-label="เปลี่ยนชื่อแชท"
                    className="flex-none text-white/60 hover:text-white cursor-pointer w-[28px] h-[28px] rounded-full flex items-center justify-center"
                  >
                    <Pencil className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => onRemoveSession(s.id)}
                    title="ลบ"
                    aria-label="ลบแชท"
                    className="flex-none text-white/60 hover:text-moumate_red cursor-pointer w-[28px] h-[28px] rounded-full flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    </>
  )
}

export default BaziChatModal
