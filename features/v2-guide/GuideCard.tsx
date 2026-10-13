// features/v2-guide/GuideCard.tsx — การ์ด "เส้นทางมือใหม่" บนหน้าหลัก: แถบความคืบหน้า + ภารกิจถัดไป + รางวัล QI
// ทำครบ 6 ขั้น → ปุ่ม "รับรางวัลจบ" (engine guide_complete) · ซ่อนได้ · ความคืบหน้าดึงจาก engine (ข้ามเครื่องได้)
import Link from "next/link"
import { useEffect, useState } from "react"

import { GUIDE_COMPLETE_QI, GUIDE_QUESTS, GUIDE_STEP_QI, GUIDE_TOTAL } from "@/features/v2-guide/quests"
import { reportGuideMission, syncGuideFromServer, useGuideProgress } from "@/features/v2-guide/useGuideProgress"

export function GuideCard() {
  const { done, hidden, bonus, ready, setHidden, setBonus } = useGuideProgress()
  const [expanded, setExpanded] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  useEffect(() => { void syncGuideFromServer() }, [])

  if (!ready || hidden) return null

  const doneCount = GUIDE_QUESTS.filter((q) => done.includes(q.id)).length
  const next = GUIDE_QUESTS.find((q) => !done.includes(q.id))
  const allDone = !next
  const pct = Math.round((doneCount / GUIDE_TOTAL) * 100)

  const claim = async () => {
    setClaiming(true)
    setClaimMsg(null)
    const ok = await reportGuideMission("guide_complete")
    setClaiming(false)
    if (ok) { setBonus(); setClaimMsg(`รับ +${GUIDE_COMPLETE_QI} QI แล้ว 🎉`) }
    else {
      // รับไปแล้วก่อนหน้า (engine ไม่จ่ายซ้ำ) หรือยังไม่ครบฝั่ง server — sync แล้วบอกตามจริง
      await syncGuideFromServer()
      setClaimMsg("รับรางวัลไม่สำเร็จ ลองใหม่อีกครั้ง หรืออาจรับไปแล้ว")
    }
  }

  return (
    <section className="relative mb-6 overflow-hidden rounded-[24px] bg-white p-5 v3-shadow-card" data-testid="guide-card">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/mascot/01-nav.png" alt="" aria-hidden className="h-16 w-auto flex-none" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black leading-6 text-v3-navy">เส้นทางมือใหม่</p>
          <p className="text-[12px] leading-[18px] text-v3-text-body">
            {allDone
              ? bonus ? "ยินดีด้วย! คุณรู้จักทุกฟังก์ชันของ Mumate แล้ว 🎉" : "ทำครบทุกภารกิจแล้ว! กดรับรางวัลจบได้เลย"
              : `ทำตามปุ่มที่เสี่ยวมู่พากด รับ +${GUIDE_STEP_QI} QI ทุกภารกิจ ครบ ${GUIDE_TOTAL} ข้อรับโบนัส +${GUIDE_COMPLETE_QI} QI`}
          </p>
        </div>
        <button type="button" onClick={() => setHidden(true)} aria-label="ซ่อนเส้นทางมือใหม่" data-testid="guide-hide" className="flex-none text-[12px] font-bold text-v3-text-muted">
          ซ่อน
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-v3-ghost-white">
          <span className="block h-full rounded-full bg-v3-lime transition-all" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-[12px] font-black text-v3-sapphire" data-testid="guide-progress">{doneCount}/{GUIDE_TOTAL}</span>
      </div>

      {next ? (
        <Link href={`${next.href}?guide=${next.id}`} data-testid="guide-next" className="mt-3 flex items-center gap-3 rounded-[16px] bg-v3-sapphire px-4 py-3 text-white">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-v3-lime">ภารกิจถัดไป · +{GUIDE_STEP_QI} QI</span>
            <span className="block text-[14px] font-black">{next.title}</span>
            <span className="block text-[12px] text-white/80">{next.desc}</span>
          </span>
          <span className="flex-none rounded-full bg-v3-lime px-3 py-1 text-[12px] font-black text-v3-sapphire">ไปเลย</span>
        </Link>
      ) : !bonus ? (
        <button type="button" onClick={() => void claim()} disabled={claiming} data-testid="guide-claim" className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire disabled:opacity-50">
          {claiming ? "กำลังรับรางวัล..." : `🎁 รับรางวัลจบ +${GUIDE_COMPLETE_QI} QI`}
        </button>
      ) : null}
      {claimMsg ? <p className="mt-2 text-center text-[12px] font-bold text-v3-sapphire" data-testid="guide-claim-msg">{claimMsg}</p> : null}

      <button type="button" onClick={() => setExpanded((v) => !v)} data-testid="guide-toggle" className="mt-3 text-[12px] font-bold text-v3-sapphire">
        {expanded ? "ซ่อนรายการภารกิจ ↑" : "ดูภารกิจทั้งหมด ↓"}
      </button>
      {expanded ? (
        <ul className="mt-2 flex flex-col gap-2" data-testid="guide-list">
          {GUIDE_QUESTS.map((q, i) => {
            const ok = done.includes(q.id)
            return (
              <li key={q.id}>
                <Link href={`${q.href}?guide=${q.id}`} className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-3 py-2">
                  <span className={"grid size-7 flex-none place-items-center rounded-full text-[12px] font-black " + (ok ? "bg-v3-lime text-v3-sapphire" : "bg-v3-ghost-white text-v3-text-muted")}>
                    {ok ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={"block text-[13px] font-bold " + (ok ? "text-v3-text-muted line-through" : "text-v3-navy")}>{q.title}</span>
                    <span className="block text-[11px] text-v3-text-muted">{q.desc}</span>
                  </span>
                  <span className={"flex-none text-[11px] font-black " + (ok ? "text-v3-text-muted" : "text-[#8A5A0C]")}>{ok ? "รับแล้ว" : `+${GUIDE_STEP_QI} QI`}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
