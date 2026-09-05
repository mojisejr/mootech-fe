// features/v2-fortune/components/CardReadingScreen.tsx — flow เลือกไพ่ 3 ใบ (oracle/divine) ร่วมกัน
// เฟรม oracle 55449:2172 / divine 55449:2170. intro → เลือกไพ่ 3 ใบ (หรือหยิบสุ่ม) → loading → ผล
// (3 ใบ + น้ำหนัก% + สรุป + รายใบ). ต่อ engine ผ่าน BFF. โควตา "card" (402 → ชวนเติม/แลก). แชร์ = +10 QI (earn share).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { KitButton, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"

export type FortuneCard = {
  no: number
  name: string
  keyword: string
  meaning: string
  book1?: string
  book2?: string
  imageUrl?: string | null
}
type Slot = { position: number; weight: number; role: string; no: number }

// รูปหลังไพ่จริง (export จาก Figma deck-cover) + สีเรืองเมื่อเลือก/ตอนโหลด
const THEME: Record<"oracle" | "divine", { back: string; ring: string }> = {
  oracle: { back: "/images/v2/fortune/oracle-back.png", ring: "ring-[#127687]" },
  divine: { back: "/images/v2/fortune/divine-back.png", ring: "ring-[#20306F]" },
}

function shuffle(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i + 1)
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function CardReadingScreen({
  mode,
  title,
  resultTitle,
  introArt,
  endpoint,
  deckCount,
  backHref = "/v2/service",
}: {
  mode: "oracle" | "divine"
  title: string
  resultTitle: string
  introArt: string
  endpoint: string
  deckCount: number
  backHref?: string
}) {
  const theme = THEME[mode]
  const [phase, setPhase] = useState<"intro" | "pick" | "loading" | "result">("intro")
  const [picked, setPicked] = useState<number[]>([])
  const [cards, setCards] = useState<FortuneCard[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [prose, setProse] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [quotaOut, setQuotaOut] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  const deck = useMemo(() => shuffle(deckCount), [deckCount])

  // ยอด QI (โชว์ chip ในหัวจอเลือกไพ่ ตามเฟรม)
  useEffect(() => {
    let alive = true
    fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && typeof j?.qi === "number") setBalance(j.qi) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // น้ำหนัก% ต่อเลขไพ่ + คำทำนายรายใบ (engineProse = ย่อหน้าเรียงตามลำดับ slot/card)
  // weight จาก engine อาจเป็นสัดส่วน (0.5) หรือเปอร์เซ็นต์ (50) — normalize เป็น % จำนวนเต็ม
  const weightByNo = useMemo(() => new Map(slots.map((s) => [s.no, Math.round(s.weight <= 1 ? s.weight * 100 : s.weight)])), [slots])
  const proseParas = useMemo(() => prose.split("\n\n").map((p) => p.trim()).filter(Boolean), [prose])

  const predict = async (cardNos?: number[]) => {
    setPhase("loading")
    setError(null)
    setQuotaOut(false)
    const started = Date.now()
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardNos ? { cardNos } : { random: true }),
      })
      const j = (await res.json().catch(() => ({}))) as { cards?: FortuneCard[]; slots?: Slot[]; engineProse?: string; error?: { message?: string } }
      await new Promise((r) => setTimeout(r, Math.max(0, 1900 - (Date.now() - started))))
      if (res.status === 402) { setQuotaOut(true); setPhase("intro"); return }
      if (!res.ok || !j.cards?.length) { setError(j.error?.message ?? "เปิดไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง"); setPhase(cardNos ? "pick" : "intro"); return }
      setCards(j.cards)
      setSlots(j.slots ?? [])
      setProse(j.engineProse ?? "")
      setPhase("result")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase(cardNos ? "pick" : "intro")
    }
  }

  const toggle = (idx: number) => setPicked((p) => (p.includes(idx) ? p.filter((x) => x !== idx) : p.length >= 3 ? p : [...p, idx]))
  const openPicked = () => { if (picked.length === 3) void predict(picked.map((i) => deck[i])) }
  const reset = () => { setPicked([]); setCards([]); setSlots([]); setProse(""); setPhase("intro") }

  const share = () => {
    void fetch("/api/qi-earn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "share" }) }).catch(() => {})
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = cards.length ? `เปิดไพ่ได้ ${cards.map((c) => c.name).join(" · ")} — ${title} กับ Mumate` : `${title} กับ Mumate`
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title, text, url }).catch(() => {})
    else if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
  }

  const headerTitle = phase === "result" ? resultTitle : phase === "pick" ? "เลือกไพ่ 3 ใบ" : title

  return (
    <SkyScreen>
      <Head><title>{headerTitle} · MuMate</title></Head>
      <SkyHeader
        title={headerTitle}
        backHref={phase === "pick" ? undefined : backHref}
        testId="fortune-cards"
        right={
          phase === "result"
            ? <span className="rounded-full bg-[#FCE9F0] px-3 py-1 text-[11px] font-bold text-[#B0568A]">ใช้ไป 10 QI</span>
            : phase === "pick" && balance !== null
              ? <span className="rounded-full bg-[#EAF3FF] px-3 py-1 text-[11px] font-black text-v3-sapphire" data-testid="cards-balance">{balance.toLocaleString("th-TH")} QI</span>
              : undefined
        }
      />

      {phase === "loading" && (
        <div className="mt-8 flex flex-col items-center gap-4 text-center" data-testid="cards-loading">
          <div className="flex items-end gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className={"relative aspect-[3/4] w-16 overflow-hidden rounded-[12px] shadow-md " + (i === 1 ? "-mb-2 scale-110" : "")}>
                <Image src={theme.back} alt="" fill sizes="64px" className="object-cover" />
              </span>
            ))}
          </div>
          <p className="text-[18px] font-black text-v3-navy">กำลังเปิดไพ่ให้คุณ</p>
          <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">มาร่วมสร้างบันทึกทางใจ และค้นพบความสงบไปกับพวกเรา</p>
          <span aria-hidden className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-v3-ghost-white"><span className="block h-full w-2/3 animate-pulse rounded-full bg-v3-lime" /></span>
        </div>
      )}

      {phase === "intro" && (
        <div className="mt-3 flex flex-col gap-4" data-testid="cards-intro">
          <div>
            <p className="text-[15px] font-black text-v3-navy">ตั้งจิตให้เป็นสมาธิ 1 นาที</p>
            <p className="text-[13px] leading-5 text-v3-text-body">ขอตั้งจิตอธิษฐานถามคำถามที่อยากได้คำตอบ</p>
          </div>
          <section className="v3-shadow-card flex flex-col items-center gap-4 rounded-[24px] bg-white p-5">
            <span className="relative h-56 w-40 overflow-hidden rounded-[16px]">
              <Image src={introArt} alt="" fill sizes="160px" className="object-cover" />
            </span>
            {quotaOut && <p className="text-center text-[12px] font-bold text-[#8A5A0C]" data-testid="cards-quota">โควตาเปิดไพ่วันนี้หมด — แลก 10 QI ที่หน้าพลังชี่</p>}
            {error && <p data-testid="cards-error" className="text-center text-[12px] font-bold text-v3-error">{error}</p>}
            <div className="flex w-full gap-2">
              <button onClick={() => void predict()} data-testid="cards-random" className="grid h-12 flex-1 place-items-center rounded-full border border-v3-sapphire bg-white text-[14px] font-bold text-v3-sapphire">กดเพื่อเสี่ยงโพ</button>
              <KitButton onClick={() => setPhase("pick")} testId="cards-goto-pick" className="flex-1">เลือกเอง 3 ใบ</KitButton>
            </div>
          </section>
          {quotaOut && <Link href="/v2/qi" className="text-center text-[13px] font-bold text-v3-sapphire">เติม/แลก QI ที่หน้าพลังชี่ →</Link>}
          <p className="text-center text-[11px] text-v3-text-muted">ใช้โควตาเปิดการ์ดวันละ 1 ครั้ง (ฟรี) — เกินแล้วแลกด้วย QI</p>
        </div>
      )}

      {phase === "pick" && (
        <div className="mt-3 flex flex-col gap-3" data-testid="cards-pick">
          {/* ถาดเลือก: บอกจำนวนที่เลือกแล้ว */}
          <div className="rounded-[16px] bg-v3-sapphire p-3 text-center text-white">
            <p className="text-[13px] font-bold">ตั้งจิตให้นิ่ง แล้วเลือกไพ่ที่รู้สึกว่าใช่</p>
            <p className="text-[12px] text-white/80" data-testid="cards-pick-count">เลือกแล้ว {picked.length}/3</p>
          </div>
          <div className="grid grid-cols-4 gap-2 pb-24">
            {deck.map((no, idx) => {
              const order = picked.indexOf(idx)
              const on = order !== -1
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggle(idx)}
                  data-testid={`cards-tile-${idx}`}
                  className={"relative aspect-[3/4] overflow-hidden rounded-[10px] transition " + (on ? "ring-2 ring-v3-lime scale-[0.96]" : "")}
                >
                  <Image src={theme.back} alt="" fill sizes="90px" className="object-cover" />
                  <span aria-hidden className="absolute bottom-0.5 right-1 rounded bg-black/25 px-1 text-[9px] font-bold text-white">{idx + 1}</span>
                  {on ? <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-v3-lime text-[11px] font-black text-v3-navy">{order + 1}</span> : null}
                </button>
              )
            })}
          </div>
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-v3-border-card bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <KitButton onClick={openPicked} disabled={picked.length !== 3} testId="cards-open">เปิดไพ่ทั้ง 3 ใบ · 10 QI</KitButton>
          </div>
        </div>
      )}

      {phase === "result" && cards.length > 0 && (
        <div className="mt-3 flex flex-col gap-3" data-testid="cards-result">
          {/* 3 ใบ + น้ำหนัก% */}
          <div className="grid grid-cols-3 gap-2">
            {cards.map((c) => (
              <div key={c.no} className="flex flex-col items-center gap-1">
                <span className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[12px]">
                  {/* หลังไพ่ + ชื่อ = เลเยอร์ล่าง (fallback ถ้าโหลดรูปหน้าไพ่ไม่ได้) · หน้าไพ่จริงทับเมื่อโหลดสำเร็จ */}
                  <Image src={theme.back} alt="" fill sizes="110px" className="object-cover" />
                  <span className="absolute inset-x-1 bottom-1 z-0 rounded bg-black/40 px-1 py-0.5 text-center text-[9px] font-bold leading-tight text-white">{c.name}</span>
                  {c.imageUrl
                    ? // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.name} className="absolute inset-0 z-10 size-full object-cover" />
                    : null}
                </span>
                {weightByNo.has(c.no) ? <span className="rounded-full bg-[#EAF3FF] px-2 py-[1px] text-[10px] font-black text-v3-sapphire">น้ำหนัก {weightByNo.get(c.no)}%</span> : null}
                <p className="text-center text-[10px] font-bold leading-tight text-v3-navy">#{c.no} {c.name}</p>
                <p className="text-center text-[9px] leading-tight text-v3-text-muted">{c.keyword}</p>
              </div>
            ))}
          </div>
          <p className="px-1 text-center text-[11px] leading-4 text-v3-text-muted">น้ำหนักคือสัดส่วนที่ไพ่แต่ละใบมีต่อคำทำนายรวม รวมกันได้ 100%</p>

          {/* สรุปคำทำนายนี้ */}
          <section className="flex flex-col gap-1 rounded-[24px] bg-[#EAF3FF] p-5" data-testid="cards-summary">
            <span className="w-fit text-[13px] font-black text-v3-sapphire">สรุปคำทำนายนี้</span>
            <p className="text-[13px] leading-[22px] text-v3-text-body">{cards[0].meaning}</p>
          </section>

          {/* รายใบ */}
          {cards.map((c, i) => (
            <section key={c.no} className="v3-shadow-card flex flex-col gap-2 rounded-[24px] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="relative size-8 flex-none overflow-hidden rounded-[8px]"><Image src={theme.back} alt="" fill sizes="32px" className="object-cover" /></span>
                <p className="text-[14px] font-black text-v3-navy">#{c.no} {c.name} · {c.keyword}</p>
                {weightByNo.has(c.no) ? <span className="rounded-full bg-[#EAF3FF] px-2 py-[1px] text-[10px] font-black text-v3-sapphire">น้ำหนัก {weightByNo.get(c.no)}%</span> : null}
              </div>
              <p className="text-[13px] leading-[22px] text-v3-text-body">{proseParas[i] || c.book1 || c.meaning}</p>
            </section>
          ))}

          {/* อยากรู้ลึกกว่านี้ */}
          <section className="v3-shadow-card flex flex-col gap-2 rounded-[24px] bg-white p-5">
            <p className="text-[14px] font-black text-v3-navy">อยากรู้ลึกกว่านี้</p>
            <Link href="/v2/chat" data-testid="cards-ask-ai" className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-4 py-3">
              <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-[#E3F4F7] text-v3-cyan">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-v3-navy">ถามเซียนมูเรื่องไพ่ชุดนี้</span>
                <span className="block text-[11px] text-v3-text-muted">คุยเจาะลึกกับ AI · 30 QI ต่อคำถาม</span>
              </span>
              <span className="flex-none text-[16px] font-bold text-v3-text-muted">›</span>
            </Link>
          </section>

          <div className="mt-1 flex flex-col gap-2">
            <KitButton onClick={share} testId="cards-share">
              <span className="inline-flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
                แชร์ผลนี้ รับ +10 QI
              </span>
            </KitButton>
            <button onClick={reset} data-testid="cards-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">เสี่ยงอีกครั้ง · 10 QI</button>
          </div>
          <p className="pb-2 text-center text-[11px] leading-4 text-v3-text-muted">คำทำนายเพื่อความบันเทิงและเป็นแนวทาง โปรดใช้วิจารณญาณ</p>
        </div>
      )}

      {phase !== "pick" && <Menubar />}
    </SkyScreen>
  )
}

export default CardReadingScreen
