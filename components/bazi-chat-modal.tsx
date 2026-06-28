// Production bazi chat modal — FULL-SCREEN mobile-first rebuild (#mootech-chat-mobile-ux).
// Mobile = full-screen conversation (100dvh + safe-area) with a composer that rides ABOVE the
// on-screen keyboard via VisualViewport (fixes the "กดส่งไม่ไป" bug). Desktop (md+) = docked
// widget bottom-right. Transport is the useBaziChatStream hook; sessions/persistence stay in
// useChatSessions (localStorage, per-user — bazi_chat_histories untouched). Birthday immutable:
// we send ONLY message turns; birth is resolved server-side by the BFF.
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { SUGGESTED_QUESTIONS } from "@/constants/suggested-questions"
import { useChatSessions } from "@/lib/chat/use-chat-sessions"
import { useBaziChatStream, type WireMessage } from "@/lib/chat/use-bazi-chat-stream"
import type { ChatSessionMessage } from "@/lib/chat/session-store"
import { buildGreeting } from "@/components/chat/chat-greeting"
import { useKeyboardInset } from "@/components/chat/use-keyboard-inset"
import { useBodyScrollLock } from "@/components/chat/use-body-scroll-lock"
import { Menu, SquarePen, X, Pencil, Trash2, SendHorizontal } from "lucide-react"

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

let idSeq = 0
const nextId = () => `m_${++idSeq}`

const toChatItems = (messages: ChatSessionMessage[]): ChatItem[] =>
  messages.map((m) => ({ id: m.id, message: m.message, is_ai: m.is_ai, is_loading: false }))

const toSessionMessages = (items: ChatItem[]): ChatSessionMessage[] =>
  items.filter((m) => !m.is_loading).map((m) => ({ id: m.id, message: m.message, is_ai: m.is_ai }))

