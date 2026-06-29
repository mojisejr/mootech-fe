// Glass Box console (#bazi-chat-anti-drift v2, Track B2).
//
// The ซินแส trace console: ask a TEST chart a question and watch, in realtime, what the chat
// HEARD (triage), the engine TRUTH it used, the FILTERS it applied, and the ANSWER it streamed —
// side by side. This is the same prod chat pipeline + answer; the only difference is the
// x-glass-box flag exposing the trace (the BFF sets it). No real customer data, no persistence.
//
// Access: locked behind GLASS_BOX_KEY in middleware (cookie `gb_access`). Open `?key=<KEY>` once.
// Deliberately NO production notFound guard here — the gate, not NODE_ENV, owns visibility.
import { useEffect, useRef, useState } from "react"
import type { DevBirthProfile } from "@/dev-access/birth-adapter"
import { useGlassBoxStream, type GlassBoxTrace } from "@/features/glass-box/use-glass-box-stream"
import TracePanels from "@/features/glass-box/TracePanels"

const STORAGE_KEY = "glass-box-test-birth"

const PRESETS: { label: string; birth: DevBirthProfile }[] = [
  { label: "หญิง 1992-08-12 09:15", birth: { dob: "1992-08-12", time: "09:15", gender: "FEMALE", isRememberTime: true } },
  { label: "ชาย 1989-01-03 08:45", birth: { dob: "1989-01-03", time: "08:45", gender: "MALE", isRememberTime: true } },
  { label: "หญิง 1986-09-16 14:23", birth: { dob: "1986-09-16", time: "14:23", gender: "FEMALE", isRememberTime: true } },
]

const EMPTY: DevBirthProfile = { dob: "", time: "", gender: "MALE", isRememberTime: true }

type Turn = {
  id: string
  question: string
  answer: string
  trace: GlassBoxTrace | null
  loading: boolean
}

let seq = 0
const nextId = () => `t_${++seq}`

const TypingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.2s]" />
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.1s]" />
    <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce" />
    <span className="ml-2 text-white/90 text-[12px]">ซินแสกำลังตอบ…</span>
  </span>
)

