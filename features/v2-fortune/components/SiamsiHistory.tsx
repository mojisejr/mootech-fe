// features/v2-fortune/components/SiamsiHistory.tsx — ประวัติเซียมซีโป๊ยเซียน 20 ใบล่าสุด + รีวิว (2026-11-19)
// รีวิว = 👍/👎 + เขียนข้อความ + บันทึก → ได้ 3-5 QI ต่อรีวิว, รวมทั้งเดือนไม่เกิน 100 QI (engine คุมเพดาน)
import { useCallback, useEffect, useState } from "react"

import { shareAsInvite } from "@/lib/v2/share-invite"

export type HistoryCard = {
  no: number
  name: string
  imageUrl?: string
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
}
export type HistoryItem = {
  id: string
  createdAt: string
  question: string | null
  rating: 1 | -1 | null
  review: string | null
  rewardQi: number
  card: HistoryCard | null
}
type ListResp = { items?: HistoryItem[]; monthEarned?: number; monthCap?: number; error?: { message?: string } }

const MIN_CHARS = 5
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })

/** กล่องรีวิว — ใช้ทั้งในหน้าผล (ไพ่ที่เพิ่งเปิด) และในประวัติ */
export function SiamsiReviewBox({
  historyId,
  initial,
  onSaved,
  card,
}: {
  historyId: string
  /** ไพ่ของรีวิวนี้ — ใช้ทำภาพแชร์ */
  card?: Pick<HistoryCard, "no" | "name" | "imageUrl"> | null
  initial?: Pick<HistoryItem, "rating" | "review" | "rewardQi">
  onSaved?: (r: { rating: 1 | -1; review: string; rewardQi: number }) => void
}) {
  const done = initial?.rating != null
  const [rating, setRating] = useState<1 | -1 | null>(initial?.rating ?? null)
  const [text, setText] = useState(initial?.review ?? "")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saved, setSaved] = useState(done)

  const shareReview = () => {
    const verdict = rating === 1 ? "👍 ตรงมาก" : "👎 ไม่ค่อยตรง"
    const head = card ? `เซียมซีโป๊ยเซียนใบที่ ${card.no} ${card.name}` : "เซียมซีโป๊ยเซียน"
    const quote = text.trim().slice(0, 160)
    void shareAsInvite({
      title: "รีวิวเซียมซีโป๊ยเซียน",
      text: `${head} — ${verdict}${quote ? ` "${quote}"` : ""} · เสี่ยงทายกับ Mumate`,
      og: { title: card ? `เซียมซีใบที่ ${card.no}` : "เซียมซีโป๊ยเซียน", subtitle: card?.name ?? verdict, summary: `${verdict}${quote ? ` — "${quote}"` : ""}`, tag: "รีวิวเซียมซี", image: card?.imageUrl, isPublic: true, fullText: quote },
    })
  }

  if (saved) {
    return (
      <section className="v3-shadow-card flex flex-col gap-2 rounded-[24px] bg-white p-5" data-testid="siamsi-review-done">
        <p className="text-[15px] font-black text-v3-navy">รีวิวของคุณ {rating === 1 ? "👍" : "👎"}</p>
        {text ? <p className="text-[13px] leading-[22px] text-v3-text-body">{text}</p> : null}
        {msg ? <p className={"text-[12px] font-bold " + (msg.ok ? "text-[#3F6F5D]" : "text-[#8A5A0C]")}>{msg.text}</p> : initial?.rewardQi ? <p className="text-[12px] font-bold text-[#3F6F5D]">ได้รับ +{initial.rewardQi} QI แล้ว</p> : null}
        <button type="button" onClick={shareReview} data-testid="siamsi-review-share" className="mt-1 grid h-11 w-full place-items-center rounded-full border border-v3-sapphire text-[14px] font-bold text-v3-sapphire">
          แชร์รีวิวนี้
        </button>
      </section>
    )
  }

  const save = async () => {
    if (!rating) { setMsg({ ok: false, text: "เลือก 👍 หรือ 👎 ก่อนนะ" }); return }
    if (text.trim().length < MIN_CHARS) { setMsg({ ok: false, text: `เขียนรีวิวอย่างน้อย ${MIN_CHARS} ตัวอักษร` }); return }
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/fortune/sage-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: historyId, rating, review: text.trim() }) })
      const j = (await r.json().catch(() => ({}))) as { rewardQi?: number; capped?: boolean; error?: { message?: string } }
      if (!r.ok) { setMsg({ ok: false, text: j.error?.message ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }); return }
      const reward = j.rewardQi ?? 0
      setSaved(true)
      setMsg(reward > 0 ? { ok: true, text: `ขอบคุณสำหรับรีวิว! ได้รับ +${reward} QI 🎉` } : { ok: false, text: "บันทึกรีวิวแล้ว · เดือนนี้รับ QI จากรีวิวครบ 100 แล้ว" })
      onSaved?.({ rating, review: text.trim(), rewardQi: reward })
    } catch {
      setMsg({ ok: false, text: "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง" })
    } finally {
      setBusy(false)
    }
  }

  const thumb = (v: 1 | -1, label: string, emoji: string) => (
    <button
      type="button"
      onClick={() => setRating(v)}
      aria-pressed={rating === v}
      data-testid={v === 1 ? "siamsi-thumb-up" : "siamsi-thumb-down"}
      className={"flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-[14px] font-bold " + (rating === v ? "border-v3-sapphire bg-v3-sapphire text-v3-lime" : "border-v3-border-card bg-white text-v3-navy")}
    >
      <span className="text-lg">{emoji}</span>{label}
    </button>
  )

  return (
    <section className="v3-shadow-card flex flex-col gap-3 rounded-[24px] bg-white p-5" data-testid="siamsi-review">
      <div>
        <p className="text-[15px] font-black text-v3-navy">คำทำนายนี้ตรงไหม?</p>
        <p className="text-[12px] text-v3-text-muted">รีวิวแล้วรับ 3-5 QI (เดือนละไม่เกิน 100 QI)</p>
      </div>
      <div className="flex gap-2">
        {thumb(1, "ตรง", "👍")}
        {thumb(-1, "ไม่ตรง", "👎")}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={3}
        placeholder="เล่าให้ฟังหน่อย ตรงกับเรื่องที่ถามยังไงบ้าง"
        data-testid="siamsi-review-text"
        className="w-full resize-none rounded-[14px] border border-v3-border-card bg-v3-ghost-white px-3 py-2 text-[13px] leading-5 text-v3-navy outline-none focus:border-v3-sapphire"
      />
      {msg ? <p className={"text-[12px] font-bold " + (msg.ok ? "text-[#3F6F5D]" : "text-v3-error")}>{msg.text}</p> : null}
      <button type="button" onClick={() => void save()} disabled={busy} data-testid="siamsi-review-save" className="grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-v3-lime disabled:opacity-40">
        {busy ? "กำลังบันทึก…" : "บันทึกรีวิว"}
      </button>
    </section>
  )
}

