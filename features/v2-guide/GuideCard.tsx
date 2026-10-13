// features/v2-guide/GuideCard.tsx — การ์ด "เส้นทางมือใหม่" บนหน้าหลัก (6 บท แบบเกม)
// บทปัจจุบัน: แถบความคืบหน้า + ภารกิจถัดไป → จบบท = ปุ่มรับโบนัสบท (guide_ch<n>) → บทถัดไปปลดล็อก
// จบทุกบท = ปุ่มรับรางวัลใหญ่ (guide_complete) + ป้าย "ศิษย์เอกเสี่ยวมู่" · ดูทุกบทได้ (บทที่ล็อกโชว์แม่กุญแจ)
import Link from "next/link"
import { useEffect, useState } from "react"

import { GUIDE_BADGE, GUIDE_CHAPTER_QI, GUIDE_CHAPTERS, GUIDE_COMPLETE_QI, GUIDE_STEP_QI, chapterBonusId } from "@/features/v2-guide/quests"
import { guideStatus, reportGuideMission, syncGuideFromServer, useGuideProgress } from "@/features/v2-guide/useGuideProgress"

export function GuideCard() {
  const { done, hidden, bonuses, ready, setHidden, addBonus } = useGuideProgress()
  const [expanded, setExpanded] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimMsg, setClaimMsg] = useState<string | null>(null)

  useEffect(() => { void syncGuideFromServer() }, [])

  if (!ready) return null

  const { chapters, current, allQuestsDone, finalClaimed } = guideStatus(done, bonuses)
  const cur = current

  // ซ่อน = ย่อเหลือแถบเล็ก (ไม่หายไป) กดเพื่อเปิดกลับ
  if (hidden) {
    return (
      <button type="button" onClick={() => setHidden(false)} data-testid="guide-collapsed" className="mb-6 flex w-full items-center gap-3 rounded-full bg-white px-4 py-2 text-left v3-shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/mascot/01-nav.png" alt="" aria-hidden className="h-8 w-auto flex-none" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-black text-v3-navy">
          เส้นทางมือใหม่{cur ? ` · บทที่ ${cur.index + 1}/${GUIDE_CHAPTERS.length} · ${cur.doneCount}/${cur.chapter.quests.length}` : finalClaimed ? ` · 🏅 ${GUIDE_BADGE}` : ""}
        </span>
        <span className="flex-none text-[12px] font-bold text-v3-sapphire" data-testid="guide-show">แสดง ↓</span>
      </button>
    )
  }
  const next = cur ? cur.chapter.quests.find((q) => !done.includes(q.id)) : undefined
  const pct = cur ? Math.round((cur.doneCount / cur.chapter.quests.length) * 100) : 100

  const claim = async (missionId: string, qi: number) => {
    setClaiming(true)
    setClaimMsg(null)
    const ok = await reportGuideMission(missionId)
    setClaiming(false)
    if (ok) {
      addBonus(missionId)
      setClaimMsg(`รับ +${qi} QI แล้ว 🎉`)
      return
    }
    // engine ไม่จ่าย = รับไปแล้ว (ไม่จ่ายซ้ำ) หรือฝั่ง server ยังไม่ครบ → sync แล้วบอกตามจริง
    await syncGuideFromServer()
    setClaimMsg("รับรางวัลไม่สำเร็จ ลองใหม่อีกครั้ง หรืออาจรับไปแล้ว")
  }

  return (
    <section className="relative mb-6 overflow-hidden rounded-[24px] bg-white p-5 v3-shadow-card" data-testid="guide-card">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/mascot/01-nav.png" alt="" aria-hidden className="h-16 w-auto flex-none" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black leading-6 text-v3-navy">เส้นทางมือใหม่</p>
          {cur ? (
            <p className="text-[12px] leading-[18px] text-v3-text-body" data-testid="guide-chapter">
              บทที่ {cur.index + 1}/{GUIDE_CHAPTERS.length} · <b className="text-v3-navy">{cur.chapter.title}</b> — {cur.chapter.subtitle}
            </p>
          ) : (
            <p className="text-[12px] leading-[18px] text-v3-text-body">
              {finalClaimed ? `ยินดีด้วย! คุณคือ "${GUIDE_BADGE}" รู้จักทุกฟังก์ชันของ Mumate แล้ว 🎉` : "ทำครบทุกบทแล้ว! กดรับรางวัลใหญ่ได้เลย"}
            </p>
          )}
        </div>
        <button type="button" onClick={() => setHidden(true)} aria-label="ย่อเส้นทางมือใหม่" data-testid="guide-hide" className="flex-none text-[12px] font-bold text-v3-text-muted">
          ย่อ
        </button>
      </div>

      {finalClaimed ? (
        <p className="mt-3 rounded-full bg-v3-lime px-4 py-2 text-center text-[13px] font-black text-v3-sapphire" data-testid="guide-badge">🏅 {GUIDE_BADGE}</p>
      ) : null}

      {cur ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-v3-ghost-white">
            <span className="block h-full rounded-full bg-v3-lime transition-all" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[12px] font-black text-v3-sapphire" data-testid="guide-progress">{cur.doneCount}/{cur.chapter.quests.length}</span>
        </div>
      ) : null}

      {cur && next ? (
        <Link href={`${next.href}?guide=${next.id}`} data-testid="guide-next" className="mt-3 flex items-center gap-3 rounded-[16px] bg-v3-sapphire px-4 py-3 text-white">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-v3-lime">ภารกิจถัดไป · +{GUIDE_STEP_QI} QI</span>
            <span className="block text-[14px] font-black">{next.title}</span>
            <span className="block text-[12px] text-white/80">{next.desc}</span>
          </span>
          <span className="flex-none rounded-full bg-v3-lime px-3 py-1 text-[12px] font-black text-v3-sapphire">ไปเลย</span>
        </Link>
      ) : null}

      {cur && cur.complete && !cur.bonusClaimed ? (
        <button type="button" onClick={() => void claim(chapterBonusId(cur.chapter.id), GUIDE_CHAPTER_QI)} disabled={claiming} data-testid="guide-claim-chapter" className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire disabled:opacity-50">
          {claiming ? "กำลังรับรางวัล..." : `🎁 จบบท${cur.chapter.title}! รับโบนัส +${GUIDE_CHAPTER_QI} QI`}
        </button>
      ) : null}

      {!cur && allQuestsDone && !finalClaimed ? (
        <button type="button" onClick={() => void claim("guide_complete", GUIDE_COMPLETE_QI)} disabled={claiming} data-testid="guide-claim" className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-lime text-[15px] font-black text-v3-sapphire disabled:opacity-50">
          {claiming ? "กำลังรับรางวัล..." : `🏆 รับรางวัลใหญ่ +${GUIDE_COMPLETE_QI} QI`}
        </button>
      ) : null}
      {claimMsg ? <p className="mt-2 text-center text-[12px] font-bold text-v3-sapphire" data-testid="guide-claim-msg">{claimMsg}</p> : null}

      <button type="button" onClick={() => setExpanded((v) => !v)} data-testid="guide-toggle" className="mt-3 text-[12px] font-bold text-v3-sapphire">
        {expanded ? "ซ่อนทุกบท ↑" : `ดูทั้ง ${GUIDE_CHAPTERS.length} บท ↓`}
      </button>
      {expanded ? (
        <div className="mt-2 flex flex-col gap-3" data-testid="guide-list">
          {chapters.map((c) => (
            <div key={c.chapter.id} className={"rounded-[16px] border border-v3-border-card p-3 " + (c.unlocked ? "" : "opacity-60")} data-testid={`guide-ch-${c.chapter.id}`}>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-black text-v3-navy">
                  {c.unlocked ? "" : "🔒 "}บทที่ {c.index + 1} · {c.chapter.title}
                </p>
                <span className="text-[11px] font-black text-v3-sapphire">
                  {c.bonusClaimed ? "รับโบนัสแล้ว ✓" : `${c.doneCount}/${c.chapter.quests.length} · โบนัส +${GUIDE_CHAPTER_QI}`}
                </span>
              </div>
              {c.unlocked ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {c.chapter.quests.map((q) => {
                    const ok = done.includes(q.id)
                    return (
                      <li key={q.id}>
                        <Link href={`${q.href}?guide=${q.id}`} className="flex items-center gap-2 rounded-[12px] bg-v3-ghost-white px-3 py-2">
                          <span className={"grid size-6 flex-none place-items-center rounded-full text-[11px] font-black " + (ok ? "bg-v3-lime text-v3-sapphire" : "bg-white text-v3-text-muted")}>{ok ? "✓" : "•"}</span>
                          <span className={"min-w-0 flex-1 text-[12px] font-bold " + (ok ? "text-v3-text-muted line-through" : "text-v3-navy")}>{q.title}</span>
                          <span className={"flex-none text-[11px] font-black " + (ok ? "text-v3-text-muted" : "text-[#8A5A0C]")}>{ok ? "รับแล้ว" : `+${GUIDE_STEP_QI}`}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-[11px] text-v3-text-muted">ทำบทก่อนหน้าให้ครบเพื่อปลดล็อก · {c.chapter.subtitle}</p>
              )}
            </div>
          ))}
          <p className="text-center text-[11px] text-v3-text-muted">จบทุกบทรับรางวัลใหญ่ +{GUIDE_COMPLETE_QI} QI และป้าย &quot;{GUIDE_BADGE}&quot;</p>
        </div>
      ) : null}
    </section>
  )
}
