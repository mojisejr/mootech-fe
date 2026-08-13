// features/v2-service/components/QuotaLine.tsx — Phase 2 (#264), the one shared treatment for both
// quota indicators (ดูดวงสมพงศ์ and เพิ่มเพื่อน).
//
// ฟีม/บอง's one constraint on this feature: "อย่าให้ indicator กลายเป็นตัวเร่งให้รีบใช้."
// Urgency is not made of words — it is made of PROMINENCE and of saying the allowance EXPIRES:
//   • no progress bar, ring, percentage or coloured badge. A gauge draining toward empty is the
//     pressure device itself; small plain text is not.
//   • no time period in the string. "เหลือ 97 ครั้งในปีนี้" means *these 97 vanish on 31 Dec* — the
//     strongest urgency framing available for a use-it-or-lose-it allowance. So: "เหลือ 97 ครั้ง".
//     ⚠️ This is deliberately NOT inconsistent with #263's "ใช้สิทธิ์ครบแล้วสำหรับปีนี้": at zero the
//     period tells you WHEN YOU GET MORE (relief); at 97 the same word puts a deadline on what you have
//     not spent (pressure). Same word, opposite job, decided by the number.
//   • low is not an error. #263 established the tone language on this screen — red means something is
//     broken and retrying may fix it; navy means a fact about your account. Running low is a fact.
//     So low only changes muted → navy. No red, no icon, no exclamation, at any remaining > 0.
//
// States with no number (loading / unavailable / unlimited) render NOTHING. Showing "เหลือ 0" because a
// read failed would tell a user with quota left that they have none.
import type { QuotaView } from '../hooks/useQuota'

/** At or below this many left, the line stops being background texture and is read at normal strength. */
export const LOW_REMAINING = 5

export function QuotaLine({ quota, label, testId }: {
  quota: QuotaView
  /**
   * The whole sentence, decided by the caller — the TREATMENT is what is shared here, not the wording.
   * A single "เหลือ {n} {unit}" template looked like the tidier design and was wrong in the frame: under
   * the add-friend button, with the friend LIST directly beneath it, "เหลือ 17 คน" reads as *17 people in
   * this list* rather than *17 more may be added*. Each site says what it actually means.
   */
  label: (remaining: number) => string
  testId: string
}) {
  if (quota.state !== 'known') return null
  const low = quota.remaining <= LOW_REMAINING
  return (
    <p
      data-testid={testId}
      className={[
        'text-center text-[14px] font-normal leading-5',
        low ? 'text-v3-navy' : 'text-v3-text-muted',
      ].join(' ')}
    >
      {label(quota.remaining)}
    </p>
  )
}
