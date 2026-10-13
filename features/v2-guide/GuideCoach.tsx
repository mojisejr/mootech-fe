// features/v2-guide/GuideCoach.tsx — มาสคอตอธิบายหน้า เมื่อมาจากไกด์ (?guide=<id>) + นับเควสผ่าน
// mount ครั้งเดียวใน _app (เฉพาะ /v2). เควสนับผ่านเมื่อเข้าหน้าของเควสนั้น (มาจากไกด์หรือเข้าเองก็ได้)
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import { GUIDE_QUESTS, GUIDE_TOTAL, questForPath } from "@/features/v2-guide/quests"
import { useGuideProgress } from "@/features/v2-guide/useGuideProgress"

export function GuideCoach() {
  const router = useRouter()
  const { done, ready, markDone } = useGuideProgress()
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!router.isReady || !ready) return
    const quest = questForPath(router.pathname)
    if (quest) markDone(quest.id)
    const fromGuide = typeof router.query.guide === "string" ? router.query.guide : null
    setOpenId(fromGuide && quest && quest.id === fromGuide ? quest.id : null)
  }, [router.isReady, router.pathname, router.query.guide, ready, markDone])

  const quest = GUIDE_QUESTS.find((q) => q.id === openId)
  if (!quest) return null
  const count = GUIDE_QUESTS.filter((q) => done.includes(q.id)).length
  const next = GUIDE_QUESTS.find((q) => !done.includes(q.id) && q.id !== quest.id)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] mx-auto flex w-full max-w-md justify-center px-4" data-testid="guide-coach">
      <div className="pointer-events-auto flex w-full items-end gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/mascot/01-nav.png" alt="" aria-hidden className="h-20 w-auto flex-none drop-shadow" />
        <div className="relative flex-1 rounded-[18px] border border-v3-sapphire/20 bg-white p-3 shadow-lg">
          <p className="text-[11px] font-black text-v3-sapphire">เส้นทางมือใหม่ · {Math.min(count, GUIDE_TOTAL)}/{GUIDE_TOTAL}</p>
          <p className="mt-0.5 text-[13px] font-bold text-v3-navy">{quest.title}</p>
          <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">{quest.coach}</p>
          <div className="mt-2 flex items-center justify-end gap-2">
            {next ? (
              <button
                type="button"
                data-testid="guide-coach-next"
                onClick={() => { setOpenId(null); void router.push(`${next.href}?guide=${next.id}`) }}
                className="rounded-full bg-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-lime"
              >
                ภารกิจต่อไป →
              </button>
            ) : null}
            <button type="button" data-testid="guide-coach-close" onClick={() => setOpenId(null)} className="rounded-full border border-v3-border-card px-3 py-1.5 text-[12px] font-bold text-v3-navy">
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
