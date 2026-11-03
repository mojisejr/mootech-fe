// pages/v2/fortune/sage.tsx — เซียมซีโป๊ยเซียน 21 ใบ (ซินแสนุ้ย 2026-11-03 แทนเซียมซีเซี่ยงแซเดิม) เฟรม 55449:240
// flow: intro (ตั้งจิต + เขย่ามือถือ/กดเพื่อเสี่ยง) → loading สั้น → ผล 1 ใบตามไฟล์ซินแส (ไม่ผ่าน AI). ต่อ engine /api/immortal-cards/siamsi.
// โควตา: ตัด "card" ที่ engine (qiGate) — 402 = หมด → ชวนเติม/แลกที่ /v2/qi. แชร์ผล = ได้ +10 QI (earn "share").
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useRef, useState } from "react"
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { KitButton, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useCardGate } from "@/features/v2-shell/hooks/useCardGate"
import { useActionCooldown } from "@/lib/useActionCooldown"
import { useV2Tier } from "@/features/auth/hooks/useV2Tier"
import { useCurrentUser } from "@/lib/auth/use-current-user"
import { useHasMounted } from "@/lib/hooks/use-has-mounted"
import { useLoadingTimeout } from "@/lib/hooks/use-loading-timeout"
import { useShake } from "@/lib/hooks/use-shake"
import { SiamsiRitual } from "@/features/v2-fortune/components/SiamsiRitual"
import { AuthRequiredCard } from "@/features/auth/components/AuthRequiredCard"
import { shareAsInvite } from "@/lib/v2/share-invite"
import { ShareCard, ShareStage } from "@/features/v2-share/components/ShareCard"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

type TopicKey = "overall" | "work" | "money" | "health" | "mind" | "family"
type SiamsiCard = {
  no: number
  name: string
  category?: string
  deity?: string
  keywords?: string
  overall?: string
  work?: string
  money?: string
  health?: string
  mind?: string
  family?: string
  loveCouple?: string
  loveSingle?: string
  advice?: string
  imageUrl?: string
}

// หัวข้อผล — จุดสีกลม + หัวข้อ (ตาม Figma) · ความรักแยกมีคู่/โสด ต่อท้าย
const SECTIONS: { key: TopicKey; label: string; dot: string }[] = [
  { key: "overall", label: "ภาพรวม", dot: "#3B82F6" },
  { key: "work", label: "การงาน", dot: "#8B5CF6" },
  { key: "money", label: "การเงิน", dot: "#E5A93B" },
  { key: "health", label: "สุขภาพ", dot: "#EC4899" },
  { key: "mind", label: "จิตใจ", dot: "#10B981" },
  { key: "family", label: "ครอบครัว", dot: "#22D3EE" },
]
const CAT_STYLE: Record<string, string> = { ดี: "bg-[#FBF3DE] text-[#B08A3B]", กลาง: "bg-[#E6F1EC] text-[#3F6F5D]", เตือน: "bg-[#F6E3E1] text-[#8E3B36]" }

