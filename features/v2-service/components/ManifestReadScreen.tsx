// features/v2-service/components/ManifestReadScreen.tsx — /v2/service/manifest/[goalId]
// Design: Figma "read/review" (iPhone 16-1) — อ่าน manifest 1 ข้อ + mood 5 หน้า + บันทึก + ปุ่ม.
// Data: goals (GET /api/v2/manifest/goals) · บันทึก mood/note → POST /api/v2/manifest/entry
// · "ความปรารถนาเป็นจริงแล้ว" → PATCH goals {status:"done"}.
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"

import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

type Goal = { id: string; title: string; affirmation: string | null; imageUrl: string | null; category?: string | null; status: string }
type ReadPreview = { goals: Goal[]; goalId?: string }

const MOODS = ["😞", "😕", "🙂", "😊", "😍"]

export function ManifestReadScreen({ previewData }: { previewData?: ReadPreview } = {}) {
  const router = useRouter()
  const routeId = typeof router.query.goalId === "string" ? router.query.goalId : ""
  const goalId = previewData?.goalId ?? routeId

  const [goals, setGoals] = useState<Goal[]>(previewData?.goals ?? [])
  const [idx, setIdx] = useState(0)
  const [mood, setMood] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (previewData) return
    fetch("/api/v2/manifest/goals")
      .then((x) => (x.ok ? x.json() : null))
      .then((j) => setGoals(Array.isArray(j?.goals) ? j.goals.filter((g: Goal) => g.status !== "archived") : []))
      .catch(() => setGoals([]))
  }, [previewData])

  useEffect(() => {
    const i = goals.findIndex((g) => g.id === goalId)
    if (i >= 0) setIdx(i)
  }, [goals, goalId])

  const g = goals[idx]
  useEffect(() => { if (g) setNote(g.affirmation || g.title) }, [g])

  // swipe carousel — เลื่อนแนวนอนสลับ manifest, sync idx กับ scroll
  const scrollRef = useRef<HTMLDivElement>(null)
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    const el = scrollRef.current
    if (el && goals.length > 0) {
      el.scrollLeft = idx * el.clientWidth
      didInit.current = true
    }
  }, [goals, idx])
  const onScroll = () => {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== idx && i >= 0 && i < goals.length) setIdx(i)
  }
  const goToDot = (i: number) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
    else setIdx(i)
  }

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/v2/manifest/entry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood ?? undefined, note: note.trim() || undefined }),
      })
      const j = (await r.json().catch(() => ({}))) as { rewarded?: boolean; streak?: { current?: number } }
      if (r.ok) setMsg(j.rewarded ? `บันทึกแล้ว +5 QI · ต่อเนื่อง ${j.streak?.current ?? 1} วัน` : "บันทึกแล้ว")
      else setMsg("บันทึกไม่สำเร็จ")
    } catch { setMsg("บันทึกไม่สำเร็จ") } finally { setBusy(false) }
  }

  const complete = async () => {
    if (!g) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/v2/manifest/goals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: g.id, status: "done" }),
      })
      if (r.ok) void router.push(`/v2/service/manifest/done?id=${encodeURIComponent(g.id)}`)
      else setMsg("ทำเครื่องหมายไม่สำเร็จ")
    } catch { setMsg("ทำเครื่องหมายไม่สำเร็จ") } finally { setBusy(false) }
  }

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-ghost-white">
      <Head><title>แมนิเฟสต์ · MuMate</title></Head>
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-md overflow-hidden bg-v3-ghost-white pb-28">
        <header className="flex w-full items-center gap-2 px-4 pt-4">
          <Link href="/v2/service/manifest" aria-label="ย้อนกลับ" className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <h1 className="flex-1 text-lg font-black leading-6 text-v3-navy">แมนิเฟสต์</h1>
          <TopBarBell variant="solid" href="/v2/calendar/notifications" />
          <TopBarAvatar variant="sapphire" href="/v2/account" />
        </header>

        {!g ? (
          <p className="px-4 pt-10 text-center text-[14px] text-v3-text-muted">ไม่พบความปรารถนานี้</p>
        ) : (
          <div className="pt-3">
            {/* page dots */}
            {goals.length > 1 && (
              <div className="flex justify-center gap-1.5">
                {goals.map((x, i) => (
                  <button key={x.id} aria-label={`ไปข้อ ${i + 1}`} onClick={() => goToDot(i)} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-v3-sapphire" : "w-1.5 bg-v3-border-card"}`} />
                ))}
              </div>
            )}

            {/* swipe carousel — ปัดสลับ manifest */}
            <div ref={scrollRef} onScroll={onScroll} className="mt-3 flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="manifest-read-carousel">
              {goals.map((x) => (
                <div key={x.id} className="w-full shrink-0 snap-center px-4">
                  <div className="text-center">
                    {x.category ? <span className="inline-block rounded-full bg-[#3E9B4A] px-3 py-1 text-[12px] font-semibold text-white">{x.category}</span> : null}
                    <p className="mt-2 text-[20px] font-black leading-7 text-v3-navy">{x.affirmation || x.title}</p>
                  </div>
                  {x.imageUrl ? (
                    <span className="mt-3 block h-[220px] w-full overflow-hidden rounded-[20px]">
                      <Image src={x.imageUrl} alt="" width={480} height={440} unoptimized className="h-full w-full object-cover" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-4 px-4">
            {/* mood */}
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white">
              <p className="text-center text-[16px] font-black">คุณรู้สึกอย่างไรตอนนี้?</p>
              <div className="mt-3 flex justify-between">
                {MOODS.map((m, i) => (
                  <button key={i} onClick={() => setMood(i + 1)} aria-label={`อารมณ์ ${i + 1}`} className={`grid size-11 place-items-center rounded-full border-2 text-[22px] transition ${mood === i + 1 ? "border-v3-lime bg-white/15" : "border-white/40"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </section>

            {/* note */}
            <div>
              <p className="text-[14px] font-bold text-v3-navy">บันทึก</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-[16px] border border-v3-border-input bg-white p-3 text-[14px] outline-none focus:border-v3-navy" />
            </div>

            <Link href="/v2/service/manifest/history" className="flex items-center justify-between rounded-[16px] bg-white px-4 py-3 v3-shadow-line">
              <span className="flex items-center gap-2 text-[14px] font-medium text-v3-navy">
                <span className="size-7 rounded-full bg-v3-ghost-white" />
                ดูย้อนหลังได้ที่ บันทึกของฉัน
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>

            {msg ? <p className="text-center text-[13px] font-bold text-v3-sapphire">{msg}</p> : null}

            <button onClick={() => void complete()} disabled={busy} className="grid h-11 w-full place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire disabled:opacity-60">ความปรารถนาเป็นจริงแล้ว</button>
            </div>
          </div>
        )}
      </div>

      {/* ปุ่มบันทึก (ล่างติดจอ) */}
      {g && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-v3-border-card bg-white px-4 py-3">
          <button onClick={() => void save()} disabled={busy} className="grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-black text-white disabled:opacity-60">{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      )}
    </div>
  )
}

export default ManifestReadScreen
