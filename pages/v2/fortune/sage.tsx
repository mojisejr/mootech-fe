// pages/v2/fortune/sage.tsx — เซียมซีเสี่ยงทาย (fortune-sage) เฟรม 55449:240
// flow: intro (ตั้งจิต + กดเพื่อเสี่ยงโพ) → loading → ผลเซียมซี (หัวเซี่ยงแซ + 6 หมวด). ต่อ engine /api/fortune-sage/predict.
// โควตา: ตัด "card" ที่ engine (qiGate) — 402 = หมด → ชวนเติม/แลกที่ /v2/qi. แชร์ผล = ได้ +10 QI (earn "share").
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

// หัวข้อผล — จุดสีกลม + หัวข้อ (ตาม Figma) เรียงตามเฟรม
const SECTIONS: { key: TopicKey; label: string; dot: string }[] = [
  { key: "career", label: "การงาน", dot: "#8B5CF6" },
  { key: "finance", label: "การเงิน", dot: "#E5A93B" },
  { key: "health", label: "สุขภาพ", dot: "#EC4899" },
  { key: "love", label: "ความรัก", dot: "#F472B6" },
  { key: "family", label: "ครอบครัว", dot: "#22D3EE" },
]

/** แยกคำทำนายความรัก "ชาย : ... / หญิง : ..." เป็นชาย/หญิง (ถ้าแยกไม่ได้คืน null) */
function splitLove(text: string): { male: string; female: string } | null {
  const fIdx = text.search(/หญิง\s*[:：]/)
  const mIdx = text.search(/ชาย\s*[:：]/)
  if (fIdx === -1 || mIdx === -1) return null
  const male = text.slice(mIdx, fIdx).replace(/^ชาย\s*[:：]\s*/, "").replace(/[/·|]\s*$/, "").trim()
  const female = text.slice(fIdx).replace(/^หญิง\s*[:：]\s*/, "").trim()
  return male && female ? { male, female } : null
}

