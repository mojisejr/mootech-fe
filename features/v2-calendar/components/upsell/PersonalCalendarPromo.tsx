// Figma Free-1 375:10991 `promo-personal-calendar` — the SHORT blue promo on the month screen.
//
// This is NOT the same card as the day-detail upsell (375:13285). The handoff assumed one component used
// twice; opening both frames says otherwise — this one has no comparison tiles, no CTA button and no price
// line. Two cards, two components. (Free-1 shows it; Paid-1 does not.)
//
// ฟีม 2026-08-04 (คำถาม I): Figma draws this card 345 wide inside a 16px-padded 393 column, so its right
// margin is 32 while every other card on the screen sits at 16 — an asymmetry on one card only. Ruled a
// Figma slip: we render w-full (361) like the grid below it. The two decorations are therefore anchored to
// the RIGHT edge, not the left, so they keep the same relationship to the corner they hug.
import Image from 'next/image'

export function PersonalCalendarPromo({ testId = 'calendar-promo' }: { testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-2xl bg-v3-sapphire px-4 py-6 font-ibm shadow-[0px_6px_16px_0px_rgba(51,46,115,0.28)]"
    >
      <div className="flex w-[209px] flex-col gap-1">
        <p className="text-[16px] font-bold leading-6 text-white">
          เปิดการใช้งาน<span className="text-v3-lime">ปฏิทินเฉพาะฉัน</span>
        </p>
        <p className="text-[14px] font-normal leading-[22px] text-white">
          ดูวันดี-วันควรระวัง วางแผนชีวิต ตามดวงที่คำนวณจากวันเกิดของคุณเอง
        </p>
      </div>

      {/* 375:11191 — the zodiac character, STATIC (get_motion_context lists no track for it). The asset is
          already in the repo under the exact name Figma gives the layer (`01_ชวด-ไม้`). */}
      <div aria-hidden className="pointer-events-none absolute right-[-28.424px] top-[-41px] flex h-[216.857px] w-[187.424px] items-center justify-center">
        <div className="rotate-[7.08deg]">
          <div className="relative h-[198.12px] w-[164.253px] overflow-hidden rounded-3xl">
            <Image src="/images/v2/characters/01_ชวด-ไม้.png" alt="" width={184} height={252} className="absolute left-[-5.5%] top-[-7.41%] h-[128.68%] w-[112.03%] max-w-none" />
          </div>
        </div>
      </div>

      {/* 375:11210 — the coin, ANIMATED. get_motion_context gives it its OWN track (y-6 · scale 1.05 ·
          rotate ±3 on a 4-point curve), which is NOT the .compat-sprite track (y-7 · 1.03 · ±2 on 35/70).
          Close enough to eyeball as "the same float" and wrong enough to be an invented value, so it gets
          its own keyframe rather than borrowing one that happens to exist. */}
      <div aria-hidden data-testid="calendar-promo-coin" className="pointer-events-none absolute right-[-9px] top-[95px] size-[65px]">
        <div className="v3-float-wide relative size-full overflow-hidden">
          <Image src="/images/v2/zone2/coin.png" alt="" width={95} height={95} className="absolute left-[-23.86%] top-[-22.73%] size-[145.45%] max-w-none" />
        </div>
      </div>
    </section>
  )
}

export default PersonalCalendarPromo
