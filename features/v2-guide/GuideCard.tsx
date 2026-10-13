// features/v2-guide/GuideCard.tsx — การ์ด "เส้นทางมือใหม่" บนหน้าหลัก: แถบความคืบหน้า + เควสถัดไป + รายการทั้งหมด
// ซ่อนได้ (กดซ่อน) · ทำครบแล้วโชว์ฉลองครั้งเดียวจนกดปิด
import Link from "next/link"
import { useState } from "react"

import { GUIDE_QUESTS, GUIDE_TOTAL } from "@/features/v2-guide/quests"
import { useGuideProgress } from "@/features/v2-guide/useGuideProgress"

export function GuideCard() {
  const { done, hidden, ready, setHidden } = useGuideProgress()
  const [expanded, setExpanded] = useState(false)
  if (!ready || hidden) return null

  const doneCount = GUIDE_QUESTS.filter((q) => done.includes(q.id)).length
  const next = GUIDE_QUESTS.find((q) => !done.includes(q.id))
  const pct = Math.round((doneCount / GUIDE_TOTAL) * 100)

  return (
    <section className="relative mb-6 overflow-hidden rounded-[24px] bg-white p-5 v3-shadow-card" data-testid="guide-card">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/mascot/01-nav.png" alt="" aria-hidden className="h-16 w-auto flex-none" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black leading-6 text-v3-navy">เส้นทางมือใหม่</p>
          <p className="text-[12px] leading-[18px] text-v3-text-body">
            {next ? "ทำภารกิจตามลำดับ แล้วจะรู้จักทุกฟังก์ชันของ Mumate" : "ยินดีด้วย! คุณรู้จักทุกฟังก์ชันของ Mumate แล้ว 🎉"}
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
            <span className="block text-[11px] font-bold text-v3-lime">ภารกิจถัดไป</span>
            <span className="block text-[14px] font-black">{next.title}</span>
            <span className="block text-[12px] text-white/80">{next.desc}</span>
          </span>
          <span className="flex-none rounded-full bg-v3-lime px-3 py-1 text-[12px] font-black text-v3-sapphire">ไปเลย</span>
        </Link>
      ) : null}

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
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
