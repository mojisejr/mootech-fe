// features/v2-chat/components/ChatScreen.tsx — จอ "Mate AI" (/v2/chat).
//
// Design: Figma "Mumate app_ final" → page "- Mumate AI" → frame `mumate-ai-chat` (node 55271-8612,
// 393×852, r40, fill: linear gradient + BG01/BG04 clouds + #F6ECF0). Element list captured off the
// node 2026-09-02:
//   header  : ← back · "Mate AI" (black) · green dot-pill "ทำงานอยู่" · ⚙ gear (right)
//   mascot  : 01.webp (the red-robed dragon holding the phone) floating on clouds
//   link    : teal underlined line under the mascot — toggles the full question list
//   greeting: white AI bubble, Miu-persona copy 💜
//   chips   : 3 starter chips, then the canonical SUGGESTED_QUESTIONS minus asked ones
//   composer: 🎤 mic (Web Speech th-TH) · rounded input "พิมพ์ถามมา..." · sapphire send circle
//   legal   : 2-line disclaimer — entertainment only, not medical advice
//
// TODO(figma-copy): the greeting/chips/link strings are transcribed from a 101% zoom — playful
// persona-speak is hard to read at that size. Swap in the designer's exact strings when exported.
import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { useBaziChatStream } from "../useBaziChatStream"
import { SUGGESTED_QUESTIONS } from "@/constants/suggested-questions"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"

const GREETING =
  "สวัสดีจ้าา~ มิวมาแล้วจ้าา~ มิวอ่านดวงของคุณมาแล้วนะะ มีอะไรสงสัยบอกมาได้เลยย ถามให้ปังในสิ่งที่สงสัยเลย มิวเองงค้า 💜"

// TODO(figma-copy): exact strings off the node — best-effort transcription, confirm with design.
const STARTER_CHIPS = [
  { label: "ดวงวันนี้เป็นงัย 🌟", question: "ดวงวันนี้ของฉันเป็นอย่างไรบ้าง?" },
  { label: "ความสมพงษ์ 💖", question: "เรื่องความรักและคู่ครองที่เหมาะกับฉันเป็นแบบไหน?" },
  { label: "เลขนำโชครายวัน 🎴", question: "เลขนำโชคของฉันวันนี้คืออะไร?" },
]

const DISCLAIMER =
  "การแชทนี้อยู่เพียงเพื่อความบันเทิงเท่านั้น ไม่สามารถใช้แทนคำแนะนำทางการแพทย์ หรือคำแนะนำทางการเงินได้"

const MASCOT_SRC = "/images/v2/mascot/01.webp"

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" data-testid="chat-typing">
      <span className="h-[6px] w-[6px] animate-bounce rounded-full bg-v3-sapphire/50 [animation-delay:-0.2s]" />
      <span className="h-[6px] w-[6px] animate-bounce rounded-full bg-v3-sapphire/50 [animation-delay:-0.1s]" />
      <span className="h-[6px] w-[6px] animate-bounce rounded-full bg-v3-sapphire/50" />
    </span>
  )
}

