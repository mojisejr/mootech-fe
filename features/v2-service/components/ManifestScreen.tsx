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
  id: string; title: string; affirmation: string | null; imageUrl: string | null; category?: string | null
  status: string; tasks: Task[]; progress: { done: number; target: number; percent: number }
}

// ย่อรูปฝั่ง client (canvas) ก่อนอัปโหลด → dataURL jpeg (คุมขนาดไฟล์ที่เก็บใน storage)
function resizeImage(file: File, maxEdge = 1080, quality = 0.82): Promise<{ dataUrl: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("read failed"))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error("decode failed"))
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) return reject(new Error("no canvas"))
        ctx.drawImage(img, 0, 0, w, h)
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality), mime: "image/jpeg" })
      }
      img.src = String(reader.result ?? "")
    }
    reader.readAsDataURL(file)
  })
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

// ตั้งเวลาแมนิเฟสต์ (07:00 + แจ้งเตือนทุกวัน) — เก็บค่าไว้ local + ขอสิทธิ์แจ้งเตือน
// TODO(push): ต่อ schedule จริงกับ calendar push infra (kind=manifest) — pass ถัดไป
function ReminderCard() {
  const [time, setTime] = useState("07:00")
  const [on, setOn] = useState(false)
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("mumate-manifest-reminder") || "{}") as { time?: string; on?: boolean }
      if (raw.time) setTime(raw.time)
      if (typeof raw.on === "boolean") setOn(raw.on)
    } catch { /* ignore */ }
  }, [])
  const persist = (t: string, o: boolean) => {
    try { localStorage.setItem("mumate-manifest-reminder", JSON.stringify({ time: t, on: o })) } catch { /* ignore */ }
  }
  const toggle = async () => {
    const next = !on
    setOn(next); persist(time, next)
    if (next && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission() } catch { /* ignore */ }
    }
  }
  return (
    <section className="rounded-[24px] bg-white p-5 v3-shadow-card" data-testid="manifest-reminder">
      <p className="text-[16px] font-bold text-v3-navy">ตั้งเวลาแมนิเฟสต์</p>
      <p className="mt-1 text-[12px] leading-4 text-v3-text-muted">คนที่ตั้งเวลาอ่านต่อเนื่องได้นานกว่าถึง 3 เท่า</p>
      <div className="mt-3 flex items-center justify-between rounded-[16px] bg-v3-ghost-white px-4 py-3">
        <div>
          <input type="time" value={time} onChange={(e) => { setTime(e.target.value); persist(e.target.value, on) }} className="bg-transparent text-[20px] font-black text-v3-navy outline-none" data-testid="manifest-reminder-time" />
          <p className="text-[11px] text-v3-text-muted">แจ้งเตือนทุกวัน</p>
        </div>
        <button type="button" role="switch" aria-checked={on} onClick={() => void toggle()} data-testid="manifest-reminder-toggle" className={`relative h-7 w-12 flex-none rounded-full transition ${on ? "bg-v3-cyan" : "bg-v3-border-card"}`}>
          <span className={`absolute top-0.5 size-6 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
    </section>
  )
}

export function ManifestScreen({ previewData }: { previewData?: ManifestPreview } = {}) {
  const [goals, setGoals] = useState<Goal[]>(previewData?.goals ?? [])
  const [element, setElement] = useState<ElementInfo>(previewData?.element ?? null)
  const [loading, setLoading] = useState(!previewData)
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

  useEffect(() => { if (previewData) return; void load() }, [load, previewData])

  const activeCount = goals.filter((g) => g.status === "active").length

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
            <section className="relative overflow-hidden rounded-[24px] bg-v3-sapphire px-4 pb-5 pt-6 text-white" data-testid="manifest-list">
              {/* มาสคอตธาตุลอย (ล่างใกล้ปุ่ม) + ขยับ */}
              {(
                [
                  { el: "el-fire", cls: "left-1 bottom-14 h-11 w-11", d: "0s" },
                  { el: "el-earth", cls: "left-16 bottom-12 h-7 w-7", d: ".4s" },
                  { el: "el-water", cls: "left-28 bottom-14 h-8 w-8", d: ".8s" },
                  { el: "el-wood", cls: "right-1 bottom-12 h-12 w-12", d: ".3s" },
                ] as const
              ).map((m) => (
                <span key={m.el} aria-hidden className={`v3-float pointer-events-none absolute z-10 ${m.cls}`} style={{ animationDelay: m.d }}>
                  <Image src={`/images/v2/destiny/${m.el}.png`} alt="" width={48} height={48} unoptimized className="h-full w-full object-contain drop-shadow" />
                </span>
              ))}
              <div className="relative text-center">
                <h2 className="text-[18px] font-black leading-6">สมุดแมนิเฟสต์ของคุณ</h2>
                <p className="mx-auto mt-1 max-w-[300px] text-[12px] leading-[18px] text-white/90">
                  เขียนสิ่งที่อยากให้เกิดขึ้นเป็นประโยคที่เกิดขึ้นแล้ว แล้วกลับมาอ่านทุกวันจนจิตคุ้นชินกับภาพนั้น
                </p>
              </div>
              <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="manifest-carousel">
                {goals.map((g) => (
                  <article key={g.id} className="w-[86%] shrink-0 snap-center overflow-hidden rounded-[16px] bg-white text-v3-navy" data-testid="manifest-goal">
                    {g.imageUrl ? (
                      <span className="block h-[150px] w-full overflow-hidden">
                        <Image src={g.imageUrl} alt="" width={480} height={300} unoptimized className="h-full w-full object-cover" />
                      </span>
                    ) : null}
                    <div className="flex items-start gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        {g.category ? <span className="inline-block rounded-full bg-[#3E9B4A] px-2 py-0.5 text-[11px] font-semibold text-white">{g.category}</span> : null}
                        <p className="mt-1 text-[14px] font-bold leading-5">{g.affirmation || g.title}</p>
                      </div>
                      <button type="button" onClick={() => void deleteGoal(g.id)} aria-label="ลบความปรารถนา" data-testid="manifest-delete" className="flex-none text-[12px] text-v3-text-muted">ลบ</button>
                    </div>
                  </article>
                ))}
              </div>
              {activeCount < MAX_GOALS ? (
                <button onClick={() => setCreating(true)} data-testid="manifest-add" className="relative z-20 mx-auto mt-4 grid h-11 w-[62%] place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire">เพิ่มความปรารถนา</button>
              ) : <p className="mt-3 text-center text-[12px] text-white/80">เขียนครบ {MAX_GOALS} ข้อแล้ว โฟกัสให้สำเร็จก่อนนะ</p>}
            </section>
          )}

          {/* การ์ดธาตุประจำเดือน */}
          {!loading && <ElementInsightCard element={element} />}

          {/* ตั้งเวลาแมนิเฟสต์ */}
          {!loading && <ReminderCard />}

          {/* ปุ่มล่าง — เพิ่มความปรารถนา (เมื่อยังไม่ครบ 5) */}
          {!loading && goals.length > 0 && activeCount < MAX_GOALS && (
            <KitButton onClick={() => setCreating(true)} testId="manifest-add-bottom">+ เพิ่มความปรารถนาของคุณ</KitButton>
          )}
        </div>
      </div>

      {creating ? <CreateGoalModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load() }} /> : null}
      <Menubar />
    </div>
  )
}

// "เพิ่มความปรารถนา" — เขียนประโยค (เกิดขึ้นแล้ว) + เลือกหมวด + แนบรูป (ย่อ+อัปโหลด → URL)
function CreateGoalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [text, setText] = useState("")
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true); setErr(null)
    try {
      const { dataUrl, mime } = await resizeImage(file)
      const r = await fetch("/api/v2/manifest/photo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl, mime }),
      })
      const j = (await r.json().catch(() => ({}))) as { url?: string }
      if (r.ok && j.url) setPhoto(j.url)
      else setErr("อัปโหลดรูปไม่สำเร็จ")
    } catch { setErr("อ่าน/ย่อรูปไม่สำเร็จ") } finally { setUploading(false) }
  }

  const submit = async () => {
    if (!text.trim()) { setErr("เขียนความปรารถนาก่อนนะ"); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch("/api/v2/manifest/goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: text.trim().slice(0, 120),
          affirmation: text.trim(),
          category,
          imageUrl: photo ?? undefined,
        }),
      })
      if (res.ok) { onCreated(); return }
      const j = await res.json().catch(() => ({}))
      setErr(res.status === 409 ? String(j.error ?? "มีความปรารถนาครบ 5 ข้อแล้ว") : "บันทึกไม่สำเร็จ")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose} data-testid="manifest-create">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-black text-v3-navy">เพิ่มความปรารถนา</h2>
          <button type="button" onClick={onClose} className="text-[16px] font-bold text-v3-text-muted">✕</button>
        </div>

        <label className="mt-3 block">
          <span className="text-[13px] font-bold text-v3-navy">เขียนเป็นประโยคที่เกิดขึ้นแล้ว</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="เช่น ฉันได้งานที่ใช่ และมีทีมที่เข้าใจกัน" data-testid="manifest-title" className="mt-1 w-full rounded-[14px] border border-v3-border-input bg-white p-3 text-[14px] outline-none focus:border-v3-navy" />
        </label>

        <div className="mt-3">
          <span className="text-[13px] font-bold text-v3-navy">หมวด</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${category === c ? "bg-[#3E9B4A] text-white" : "border border-[#3E9B4A]/40 text-[#3E9B4A]"}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <span className="text-[13px] font-bold text-v3-navy">รูปภาพ (ไม่บังคับ)</span>
          <label className="mt-1 flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-v3-border-input bg-v3-ghost-white" data-testid="manifest-photo-pick">
            <input type="file" accept="image/*" className="hidden" onChange={onPick} />
            {uploading ? (
              <span className="text-[13px] text-v3-text-muted">กำลังอัปโหลด…</span>
            ) : photo ? (
              <Image src={photo} alt="" width={400} height={160} unoptimized className="h-full w-full object-cover" />
            ) : (
              <span className="text-[13px] text-v3-text-muted">+ แตะเพื่อเลือกรูป</span>
            )}
          </label>
        </div>

        {err ? <p className="mt-3 text-[12px] font-bold text-v3-error" data-testid="manifest-create-err">{err}</p> : null}
        <div className="mt-4"><KitButton onClick={() => void submit()} disabled={saving || uploading} testId="manifest-create-submit">{saving ? "กำลังบันทึก..." : "บันทึกความปรารถนา"}</KitButton></div>
      </div>
    </div>
  )
}

export default ManifestScreen