const relativeTime = (ts: number): string => {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return "เมื่อกี้"
  if (min < 60) return `${min} นาทีที่แล้ว`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ชม.ที่แล้ว`
  return `${Math.floor(hr / 24)} วันก่อน`
}

const TypingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.2s]" />
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.1s]" />
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce" />
    <span className="ml-2 text-white/90 text-[12px]">ซินแสกำลังตอบ...</span>
  </span>
)

const BaziChatModal = ({ userId, onClose }: ComponentProps) => {
  const { sessions, activeId, ready, newSession, switchTo, rename, remove, persist } =
    useChatSessions(userId)
  const { streamChat, abort } = useBaziChatStream()
  const { data: authSession } = useSession()
  const userName = authSession?.user?.name ?? null

  const keyboardInset = useKeyboardInset()
  useBodyScrollLock(true)

  const [historyChat, setHistoryChat] = useState<ChatItem[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const [isCallAI, setIsCallAI] = useState(false)
  const [needProfile, setNeedProfile] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [wallet, setWallet] = useState<{ balance: number; unlimited: boolean; enforced: boolean } | null>(null)
  const [outOfCredit, setOutOfCredit] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const hydratingRef = useRef(false)
  const loadedForRef = useRef<string | null>(null)

  // wallet balance — fetched on open, refreshed after each turn.
  const refreshBalance = async () => {
    try {
      const r = await fetch("/api/chat/balance")
      if (!r.ok) return
      const b = (await r.json()) as { balance?: number; unlimited?: boolean; enforced?: boolean }
      setWallet({ balance: b.balance ?? 0, unlimited: !!b.unlimited, enforced: b.enforced !== false })
      if (b.unlimited || (b.balance ?? 0) > 0) setOutOfCredit(false)
    } catch {
      // best-effort; counter stays hidden on failure
    }
  }

  useEffect(() => {
    refreshBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load the active session's messages once the store is ready.
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [historyChat])

  // abort any in-flight stream on unmount
  useEffect(() => () => abort(), [abort])

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
    abort()
    const id = newSession()
    if (id) loadInto([], id)
    setShowSessions(false)
  }

  const onSwitchSession = (id: string) => {
    if (id === activeId) {
      setShowSessions(false)
      return
    }
    abort()
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

  const activeSession = sessions.find((s) => s.id === activeId)
  const isReturning = sessions.some((s) => (s.messages?.length ?? 0) > 0)

  const askedSet = new Set(historyChat.filter((m) => !m.is_ai).map((m) => m.message.trim()))
  const remainingSuggestions = SUGGESTED_QUESTIONS.filter((q) => !askedSet.has(q))

  const updateAi = (id: string, fn: (prev: ChatItem) => ChatItem) =>
    setHistoryChat((list) => list.map((m) => (m.id === id ? fn(m) : m)))

  const onSubmitChat = async (overrideText?: string) => {
    const msg = (overrideText ?? chatMessage).trim()
    if (!msg || isCallAI) return

    const userItem: ChatItem = { id: nextId(), message: msg, is_ai: false }
    const aiId = nextId()
    const aiItem: ChatItem = { id: aiId, message: "", is_ai: true, is_loading: true }

    // wire = full prior turns + this user turn (stateless continuity, NO birth)
    const wireMessages: WireMessage[] = [
      ...historyChat
        .filter((m) => !(m.is_ai && m.is_loading))
        .map((m) => ({ role: m.is_ai ? ("assistant" as const) : ("user" as const), content: m.message })),
      { role: "user", content: msg },
    ]

    setHistoryChat((list) => [...list, userItem, aiItem])
    setChatMessage("")
    setIsCallAI(true)

    const outcome = await streamChat(wireMessages, (tok) => {
      if (!tok) return
      updateAi(aiId, (prev) => ({ ...prev, is_loading: false, message: prev.message + tok }))
    })

    if (outcome.type === "profile_incomplete") {
      setHistoryChat((list) => list.filter((m) => m.id !== aiId && m.id !== userItem.id))
      setNeedProfile(true)
    } else if (outcome.type === "out_of_credit") {
      setHistoryChat((list) => list.filter((m) => m.id !== aiId))
      setOutOfCredit(true)
      setWallet((w) => (w ? { ...w, balance: 0 } : w))
    } else if (outcome.type === "error") {
      updateAi(aiId, (prev) => ({
        ...prev,
        is_loading: false,
        message: `เกิดข้อผิดพลาด ${outcome.status ? `(${outcome.status}) ` : ""}${outcome.message}`.trim(),
      }))
    } else if (outcome.type === "aborted") {
      updateAi(aiId, (prev) => ({ ...prev, is_loading: false, message: prev.message || "ยกเลิกแล้ว" }))
    } else {
      // done — surface a fallback if nothing streamed
      updateAi(aiId, (prev) => ({
        ...prev,
        is_loading: false,
        message: prev.message || "ไม่ได้รับคำตอบจากซินแส ลองใหม่อีกครั้งนะคะ",
      }))
    }

    setIsCallAI(false)
    void refreshBalance()
  }

  const greeting = buildGreeting({ name: userName, isReturning, now: new Date() })
  const showGreeting = historyChat.length === 0 && !needProfile

  return (
    <>
      {/* backdrop scrim — dims the page (desktop) / sits behind the full-screen sheet (mobile) */}
      <motion.div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* sheet: mobile full-screen (100dvh), desktop docked bottom-right.
          paddingBottom = keyboard height so the composer always sits above the keyboard. */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        style={{ paddingBottom: keyboardInset > 0 ? keyboardInset : undefined }}
        className={
          "fixed z-[9999] inset-0 h-screen-dvh flex flex-col overflow-hidden bg-chat_surface font-ibm" +
          " md:inset-auto md:bottom-6 md:right-6 md:h-[640px] md:max-h-[85vh] md:w-[410px]" +
          " md:rounded-[28px] md:shadow-2xl"
        }
      >
        {/* header — slim, gradient via tokens (teal -> slate), notch-safe */}
        <div className="flex-none w-full pt-safe bg-gradient-to-b from-chat_header_from to-chat_header_to">

          <div className="w-full flex items-center gap-3 px-[20px] py-[14px]">
            <button
              onClick={() => setShowSessions((v) => !v)}
              aria-label="รายการแชท"
              className="flex-none cursor-pointer hover:bg-white/15 text-white w-[36px] h-[36px] rounded-full flex items-center justify-center"
            >
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>
            <div className="flex-1 min-w-0 flex flex-col items-center text-center">
              <span className="text-white font-medium whitespace-nowrap leading-tight">ซินแส Mumate</span>
              {activeSession ? (
                <span className="text-white/70 text-[11px] truncate max-w-full leading-tight">
                  {activeSession.title}
                </span>
              ) : null}
            </div>
            <button
              onClick={onNewSession}
              aria-label="เริ่มแชทใหม่"
              className="flex-none cursor-pointer hover:bg-white/15 text-white w-[36px] h-[36px] rounded-full flex items-center justify-center"
            >
              <SquarePen className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              onClick={onClose}
              aria-label="ปิด"
              className="flex-none cursor-pointer hover:bg-white/15 text-white w-[36px] h-[36px] rounded-full flex items-center justify-center"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto w-full py-[20px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="w-full flex flex-col px-[20px]">
              {needProfile ? (
                <div className="w-full text-white text-[14px] bg-white/10 rounded-[12px] p-4 my-2">
                  ยังไม่มีข้อมูลวันเกิดของคุณค่ะ กรอกวันเกิดและเพศก่อนเพื่อให้ซินแสดูดวงให้ได้
                  <Link href="/profile/edit" className="inline-block mt-3 rounded-full bg-moumate_blue px-4 py-2 text-[13px] cursor-pointer">
                    ไปกรอกข้อมูลวันเกิด
                  </Link>
                </div>
              ) : null}

              {showGreeting ? (
                <div className="w-full flex-1 flex flex-col items-center justify-center text-center px-2 py-10">
                  <div className="text-[40px] mb-3 leading-none">🔮</div>
                  <p className="text-white text-[18px] font-medium leading-snug">{greeting.line1}</p>
                  <p className="text-white/75 text-[14px] leading-relaxed mt-2 max-w-[300px]">{greeting.line2}</p>
                </div>
              ) : null}

              {historyChat.map((item) => {
                const streaming = item.is_ai && !item.is_loading && isCallAI
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: item.is_ai ? -8 : 8, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: "spring", damping: 26, stiffness: 320 }}
                    className={(item.is_ai ? "justify-start" : "justify-end") + " w-full flex"}
                  >
                    <div
                      className={
                        (item.is_ai ? "justify-start" : "justify-end") +
                        " max-w-[80%] flex my-2 text-white whitespace-pre-line"
                      }
                    >
                      <span
                        className={
                          (item.is_ai
                            ? "bg-moumate_blue"
                            : "bg-chat_bubble_user/80") + " rounded-[12px] py-[8px] px-[12px]"
                        }
                      >
                        {item.is_ai && item.is_loading ? (
                          <TypingDots />
                        ) : (
                          <>
                            {item.message}
                            {streaming ? <span className="inline-block animate-pulse ml-[1px]">▋</span> : null}
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

          {/* suggested "next questions" — horizontal slider */}
          {remainingSuggestions.length > 0 && (
            <div className="flex-none w-full">
              <div className="flex gap-2 overflow-x-auto px-[20px] pb-[10px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {remainingSuggestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSubmitChat(q)}
                    disabled={isCallAI}
                    title={q}
                    className={
                      (isCallAI ? "opacity-50 cursor-default" : "cursor-pointer hover:bg-white/20 active:scale-[0.98]") +
                      " flex-none whitespace-nowrap rounded-full border border-white/40 bg-white/10 text-white/90 text-[13px] py-[7px] px-[14px] transition"
                    }
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* credit status */}
          {wallet && (
            <div className="flex-none w-full px-[20px] pb-[6px] flex items-center justify-between gap-3">
              <span className="text-white/80 text-[12px]">
                {wallet.unlimited ? "✨ ถามได้ไม่จำกัด" : `เหลือ ${Math.max(0, wallet.balance)} คำถาม`}
              </span>
              {!wallet.unlimited && (outOfCredit || wallet.balance <= 0) && (
                <Link
                  href="/package-price?tab=PAYASUSE"
                  className="flex-none rounded-full bg-white text-chat_header_to text-[12px] font-medium px-3 py-[5px] cursor-pointer hover:bg-white/90 active:scale-95 transition"
                >
                  ซื้อเพิ่ม
                </Link>
              )}
            </div>
          )}

          {/* composer — rides above the keyboard (sheet paddingBottom) + safe-area when no keyboard */}
          <div className="flex-none w-full px-[20px] pt-[4px] pb-3 pb-safe">
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

          {/* session drawer — slides in from the left */}
          <AnimatePresence>
            {showSessions && (
              <motion.div
                key="sessions-panel"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 320 }}
                className="absolute inset-0 z-10 flex flex-col bg-chat_panel"
              >
                <div className="flex-none flex items-center justify-between px-[20px] py-[14px] pt-safe">
                  <span className="text-white font-medium">แชทของคุณ</span>
                  <button onClick={() => setShowSessions(false)} aria-label="ปิดรายการ" className="text-white/80 hover:text-white cursor-pointer w-[32px] h-[32px] rounded-full flex items-center justify-center hover:bg-white/10">
                    <X className="w-5 h-5" strokeWidth={2} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={(s.id === activeId ? "bg-white/10" : "") + " group flex items-center gap-2 px-[20px] py-[12px] hover:bg-white/10"}
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
                        <button onClick={() => onSwitchSession(s.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <div className="flex items-center gap-2">
                            {s.id === activeId ? <span className="w-[6px] h-[6px] rounded-full bg-moumate_blue flex-none" /> : null}
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
                        aria-label="เปลี่ยนชื่อแชท"
                        className="flex-none text-white/60 hover:text-white cursor-pointer w-[28px] h-[28px] rounded-full flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => onRemoveSession(s.id)}
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
