// features/v2-fortune/components/FengshuiScreen.tsx — ไพ่อาถรรพ์ฮวงจุ้ย (ซินแสนุ้ย 2026-10-07)
// ถามเรื่องสถานที่ (ไม่บังคับ) → สุ่ม 3 ใบ (หรือ 1 ใบ) → ผล: รูปไพ่ + ความหมาย/ข้อควรระวัง/คำแนะนำ + คำตอบจากเสี่ยวมู่/มี่ (ถ้ามีคำถาม)
// ต่อ engine ผ่าน BFF /api/fortune/fengshui (โควตา "card" เดียวกับไพ่อื่น: 402 → ชวนแลก QI). หมายเหตุท้ายแชทชี้มาที่หน้านี้
import Head from "next/head"
import Link from "next/link"
import { useEffect, useState } from "react"

import { KitButton, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useActionCooldown } from "@/lib/useActionCooldown"
import { useCurrentUser } from "@/lib/auth/use-current-user"
import { AuthRequiredCard } from "@/features/auth/components/AuthRequiredCard"

type FengshuiCard = { no: number; name: string; meaning: string; caution: string; advice: string; imageUrl: string | null }
type Persona = "mu" | "mi"
type Phase = "intro" | "loading" | "result"

const SECTIONS: { key: "meaning" | "caution" | "advice"; label: string }[] = [
  { key: "meaning", label: "ความหมาย" },
  { key: "caution", label: "ข้อควรระวัง" },
  { key: "advice", label: "คำแนะนำแก้ไข" },
]

