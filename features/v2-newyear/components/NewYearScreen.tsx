// features/v2-newyear/components/NewYearScreen.tsx — /v2/newyear, แผนชีวิตปีใหม่ 2570 (team meeting 2026-11-24,
// item 13). Three phases like the element finder: type a birth → loading → the plan. Everyone sees the
// preview (the day master, the first months, the four pillars' reactions); a yearly member gets the full
// one-page plan and can save it as an image. No price is typed here — the offers come from the page.
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"

import { PillTabs } from "@/components/ui/pill-tabs"
import { useV2Login } from "@/features/auth/hooks/useV2Login"
import { SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { track } from "@/lib/analytics/track"
import { isLineInAppBrowser } from "@/lib/browser/open-external"
import type { NewYearReading } from "@/lib/newyear/assemble"
import type { NewYearOffer } from "@/lib/newyear/offer"
import { leaveNewYearAfterPay, leaveNewYearBirth, leaveNewYearReturn, takeNewYearBirth, type NewYearBirth } from "@/lib/newyear/return"

export type NewYearOffers = { plus: NewYearOffer; pro: NewYearOffer }

type Phase = "auto" | "input" | "loading" | "result"
type Plan = "plus" | "pro"

const STEPS = ["อ่านธาตุตัวคุณ", "เทียบกับปีมะแม 丁未", "ดูทั้ง 12 เดือน", "สรุปสิ่งที่ควรทำ"]
const MIN_LOADING_MS = 1800
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
const TODAY_ISO = new Date().toLocaleDateString("en-CA") // ค.ศ. — จำกัด max ไม่ให้เลือกอนาคต

// เฟรม form-card / CTA ของหน้าร้าน: ขาว + r24 + p20 · ปุ่มหลัก navy r50 h48 (เดียวกับหน้าหาธาตุ)
// CARD ไม่กำหนด gap — ให้แต่ละ section ใส่เอง (gap-3 กับ gap-4 ชนกันใน CSS ถ้าอยู่ในสตริงเดียวกัน) · PLAN_CARD = การ์ดในกล่องแผน (ไม่จำกัด max-w)
const CARD = "v3-shadow-card flex w-full max-w-md flex-col rounded-[24px] bg-white p-5"
const PLAN_CARD = "v3-shadow-card flex w-full flex-col gap-4 rounded-[24px] bg-white p-5"
const INPUT = "w-full rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[15px] font-medium text-v3-navy outline-none focus:border-v3-sapphire disabled:bg-black/5 disabled:text-v3-placeholder"
const PRIMARY = "grid h-12 w-full place-items-center rounded-full bg-v3-navy text-[15px] font-bold text-white disabled:opacity-40"
const SECONDARY = "grid h-12 w-full place-items-center rounded-full border border-v3-sapphire bg-white text-[15px] font-bold text-v3-sapphire"

type MonthState = NewYearReading["months"][number]["state"]
const STATE: Record<MonthState, { text: string; cls: string }> = {
  peak: { text: "ดี", cls: "bg-v3-qi-earn-bg text-v3-qi-earn-icon" },
  care: { text: "ระวัง", cls: "bg-v3-rose-tint text-v3-error" },
  normal: { text: "ปกติ", cls: "bg-v3-sapphire-tint text-v3-text-muted" },
}
const TONE: Record<"good" | "care" | "calm", string> = {
  good: "bg-v3-qi-earn-bg text-v3-qi-earn-icon",
  care: "bg-v3-rose-tint text-v3-error",
  calm: "bg-v3-sapphire-tint text-v3-text-muted",
}
const GENDERS = [{ label: "ชาย", value: "male" }, { label: "หญิง", value: "female" }]
const baht = (n: number | null) => (n === null ? "" : `฿${n.toLocaleString("th-TH")}`)

export function NewYearScreen({ offers }: { offers: NewYearOffers }) {
  const { onLine } = useV2Login()
  const loginRef = useRef(onLine)
  loginRef.current = onLine

  const [phase, setPhase] = useState<Phase>("auto")
  const [step, setStep] = useState(0)
  const [reading, setReading] = useState<NewYearReading | null>(null)
  const [error, setError] = useState<string | null>(null)
  // ล็อกอินแล้วแต่โปรไฟล์ยังไม่มีวันเกิดครบ (409) → ฟอร์มขึ้นพร้อมบอกว่าทำไม
  const [needBirth, setNeedBirth] = useState(false)
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [gender, setGender] = useState("male")
  // วันเกิดที่กรอกเองล่าสุด — เก็บไว้ให้หน้านี้เปิดแผนเดิมได้หลังกลับจากล็อกอิน/checkout
  const lastTypedRef = useRef<NewYearBirth | null>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveImg, setSaveImg] = useState<string | null>(null)

  const run = useCallback(async (typed: NewYearBirth | null) => {
    setPhase("loading"); setError(null); setStep(0)
    lastTypedRef.current = typed
    const timers = STEPS.map((_, i) => window.setTimeout(() => setStep(i + 1), 520 * (i + 1)))
    const started = Date.now()
    try {
      const res = await fetch("/api/newyear/reading", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typed ? { birth: typed } : {}),
      })
      const body = (await res.json().catch(() => ({}))) as Partial<NewYearReading> & { code?: string }
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_LOADING_MS - (Date.now() - started))))
      if (res.ok && body.year) {
        setReading(body as NewYearReading)
        setPhase("result")
        track("newyear_result", { member: body.chart?.source === "saved", unlocked: body.locked === false })
        return
      }
      // 401 = ยังไม่ล็อกอิน · 409 = ล็อกอินแล้วแต่วันเกิดไม่ครบ → ทั้งสองทางให้กรอกเอง
      if (res.status === 401 || res.status === 409) { setNeedBirth(res.status === 409); setPhase("input"); return }
      setError(
        res.status === 429 ? "ยิงถี่ไปหน่อยนะครับ ลองใหม่อีกครั้งในสักครู่"
          : res.status === 403 ? "หน้านี้หมดอายุแล้ว ลองรีเฟรชแล้วกรอกใหม่อีกครั้ง"
          : "คำนวณแผนไม่สำเร็จ ลองอีกครั้ง",
      )
      setPhase("input")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase("input")
    } finally { timers.forEach((t) => window.clearTimeout(t)) }
  }, [])

  // เปิดหน้า: มีวันเกิดที่เก็บไว้ (กลับจากล็อกอิน/checkout) → ใช้เลย · ไม่มี → ลองวันเกิดที่บันทึกไว้ของสมาชิก
  useEffect(() => {
    void run(takeNewYearBirth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = DOB_RE.test(date) && (timeUnknown || TIME_RE.test(time))
  const submit = () => {
    if (!canSubmit) return
    track("newyear_form_submit", { time_known: !timeUnknown })
    void run({ date, time: timeUnknown ? null : time, gender: gender === "female" ? "female" : "male" })
  }

  // ซื้อรายปี → checkout (คนยังไม่ล็อกอิน checkout จะพาไปล็อกอินแล้วกลับมาเอง) · จ่ายเสร็จหน้า success พากลับหน้านี้
  const buy = (plan: Plan) => {
    track("newyear_unlock_click", { plan })
    leaveNewYearAfterPay()
    if (lastTypedRef.current) leaveNewYearBirth(lastTypedRef.current)
    window.location.assign(offers[plan].href)
  }
  // ซื้อรายปีไว้แล้ว → ล็อกอินแล้วกลับมาหน้านี้ (OAuth callback คงที่ที่ /v2 จึงต้องทิ้ง marker ไว้)
  const login = () => {
    track("newyear_login_click", { from: "plan" })
    leaveNewYearReturn()
    if (lastTypedRef.current) leaveNewYearBirth(lastTypedRef.current)
    loginRef.current()
  }

  // บันทึกแผนเป็นรูป — จับเฉพาะกล่องแผน (planRef) ผ่าน html2canvas → JPEG · แบบเดียวกับ wallpaper หน้าหาธาตุ
  const save = async () => {
    const node = planRef.current
    if (!node || saving) return
    setSaving(true)
    let url: string | null = null
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2, useCORS: true })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92))
      if (!blob) { setError("บันทึกภาพไม่สำเร็จ ลองใหม่อีกครั้ง"); return }
      url = URL.createObjectURL(blob)
      if (isLineInAppBrowser()) {
        setSaveImg(url) // แอป LINE บล็อก download → โชว์รูปให้กดค้าง (ไม่ revoke จนปิด overlay)
        return
      }
      const a = document.createElement("a"); a.href = url; a.download = "mumate-newyear-2570.jpg"
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      track("newyear_download", { format: "jpeg" })
    } catch {
      setError("บันทึกภาพไม่สำเร็จ ลองใหม่อีกครั้ง")
      if (url) URL.revokeObjectURL(url)
    } finally { setSaving(false) }
  }
  const closeSaveImg = () => {
    if (saveImg) URL.revokeObjectURL(saveImg)
    setSaveImg(null)
    track("newyear_download", { format: "jpeg" })
  }

  const full = reading?.full
  const locked = reading?.locked ?? true

  return (
    <SkyScreen bgImage="/images/v2/fortune/sage-bg.png">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 px-4 pb-6 pt-3" data-testid="newyear">
        {/* โลโก้ Mumate ด้านบน — เหมือนหน้าหาธาตุ */}
        <Image src="/images/v2/logo/splash-logo.png" alt="Mumate" width={148} height={36} priority className="h-9 w-auto object-contain" />

        {phase === "result" && reading ? (
          <div className="mt-1 flex w-full flex-col items-center gap-3" data-testid="newyear-result">
            {/* กล่องแผน — สิ่งเดียวที่ถูกจับเป็นรูป (ปุ่มทั้งหมดอยู่นอกกล่อง) */}
            <div ref={planRef} className="flex w-full flex-col gap-3 rounded-[24px] bg-white p-3" data-testid="newyear-plan">
              {/* 1 · ภาพรวมปี: ธาตุตัวคุณ + ไฟของปีทำอะไรกับคุณ */}
              <section className="flex flex-col items-center gap-1 rounded-[22px] bg-v3-sapphire-tint px-4 py-4 text-center" data-testid="newyear-hero">
                {reading.headline?.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reading.headline.picture} alt="" width={96} height={96} className="size-24 object-contain" />
                ) : null}
                <p className="text-[12px] font-bold text-v3-text-muted">
                  ธาตุตัวคุณ{reading.headline?.th ? ` · ${reading.headline.th}` : ""}
                </p>
                {reading.headline?.fire ? <h2 className="text-[17px] font-black leading-6 text-v3-navy">{reading.headline.fire}</h2> : null}
                {reading.draft ? <p data-testid="newyear-draft" className="text-[10px] leading-4 text-v3-text-muted">คำทำนายฉบับร่าง · รอซินแสตรวจ</p> : null}
              </section>

              {/* 2 · 12 เดือนของปีมะแม — ทุกคนเห็น 3 เดือนแรก · ที่เหลือเบลอจนกว่าจะปลดล็อก */}
              <section className={PLAN_CARD} data-testid="newyear-months">
                <h3 className="text-[15px] font-black text-v3-navy">12 เดือนของปีมะแม</h3>
                <div className="grid grid-cols-4 gap-2">
                  {reading.months.map((m, i) => {
                    const hidden = locked && i >= reading.previewMonths
                    return (
                      <div key={m.branch} data-testid="newyear-month" data-state={hidden ? "hidden" : m.state} className="flex flex-col items-center gap-0.5 rounded-[14px] border border-v3-border-card px-1 py-2">
                        <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + (hidden ? "bg-v3-border-card text-v3-text-muted" : STATE[m.state].cls)}>
                          {hidden ? "?" : STATE[m.state].text}
                        </span>
                        <span className={"text-[12px] font-bold text-v3-navy " + (hidden ? "blur-[4px]" : "")}>{m.name}</span>
                        <span className="text-[10px] text-v3-text-muted">{m.short}</span>
                      </div>
                    )
                  })}
                </div>
                {locked ? <p className="text-[11px] leading-4 text-v3-text-muted">ปลดล็อกเพื่อดูคำแนะนำครบทั้ง 12 เดือน</p> : null}
              </section>

              {/* 3 · 4 เสาของคุณกับปีนี้ — ทุกคนเห็นภาพ + ชื่อความสัมพันธ์ · เรื่องเล่าและสิ่งที่ควรทำเฉพาะคนปลดล็อก */}
              <section className={PLAN_CARD} data-testid="newyear-pillars">
                <h3 className="text-[15px] font-black text-v3-navy">4 เสาของคุณกับปีนี้</h3>
                {reading.pillars.map((p) => {
                  const r = full?.readings.find((x) => x.key === p.key)
                  return (
                    <article key={p.key} data-testid="newyear-pillar" className="flex flex-col gap-2 rounded-[18px] border border-v3-border-card p-3">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.image} alt="" width={56} height={56} className="size-14 flex-none object-contain" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-5 text-v3-navy">{p.label}</p>
                          <p className="text-[11px] leading-4 text-v3-text-muted">{p.animal} · ธาตุ{p.element}</p>
                        </div>
                        <span className={"shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold " + TONE[p.tone]}>{p.name}</span>
                      </div>
                      {r ? (
                        <>
                          <p className="text-[13px] font-bold leading-5 text-v3-sapphire">{r.headline}</p>
                          <p className="text-[13px] leading-5 text-v3-text-body">{r.story}</p>
                          <ul className="flex flex-col gap-1 pl-4">
                            {r.actions.map((a) => (
                              <li key={a} className="list-disc text-[12px] leading-[18px] text-v3-text-body">{a}</li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </article>
                  )
                })}
              </section>

              {/* 4 · แผนปีใหม่ของคุณ — เฉพาะคนปลดล็อก: ธาตุที่ช่วย/ควรเลี่ยง + สิ่งที่ควรทำรายเสา + คำแนะนำรายเดือน */}
              {full ? (
                <section className={PLAN_CARD} data-testid="newyear-full">
                  <h3 className="text-[15px] font-black text-v3-navy">แผนปีใหม่ของคุณ</h3>
                  {reading.luck ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-v3-qi-earn-bg px-3 py-1 text-[12px] font-bold text-v3-qi-earn-icon">ธาตุที่ช่วย · {reading.luck.favorable.join(" ")}</span>
                      <span className="rounded-full bg-v3-rose-tint px-3 py-1 text-[12px] font-bold text-v3-error">ควรเลี่ยง · {reading.luck.avoid.join(" ")}</span>
                    </div>
                  ) : null}
                  <ol className="flex flex-col gap-2">
                    {full.plan.map((p) => (
                      <li key={p.key} className="rounded-[14px] bg-v3-sapphire-tint px-3 py-2 text-[13px] leading-5 text-v3-navy">
                        <b>{p.label.split(" · ")[0]}:</b> {p.line}
                      </li>
                    ))}
                  </ol>
                  <div className="flex flex-col gap-1.5">
                    {reading.months.map((m) => (
                      <p key={m.branch} className="text-[12px] leading-[18px] text-v3-text-body">
                        <b className="text-v3-navy">{m.name} ({m.short}):</b> {full.monthTips[m.branch] ?? ""}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            {error ? <p className="text-center text-[12px] font-bold text-v3-error" data-testid="newyear-error">{error}</p> : null}

            {locked ? (
              /* ปลดล็อก = ซื้อแพ็กรายปี (ของแถม) — ราคามาจาก payment_package ผ่าน props ของหน้า */
              <section className={CARD + " gap-3 text-center"} data-testid="newyear-unlock">
                <h3 className="text-[17px] font-black leading-6 text-v3-navy">ปลดล็อกแผนเต็ม พร้อมสมาชิกรายปี</h3>
                <p className="text-[12px] leading-5 text-v3-text-body">ดูได้ครบทั้ง 4 เสา ทั้ง 12 เดือน และสิ่งที่ควรทำ พร้อมบันทึกเป็นรูป</p>
                <button type="button" onClick={() => buy("plus")} data-testid="newyear-buy-plus" className={PRIMARY}>
                  {`Mumate + รายปี${offers.plus.price !== null ? ` · ${baht(offers.plus.price)}` : ""}`}
                </button>
                <button type="button" onClick={() => buy("pro")} data-testid="newyear-buy-pro" className={SECONDARY}>
                  {`Mumate Pro รายปี${offers.pro.price !== null ? ` · ${baht(offers.pro.price)}` : ""}`}
                </button>
                {!reading.chart.signedIn ? (
                  <button type="button" onClick={login} data-testid="newyear-login" className="min-h-[44px] px-2 text-[13px] font-bold text-v3-sapphire underline">
                    ซื้อรายปีไว้แล้ว? ล็อกอินด้วย LINE เพื่อดูแผนเต็ม
                  </button>
                ) : null}
              </section>
            ) : (
              <div className="flex w-full max-w-md gap-2">
                <button type="button" onClick={() => void save()} disabled={saving} data-testid="newyear-download" className={PRIMARY}>
                  {saving ? "กำลังบันทึก…" : "บันทึกเป็นรูป"}
                </button>
              </div>
            )}
            <button type="button" onClick={() => { setReading(null); setError(null); setPhase("input") }} data-testid="newyear-again" className="min-h-[44px] px-2 text-[13px] font-bold text-v3-sapphire">
              ดูแผนของคนอื่นอีกครั้ง
            </button>
          </div>
        ) : phase === "input" ? (
          <div className="mt-2 flex flex-col items-center gap-3" data-testid="newyear-input">
            <span className="rounded-full bg-v3-sapphire/10 px-3 py-1 text-[11px] font-black tracking-wide text-v3-sapphire">NEW YEAR SOLUTION</span>
            <h1 className="text-center text-[27px] font-black leading-9 text-v3-navy">แผนชีวิตปีใหม่ 2570</h1>
            <p className="-mt-1.5 text-center text-[13px] leading-5 text-v3-text-body">ปีใหม่มาหา solution ของคุณ · สรุปทั้งปีในหน้าเดียว เฉพาะดวงคุณ</p>
            {needBirth ? <p className="text-center text-[12px] font-medium text-v3-text-muted">โปรไฟล์ของคุณยังไม่มีวันเกิดครบ กรอกเพื่อดูแผนของคุณ</p> : null}

            <section className={CARD + " gap-4"}>
              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-v3-navy">วันเกิดของคุณ
                <input
                  type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  min="1900-01-01" max={TODAY_ISO} aria-label="วันเกิด" data-testid="newyear-date"
                  className={INPUT}
                />
                <span className="text-[11px] font-normal text-v3-text-muted">แตะเพื่อเลือกวันเกิดจากปฏิทิน</span>
              </label>

              <div className="flex flex-col gap-1.5" data-testid="newyear-time-block">
                <span className="flex items-center justify-between">
                  <span className={"text-[13px] font-bold text-v3-navy " + (timeUnknown ? "opacity-40" : "")}>เวลาเกิด (ถ้ารู้ จะแม่นขึ้น)</span>
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-v3-text-body">
                    <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} data-testid="newyear-time-unknown" className="size-4 accent-v3-sapphire" />
                    ไม่ทราบเวลาเกิด
                  </span>
                </span>
                <input type="time" value={time} disabled={timeUnknown} onChange={(e) => setTime(e.target.value)} data-testid="newyear-time" aria-label="เวลาเกิด" className={INPUT} />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-bold text-v3-navy">เพศ</span>
                <PillTabs items={GENDERS} value={gender} onChange={setGender} ariaLabel="เพศ" />
                <span className="text-[11px] font-normal text-v3-text-muted">เพศมีผลต่อทิศวัยจร ตรวจสอบก่อนกดดูแผน</span>
              </div>

              {error ? <p className="text-center text-[12px] font-bold text-v3-error" data-testid="newyear-error">{error}</p> : null}
              <button type="button" onClick={submit} disabled={!canSubmit} data-testid="newyear-submit" className={PRIMARY + " mt-1"}>ดูแผนปีใหม่ของฉัน →</button>
            </section>
          </div>
        ) : (
          /* auto + loading: กันฟอร์มแวบก่อนรู้ว่าสมาชิกมีวันเกิดบันทึกไว้ไหม */
          <div className="mt-10 flex flex-col items-center gap-4 text-center" data-testid="newyear-loading" role="status" aria-live="polite">
            <span className="animate-fortune-breathe relative size-40"><Image src="/images/v2/destiny/el-fire.png" alt="" fill sizes="160px" className="object-contain" /></span>
            <p className="text-[20px] font-black text-v3-navy">กำลังจัดแผนปีใหม่ของคุณ…</p>
            <section className={CARD + " gap-2 text-left"}>
              {STEPS.map((s, i) => (
                <p key={s} className={"flex items-center gap-2 text-[14px] " + (i < step ? "font-bold text-v3-navy" : "text-v3-text-muted")}>
                  <span aria-hidden>{i < step ? "✅" : "⏳"}</span>{s}
                </p>
              ))}
            </section>
          </div>
        )}
      </div>

      {/* LINE in-app browser: <a download> ถูกบล็อก → โชว์รูปเดี่ยวให้ "กดค้างที่รูป" เพื่อบันทึกลงเครื่อง */}
      {saveImg ? (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/80 px-6" onClick={closeSaveImg} data-testid="newyear-save-overlay">
          <p className="text-center text-[14px] font-bold text-white">กดค้างที่รูป ▸ &quot;บันทึกรูปภาพ&quot;</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saveImg} alt="แผนชีวิตปีใหม่" onClick={(e) => e.stopPropagation()} className="max-h-[75vh] w-auto rounded-[16px] shadow-2xl" />
          <button type="button" onClick={closeSaveImg} className="mt-1 rounded-full bg-white px-6 py-2 text-[14px] font-bold text-v3-navy">ปิด</button>
        </div>
      ) : null}

      <Menubar />
    </SkyScreen>
  )
}

export default NewYearScreen
