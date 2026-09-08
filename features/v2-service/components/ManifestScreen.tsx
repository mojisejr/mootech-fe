// features/v2-service/components/ManifestScreen.tsx — /v2/service/manifest ("สมุดแมนิเฟสต์")
// Design: Figma "Mumate app_ final" node 55512-729 (proto 55512-755) — onboarding: header +
// hero (3 ขั้น) + การ์ดธาตุประจำเดือน. Data: /api/v2/manifest/goals + /checkin (goals/checkin),
// element จาก /api/profile → /api/bazi/element-summary. เขียนเลยตอนนี้ → CreateGoalModal เดิม.
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { KitButton } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

type Task = { id: string; title: string; targetCount: number; isDaily: boolean; doneCount: number }
type Goal = {
  id: string; title: string; affirmation: string | null; imageUrl: string | null
  status: string; tasks: Task[]; progress: { done: number; target: number; percent: number }
}
type ElementInfo = { elementTh: string; dayGanzhi?: string } | null
type ManifestPreview = { goals?: Goal[]; element?: ElementInfo }

// วัฏจักรธาตุ (ไทย): เสริม(生) ไม้→ไฟ→ดิน→ทอง→น้ำ→ไม้ · ข่ม(克) ไม้→ดิน→น้ำ→ไฟ→ทอง→ไม้
const EL_GEN: Record<string, string> = { ไม้: "ไฟ", ไฟ: "ดิน", ดิน: "ทอง", ทอง: "น้ำ", น้ำ: "ไม้" }
const EL_CTRL: Record<string, string> = { ไม้: "ดิน", ดิน: "น้ำ", น้ำ: "ไฟ", ไฟ: "ทอง", ทอง: "ไม้" }
// ธาตุประจำเดือน (ตามเดือนสุริยคติโดยประมาณ) — 60-card ของเดือนมาจาก engine mascot ตาม ganzhi
const MONTH_ELEMENT: Record<number, string> = { 1: "ดิน", 2: "ไม้", 3: "ไม้", 4: "ดิน", 5: "ไฟ", 6: "ไฟ", 7: "ดิน", 8: "ทอง", 9: "ทอง", 10: "ดิน", 11: "น้ำ", 12: "น้ำ" }
// insight คำนวนจากความสัมพันธ์ ธาตุคน (self) กับ ธาตุเดือนนี้ (month) — เปลี่ยนทุกเดือน/แต่ละคน
function monthInsight(self: string, month: string): string {
  if (self === month) return `ธาตุ${self}ของคุณได้พลังหนุนเต็มที่ในเดือนนี้ เป็นจังหวะเหมาะกับการลงมือทำสิ่งที่ตั้งใจ`
  if (EL_GEN[month] === self) return `ธาตุ${self}กำลังได้รับการเสริมจากธาตุ${month}ในเดือนนี้ เป็นจังหวะที่เหมาะกับการตั้งจิตเรื่องการเริ่มต้นใหม่`
  if (EL_GEN[self] === month) return `ธาตุ${self}ได้ปลดปล่อยพลังผ่านธาตุ${month}ในเดือนนี้ เหมาะกับการสร้างสรรค์และแสดงออก`
  if (EL_CTRL[self] === month) return `ธาตุ${self}ได้จัดการธาตุ${month}ในเดือนนี้ เหมาะกับการวางแผนและเรื่องทรัพย์สิน`
  if (EL_CTRL[month] === self) return `เดือนนี้ธาตุ${month}เข้ามากำกับธาตุ${self}ของคุณ เหมาะกับการฝึกวินัยและความรับผิดชอบ`
  return `ธาตุ${self}ของคุณกำลังเปลี่ยนผ่านในเดือนนี้ เหมาะกับการตั้งจิตอย่างมีสติ`
}