export default function GlassBoxConsole() {
  const [form, setForm] = useState<DevBirthProfile>(EMPTY)
  const [birth, setBirth] = useState<DevBirthProfile | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState("")
  const [busy, setBusy] = useState(false)
  const { streamChat, abort } = useGlassBoxStream()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as DevBirthProfile
        setBirth(saved)
        setForm(saved)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  useEffect(() => () => abort(), [abort])

  const saveBirth = (b: DevBirthProfile) => {
    const profile: DevBirthProfile = { ...b, time: b.isRememberTime ? b.time : "" }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    setBirth(profile)
    setForm(profile)
  }

  const onSave = () => {
    if (!form.dob) {
      alert("กรอกวันเกิดดวงทดสอบก่อนนะคะ")
      return
    }
    saveBirth(form)
  }

  const updateTurn = (id: string, fn: (t: Turn) => Turn) =>
    setTurns((list) => list.map((t) => (t.id === id ? fn(t) : t)))

  const onAsk = async () => {
    const q = question.trim()
    if (!q || busy || !birth) return

    // continuity: replay prior Q/A as wire turns, then this question
    const wire = turns.flatMap((t) => [
      { role: "user" as const, content: t.question },
      ...(t.answer ? [{ role: "assistant" as const, content: t.answer }] : []),
    ])
    wire.push({ role: "user" as const, content: q })

    const id = nextId()
    setTurns((list) => [...list, { id, question: q, answer: "", trace: null, loading: true }])
    setQuestion("")
    setBusy(true)

    const outcome = await streamChat(
      wire,
      birth,
      (tok) => updateTurn(id, (t) => ({ ...t, answer: t.answer + tok })),
      (trace) => updateTurn(id, (t) => ({ ...t, trace })),
    )

    updateTurn(id, (t) => ({
      ...t,
      loading: false,
      answer:
        t.answer ||
        (outcome.type === "error"
          ? `เกิดข้อผิดพลาด (${outcome.status ?? ""}) ${outcome.message}`
          : outcome.type === "aborted"
            ? "ยกเลิกแล้ว"
            : "ไม่ได้รับคำตอบจากซินแส ลองใหม่อีกครั้งนะคะ"),
    }))
    setBusy(false)
  }

  return (
    <main className="min-h-screen bg-chat_surface text-white">
      {/* header */}
      <div
        style={{ background: "linear-gradient(180deg, rgba(37,153,174,1) 0%, rgba(58,120,169,1) 100%)" }}
        className="px-6 py-5"
      >
        <h1 className="text-[20px] font-semibold">🔮 Glass Box — ผนังกระจกซินแส</h1>
        <p className="text-white/70 text-[12px] mt-1">
          ถามดวงทดสอบ แล้วดูว่า AI <b>ได้ยิน</b>อะไร · ใช้<b>ความจริง</b>จาก engine ตัวไหน · ผ่าน<b>ตัวกรอง</b>อะไร ก่อนตอบ — แบบเรียลไทม์
        </p>
      </div>

      <div className="max-w-[920px] mx-auto p-5 space-y-5">
        {/* test birth */}
        <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-[15px] font-medium mb-3">ดวงทดสอบ (ไม่ใช่ดวงลูกค้าจริง)</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => saveBirth(p.birth)}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[12px] cursor-pointer transition"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[12px] text-white/60 mb-1">วันเกิด</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
                className="w-full rounded-lg bg-white/10 px-3 py-2 outline-none text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-white/60 mb-1">เวลาเกิด</label>
              <input
                type="time"
                value={form.time}
                disabled={!form.isRememberTime}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full rounded-lg bg-white/10 px-3 py-2 outline-none text-[14px] disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-[12px] text-white/60 mb-1">เพศ</label>
              <div className="flex gap-2">
                {(["MALE", "FEMALE"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setForm({ ...form, gender: g })}
                    className={
                      "px-4 py-2 rounded-lg text-[14px] cursor-pointer " +
                      (form.gender === g ? "bg-moumate_blue" : "bg-white/10")
                    }
                  >
                    {g === "MALE" ? "ชาย" : "หญิง"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12px] text-white/60 mt-3">
            <input
              type="checkbox"
              checked={form.isRememberTime}
              onChange={(e) => setForm({ ...form, isRememberTime: e.target.checked })}
            />
            รู้เวลาเกิด (ไม่รู้ → ใช้ 12:00)
          </label>

          <div className="mt-4">
            <button
              onClick={onSave}
              className="px-4 py-2 rounded-lg bg-moumate_blue text-[14px] cursor-pointer"
            >
              ใช้ดวงนี้
            </button>
            {birth ? (
              <span className="ml-3 text-white/60 text-[12px]">
                กำลังใช้: {birth.dob} · {birth.time || "ไม่ระบุเวลา (→12:00)"} · {birth.gender}
              </span>
            ) : null}
          </div>
        </section>

        {/* conversation + trace */}
        {!birth ? (
          <p className="text-white/40 text-[13px] text-center py-8">เลือกหรือบันทึกดวงทดสอบก่อน แล้วเริ่มถามได้เลยค่ะ</p>
        ) : (
          <section className="space-y-6">
            {turns.map((t) => (
              <div key={t.id} className="space-y-3">
                {/* question */}
                <div className="flex justify-end">
                  <span className="bg-chat_bubble_user/80 rounded-[8px] py-2 px-3 text-[14px] max-w-[80%] whitespace-pre-line">
                    {t.question}
                  </span>
                </div>
                {/* answer */}
                <div className="flex justify-start">
                  <span className="bg-moumate_blue rounded-[8px] py-2 px-3 text-[14px] max-w-[80%] whitespace-pre-line">
                    {t.loading && !t.answer ? <TypingDots /> : t.answer}
                  </span>
                </div>
                {/* trace */}
                <TracePanels trace={t.trace} />
              </div>
            ))}
            <div ref={bottomRef} />
          </section>
        )}
      </div>

      {/* sticky input */}
      {birth ? (
        <div className="sticky bottom-0 bg-chat_surface/95 backdrop-blur border-t border-white/10 px-5 py-4">
          <div className="max-w-[920px] mx-auto">
            <div
              style={{
                background:
                  "linear-gradient(268.72deg, rgba(174,240,243,0.2) 1.75%, rgba(159,184,232,0.2) 49.8%, rgba(251,217,226,0.2) 97.85%)",
              }}
              className="w-full py-3 px-5 rounded-[100px] border-white border-2 flex items-center gap-3"
            >
              <input
                type="text"
                disabled={busy}
                value={question}
                placeholder={busy ? "กำลังรอคำตอบ…" : "พิมพ์คำถามถึงซินแส…"}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onAsk()
                  }
                }}
                className="flex-1 min-w-0 text-white text-[15px] bg-transparent outline-none placeholder:text-white/60"
              />
              <button
                onClick={onAsk}
                disabled={busy}
                className={(busy ? "opacity-50" : "cursor-pointer") + " flex-none text-white text-[14px] font-medium"}
              >
                ส่ง
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
