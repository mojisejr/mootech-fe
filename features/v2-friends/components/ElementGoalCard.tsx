// features/v2-friends/components/ElementGoalCard.tsx — การ์ด "สะสมเพื่อนครบ 5 ธาตุ" ตัวเดียวกันทั้งแอป
// (เดิมวาดอยู่ใน ReferralHubScreen · ย้ายมาที่นี่เพื่อให้หน้ารายชื่อเพื่อน ประชุม 24 พ.ย. ข้อ 3 ใช้ร่วมได้
// โดยไม่คัดลอก markup สองชุดแล้วให้มันเบี่ยงกันเอง)
// เป้านี้นับจาก "เพื่อนที่ชวนมา" (คนที่สมัครด้วยโค้ดของผู้ใช้) — ไม่ใช่รายชื่อเพื่อนที่บันทึกวันเกิดไว้
import Image from "next/image"

import { SectionCard } from "@/features/v2-profile/components/kit"

export const FRIEND_ELEMENTS: Array<{ key: string; label: string; mascot: string; bg: string }> = [
  { key: "wood", label: "ธาตุไม้", mascot: "mascot-wood", bg: "#E6F4EC" },
  { key: "metal", label: "ธาตุทอง", mascot: "mascot-metal", bg: "#E1E1E1" },
  { key: "fire", label: "ธาตุไฟ", mascot: "mascot-fire", bg: "#FBEAE8" },
  { key: "earth", label: "ธาตุดิน", mascot: "mascot-earth", bg: "#F7EEE1" },
  { key: "water", label: "ธาตุน้ำ", mascot: "mascot-water", bg: "#E4F1F7" },
]

/** ชื่อธาตุที่ยังไม่มี (ตามลำดับการ์ด) — ใช้เขียน "ตอนนี้ยังขาด…" */
export function missingFriendElements(collected: ReadonlySet<string>): string[] {
  return FRIEND_ELEMENTS.filter((e) => !collected.has(e.key)).map((e) => e.label)
}

export function ElementGoalCard({ collectedKeys, testId = "referral-element-goal" }: { collectedKeys: ReadonlySet<string>; testId?: string }) {
  const missing = missingFriendElements(collectedKeys)
  return (
    <SectionCard className="!rounded-[18px]" testId={testId}>
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-v3-navy">สะสมเพื่อนครบ 5 ธาตุ</h2>
        <span className="rounded-[10px] bg-v3-qi-earn-bg px-2.5 py-1 text-[14px] font-semibold text-v3-qi-earn">+1,000 QI</span>
      </div>
      <div className="mt-2 flex items-start justify-between">
        {FRIEND_ELEMENTS.map((e) => {
          const got = collectedKeys.has(e.key)
          return (
            <div key={e.key} className="flex flex-col items-center gap-1.5" data-testid={testId ? `${testId}-${e.key}` : undefined}>
              <span className="relative grid size-14 place-items-center overflow-hidden rounded-[16px]" style={{ backgroundColor: e.bg, border: got ? "1px solid #63B05F" : undefined }}>
                <Image src={`/images/v2/referral/${e.mascot}.png`} alt="" width={33} height={41} className="h-[41px] w-[33px] object-contain" />
                {got ? <Image src="/images/v2/referral/success-mark.svg" alt="" aria-hidden width={20} height={20} className="absolute -right-1 -top-1 size-5" /> : null}
              </span>
              <span className="text-[13px] font-medium text-v3-navy">{e.label}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-[12px] leading-[18px] text-v3-text-muted">
        ธาตุของเพื่อนคำนวณจากวันเกิด{missing.length && missing.length < 5 ? ` ตอนนี้ยังขาด${missing.join(" และ ")}` : ""}
      </p>
    </SectionCard>
  )
}
