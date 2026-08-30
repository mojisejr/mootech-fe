// features/v2-calendar/components/refusal/CalendarRefusalCard.tsx — the face of a named refusal.
// ONE component, both routes (#529 day · #530 month), because the two tickets are one behaviour split
// across two routes and #530's body records that splitting it is exactly how the two calendar gates
// drifted apart before #358 Phase 2. Two components that look identical today drift next month.
//
// 🔴 TWO VISUAL REGISTERS, ON PURPOSE — and this is the design decision of the pair, so it is written
// down rather than left in the classNames:
//
//   upgrade  sapphire card + lime pill. The same register as PersonalCalendarUpsell and
//            PersonalCalendarPromo, because it is doing the same job: inviting. ฟีมเคาะ 2026-08-24 that
//            pressing past your span should invite an upgrade.
//   sign-in  a calm white card with a plain sapphire link, deliberately UNLIKE the two above. Somebody
//            whose identity we cannot resolve is not a sales moment; dressing that state in the selling
//            colours is the same bug as before, only louder — it would just mean "buy something" is now
//            said to BOTH people instead of "sorry, broken" being said to both.
//
// COPY CLAIMS ONLY WHAT THE FIELD SUPPORTS. `refusal` says WHICH gate refused, never where the wall is,
// so no line here names a boundary date or a package. And 'no-identity' covers not-signed-in / no account
// / an ambiguous session (pages/api/v2/calendar-month.ts, the resolveSessionUserId exit), so the copy says
// we cannot confirm who you are rather than asserting the session expired. Asserting an unseen cause is
// the exact sin CalendarSkeleton.tsx:106 refuses to commit one file over.
//
// RESPONSIVE BY PRINCIPLE (DESIGN.md 9.2 Ref rule) — Figma has no frame for either state, so this is
// designed to the standard rather than pixel-matched: no fixed widths, one fluid column, and Thai lines
// carry [word-break:keep-all] so a sentence cannot break mid-word at 320 (the repo idiom, see
// features/onboarding/components/OnboardingCarousel.tsx:71).
import Link from 'next/link'
import { SHOP_HREF, UPGRADE_TO_MEMBER_LABEL } from '@/features/v2-shop/upgrade-cta'
import type { RefusalSurface } from '../../refusal-view'

/** Where an unresolved identity is sent. The v2 sign-in screen (pages/v2/login.tsx). */
export const SIGN_IN_HREF = '/v2/login'
export const SIGN_IN_LABEL = 'เข้าสู่ระบบอีกครั้ง'

const UPGRADE_COPY = {
  month: {
    headline: 'เดือนนี้ยังไม่รวมอยู่ในแพ็กเกจของคุณ',
    // Names the escape hatch, and it is a true one: the selector row renders in every state
    // (selector-always, 2026-08-07), so it is on screen above this card right now.
    body: 'แพ็กเกจที่กว้างขึ้นดูดวงล่วงหน้าได้ไกลกว่านี้ กลับไปเดือนที่ดูได้จากแถบเลือกเดือนด้านบนได้ทุกเมื่อ',
  },
  day: {
    headline: 'วันที่เลือกยังไม่รวมอยู่ในแพ็กเกจของคุณ',
    body: 'แพ็กเกจที่กว้างขึ้นดูดวงรายวันล่วงหน้าได้ไกลกว่านี้',
  },
} as const

export function CalendarRefusalCard({ surface, testId = 'calendar-refusal' }: { surface: RefusalSurface; testId?: string }) {
  if (surface.kind === 'sign-in') {
    return (
      <section
        data-testid={testId}
        data-refusal="no-identity"
        className="flex w-full flex-col items-center gap-2 rounded-[20px] bg-white px-5 py-8 text-center font-ibm shadow-[0_4px_14px_rgba(26,38,77,0.06)]"
      >
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-v3-sapphire/[0.06] text-2xl">🔑</span>
        <p className="text-base font-bold leading-6 text-v3-navy [word-break:keep-all]">ยืนยันตัวตนของคุณไม่ได้ตอนนี้</p>
        <p className="text-sm font-medium leading-6 text-v3-text-muted [word-break:keep-all]">
          เข้าสู่ระบบอีกครั้งเพื่อดูปฏิทินที่คำนวณจากวันเกิดของคุณ
        </p>
        <Link
          href={SIGN_IN_HREF}
          data-testid="calendar-refusal-signin"
          className="mt-2 inline-flex items-center justify-center rounded-full border border-v3-sapphire/25 px-6 py-2.5 text-sm font-bold leading-5 text-v3-sapphire"
        >
          {SIGN_IN_LABEL}
        </Link>
      </section>
    )
  }

  const copy = UPGRADE_COPY[surface.scope]
  return (
    <section
      data-testid={testId}
      data-refusal="out-of-span"
      data-scope={surface.scope}
      className="flex w-full flex-col items-center gap-3 rounded-[22px] bg-v3-sapphire px-5 py-7 text-center font-ibm shadow-[0px_6px_16px_0px_rgba(51,46,115,0.28)]"
    >
      <p className="text-[18px] font-bold leading-7 text-white [word-break:keep-all]">{copy.headline}</p>
      <p className="text-[14px] font-normal leading-[22px] text-white [word-break:keep-all]">{copy.body}</p>
      <Link
        href={SHOP_HREF}
        data-testid="calendar-refusal-cta"
        aria-label={UPGRADE_TO_MEMBER_LABEL}
        className="mt-1 inline-flex items-center justify-center rounded-full bg-v3-lime px-6 py-2.5 text-[14px] font-semibold uppercase leading-5 text-v3-sapphire"
      >
        {UPGRADE_TO_MEMBER_LABEL}
      </Link>
    </section>
  )
}

export default CalendarRefusalCard
