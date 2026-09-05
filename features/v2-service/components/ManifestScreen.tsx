// features/v2-service/components/ManifestScreen.tsx — /v2/service/manifest (มานิเฟส)
// ต่อ ENGINE: /api/manifest/goals + /checkin (ผ่าน BFF /api/v2/manifest/*). ไม่มีเฟรม Figma → ออกแบบเองตามภาษาแอป.
// ตั้งเป้าหมาย + คำยืนยัน(affirmation) + ภารกิจรายวัน → ติ๊กเช็คอินให้ครบ, มี progress ต่อเป้าหมาย.
import Head from "next/head"
import { useCallback, useEffect, useMemo, useState } from "react"

import { SkyBackdrop, SkyHeader, KitButton } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

type Task = { id: string; title: string; targetCount: number; isDaily: boolean; doneCount: number }
type Goal = {
  id: string; title: string; affirmation: string | null; imageUrl: string | null
  status: string; tasks: Task[]; progress: { done: number; target: number; percent: number }
}

const CARD = "v3-shadow-card w-full rounded-[24px] bg-white p-5"
const MAX_GOALS = 5

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

export function ManifestScreen() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedToday, setCheckedToday] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch("/api/v2/manifest/goals").then((x) => (x.ok ? x.json() : null))
      setGoals(Array.isArray(j?.goals) ? j.goals.filter((g: Goal) => g.status !== "archived") : [])
    } catch { setGoals([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { setCheckedToday(readCheckedToday()); void load() }, [load])

  const activeCount = goals.filter((g) => g.status === "active").length

  const toggleTask = async (goalId: string, task: Task) => {
    const wasDone = checkedToday.has(task.id)
    const next = new Set(checkedToday)
    if (wasDone) next.delete(task.id); else next.add(task.id)
    setCheckedToday(next); writeCheckedToday(next)
    // ปรับ progress แบบ optimistic
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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop height={440} />
      <Head><title>มานิเฟส · ตั้งเป้าหมาย & คำยืนยัน · MuMate</title></Head>
      <SkyHeader title="มานิเฟส" backHref="/v2/service" testId="manifest" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-40 pt-2">
        {/* HERO */}
        <section className="flex flex-col items-center gap-2 text-center" data-testid="manifest-hero">
          <p className="text-[36px]">🌙</p>
          <h1 className="text-[22px] font-black leading-7 text-v3-navy">ตั้งเป้าหมาย แล้วดึงดูดให้เป็นจริง</h1>
          <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">ตั้งใจให้ชัด เขียนคำยืนยัน (affirmation) แล้วทำภารกิจเล็ก ๆ ทุกวัน — จักรวาลจัดสรรให้</p>
        </section>

        {loading ? (
          <div className="h-40 w-full animate-pulse rounded-[24px] bg-v3-ghost-white" data-testid="manifest-loading" />
        ) : goals.length === 0 ? (
          <section className={CARD + " text-center"} data-testid="manifest-empty">
            <p className="text-[32px]">✨</p>
            <p className="mt-1 text-[15px] font-black text-v3-navy">ยังไม่มีเป้าหมาย</p>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">เริ่มจากสิ่งที่อยากให้เกิดขึ้นในชีวิต แล้วมาเช็คอินทุกวันกัน</p>
            <div className="mt-4"><KitButton onClick={() => setCreating(true)} testId="manifest-add">+ สร้างเป้าหมายแรก</KitButton></div>
          </section>
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

                  {/* progress */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-v3-text-muted">
                      <span>ความคืบหน้า</span><span>{g.progress.percent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-v3-ghost-white">
                      <div className="h-full rounded-full bg-v3-sapphire transition-all" style={{ width: `${g.progress.percent}%` }} />
                    </div>
                  </div>

                  {/* daily tasks */}
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
              <KitButton variant="outline" onClick={() => setCreating(true)} testId="manifest-add">+ สร้างเป้าหมายใหม่</KitButton>
            ) : <p className="text-center text-[12px] text-v3-text-muted">มีเป้าหมายครบ {MAX_GOALS} ข้อแล้ว โฟกัสให้สำเร็จก่อนนะ</p>}
          </>
        )}

        <p className="px-2 text-center text-[11px] leading-4 text-v3-text-muted">มานิเฟสเพื่อจัดระเบียบใจและลงมือทำ ผลลัพธ์ขึ้นกับความตั้งใจของคุณ</p>
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
          <h2 className="text-[18px] font-black text-v3-navy">สร้างเป้าหมายใหม่</h2>
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
        <div className="mt-4"><KitButton onClick={() => void submit()} disabled={saving} testId="manifest-create-submit">{saving ? "กำลังสร้าง..." : "สร้างเป้าหมาย"}</KitButton></div>
      </div>
    </div>
  )
}

export default ManifestScreen