export function ChatScreen() {
  const { turns, busy, guard, send, clear } = useBaziChatStream()
  const [draft, setDraft] = useState("")
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const asked = useMemo(() => new Set(turns.filter((t) => t.role === "user").map((t) => t.content.trim())), [turns])
  const nextSuggestions = useMemo(
    () => SUGGESTED_QUESTIONS.filter((q) => !asked.has(q)).slice(0, 6),
    [asked],
  )
  const startersUsed = asked.size > 0 || turns.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setSpeechSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    return () => recognitionRef.current?.stop?.()
  }, [])

  const startVoice = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => any
      webkitSpeechRecognition?: new () => any
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) return
    if (listening) {
      recognitionRef.current?.stop?.()
      setListening(false)
      return
    }
    const rec = new Ctor()
    rec.lang = "th-TH"
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const said: string = e?.results?.[0]?.[0]?.transcript ?? ""
      if (said) setDraft((prev) => (prev ? `${prev} ${said}` : said))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  const submit = (override?: string) => {
    const msg = (override ?? draft).trim()
    if (!msg || busy) return
    void send(msg)
    setDraft("")
    inputRef.current?.focus()
  }

  const onGear = () => {
    if (turns.length === 0) return
    if (!confirmClear) {
      setConfirmClear(true)
      window.setTimeout(() => setConfirmClear(false), 2500)
      return
    }
    clear()
    setConfirmClear(false)
  }

  return (
    <div
      data-testid="v2-chat-screen"
      className="font-ibm flex h-[100dvh] w-full flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #CFE6FB 0%, #E7E9FB 34%, #F6E7F2 62%, #FBECEF 100%)",
      }}
    >
      {/* header — ← · Mate AI · ●ทำงานอยู่ · ⚙ */}
      <header className="flex w-full flex-none items-center gap-2 px-4 pt-4">
        <Link
          href="/v2"
          aria-label="ย้อนกลับ"
          data-testid="chat-back"
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-white/40"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-lg font-black leading-6 text-v3-navy">Mate AI</h1>
        <span
          data-testid="chat-online"
          className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-[2px] text-[10px] font-medium leading-4 text-emerald-700"
        >
          <span className="h-[6px] w-[6px] rounded-full bg-emerald-500" aria-hidden />
          ทำงานอยู่
        </span>
        <div className="grow" />
        <button
          onClick={onGear}
          aria-label={confirmClear ? "กดอีกครั้งเพื่อล้างประวัติแชท" : "ตั้งค่าแชท"}
          title={confirmClear ? "กดอีกครั้งเพื่อล้างประวัติแชท" : "ล้างประวัติแชท"}
          data-testid="chat-gear"
          className={
            (confirmClear ? "bg-white text-v3-error ring-1 ring-v3-error/40" : "text-v3-navy hover:bg-white/40") +
            " grid h-9 w-9 flex-none place-items-center rounded-full transition"
          }
        >
          {confirmClear ? (
            <span className="text-[10px] font-bold leading-none">ล้าง?</span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm7.4-3.5c0 .5 0 .9-.1 1.3l2 1.6-1.9 3.2-2.4-.9c-.7.5-1.4 1-2.2 1.2l-.4 2.5h-3.8l-.4-2.5c-.8-.3-1.5-.7-2.2-1.2l-2.4.9-1.9-3.2 2-1.6a7 7 0 0 1 0-2.6l-2-1.6L5.6 5.9l2.4.9c.7-.5 1.4-1 2.2-1.2l.4-2.5h3.8l.4 2.5c.8.3 1.5.7 2.2 1.2l2.4-.9 1.9 3.2-2 1.6c.1.4.1.8.1 1.3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </header>

      {/* mascot + link */}
      <div className="flex w-full flex-none flex-col items-center gap-1 pb-1 pt-2">
        <span className="v3-float relative block h-[190px] w-[170px]">
          <Image src={MASCOT_SRC} alt="มาสคอตมิว" fill sizes="200px" style={{ objectFit: "contain" }} priority />
        </span>
        <button
          onClick={() => setShowAllQuestions((v) => !v)}
          data-testid="chat-capabilities"
          className="text-[12px] font-medium leading-4 text-v3-cyan underline underline-offset-2"
        >
          {showAllQuestions ? "ซ่อนรายการคำถาม" : "ดูสิ่งที่มิวน้อยทำได้"}
        </button>
      </div>

      {/* messages */}
      <div className="min-h-0 w-full flex-1 overflow-y-auto px-4">
        <div className="mx-auto flex w-full max-w-[430px] flex-col gap-2 pb-2">
          {/* greeting bubble (Figma copy — see TODO(figma-copy)) */}
          <div data-testid="chat-greeting" className="max-w-[92%] self-start rounded-[18px] bg-white/95 px-4 py-3 text-[14px] leading-[22px] text-v3-navy shadow-[0_2px_10px_rgba(26,38,77,0.08)]">
            {GREETING}
          </div>

          {turns.map((t) =>
            t.role === "assistant" ? (
              <div
                key={t.id}
                data-testid="chat-bubble-ai"
                className="max-w-[92%] self-start whitespace-pre-line rounded-[18px] bg-white/95 px-4 py-3 text-[14px] leading-[22px] text-v3-navy shadow-[0_2px_10px_rgba(26,38,77,0.08)]"
              >
                {t.loading && !t.content ? <TypingDots /> : t.content}
              </div>
            ) : (
              <div key={t.id} className="max-w-[85%] self-end">
                <div
                  data-testid="chat-bubble-user"
                  className="whitespace-pre-line rounded-[18px] bg-v3-sapphire px-4 py-3 text-[14px] leading-[22px] text-white shadow-[0_2px_10px_rgba(20,85,164,0.25)]"
                >
                  {t.content}
                </div>
              </div>
            ),
          )}

          {/* guard cards */}
          {guard === "OUT_OF_LIMIT" && (
            <div data-testid="chat-guard-credit" className="w-full rounded-[18px] bg-white p-4 text-center shadow-[0_2px_10px_rgba(26,38,77,0.10)]">
              <p className="text-[13px] font-bold leading-5 text-v3-navy">เครดิตคำถาม AI หมดแล้ว</p>
              <p className="mt-1 text-[12px] leading-4 text-v3-text-body">เติมเครดิตหรืออัปเกรดแพ็กเกจเพื่อคุยกับมิวต่อได้เลย</p>
              <Link
                href={SHOP_HREF}
                className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white"
              >
                เติมเครดิต / ดูแพ็คเกจ
              </Link>
            </div>
          )}
          {guard === "profile_incomplete" && (
            <div data-testid="chat-guard-profile" className="w-full rounded-[18px] bg-white p-4 text-center shadow-[0_2px_10px_rgba(26,38,77,0.10)]">
              <p className="text-[13px] font-bold leading-5 text-v3-navy">ข้อมูลวันเกิดยังไม่ครบ</p>
              <p className="mt-1 text-[12px] leading-4 text-v3-text-body">มิวต้องรู้วันเวลาเกิดก่อนถึงจะทำนายให้แม่นยำได้</p>
              <Link
                href="/v2/register"
                className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white"
              >
                กรอกข้อมูลวันเกิด
              </Link>
            </div>
          )}
          {guard === "not_authenticated" && (
            <div data-testid="chat-guard-auth" className="w-full rounded-[18px] bg-white p-4 text-center shadow-[0_2px_10px_rgba(26,38,77,0.10)]">
              <p className="text-[13px] font-bold leading-5 text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
              <p className="mt-1 text-[12px] leading-4 text-v3-text-body">ลองเข้าสู่ระบบอีกครั้งเพื่อใช้แชท</p>
              <Link
                href="/v2/login"
                className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* suggestion chips — starters first, then the canonical next questions */}
      {(showAllQuestions || !startersUsed || nextSuggestions.length > 0) && (
        <div className="w-full flex-none px-4 pb-1">
          <div className="mx-auto flex w-full max-w-[430px] flex-wrap gap-2">
            {!startersUsed &&
              STARTER_CHIPS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => submit(c.question)}
                  disabled={busy}
                  data-testid="chat-chip-starter"
                  className="rounded-full border border-white bg-white/70 px-3 py-[7px] text-[12px] font-medium leading-4 text-v3-navy shadow-[0_1px_6px_rgba(26,38,77,0.08)] backdrop-blur transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
                >
                  {c.label}
                </button>
              ))}
            {showAllQuestions &&
              SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  disabled={busy}
                  className="rounded-full border border-white bg-white/70 px-3 py-[7px] text-left text-[12px] font-medium leading-4 text-v3-navy shadow-[0_1px_6px_rgba(26,38,77,0.08)] backdrop-blur transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            {startersUsed &&
              !showAllQuestions &&
              nextSuggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  disabled={busy}
                  data-testid="chat-chip-next"
                  className="rounded-full border border-white bg-white/70 px-3 py-[7px] text-[12px] font-medium leading-4 text-v3-navy shadow-[0_1px_6px_rgba(26,38,77,0.08)] backdrop-blur transition hover:bg-white active:scale-[0.98] disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* composer — 🎤 · input · send */}
      <div className="w-full flex-none px-4 pb-1 pt-1">
        <div className="mx-auto flex w-full max-w-[430px] items-center gap-2">
          {speechSupported && (
            <button
              onClick={startVoice}
              disabled={busy}
              aria-label={listening ? "หยุดฟังเสียง" : "พิมพ์ด้วยเสียง"}
              data-testid="chat-mic"
              className={
                (listening ? "bg-v3-error/10 text-v3-error ring-1 ring-v3-error/40" : "bg-white/80 text-v3-navy") +
                " grid h-11 w-11 flex-none place-items-center rounded-full shadow-[0_2px_8px_rgba(26,38,77,0.10)] transition disabled:opacity-50"
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-white bg-white/85 px-4 shadow-[0_2px_8px_rgba(26,38,77,0.08)] backdrop-blur">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              disabled={busy}
              placeholder={busy ? "มิวกำลังตอบ..." : "พิมพ์ถามมา..."}
              data-testid="chat-input"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submit()
                }
              }}
              className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-v3-text-filled outline-none placeholder:text-v3-placeholder"
            />
          </div>
          <button
            onClick={() => submit()}
            disabled={busy || draft.trim().length === 0}
            aria-label="ส่งข้อความ"
            data-testid="chat-send"
            className="grid h-11 w-11 flex-none place-items-center rounded-full bg-v3-sapphire text-white shadow-[0_2px_8px_rgba(20,85,164,0.35)] transition hover:bg-v3-sapphire-hover active:scale-[0.97] disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m5 12 14-7-5.5 7L19 19 5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* disclaimer — Figma fine print under the composer */}
      <p data-testid="chat-disclaimer" className="mx-auto w-full max-w-[430px] flex-none px-6 pb-2 text-center text-[9px] leading-[13px] text-v3-text-muted">
        {DISCLAIMER}
      </p>
    </div>
  )
}

export default ChatScreen