// มาสคอตสัตว์ธาตุ (60-card) จาก engine ตาม ganzhi — โชว์ el fallback ก่อน แล้ว preload ตัวจริงสลับเมื่อโหลดได้
function MonthMascot({ ganzhi, elementTh }: { ganzhi?: string; elementTh: string }) {
  const fallback = ELEMENT_MASCOT[elementTh] ?? ELEMENT_MASCOT["ไม้"]
  const [src, setSrc] = useState(fallback)
  useEffect(() => {
    if (!ganzhi) return
    let alive = true
    const url = `/api/bazi-mascot?ganzhi=${encodeURIComponent(ganzhi)}`
    const img = new window.Image()
    img.onload = () => alive && setSrc(url)
    img.src = url
    return () => { alive = false }
  }, [ganzhi])
  return <Image src={src} alt="" width={56} height={56} unoptimized className="h-14 w-14 flex-none object-contain" />
}

const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-5"
const MAX_GOALS = 5

const ELEMENT_MASCOT: Record<string, string> = {
  ไม้: "/images/v2/destiny/el-wood.png",
  ไฟ: "/images/v2/destiny/el-fire.png",
  ดิน: "/images/v2/destiny/el-earth.png",
  ทอง: "/images/v2/destiny/el-metal.png",
  น้ำ: "/images/v2/destiny/el-water.png",
}
// 2 หมวดที่ธาตุแต่ละธาตุส่งเสริมเป็นพิเศษ (ตาม Figma: ธาตุไม้ → การงาน/การเรียนรู้)
const CATEGORIES = ["การงาน", "การเรียนรู้", "การเงิน", "ความรัก", "สุขภาพ"]
const ELEMENT_FAVORED: Record<string, string[]> = {
  ไม้: ["การงาน", "การเรียนรู้"],
  ไฟ: ["ความรัก", "การงาน"],
  ดิน: ["การเงิน", "สุขภาพ"],
  ทอง: ["การเงิน", "การงาน"],
  น้ำ: ["การเรียนรู้", "ความรัก"],
}

function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
function readCheckedToday(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem("mumate-manifest-checked") || "{}") as { date?: string; ids?: string[] }
    return raw.date === todayBangkok() ? new Set(raw.ids ?? []) : new Set()
  } catch { return new Set() }
}
function writeCheckedToday(ids: Set<string>) {
  try { localStorage.setItem("mumate-manifest-checked", JSON.stringify({ date: todayBangkok(), ids: Array.from(ids) })) } catch { /* ignore */ }
}