export default function FortuneSagePage() {
  const { status: authStatus } = useCurrentUser() // 'loading' | 'authed' | 'anon' — ไม่ login กดเสี่ยงทายไม่ได้
  // #246-style escape: authStatus ค้าง 'loading' เกิน 8 วิ → โชว์การ์ดเข้าสู่ระบบแทนปุ่มที่กดไม่ได้
  const mounted = useHasMounted()
  const identityStuck = useLoadingTimeout(mounted && authStatus === "loading", 8000)
  const cd = useActionCooldown("fortune:sage") // กันบอทยิงรัว 10 วิ
  const { tier, loading: tierLoading } = useV2Tier() // PRO = เซียมซี/Oracle ไม่จำกัด
  const cardUnlimited = tier === "PRO"
  const [phase, setPhase] = useState<"intro" | "loading" | "result">("intro")
  const [card, setCard] = useState<SiamsiCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quotaOut, setQuotaOut] = useState(false)
  // ฟรีวันละ 1 ครั้ง (รวมไพ่/เซียมซี/เบอร์มงคล) — ครั้งที่จะหัก QI ขึ้นป็อปอัปชวนแพ็กเกจก่อน (Kittipon 2026-10-20)
  const gate = useCardGate()
  const [loveMode, setLoveMode] = useState<"couple" | "single">("couple")
  // ที่มาของการเปิดครั้งนี้ (จาก engine): free=ฟรีวันนี้ · qi=หัก N QI · credit=ใช้เครดิต
  const [qiInfo, setQiInfo] = useState<{ source: "free" | "credit" | "qi"; cost: number } | null>(null)

  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)
  const [shareState, setShareState] = useState<"idle" | "done" | "capped">("idle")
  const redeemAndRetry = async () => {
    setRedeeming(true)
    setRedeemMsg(null)
    try {
      const res = await fetch("/api/qi-spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "card_use" }) })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) { setRedeemMsg(res.status === 409 ? "ชี่ไม่พอ — เติมชี่ก่อน" : String(j.error ?? "แลกไม่สำเร็จ ลองใหม่")); return }
      setQuotaOut(false)
      await draw({ bypassCooldown: true })
    } finally {
      setRedeeming(false)
    }
  }

  const draw = async (opts?: { bypassCooldown?: boolean }) => {
    if (!opts?.bypassCooldown && !cd.begin()) return
    if (authStatus === "anon") { setError("เข้าสู่ระบบก่อนเพื่อเสี่ยงทายเซียมซี"); setPhase("intro"); return }
    setCard(null)
    setPhase("loading")
    setError(null)
    setQuotaOut(false)
    try {
      const res = await fetch("/api/fortune/sage", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const j = (await res.json().catch(() => ({}))) as { card?: SiamsiCard; qi?: { source: "free" | "credit" | "qi"; cost: number } | null; error?: { message?: string } }
      if (res.status === 402) { setQuotaOut(true); gate.blocked(); setPhase("intro"); return }
      if (!res.ok || !j.card) { setError(j.error?.message ?? "เสี่ยงทายไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("intro"); return }
      // ได้ผลแล้ว → SiamsiRitual เขย่าจนครบเวลา หล่นไม้ แสงระเบิด พลิกไพ่ แล้วค่อย revealDone ไปหน้าผล
      setCard(j.card)
      setQiInfo(j.qi ?? null)
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase("intro")
    } finally {
      if (!opts?.bypassCooldown) cd.end()
    }
  }

  const revealDone = useCallback(() => setPhase("result"), [])

  const canDraw = phase === "intro" && authStatus === "authed" && !cd.active && !quotaOut
  // มือถือ: เขย่าเครื่อง = เสี่ยงทันที (ผ่าน gate ป็อปอัป QI เหมือนกดปุ่ม)
  const shake = useShake(() => { if (canDraw) void gate.guard(() => void draw()) }, canDraw)

  const shareCardRef = useRef<HTMLDivElement>(null)

  const share = async () => {
    if (shareState === "idle") {
      try {
        const r = await fetch("/api/qi-earn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "share" }) })
        const j = (r.ok ? await r.json().catch(() => ({})) : {}) as { awarded?: boolean; capped?: boolean }
        if (j.awarded) setShareState("done")
        else if (j.capped) setShareState("capped")
      } catch {
        /* QI ล่ม — คง idle ให้ลองใหม่ได้ */
      }
    }
    const summary = (card?.overall ?? "").replace(/\s+/g, " ").trim().slice(0, 120)
    const text = card ? `เสี่ยงเซียมซีโป๊ยเซียนได้ใบที่ ${card.no} ${card.name}${summary ? ` - ${summary}` : ""} — เสี่ยงทายกับ Mumate` : "เสี่ยงทายกับ Mumate"
    const ogSummary = card?.overall ?? ""
    void shareAsInvite({
      title: "เซียมซีโป๊ยเซียน",
      text,
      og: card ? { title: `เซียมซีใบที่ ${card.no}`, subtitle: card.name, summary: ogSummary, tag: "เซียมซี", image: card.imageUrl, isPublic: true, fullText: ogSummary } : { title: "เซียมซีโป๊ยเซียน", tag: "เซียมซี" },
    })
  }

  const love = card ? (loveMode === "couple" ? card.loveCouple : card.loveSingle) : undefined

  return (
    <SkyScreen bgImage="/images/v2/fortune/sage-bg.png">
      <Head><title>{`${phase === "result" ? "ผลเซียมซี" : "เซียมซีโป๊ยเซียน"} · MuMate`}</title></Head>
      <SkyHeader
        title={phase === "result" ? "ผลเซียมซี" : "เซียมซีโป๊ยเซียน"}
        backHref="/v2/service"
        testId="fortune-sage"
        right={phase === "result" && qiInfo ? <span data-testid="sage-qi-source" className="rounded-full bg-[#FCE9F0] px-3 py-1 text-[11px] font-bold text-[#B0568A]">{qiInfo.source === "qi" ? `ใช้ไป ${qiInfo.cost} QI` : qiInfo.source === "credit" ? "ใช้เครดิต" : "ฟรีวันนี้"}</span> : undefined}
      />

      {phase === "loading" && <SiamsiRitual ready={card !== null} cardImage={card?.imageUrl} cardName={card ? `ใบที่ ${card.no} · ${card.name}` : undefined} onDone={revealDone} />}

      {phase === "intro" && (
        <div className="mt-3 flex flex-col gap-4" data-testid="sage-intro">
          <div>
            <p className="text-[15px] font-black text-v3-navy">ตั้งจิตอธิษฐานถึงโป๊ยเซียน</p>
            <p className="text-[13px] leading-5 text-v3-text-body">นึกถึงเรื่องที่อยากรู้ แล้วเขย่ากระบอกเซียมซี</p>
          </div>
          <section className="v3-shadow-card flex flex-col items-center gap-3 rounded-[24px] bg-white p-5">
            <span className="relative h-48 w-full max-w-[300px]">
              <Image src="/images/v2/fortune/sage-cup.png" alt="" fill sizes="300px" className="object-contain" />
            </span>
            {authStatus === "anon" || identityStuck ? (
              <AuthRequiredCard testId="sage-auth-gate" message="เข้าสู่ระบบก่อนเพื่อเสี่ยงทายเซียมซี" />
            ) : (
              <>
                {shake.supported ? (
                  shake.granted ? (
                    <p data-testid="sage-shake-hint" className="text-center text-[13px] font-bold text-v3-sapphire">📳 เขย่ามือถือเพื่อเสี่ยงเซียมซีได้เลย</p>
                  ) : shake.needsPermission ? (
                    <button type="button" data-testid="sage-shake-enable" onClick={() => void shake.requestPermission()} className="text-center text-[13px] font-bold text-v3-sapphire underline">📳 แตะเพื่อเปิดโหมดเขย่ามือถือ</button>
                  ) : null
                ) : null}
                {quotaOut && <p className="text-center text-[12px] font-bold text-[#8A5A0C]" data-testid="sage-quota">โควตาเสี่ยงทายวันนี้หมด — แลก 10 QI เพื่อเสี่ยงต่อได้เลย</p>}
                {quotaOut && (
                  <button type="button" onClick={() => void redeemAndRetry()} disabled={redeeming} data-testid="sage-redeem" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime disabled:opacity-40">
                    {redeeming ? "กำลังแลก..." : "แลก 10 QI แล้วเสี่ยงทายเลย"}
                  </button>
                )}
                {redeemMsg && <p className="text-center text-[12px] font-bold text-v3-error">{redeemMsg}</p>}
                {error && <p data-testid="sage-error" className="text-center text-[12px] font-bold text-v3-error">{error}</p>}
                <KitButton onClick={() => void gate.guard(() => void draw())} disabled={cd.active || authStatus === "loading"} testId="sage-draw">{authStatus === "loading" ? "กำลังเชื่อมต่อบัญชี…" : cd.active ? `รออีก ${cd.secondsLeft} วินาที` : "กดเพื่อเสี่ยงทาย"}</KitButton>
                {authStatus === "loading" && <p className="text-center text-[11px] text-v3-text-muted">กำลังตรวจสอบบัญชีของคุณ สักครู่…</p>}
              </>
            )}
          </section>
          {quotaOut && <Link href="/v2/qi" className="text-center text-[13px] font-bold text-v3-sapphire">เติม/แลก QI ที่หน้าพลังชี่ →</Link>}
          {!tierLoading && <p className="text-center text-[11px] text-v3-text-muted">{cardUnlimited ? "สมาชิก PRO เสี่ยงทายได้ไม่จำกัด" : tier === "PLUS" ? "สมาชิก PLUS เสี่ยงทายวันละ 10 ครั้ง — เกินแล้วแลกด้วย QI" : "ฟรีวันละ 1 ครั้ง (รวมไพ่ · เซียมซี · เบอร์มงคล) — สมัครสมาชิกเพื่อใช้ไม่จำกัด"}</p>}
        </div>
      )}

      {phase === "result" && card && (
        <div className="mt-3 flex flex-col gap-3" data-testid="sage-result">
          {card.imageUrl ? (
            <span className="block w-full overflow-hidden rounded-[24px] bg-[#F3F4FB]" data-testid="sage-slip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.imageUrl} alt={`เซียมซีใบที่ ${card.no} ${card.name}`} className="mx-auto block w-full max-w-[360px]" />
            </span>
          ) : null}

          <section className="flex flex-col items-center gap-1.5 rounded-[24px] border border-[#EAD9AE] bg-[#FBF3DE] p-5 text-center">
            <p className="text-[13px] font-bold text-[#B08A3B]">ใบที่ {card.no}</p>
            <p className="text-[26px] font-black leading-tight text-v3-navy" data-testid="sage-name">{card.name}</p>
            {card.deity ? <p className="text-[14px] font-bold text-[#8A6D2F]">{card.deity}</p> : null}
            {card.category ? <span data-testid="sage-category" className={"mt-1 rounded-full px-3 py-1 text-[11px] font-bold " + (CAT_STYLE[card.category] ?? "bg-white text-[#B08A3B]")}>หมวด{card.category}</span> : null}
            {card.keywords ? <p className="mt-1 text-[12px] leading-5 text-v3-text-body">{card.keywords}</p> : null}
          </section>

          {SECTIONS.map((s) => (card[s.key] ? (
            <DotSection key={s.key} label={s.label} dot={s.dot}>
              <p className="text-[13px] leading-[22px] text-v3-text-body">{card[s.key]}</p>
              {s.key === "health" ? (
                <p className="mt-2 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[11px] leading-4 text-[#A83238]">ข้อมูลเพื่อการพยากรณ์ ไม่ใช่คำวินิจฉัยทางการแพทย์ หากมีอาการควรพบแพทย์</p>
              ) : null}
            </DotSection>
          ) : null))}
          {card.loveCouple || card.loveSingle ? (
            <DotSection label="ความรัก" dot="#F472B6">
              <div className="mb-2 inline-flex w-fit rounded-full bg-[#F6ECF0] p-0.5">
                <button onClick={() => setLoveMode("couple")} className={"rounded-full px-4 py-1 text-[12px] font-bold " + (loveMode === "couple" ? "bg-white text-v3-navy shadow-sm" : "text-v3-text-muted")}>มีคู่</button>
                <button onClick={() => setLoveMode("single")} className={"rounded-full px-4 py-1 text-[12px] font-bold " + (loveMode === "single" ? "bg-white text-v3-navy shadow-sm" : "text-v3-text-muted")}>โสด</button>
              </div>
              <p className="text-[13px] leading-[22px] text-v3-text-body">{love}</p>
            </DotSection>
          ) : null}
          {card.advice ? <DotSection label="คำแนะนำ" dot="#C9A24A"><p className="text-[13px] leading-[22px] text-v3-text-body">{card.advice}</p></DotSection> : null}

          <div className="mt-1 flex flex-col gap-2">
            <KitButton onClick={share} testId="sage-share">
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
                {shareState === "done" ? "รับ +10 QI แล้ว 🎉" : shareState === "capped" ? "วันนี้รับ +10 QI ไปแล้ว" : "แชร์ผลนี้ รับ +10 QI"}
              </span>
            </KitButton>
            <button onClick={() => { setCard(null); setPhase("intro") }} data-testid="sage-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">
              เสี่ยงอีกครั้ง · 10 QI
            </button>
          </div>
          <p className="pb-2 text-center text-[11px] leading-4 text-v3-text-muted">คำทำนายเพื่อความบันเทิงและเป็นแนวทาง โปรดใช้วิจารณญาณ</p>
        </div>
      )}

      {card ? (
        <ShareStage>
          <ShareCard
            ref={shareCardRef}
            tag="เซียมซี"
            title={`เซียมซีใบที่ ${card.no}`}
            subtitle={card.name}
            summary={card.overall?.trim() || "เสี่ยงเซียมซีโป๊ยเซียนกับ Mumate"}
            images={card.imageUrl ? [card.imageUrl] : []}
          />
        </ShareStage>
      ) : null}
      <Menubar />
      {gate.modal}
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
