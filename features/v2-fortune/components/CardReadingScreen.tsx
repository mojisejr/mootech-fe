// features/v2-fortune/components/CardReadingScreen.tsx — flow เลือกไพ่ 3 ใบ (oracle/divine) ร่วมกัน
// intro → เลือกไพ่ 3 ใบ (หรือหยิบสุ่ม) → loading → ผล (3 ใบ + คำทำนายรวม + รายใบ). ต่อ engine ผ่าน BFF endpoint.
// ไพ่คว่ำในกริด = สไตล์ตามธีมสำรับ (ไม่มี asset หลัง) · หน้าไพ่ในผล = imageUrl จาก engine (fallback สไตล์).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"

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

export type CardReadingTheme = {
  /** ไพ่คว่ำในกริด + หน้าไพ่ fallback */
  backClass: string
  /** สัญลักษณ์กลางไพ่คว่ำ */
  glyph: string
}

const THEME: Record<"oracle" | "divine", CardReadingTheme> = {
  oracle: { backClass: "bg-gradient-to-b from-[#2AA7B8] to-[#127687] text-white", glyph: "☯" },
  divine: { backClass: "bg-gradient-to-b from-[#3D5AB5] to-[#20306F] text-[#FFE9A8]", glyph: "✦" },
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
  intro,
  introArt,
  endpoint,
  deckCount,
  backHref = "/v2/service",
}: {
  mode: "oracle" | "divine"
  title: string
  intro: string
  introArt: string
  endpoint: string
  deckCount: number
  backHref?: string
}) {
  const theme = THEME[mode]
  const [phase, setPhase] = useState<"intro" | "pick" | "loading" | "result">("intro")
  const [picked, setPicked] = useState<number[]>([]) // ลำดับ index ในกริดที่เลือก (สูงสุด 3)
  const [cards, setCards] = useState<FortuneCard[]>([])
  const [prose, setProse] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [quotaOut, setQuotaOut] = useState(false)

  // สำรับสับครั้งเดียวต่อรอบ — index กริด → เลขไพ่จริง
  const deck = useMemo(() => shuffle(deckCount), [deckCount])

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
      const j = (await res.json().catch(() => ({}))) as { cards?: FortuneCard[]; engineProse?: string; error?: { message?: string } }
      await new Promise((r) => setTimeout(r, Math.max(0, 1900 - (Date.now() - started))))
      if (res.status === 402) {
        setQuotaOut(true)
        setPhase("intro")
        return
      }
      if (!res.ok || !j.cards?.length) {
        setError(j.error?.message ?? "เปิดไพ่ไม่สำเร็จ ลองใหม่อีกครั้ง")
        setPhase(cardNos ? "pick" : "intro")
        return
      }
      setCards(j.cards)
      setProse(j.engineProse ?? "")
      setPhase("result")
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง")
      setPhase(cardNos ? "pick" : "intro")
    }
  }

  const toggle = (idx: number) => {
    setPicked((p) => (p.includes(idx) ? p.filter((x) => x !== idx) : p.length >= 3 ? p : [...p, idx]))
  }

  const openPicked = () => {
    if (picked.length !== 3) return
    void predict(picked.map((i) => deck[i]))
  }

  const reset = () => {
    setPicked([])
    setCards([])
    setProse("")
    setPhase("intro")
  }

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = cards.length ? `เปิดไพ่ได้ ${cards.map((c) => c.name).join(" · ")} — ${title} กับ Mumate` : `${title} กับ Mumate`
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ title, text, url }).catch(() => {})
    else if (typeof navigator !== "undefined" && navigator.clipboard) void navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
  }

  return (
    <SkyScreen>
      <Head><title>{title} · MuMate</title></Head>
      <SkyHeader title={title} backHref={phase === "pick" ? undefined : backHref} testId="fortune-cards" />

      {phase === "loading" && (
        <div className="mt-10 flex flex-col items-center gap-4 text-center" data-testid="cards-loading">
          <span aria-hidden className={"grid size-24 place-items-center rounded-[20px] text-4xl " + theme.backClass}>{theme.glyph}</span>
          <p className="text-[18px] font-black text-v3-navy">กำลังเปิดไพ่ให้คุณ</p>
          <p className="text-[13px] text-v3-text-body">ตั้งจิตให้นิ่ง แล้วรอไพ่เผยคำตอบ…</p>
          <span aria-hidden className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-v3-ghost-white"><span className="block h-full w-2/3 animate-pulse rounded-full bg-v3-lime" /></span>
        </div>
      )}

      {phase === "intro" && (
        <div className="mt-3 flex flex-col gap-4" data-testid="cards-intro">
          <section className="v3-shadow-card flex flex-col items-center gap-3 rounded-[24px] bg-white p-6 text-center">
            <span className="relative h-44 w-32 overflow-hidden rounded-[16px]">
              <Image src={introArt} alt="" fill sizes="128px" className="object-cover" />
            </span>
            <h1 className="text-[20px] font-black text-v3-navy">{title}</h1>
            <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">{intro}</p>
          </section>

          {quotaOut && (
            <div className="rounded-[16px] bg-[#FDF3E0] p-4" data-testid="cards-quota">
              <p className="text-[13px] font-bold text-[#8A5A0C]">โควตาเปิดไพ่วันนี้หมดแล้ว</p>
              <p className="text-[12px] leading-4 text-[#8A5A0C]">แลก 10 QI เพื่อเปิดเพิ่ม หรือเช็คอิน/ทำภารกิจรับ QI ฟรี</p>
              <Link href="/v2/qi" className="mt-2 inline-block text-[13px] font-bold text-v3-sapphire">ไปหน้าพลังชี่ →</Link>
            </div>
          )}
          {error && <p data-testid="cards-error" className="text-center text-[13px] font-bold text-v3-error">{error}</p>}

          <KitButton onClick={() => setPhase("pick")} testId="cards-goto-pick">เลือกไพ่เอง 3 ใบ</KitButton>
          <button onClick={() => void predict()} data-testid="cards-random" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">
            หยิบไพ่ทันที (สุ่มให้)
          </button>
          <p className="text-center text-[11px] text-v3-text-muted">ใช้โควตาเปิดการ์ดวันละ 1 ครั้ง (ฟรี) — เกินแล้วแลกด้วย QI</p>
        </div>
      )}

      {phase === "pick" && (
        <div className="mt-3 flex flex-col gap-3" data-testid="cards-pick">
          <div className="flex items-center justify-between px-1">
            <div>
              <p className="text-[16px] font-black text-v3-navy">เลือกไพ่ 3  ใบ</p>
              <p className="text-[12px] text-v3-text-body">ตั้งจิตอธิษฐาน แล้วแตะไพ่ที่สะดุดใจ</p>
            </div>
            <span className="flex-none rounded-full bg-v3-navy px-3 py-1 text-[12px] font-black text-v3-lime" data-testid="cards-pick-count">{picked.length}/3</span>
          </div>
          <div className="grid grid-cols-4 gap-2 pb-28">
            {deck.map((no, idx) => {
              const order = picked.indexOf(idx)
              const on = order !== -1
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggle(idx)}
                  data-testid={`cards-tile-${idx}`}
                  className={"relative grid aspect-[3/4] place-items-center rounded-[10px] text-[18px] transition " + theme.backClass + (on ? " ring-2 ring-v3-lime scale-[0.96]" : "")}
                >
                  <span aria-hidden>{theme.glyph}</span>
                  {on ? <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-v3-lime text-[11px] font-black text-v3-navy">{order + 1}</span> : null}
                </button>
              )
            })}
          </div>
          {/* ปุ่มเปิดไพ่ ติดล่าง */}
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-v3-border-card bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <KitButton onClick={openPicked} disabled={picked.length !== 3} testId="cards-open">เปิดไพ่ ({picked.length}/3)</KitButton>
          </div>
        </div>
      )}

      {phase === "result" && cards.length > 0 && (
        <div className="mt-3 flex flex-col gap-4" data-testid="cards-result">
          {/* 3 ใบที่เปิด */}
          <div className="grid grid-cols-3 gap-2">
            {cards.map((c) => (
              <div key={c.no} className="flex flex-col items-center gap-1.5">
                <span className={"relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[12px] " + theme.backClass}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.name} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="px-1 text-center text-[11px] font-bold leading-tight">{c.name}</span>
                  )}
                </span>
                <p className="text-center text-[11px] font-bold leading-tight text-v3-navy">{c.name}</p>
                <p className="text-center text-[10px] leading-tight text-v3-text-muted">{c.keyword}</p>
              </div>
            ))}
          </div>

          {prose ? (
            <section className="v3-shadow-card flex flex-col gap-2 rounded-[24px] bg-white p-5" data-testid="cards-prose">
              <span className="w-fit rounded-full bg-[#EAF3FF] px-3 py-1 text-[13px] font-black text-v3-sapphire">ภาพรวมคำทำนาย</span>
              {prose.split("\n\n").map((p, i) => <p key={i} className="text-[13px] leading-[22px] text-v3-text-body">{p}</p>)}
            </section>
          ) : null}

          {cards.map((c, i) => (
            <section key={c.no} className="v3-shadow-card flex flex-col gap-2 rounded-[24px] bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="grid size-7 flex-none place-items-center rounded-full bg-v3-navy text-[12px] font-black text-v3-lime">{i + 1}</span>
                <p className="text-[15px] font-black text-v3-navy">{c.name}</p>
                <span className="rounded-full bg-[#F6ECF0] px-2.5 py-[2px] text-[11px] font-bold text-[#B0568A]">{c.keyword}</span>
              </div>
              <p className="text-[13px] leading-[22px] text-v3-text-body">{c.book1 || c.meaning}</p>
            </section>
          ))}

          <div className="mt-1 flex flex-col gap-2">
            <KitButton onClick={share} testId="cards-share">แชร์ผลทำนาย</KitButton>
            <button onClick={reset} data-testid="cards-again" className="grid h-12 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[15px] font-bold text-v3-navy">เปิดไพ่ใหม่</button>
          </div>
          <p className="pb-2 text-center text-[11px] leading-4 text-v3-text-muted">คำทำนายเพื่อความบันเทิงและเป็นแนวทาง โปรดใช้วิจารณญาณ</p>
        </div>
      )}

      {/* ซ่อนเมนูล่างตอนเลือกไพ่ — กันชนกับปุ่ม "เปิดไพ่" ที่ปักล่าง */}
      {phase !== "pick" && <Menubar />}
    </SkyScreen>
  )
}

export default CardReadingScreen