// การ์ดฮีโร่ onboarding (Figma) — 3 ขั้น + ปุ่มเขียน + มาสคอต
function OnboardingHero({ onWrite }: { onWrite: () => void }) {
  const steps = [
    { n: 1, t: "เลือก 3 ด้านที่อยากเปลี่ยน", s: "ราศีของคุณจะช่วยแนะนำ" },
    { n: 2, t: "เขียนและใส่รูปให้แต่ละข้อ", s: "เขียนเป็นประโยคที่เกิดขึ้นแล้ว เช่น “ฉันได้งานที่ใช่” จะช่วยให้จิตจดจ่อกับภาพปลายทางมากกว่าความอยาก" },
    { n: 3, t: "กลับมาอ่านทุกวัน", s: "ใช้เวลาราว 1 นาที รับ +5 QI" },
  ]
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-v3-sapphire px-4 pb-6 pt-6 text-white" data-testid="manifest-hero">
      {/* มาสคอตธาตุลอย + ขยับ (.v3-float) รอบการ์ด */}
      {(
        [
          { el: "el-water", cls: "left-1 top-4 h-8 w-8", d: "0s" },
          { el: "el-earth", cls: "left-3 top-24 h-7 w-7", d: ".5s" },
          { el: "el-metal", cls: "right-24 bottom-2 h-8 w-8", d: "1s" },
          { el: "el-wood", cls: "right-2 bottom-4 h-9 w-9", d: ".3s" },
        ] as const
      ).map((m) => (
        <span key={m.el} aria-hidden className={`v3-float pointer-events-none absolute z-10 ${m.cls}`} style={{ animationDelay: m.d }}>
          <Image src={`/images/v2/destiny/${m.el}.png`} alt="" width={40} height={40} unoptimized className="h-full w-full object-contain drop-shadow" />
        </span>
      ))}
      <Image src="/images/v2/mascot/01-nav.png" alt="" width={96} height={114} unoptimized className="v3-float pointer-events-none absolute right-2 top-1 h-24 w-auto object-contain" />
      <div className="relative text-center">
        <h1 className="text-[20px] font-black leading-7">สมุดแมนิเฟสต์<br />ของคุณรอภาพแรกอยู่</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-[12px] leading-[18px] text-white/90">
          แมนิเฟสต์คือการเขียนสิ่งที่อยากให้เกิดขึ้นเป็นประโยคที่เกิดขึ้นแล้ว แล้วกลับมาอ่านทุกวันจนจิตคุ้นชินกับภาพนั้น
        </p>
      </div>
      <div className="relative mt-4 flex flex-col gap-2">
        {steps.map((st) => (
          <div key={st.n} className="flex items-start gap-3 rounded-[16px] bg-white p-3.5">
            <span className="grid size-6 flex-none place-items-center rounded-full bg-v3-sapphire/10 text-[12px] font-black text-v3-sapphire">{st.n}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-5 text-v3-navy">{st.t}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-v3-text-muted">{st.s}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 flex items-center justify-center">
        <Image src="/images/v2/destiny/el-fire.png" alt="" width={64} height={64} unoptimized className="v3-float pointer-events-none absolute left-2 bottom-[-6px] h-14 w-14 object-contain drop-shadow" />
        <button onClick={onWrite} data-testid="manifest-write" className="grid h-11 w-[220px] place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire">
          เขียนเลยตอนนี้
        </button>
      </div>
    </section>
  )
}

// การ์ดธาตุประจำเดือน (Figma) — insight + 5 หมวด (2 แรก highlight)
function ElementInsightCard({ element }: { element: ElementInfo }) {
  const el = element?.elementTh ?? "ไม้"
  const monthEl = MONTH_ELEMENT[new Date().getMonth() + 1] ?? "น้ำ"
  const favored = ELEMENT_FAVORED[el] ?? ["การงาน", "การเรียนรู้"]
  return (
    <section className="rounded-[24px] bg-[#eef7f0] p-5" data-testid="manifest-element">
      <div className="flex items-center gap-2">
        {/* สัตว์ธาตุ (60-card) ตาม ganzhi ของคุณจาก engine */}
        <MonthMascot ganzhi={element?.dayGanzhi} elementTh={el} />
        <p className="text-[16px] font-bold text-v3-navy">ธาตุ{el}ของคุณเดือนนี้</p>
      </div>
      <p className="mt-2 text-[13px] leading-[20px] text-v3-text-body">
        {monthInsight(el, monthEl)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const on = favored.includes(c)
          return (
            <span key={c} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${on ? "bg-[#3E9B4A] text-white" : "border border-[#3E9B4A]/40 text-[#3E9B4A]"}`}>{c}</span>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-v3-text-muted">สองหมวดแรกคือหมวดที่ธาตุคุณส่งเสริมเป็นพิเศษ ไม่ใช่หมวดอื่นเลือกเองได้</p>
    </section>
  )
}

export function ManifestScreen({ previewData }: { previewData?: ManifestPreview } = {}) {
  const [goals, setGoals] = useState<Goal[]>(previewData?.goals ?? [])
  const [element, setElement] = useState<ElementInfo>(previewData?.element ?? null)
  const [loading, setLoading] = useState(!previewData)
  const [checkedToday, setCheckedToday] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch("/api/v2/manifest/goals").then((x) => (x.ok ? x.json() : null))
      setGoals(Array.isArray(j?.goals) ? j.goals.filter((g: Goal) => g.status !== "archived") : [])
    } catch { setGoals([]) } finally { setLoading(false) }
    // ธาตุประจำตัว: profile → element-summary
    try {
      const prof = await fetch("/api/profile").then((x) => (x.ok ? x.json() : null))
      const birthDate = prof?.profile?.birthDate
      if (birthDate) {
        const e = await fetch("/api/bazi/element-summary", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ person: { birthDate, birthTime: prof.profile.birthTime ?? undefined } }),
        }).then((x) => (x.ok ? x.json() : null))
        const s = e?.summary ?? e
        if (s?.elementTh) setElement({ elementTh: s.elementTh, dayGanzhi: s.dayGanzhi })
      }
    } catch { /* ธาตุเป็น optional — ไม่มีก็ยังใช้ค่า default ได้ */ }
  }, [])

  useEffect(() => { if (previewData) return; setCheckedToday(readCheckedToday()); void load() }, [load, previewData])

  const activeCount = goals.filter((g) => g.status === "active").length

  const toggleTask = async (goalId: string, task: Task) => {
    const wasDone = checkedToday.has(task.id)
    const next = new Set(checkedToday)
    if (wasDone) next.delete(task.id); else next.add(task.id)
    setCheckedToday(next); writeCheckedToday(next)
    setGoals((gs) => gs.map((g) => {
      if (g.id !== goalId) return g
      const tasks = g.tasks.map((t) => t.id === task.id ? { ...t, doneCount: Math.max(0, Math.min(t.targetCount, t.doneCount + (wasDone ? -1 : 1))) } : t)
      const done = tasks.reduce((s, t) => s + t.doneCount, 0)
      const target = tasks.reduce((s, t) => s + t.targetCount, 0)
      return { ...g, tasks, progress: { done, target, percent: target ? Math.round((done / target) * 100) : 0 } }
    }))
    await fetch("/api/v2/manifest/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, done: !wasDone }),
    }).catch(() => {})
  }

  const deleteGoal = async (id: string) => {
    setGoals((gs) => gs.filter((g) => g.id !== id))
    await fetch("/api/v2/manifest/goals", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-ghost-white">
      <Head><title>สมุดแมนิเฟสต์ · MuMate</title></Head>
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-md overflow-hidden bg-v3-ghost-white pb-32">
        {/* header — สมุดแมนิเฟสต์ + อัพเกรด + กระดิ่ง + avatar (Figma) */}
        <header className="flex w-full items-center gap-2 px-4 pt-4">
          <h1 className="flex-1 text-[20px] font-black leading-7 text-v3-navy">สมุดแมนิเฟสต์</h1>
          <Link href="/v2/shop" className="grid h-8 flex-none place-items-center rounded-full bg-v3-lime px-3 text-[13px] font-black text-v3-sapphire">อัพเกรด</Link>
          <TopBarBell variant="solid" href="/v2/calendar/notifications" />
          <TopBarAvatar variant="sapphire" href="/v2/account" />
        </header>

        <div className="mt-3 flex flex-col gap-4 px-4">
          {loading ? (
            <div className="h-[420px] w-full animate-pulse rounded-[24px] bg-v3-ghost-white" data-testid="manifest-loading" />
          ) : goals.length === 0 ? (
            <OnboardingHero onWrite={() => setCreating(true)} />
          ) : (
            <>
              <section className="flex flex-col gap-3" data-testid="manifest-list">
                {goals.map((g) => (
                  <article key={g.id} className={CARD} data-testid="manifest-goal">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[16px] font-black leading-6 text-v3-navy">{g.title}</p>
                      <button type="button" onClick={() => void deleteGoal(g.id)} aria-label="ลบเป้าหมาย" data-testid="manifest-delete" className="flex-none text-[12px] text-v3-text-muted">ลบ</button>
                    </div>
                    {g.affirmation ? <p className="mt-1 rounded-[12px] bg-[#F3EEFF] px-3 py-2 text-[13px] leading-5 text-[#6B4FA0]">“{g.affirmation}”</p> : null}
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-v3-text-muted">
                        <span>ความคืบหน้า</span><span>{g.progress.percent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-v3-ghost-white">
                        <div className="h-full rounded-full bg-v3-sapphire transition-all" style={{ width: `${g.progress.percent}%` }} />
                      </div>
                    </div>
                    {g.tasks.length ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {g.tasks.map((t) => {
                          const done = checkedToday.has(t.id)
                          return (
                            <button key={t.id} type="button" onClick={() => void toggleTask(g.id, t)} data-testid="manifest-task" className="flex items-center gap-3 rounded-[12px] border border-v3-border-card bg-white px-3 py-2 text-left">
                              <span className={"grid size-6 flex-none place-items-center rounded-full border-2 " + (done ? "border-transparent bg-[#3E9B4A] text-white" : "border-v3-border-card text-transparent")}>✓</span>
                              <span className="min-w-0 flex-1">
                                <span className={"block text-[13px] font-bold " + (done ? "text-v3-text-muted line-through" : "text-v3-navy")}>{t.title}</span>
                                <span className="block text-[11px] text-v3-text-muted">{t.isDaily ? "ทำทุกวัน" : "ครั้งเดียว"} · {t.doneCount}/{t.targetCount}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : <p className="mt-2 text-[12px] text-v3-text-muted">ยังไม่มีภารกิจในเป้าหมายนี้</p>}
                  </article>
                ))}
              </section>
              {activeCount < MAX_GOALS ? (
                <KitButton variant="outline" onClick={() => setCreating(true)} testId="manifest-add">+ เขียนแมนิเฟสต์ใหม่</KitButton>
              ) : <p className="text-center text-[12px] text-v3-text-muted">เขียนครบ {MAX_GOALS} ข้อแล้ว โฟกัสให้สำเร็จก่อนนะ</p>}
            </>
          )}

          {/* การ์ดธาตุประจำเดือน */}
          {!loading && <ElementInsightCard element={element} />}
        </div>
      </div>

      {creating ? <CreateGoalModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load() }} /> : null}
      <Menubar />
    </div>
  )
}

function CreateGoalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("")
  const [affirmation, setAffirmation] = useState("")
  const [tasks, setTasks] = useState<string[]>([""])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) { setErr("ใส่ชื่อเป้าหมายก่อนนะ"); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch("/api/v2/manifest/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          affirmation: affirmation.trim() || undefined,
          tasks: tasks.map((t) => t.trim()).filter(Boolean).map((t) => ({ title: t, targetCount: 30, isDaily: true })),
        }),
      })
      if (res.ok) { onCreated(); return }
      const j = await res.json().catch(() => ({}))
      setErr(res.status === 409 ? String(j.error ?? "มีเป้าหมายครบแล้ว") : "สร้างไม่สำเร็จ")
    } finally { setSaving(false) }
  }

  const INPUT = "h-11 w-full rounded-[14px] border border-v3-border-input bg-white px-3 text-[14px] outline-none focus:border-v3-navy"
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose} data-testid="manifest-create">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-black text-v3-navy">เขียนแมนิเฟสต์</h2>
          <button type="button" onClick={onClose} className="text-[16px] font-bold text-v3-text-muted">✕</button>
        </div>
        <label className="mt-3 block">
          <span className="text-[13px] font-bold text-v3-navy">เป้าหมาย</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น มีเงินเก็บ 1 แสน" data-testid="manifest-title" className={INPUT + " mt-1"} />
        </label>
        <label className="mt-3 block">
          <span className="text-[13px] font-bold text-v3-navy">คำยืนยัน (affirmation)</span>
          <textarea value={affirmation} onChange={(e) => setAffirmation(e.target.value)} rows={2} placeholder="เช่น ฉันเป็นคนที่เงินไหลมาหาเสมอ" className="mt-1 w-full rounded-[14px] border border-v3-border-input bg-white p-3 text-[14px] outline-none focus:border-v3-navy" />
        </label>
        <div className="mt-3">
          <span className="text-[13px] font-bold text-v3-navy">ภารกิจรายวัน</span>
          <div className="mt-1 flex flex-col gap-2">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={t} onChange={(e) => setTasks((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`ภารกิจที่ ${i + 1} เช่น เก็บเงินวันละ 50 บาท`} data-testid="manifest-task-input" className={INPUT} />
                {tasks.length > 1 ? <button type="button" onClick={() => setTasks((xs) => xs.filter((_, j) => j !== i))} className="flex-none text-[13px] text-v3-text-muted">ลบ</button> : null}
              </div>
            ))}
            {tasks.length < 5 ? <button type="button" onClick={() => setTasks((xs) => [...xs, ""])} className="w-fit text-[13px] font-bold text-v3-cyan">+ เพิ่มภารกิจ</button> : null}
          </div>
        </div>
        {err ? <p className="mt-3 text-[12px] font-bold text-v3-error" data-testid="manifest-create-err">{err}</p> : null}
        <div className="mt-4"><KitButton onClick={() => void submit()} disabled={saving} testId="manifest-create-submit">{saving ? "กำลังบันทึก..." : "บันทึกแมนิเฟสต์"}</KitButton></div>
      </div>
    </div>
  )
}

export default ManifestScreen
