// pages/v2/fortune/sage.tsx — เสี่ยงเซียนเสี่ยงทาย (fortune-sage / เซียมซี) เฟรม 55449:240
// flow: intro (ตั้งจิต + เลือกหัวข้อ) → loading → ผล (หัวเซี่ยงแซ + 5 หมวดทำนาย). ต่อ engine /api/fortune-sage/predict.
// โควตา: ตัด "card" (ฟรีรายวัน → ชี่) ที่ engine (qiGate) — 402 = หมด → ชวนเติม/แลกที่ /v2/qi.
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { KitButton, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

type TopicKey = "career" | "finance" | "health" | "love" | "family"
const TOPICS: { key: TopicKey; label: string }[] = [
  { key: "career", label: "การงาน" },
  { key: "finance", label: "การเงิน" },
  { key: "health", label: "สุขภาพ" },
  { key: "love", label: "ความรัก" },
  { key: "family", label: "ครอบครัว" },
]

type Stick = {
  no: number
  stem: string
  branch: string
  pillar: string
  nayin: string
  personality: string
  deity: string
  topics: Record<TopicKey, string>
  imageUrl: string | null
}

export default function FortuneSagePage() {
  const [phase, setPhase] = useState<"intro" | "loading" | "result">("intro")
  const [topic, setTopic] = useState<TopicKey | null>(null)
  const [stick, setStick] = useState<Stick | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quotaOut, setQuotaOut] = useState(false)

  const draw = async () => {
    setPhase("loading")
    setError(null)
    setQuotaOut(false)
    const started = Date.now()
    try {
      const res = await fetch("/api/fortune/sage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topic ? { topic } : {}),
      })
      const j = (await res.json().catch(() => ({}))) as { stick?: Stick; error?: { message?: string } }
      // หน่วงให้ครบ ~1.8s เพื่อให้จอ "กำลังลุ้น" ไม่วืบ
      const wait = Math.max(0, 1800 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, wait))
      if (res.status === 402) {
        setQuotaOut(true)
        setPhase("intro")
        return
      }
      if (!res.ok || !j.stick) {
        setError(j.error?.message ?? "เสี่ยงทายไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase("intro")
        return
      }
      setStick(j.stick)
      setPhase("result")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase("intro")
    }
  }

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = stick ? `เสี่ยงเซียนได้ ${stick.pillar} · ${stick.nayin} — เสี่ยงทายกับ Mumate` : "เสี่ยงทายกับ Mumate"
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title: "เสี่ยงเซียนเสี่ยงทาย", text, url }).catch(() => {})
    else if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
  }

  return (
    <SkyScreen>
      <Head><title>เสี่ยงเซียนเสี่ยงทาย · MuMate</title></Head>
      <SkyHeader title="เสี่ยงเซียนเสี่ยงทาย" backHref="/v2/service" testId="fortune-sage" />

      {phase === "loading" && (
        <div className="mt-10 flex flex-col items-center gap-4 text-center" data-testid="sage-loading">
          <span aria-hidden className="grid size-24 place-items-center rounded-full bg-v3-sapphire/15">
            <Image src="/images/v2/qi/qi-orb.png" alt="" width={84} height={84} className="size-20 animate-pulse rounded-full object-cover" />
          </span>
          <p className="text-[18px] font-black text-v3-navy">กำลังลุ้นเซียมซีให้คุณ</p>
          <p className="text-[13px] text-v3-text-body">ตั้งจิตให้นิ่ง แล้วรอเซียนตอบ…</p>
          <span aria-hidden className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-v3-ghost-white">
            <span className="block h-full w-2/3 animate-pulse rounded-full bg-v3-lime" />
          </span>
        </div>
      )}

      {phase === "intro" && (
        <div className="mt-3 flex flex-col gap-4" data-testid="sage-intro">
          <section className="v3-shadow-card flex flex-col items-center gap-3 rounded-[24px] bg-white p-6 text-center">
            <span aria-hidden className="grid size-28 place-items-center rounded-full bg-[rgba(245,165,42,0.25)]" style={{ boxShadow: "0 0 18px rgba(245,165,42,0.4)" }}>
              <Image src="/images/v2/qi/qi-orb.png" alt="" width={92} height={92} className="size-24 rounded-full object-cover" />
            </span>
            <h1 className="text-[20px] font-black text-v3-navy">เสี่ยงเซียนเสี่ยงทาย</h1>
            <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">
              ตั้งจิตอธิษฐานถึงสิ่งที่อยากรู้ เลือกหัวข้อ (หรือไม่เลือกก็ได้) แล้วเสี่ยงเซียมซีรับคำทำนายจากเซียน
            </p>
          </section>

          <div>
            <p className="mb-2 px-1 text-[14px] font-bold text-v3-navy">อยากถามเรื่องอะไร (ไม่บังคับ)</p>
            <div className="flex flex-wrap gap-2" data-testid="sage-topics">
              {TOPICS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTopic(topic === t.key ? null : t.key)}
                  data-testid={`sage-topic-${t.key}`}
                  className={"h-9 rounded-full px-4 text-[13px] font-bold " + (topic === t.key ? "bg-v3-navy text-white" : "border border-v3-border-card bg-white text-v3-navy")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {quotaOut && (
            <div className="rounded-[16px] bg-[#FDF3E0] p-4" data-testid="sage-quota">
              <p className="text-[13px] font-bold text-[#8A5A0C]">โควตาเสี่ยงทายวันนี้หมดแล้ว</p>
              <p className="text-[12px] leading-4 text-[#8A5A0C]">แลก 10 QI เพื่อเสี่ยงเพิ่ม หรือเช็คอิน/ทำภารกิจรับ QI ฟรี</p>
              <Link href="/v2/qi" className="mt-2 inline-block text-[13px] font-bold text-v3-sapphire">ไปหน้าพลังชี่ →</Link>
            </div>
          )}
          {error && <p data-testid="sage-error" className="text-center text-[13px] font-bold text-v3-error">{error}</p>}

          <KitButton onClick={() => void draw()} testId="sage-draw">เสี่ยงทายเลย</KitButton>
          <p className="text-center text-[11px] text-v3-text-muted">ใช้โควตาเปิดการ์ดวันละ 1 ครั้ง (ฟรี) — เกินแล้วแลกด้วย QI</p>
        </div>
      )}

      {phase === "result" && stick && (
        <div className="mt-3 flex flex-col gap-4" data-testid="sage-result">
          {/* หัวเซี่ยงแซ */}
          <section className="v3-shadow-card flex flex-col items-center gap-2 overflow-hidden rounded-[24px] bg-white p-6 text-center">
            {stick.imageUrl ? (
              <span className="relative h-40 w-full overflow-hidden rounded-[16px]"><Image src={stick.imageUrl} alt="" fill sizes="360px" className="object-cover" /></span>
            ) : (
              <span aria-hidden className="grid size-24 place-items-center rounded-full bg-[rgba(245,165,42,0.2)]"><Image src="/images/v2/qi/qi-orb.png" alt="" width={80} height={80} className="size-20 rounded-full object-cover" /></span>
            )}
            <p className="mt-2 text-[12px] font-bold text-v3-cyan">ครั้งที่ {stick.no}</p>
            <p className="text-[30px] font-black leading-none text-v3-navy" data-testid="sage-pillar">{stick.pillar}</p>
            <p className="text-[14px] font-bold text-[#E5A93B]">{stick.nayin}</p>
            {topic ? <span className="mt-1 rounded-full bg-v3-ghost-white px-3 py-1 text-[12px] font-bold text-v3-sapphire">{TOPICS.find((t) => t.key === topic)?.label}</span> : null}
          </section>

          <Section title="คำทำนายพื้นฐาน" tone="bg-[#EAF3FF] text-v3-sapphire">{stick.personality}</Section>
          {TOPICS.map((t) => (
            <Section key={t.key} title={t.label} tone={topic === t.key ? "bg-v3-lime text-v3-navy" : "bg-[#F6ECF0] text-[#B0568A]"} highlight={topic === t.key}>
              {stick.topics[t.key]}
            </Section>
          ))}
          <Section title="สิ่งศักดิ์สิทธิ์ประจำเซียมซี" tone="bg-[#FDF3E0] text-[#8A5A0C]">{stick.deity}</Section>

          <div className="mt-1 flex flex-col gap-2">
            <KitButton onClick={share} testId="sage-share">แชร์ผลทำนาย</KitButton>
            <button onClick={() => { setStick(null); setPhase("intro") }} data-testid="sage-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">
              เสี่ยงใหม่อีกครั้ง
            </button>
          </div>
          <p className="pb-2 text-center text-[11px] leading-4 text-v3-text-muted">คำทำนายเพื่อความบันเทิงและเป็นแนวทาง โปรดใช้วิจารณญาณ</p>
        </div>
      )}

      <Menubar />
    </SkyScreen>
  )
}

function Section({ title, tone, highlight, children }: { title: string; tone: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <section className={"v3-shadow-card flex w-full flex-col gap-2 rounded-[24px] bg-white p-5 " + (highlight ? "ring-2 ring-v3-lime" : "")}>
      <span className={"w-fit rounded-full px-3 py-1 text-[13px] font-black " + tone}>{title}</span>
      <p className="text-[13px] leading-[22px] text-v3-text-body">{children}</p>
    </section>
  )
}