const TOPICS: { key: keyof HistoryCard; label: string }[] = [
  { key: "overall", label: "ภาพรวม" },
  { key: "work", label: "การงาน" },
  { key: "money", label: "การเงิน" },
  { key: "health", label: "สุขภาพ" },
  { key: "mind", label: "จิตใจ" },
  { key: "family", label: "ครอบครัว" },
  { key: "loveCouple", label: "ความรัก (มีคู่)" },
  { key: "loveSingle", label: "ความรัก (โสด)" },
  { key: "advice", label: "คำแนะนำ" },
]

/** หน้าประวัติ — รายการ 20 ใบล่าสุด, แตะเพื่อดูคำทำนายย้อนหลัง + รีวิว */
export function SiamsiHistory({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [earned, setEarned] = useState(0)
  const [cap, setCap] = useState(100)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await fetch("/api/fortune/sage-history")
      const j = (await r.json().catch(() => ({}))) as ListResp
      if (!r.ok) { setError(j.error?.message ?? "โหลดประวัติไม่สำเร็จ"); setItems([]); return }
      setItems(j.items ?? [])
      setEarned(j.monthEarned ?? 0)
      setCap(j.monthCap ?? 100)
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ")
      setItems([])
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const open = items?.find((i) => i.id === openId) ?? null

  if (open) {
    const c = open.card
    return (
      <div className="siamsi-result-in mt-3 flex flex-col gap-3" data-testid="siamsi-history-detail">
        <button type="button" onClick={() => setOpenId(null)} className="w-fit text-[13px] font-bold text-v3-sapphire">← กลับไปประวัติ</button>
        {c?.imageUrl ? (
          <span className="block w-full overflow-hidden rounded-[24px] bg-[#F3F4FB]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imageUrl} alt={`เซียมซีใบที่ ${c.no} ${c.name}`} className="mx-auto block w-full max-w-[360px]" />
          </span>
        ) : null}
        <section className="flex flex-col items-center gap-1 rounded-[24px] border border-[#EAD9AE] bg-[#FBF3DE] p-5 text-center">
          <p className="text-[12px] text-[#8A6D2F]">{fmtDate(open.createdAt)}</p>
          <p className="text-[13px] font-bold text-[#B08A3B]">ใบที่ {c?.no ?? "-"}</p>
          <p className="text-[24px] font-black leading-tight text-v3-navy">{c?.name ?? "ไม่พบข้อมูลไพ่"}</p>
          {c?.deity ? <p className="text-[14px] font-bold text-[#8A6D2F]">{c.deity}</p> : null}
        </section>
        {c
          ? TOPICS.map((t) =>
              c[t.key] ? (
                <section key={t.key} className="v3-shadow-card flex flex-col gap-1.5 rounded-[24px] bg-white p-5">
                  <p className="text-[15px] font-black text-v3-navy">{t.label}</p>
                  <p className="text-[13px] leading-[22px] text-v3-text-body">{String(c[t.key])}</p>
                </section>
              ) : null,
            )
          : null}
        <SiamsiReviewBox
          historyId={open.id}
          initial={open}
          card={c}
          onSaved={(r) => {
            setItems((prev) => prev?.map((i) => (i.id === open.id ? { ...i, ...r } : i)) ?? prev)
            setEarned((e) => e + r.rewardQi)
          }}
        />
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-3" data-testid="siamsi-history">
      <button type="button" onClick={onBack} className="w-fit text-[13px] font-bold text-v3-sapphire">← กลับ</button>
      <div className="rounded-[20px] bg-[#FBF3DE] px-4 py-3">
        <p className="text-[15px] font-black text-v3-navy">ประวัติเซียมซี (20 ครั้งล่าสุด)</p>
        <p className="text-[12px] text-[#8A6D2F]">รีวิวคำทำนาย รับ 3-5 QI · เดือนนี้ได้แล้ว {earned}/{cap} QI</p>
      </div>
      {items === null ? <p className="text-center text-[13px] text-v3-text-muted">กำลังโหลด…</p> : null}
      {error ? <p className="text-center text-[12px] font-bold text-v3-error">{error}</p> : null}
      {items && items.length === 0 && !error ? <p className="py-6 text-center text-[13px] text-v3-text-muted">ยังไม่มีประวัติ — ลองเสี่ยงเซียมซีดูก่อนนะ</p> : null}
      {items?.map((i) => (
        <button
          key={i.id}
          type="button"
          onClick={() => setOpenId(i.id)}
          data-testid="siamsi-history-item"
          className="v3-shadow-card flex items-center gap-3 rounded-[20px] bg-white p-3 text-left"
        >
          {i.card?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={i.card.imageUrl} alt="" className="h-16 w-12 flex-none rounded-[8px] object-cover" />
          ) : (
            <span className="grid h-16 w-12 flex-none place-items-center rounded-[8px] bg-[#FBF3DE] text-lg">🎋</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-black text-v3-navy">ใบที่ {i.card?.no ?? "-"} · {i.card?.name ?? ""}</span>
            <span className="block text-[11px] text-v3-text-muted">{fmtDate(i.createdAt)}</span>
          </span>
          {i.rating != null ? (
            <span className="flex-none rounded-full bg-[#E6F1EC] px-2.5 py-1 text-[11px] font-bold text-[#3F6F5D]">{i.rating === 1 ? "👍" : "👎"} รีวิวแล้ว</span>
          ) : (
            <span className="flex-none rounded-full bg-[#FCE9F0] px-2.5 py-1 text-[11px] font-bold text-[#B0568A]">รีวิว +3-5 QI</span>
          )}
        </button>
      ))}
    </div>
  )
}