export default function FortuneSagePage() {
  const [phase, setPhase] = useState<"intro" | "loading" | "result">("intro")
  const [stick, setStick] = useState<Stick | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quotaOut, setQuotaOut] = useState(false)
  const [loveGender, setLoveGender] = useState<"female" | "male">("female")

  const draw = async () => {
    setPhase("loading")
    setError(null)
    setQuotaOut(false)
    const started = Date.now()
    try {
      const res = await fetch("/api/fortune/sage", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const j = (await res.json().catch(() => ({}))) as { stick?: Stick; error?: { message?: string } }
      await new Promise((r) => setTimeout(r, Math.max(0, 1800 - (Date.now() - started))))
      if (res.status === 402) { setQuotaOut(true); setPhase("intro"); return }
      if (!res.ok || !j.stick) { setError(j.error?.message ?? "เสี่ยงทายไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("intro"); return }
      setStick(j.stick)
      setPhase("result")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase("intro")
    }
  }

  const share = () => {
    // แชร์ = รับ +10 QI (earn "share" ที่ engine, daily-capped) + เปิด native share
    void fetch("/api/qi-earn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "share" }) }).catch(() => {})
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = stick ? `เสี่ยงเซียมซีได้ ${stick.pillar} · ${stick.nayin} — เสี่ยงทายกับ Mumate` : "เสี่ยงทายกับ Mumate"
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title: "เซียมซีเสี่ยงทาย", text, url }).catch(() => {})
    else if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
  }

  const love = stick ? splitLove(stick.topics.love) : null

  return (
    <SkyScreen>
      <Head><title>{phase === "result" ? "ผลเซียมซี" : "เซียมซีเสี่ยงทาย"} · MuMate</title></Head>
      <SkyHeader
        title={phase === "result" ? "ผลเซียมซี" : "เซียมซีเสี่ยงทาย"}
        backHref="/v2/service"
        testId="fortune-sage"
        right={phase === "result" ? <span className="rounded-full bg-[#FCE9F0] px-3 py-1 text-[11px] font-bold text-[#B0568A]">ใช้ไป 10 QI</span> : undefined}
      />

      {phase === "loading" && (
        <div className="mt-10 flex flex-col items-center gap-4 text-center" data-testid="sage-loading">
          <span aria-hidden className="grid h-56 w-40 place-items-center overflow-hidden rounded-[24px] bg-gradient-to-b from-[#1A2140] to-[#0B0F22]">
            <Image src="/images/v2/qi/qi-orb.png" alt="" width={84} height={84} className="size-20 animate-pulse rounded-full object-cover" />
          </span>
          <p className="text-[18px] font-black text-v3-navy">กำลังสุ่มเซียมซีให้คุณ</p>
          <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">มาร่วมสร้างบันทึกทางใจ และค้นพบความสงบไปกับพวกเรา</p>
          <span aria-hidden className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-v3-ghost-white"><span className="block h-full w-2/3 animate-pulse rounded-full bg-v3-lime" /></span>
        </div>
      )}

      {phase === "intro" && (
        <div className="mt-3 flex flex-col gap-4" data-testid="sage-intro">
          <div>
            <p className="text-[15px] font-black text-v3-navy">ตั้งจิตให้เป็นสมาธิ 1 นาที</p>
            <p className="text-[13px] leading-5 text-v3-text-body">ขอตั้งจิตอธิษฐานถามคำถามที่อยากได้คำตอบ</p>
          </div>
          {/* การ์ดภาพเซียมซี (ยังเป็น placeholder ในดีไซน์) + ปุ่มเสี่ยงโพ */}
          <section className="flex flex-col items-center gap-4 overflow-hidden rounded-[24px] bg-gradient-to-b from-[#1A2140] to-[#0B0F22] p-6">
            <span aria-hidden className="mt-6 grid size-28 place-items-center rounded-full bg-white/5">
              <Image src="/images/v2/qi/qi-orb.png" alt="" width={92} height={92} className="size-24 rounded-full object-cover opacity-90" />
            </span>
            <p className="mb-6 mt-2 text-center text-[12px] text-white/60">ตั้งจิตให้นิ่ง แล้วกดเสี่ยงโพเพื่อรับคำทำนาย</p>
            {quotaOut && <p className="text-center text-[12px] font-bold text-[#FFD48A]" data-testid="sage-quota">โควตาเสี่ยงทายวันนี้หมด — แลก 10 QI ที่หน้าพลังชี่</p>}
            {error && <p data-testid="sage-error" className="text-center text-[12px] font-bold text-[#FF9B9B]">{error}</p>}
            <KitButton onClick={() => void draw()} testId="sage-draw">กดเพื่อเสี่ยงโพ</KitButton>
          </section>
          {quotaOut && <Link href="/v2/qi" className="text-center text-[13px] font-bold text-v3-sapphire">เติม/แลก QI ที่หน้าพลังชี่ →</Link>}
          <p className="text-center text-[11px] text-v3-text-muted">ใช้โควตาเปิดการ์ดวันละ 1 ครั้ง (ฟรี) — เกินแล้วแลกด้วย QI</p>
        </div>
      )}

      {phase === "result" && stick && (
        <div className="mt-3 flex flex-col gap-3" data-testid="sage-result">
          {/* ภาพผล (placeholder ถ้าไม่มี imageUrl) */}
          <span className="grid h-52 w-full place-items-center overflow-hidden rounded-[24px] bg-gradient-to-b from-[#1A2140] to-[#0B0F22]">
            {stick.imageUrl
              ? // eslint-disable-next-line @next/next/no-img-element
                <img src={stick.imageUrl} alt="" className="size-full object-cover" />
              : <Image src="/images/v2/qi/qi-orb.png" alt="" width={80} height={80} className="size-20 rounded-full object-cover opacity-90" />}
          </span>

          {/* การ์ดครีม: หัวที่ + pillar + nayin + องค์เทพ */}
          <section className="flex flex-col items-center gap-1.5 rounded-[24px] border border-[#EAD9AE] bg-[#FBF3DE] p-5 text-center">
            <p className="text-[13px] font-bold text-[#B08A3B]">หัวที่ {stick.no}</p>
            <p className="text-[34px] font-black leading-none text-v3-navy" data-testid="sage-pillar">{stick.pillar}</p>
            <p className="text-[15px] font-bold text-[#8A6D2F]">{stick.nayin}</p>
            <span className="mt-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#B08A3B]">{stick.deity}</span>
          </section>

          <DotSection label="นิสัยและพฤติกรรม" dot="#3B82F6">{stick.personality}</DotSection>
          {SECTIONS.map((s) => (
            <DotSection key={s.key} label={s.label} dot={s.dot}>
              {s.key === "love" && love ? (
                <>
                  <div className="mb-2 inline-flex rounded-full bg-[#F6ECF0] p-0.5">
                    <button onClick={() => setLoveGender("female")} className={"rounded-full px-4 py-1 text-[12px] font-bold " + (loveGender === "female" ? "bg-white text-v3-navy shadow-sm" : "text-v3-text-muted")}>สำหรับผู้หญิง</button>
                    <button onClick={() => setLoveGender("male")} className={"rounded-full px-4 py-1 text-[12px] font-bold " + (loveGender === "male" ? "bg-white text-v3-navy shadow-sm" : "text-v3-text-muted")}>สำหรับผู้ชาย</button>
                  </div>
                  <p className="text-[13px] leading-[22px] text-v3-text-body">{loveGender === "female" ? love.female : love.male}</p>
                </>
              ) : (
                <p className="text-[13px] leading-[22px] text-v3-text-body">{stick.topics[s.key]}</p>
              )}
              {s.key === "health" ? (
                <p className="mt-2 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[11px] leading-4 text-[#A83238]">ข้อมูลเพื่อความบันเทิง ไม่ใช่คำวินิจฉัยทางการแพทย์ หากมีอาการควรพบแพทย์</p>
              ) : null}
            </DotSection>
          ))}

          <div className="mt-1 flex flex-col gap-2">
            <KitButton onClick={share} testId="sage-share">
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
                แชร์ผลนี้ รับ +10 QI
              </span>
            </KitButton>
            <button onClick={() => { setStick(null); setPhase("intro") }} data-testid="sage-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">
              เสี่ยงอีกครั้ง · 10 QI
            </button>
          </div>
          <p className="pb-2 text-center text-[11px] leading-4 text-v3-text-muted">คำทำนายเพื่อความบันเทิงและเป็นแนวทาง โปรดใช้วิจารณญาณ</p>
        </div>
      )}

      <Menubar />
    </SkyScreen>
  )
}

function DotSection({ label, dot, children }: { label: string; dot: string; children: React.ReactNode }) {
  return (
    <section className="v3-shadow-card flex w-full flex-col gap-2 rounded-[24px] bg-white p-5">
      <p className="flex items-center gap-2 text-[15px] font-black text-v3-navy">
        <span aria-hidden className="size-2.5 flex-none rounded-full" style={{ backgroundColor: dot }} />
        {label}
      </p>
      {children}
    </section>
  )
}