export function FengshuiScreen({ backHref = "/v2/service" }: { backHref?: string }) {
  const { status: authStatus } = useCurrentUser()
  const cd = useActionCooldown("fortune:fengshui") // กันกดรัว
  const [phase, setPhase] = useState<Phase>("intro")
  const [question, setQuestion] = useState("")
  const [persona, setPersona] = useState<Persona>("mu")
  const [cards, setCards] = useState<FengshuiCard[]>([])
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [quotaOut, setQuotaOut] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState<1 | 3>(3)

  useEffect(() => {
    try {
      // เสี่ยวมู่/มี่ ที่ผู้ใช้เลือกในแชทล่าสุด (key ประวัติแชทต่อ persona) — ไม่มี = มู่
      if (localStorage.getItem("mumate-chat-history-mi") && !localStorage.getItem("mumate-chat-history-mu")) setPersona("mi")
    } catch { /* localStorage ปิด */ }
    let alive = true
    fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && typeof j?.qi === "number") setBalance(j.qi) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const predict = async (count: 1 | 3, opts?: { bypassCooldown?: boolean }) => {
    if (!opts?.bypassCooldown && !cd.begin()) return
    if (authStatus === "anon") { setError("เข้าสู่ระบบก่อนเพื่อเปิดไพ่"); return }
    setLastCount(count)
    setPhase("loading")
    setError(null)
    setQuotaOut(false)
    const started = Date.now()
    try {
      const res = await fetch("/api/fortune/fengshui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, persona, question: question.trim() || undefined }),
      })
      const j = (await res.json().catch(() => ({}))) as { cards?: FengshuiCard[]; answer?: string | null; error?: { message?: string } }
      await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (Date.now() - started))))
      if (res.status === 402) { setQuotaOut(true); setPhase("intro"); return }
      if (!res.ok || !j.cards?.length) { setError(j.error?.message ?? "เปิดไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase("intro"); return }
      setCards(j.cards)
      setAnswer(j.answer?.trim() ?? "")
      setPhase("result")
      fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).then((w) => { if (typeof w?.qi === "number") setBalance(w.qi) }).catch(() => {})
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase("intro")
    } finally {
      if (!opts?.bypassCooldown) cd.end()
    }
  }

  // 402 = ฟรีหมด + เครดิตหมด + ชี่ไม่พอ — แลก card_use 1 ครั้งด้วยชี่ แล้วเปิดต่อ (เหมือนไพ่อื่น)
  const redeemAndRetry = async () => {
    setRedeeming(true)
    setRedeemMsg(null)
    try {
      const res = await fetch("/api/qi-spend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "card_use" }) })
      const j = (await res.json().catch(() => ({}))) as { qi?: number; error?: string }
      if (!res.ok) { setRedeemMsg(res.status === 409 ? "ชี่ไม่พอ — เติมชี่ก่อน" : String(j.error ?? "แลกไม่สำเร็จ ลองใหม่")); return }
      if (typeof j.qi === "number") setBalance(j.qi)
      setQuotaOut(false)
      await predict(lastCount, { bypassCooldown: true })
    } finally {
      setRedeeming(false)
    }
  }

  const reset = () => { setCards([]); setAnswer(""); setPhase("intro") }
  const title = "ไพ่อาถรรพ์ฮวงจุ้ย"

  return (
    <SkyScreen>
      <Head><title>{`${title} · MuMate`}</title></Head>
      <SkyHeader
        title={phase === "result" ? "ผลไพ่ฮวงจุ้ย" : title}
        backHref={backHref}
        testId="fengshui"
        right={balance !== null ? <span className="rounded-full bg-[#EAF3FF] px-3 py-1 text-[11px] font-black text-v3-sapphire" data-testid="fengshui-balance">{balance.toLocaleString("th-TH")} QI</span> : undefined}
      />

      {phase === "loading" && (
        <div className="mt-12 flex flex-col items-center gap-3 text-center" data-testid="fengshui-loading">
          <p className="text-[18px] font-black text-v3-navy">กำลังตรวจชัยภูมิให้คุณ</p>
          <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">ขอเวลาสักครู่ ซินแสกำลังเปิดไพ่ฮวงจุ้ยให้</p>
        </div>
      )}

      {phase === "intro" && (
        <div className="mt-3 flex flex-col gap-4" data-testid="fengshui-intro">
          <div>
            <p className="text-[15px] font-black text-v3-navy">ถามเรื่องสถานที่</p>
            <p className="text-[13px] leading-5 text-v3-text-body">บ้าน ที่ทำงาน ห้อง ร้าน ที่ดิน — สถานที่ไหนก็ถามได้ ไพ่จะบอกจุดที่ฮวงจุ้ยมีผลและวิธีแก้</p>
          </div>
          {authStatus !== "anon" && (
            <>
              <textarea
                data-testid="fengshui-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="เช่น ห้องนอนหันหน้าไปทางทิศตะวันตก ดีไหม (ไม่ใส่ก็ได้)"
                className="w-full resize-none rounded-2xl border border-v3-border-card bg-white px-4 py-3 text-[13px] leading-5 text-v3-navy outline-none placeholder:text-v3-text-muted focus:border-v3-sapphire"
              />
              <div className="flex items-center gap-2 text-[12px] text-v3-text-body">
                <span>ให้ตอบโดย</span>
                {(["mu", "mi"] as const).map((p) => (
                  <button key={p} type="button" onClick={() => setPersona(p)} data-testid={`fengshui-persona-${p}`} className={"rounded-full px-3 py-1 text-[12px] font-bold " + (persona === p ? "bg-v3-sapphire text-white" : "border border-v3-border-card bg-white text-v3-navy")}>
                    {p === "mu" ? "เสี่ยวมู่" : "เสี่ยวมี่"}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <KitButton onClick={() => void predict(3)} disabled={cd.active || authStatus === "loading"} testId="fengshui-draw-3">{cd.active ? `รออีก ${cd.secondsLeft} วิ` : "สุ่ม 3 ใบ"}</KitButton>
                <button onClick={() => void predict(1)} disabled={cd.active || authStatus === "loading"} data-testid="fengshui-draw-1" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy disabled:opacity-50">สุ่ม 1 ใบ</button>
              </div>
            </>
          )}
          {authStatus === "anon" && <AuthRequiredCard testId="fengshui-auth-gate" message="เข้าสู่ระบบก่อนเพื่อเปิดไพ่" />}
          {quotaOut && <p className="text-center text-[12px] font-bold text-[#8A5A0C]" data-testid="fengshui-quota">โควตาเปิดไพ่วันนี้หมด — แลก 10 QI เพื่อเปิดต่อได้เลย</p>}
          {quotaOut && (
            <button type="button" onClick={() => void redeemAndRetry()} disabled={redeeming} data-testid="fengshui-redeem" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold uppercase text-v3-lime disabled:opacity-40">
              {redeeming ? "กำลังแลก..." : `แลก 10 QI แล้วเปิดไพ่เลย${balance !== null ? ` (มี ${balance.toLocaleString("th-TH")} QI)` : ""}`}
            </button>
          )}
          {redeemMsg && <p className="text-center text-[12px] font-bold text-v3-error">{redeemMsg}</p>}
          {error && <p data-testid="fengshui-error" className="text-center text-[12px] font-bold text-v3-error">{error}</p>}
          {quotaOut && <Link href="/v2/qi" className="text-center text-[13px] font-bold text-v3-sapphire">เติม/แลก QI ที่หน้าพลังชี่ →</Link>}
        </div>
      )}

      {phase === "result" && cards.length > 0 && (
        <div className="mt-3 flex flex-col gap-3" data-testid="fengshui-result">
          {answer ? (
            <section className="flex flex-col gap-1 rounded-[24px] bg-[#EAF3FF] p-5" data-testid="fengshui-answer">
              <span className="w-fit text-[13px] font-black text-v3-sapphire">คำตอบ ({persona === "mu" ? "เสี่ยวมู่" : "เสี่ยวมี่"})</span>
              {question.trim() ? <p className="text-[12px] font-semibold leading-5 text-v3-sapphire">คำถามของคุณ: {question.trim()}</p> : null}
              <p className="whitespace-pre-line text-[13px] leading-[22px] text-v3-text-body">{answer}</p>
            </section>
          ) : null}

          {cards.map((c, i) => (
            <section key={c.no} className="v3-shadow-card flex flex-col gap-3 rounded-[24px] bg-white p-5" data-testid="fengshui-card">
              <p className="text-[12px] font-bold text-v3-text-muted">จุดที่ {i + 1} · ไพ่เลข {c.no}</p>
              <p className="text-[17px] font-black text-v3-navy">{c.name}</p>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt={c.name} loading="lazy" className="mx-auto block w-full max-w-[260px] rounded-[14px]" />
              ) : null}
              {SECTIONS.map((s) => (c[s.key] ? (
                <div key={s.key}>
                  <p className="text-[12px] font-black text-v3-sapphire">{s.label}</p>
                  <p className="whitespace-pre-line text-[13px] leading-[22px] text-v3-text-body">{c[s.key]}</p>
                </div>
              ) : null))}
            </section>
          ))}

          <section className="v3-shadow-card flex flex-col gap-2 rounded-[24px] bg-white p-5">
            <p className="text-[14px] font-black text-v3-navy">อยากรู้ลึกกว่านี้</p>
            <Link href="/v2/chat" data-testid="fengshui-ask-chat" className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-v3-navy">ถามต่อในแชท</span>
                <span className="block text-[11px] text-v3-text-muted">พิมพ์เรื่องสถานที่ที่อยากตรวจเพิ่มได้เลย</span>
              </span>
              <span className="flex-none text-[16px] font-bold text-v3-text-muted">›</span>
            </Link>
          </section>

          <button onClick={reset} data-testid="fengshui-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">เปิดไพ่อีกครั้ง</button>
          <p className="pb-2 text-center text-[11px] leading-4 text-v3-text-muted">คำทำนายเพื่อความบันเทิงและเป็นแนวทาง โปรดใช้วิจารณญาณ</p>
        </div>
      )}

      <Menubar />
    </SkyScreen>
  )
}
