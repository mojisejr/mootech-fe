// features/v2-service/components/CompatibilityResultScreen.tsx — ดวงสมพงศ์ Slice 2E-1 (Figma 636:18819).
// COMPOSES goo's useCompatibilityResult (the result seam). Slice 2E-1 = the REACHABLE SPINE + top of the
// result: D17 loader while the calc is read, an honest fallback when there is no result, then the header
// (D20), the score card, and the ภาพรวม text. The rest of the frame — รายด้าน (D22) · สี่เสา+ธาตุ · รายคน
// (D21) · มาสคอต · แท็บ · D26 3-case shots — is Slice 2E-2 (marked below).
//
// D20: the header title is "ผลดวงสมพงศ์" — NOT "รายละเอียดวัน" (that string is a Figma copy-paste from the
//      calendar day screen). D25: grade/score colours come from the shared ScoreRing primitive, no new hex.
// Rule 4 (ไม่มีข้อมูล = ไม่แสดง): every field is optional; an absent field HIDES its line/block — never a
//      fabricated 0/''/placeholder. The birthdate line is hidden when birthDate is absent (direct-link /
//      parked "ล่าสุด" flow), which is also the ฟีม-declared out-of-scope case.
import Link from 'next/link'
import { SectionCard } from '@/features/v2-calendar/components/day-detail/SectionCard'
import { ScoreRing } from '@/features/v2-calendar/components/day-detail/ScoreRing'
import { LoadingScreen } from '@/features/v2-shell/components/LoadingScreen'
import { useCompatibilityResult } from '../hooks/useCompatibilityResult'
import type { CompatResultPerson } from '../compatibility-result'
import { formatCompatBirth } from './compat-format'
import { COMPAT_CALC_LOADING } from './compat-loading-copy'

function BackChevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// One person chip in the header (Figma 636:18819 top): name + the carried birth line ("14 มิ.ย. 2537 · 09:30 น.").
// birthDate absent → the birth line is HIDDEN (rule 4); time absent → the "· HH:mm น." tail drops (formatCompatBirth).
function HeaderPerson({ person, roleLabel, testId }: { person?: CompatResultPerson; roleLabel: string; testId: string }) {
  const birth = formatCompatBirth(person?.birthDate ?? '', person?.time ?? '')
  return (
    <div data-testid={testId} className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl bg-v3-navy px-4 py-3 text-white">
      <span className="text-[11px] font-medium text-white/70">{roleLabel}</span>
      <span className="truncate text-[15px] font-bold leading-5">{person?.displayName || '—'}</span>
      {birth ? <span data-testid={`${testId}-birth`} className="truncate text-[12px] font-normal text-white/80">{birth}</span> : null}
    </div>
  )
}

function Hearts({ n }: { n: number }) {
  const count = Math.max(0, Math.min(5, Math.round(n)))
  if (!count) return null
  return (
    <span className="flex items-center gap-1" aria-label={`${count} หัวใจ`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="size-[18px]" fill="#FF6B8A" aria-hidden>
          <path d="M12 21s-7-4.4-9.3-8.7C1.1 9.1 2.7 6 5.9 6c1.9 0 3.2 1.1 4.1 2.3C10.9 7.1 12.2 6 14.1 6c3.2 0 4.8 3.1 3.2 6.3C19 16.6 12 21 12 21Z" />
        </svg>
      ))}
    </span>
  )
}

export function CompatibilityResultScreen({ matchingId }: { matchingId: string }) {
  const r = useCompatibilityResult(matchingId)

  // D17/2F — the second half of the wait: the SAME loader with the SAME copy the form showed (D32/D35),
  // so navigating form → result is one continuous screen. The heavy calc already ran on the form; this
  // covers the (fast) read-back of the finished result.
  if (r.loading) {
    return <LoadingScreen title={COMPAT_CALC_LOADING.title} subtitle={COMPAT_CALC_LOADING.subtitle} />
  }

  // no result / parse failure → honest fallback (never a spinner, never fabricated data)
  if (r.error || !r.result) {
    return (
      <div data-testid="compat-result-screen" data-state="empty" className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-v3-bg-cream px-8 text-center font-ibm">
        <p className="text-[17px] font-bold text-v3-navy">ยังไม่พบผลลัพธ์</p>
        <p className="text-[15px] leading-6 text-v3-text-body">ผลดวงสมพงศ์นี้อาจหมดอายุหรือยังไม่ถูกคำนวณ ลองเริ่มใหม่จากหน้าบริการ</p>
        <Link href="/v2/service" className="rounded-[100px] bg-v3-sapphire px-6 py-3 text-[15px] font-semibold text-white">กลับไปหน้าบริการ</Link>
      </div>
    )
  }

  const { overall, persons } = r.result

  return (
    <div data-testid="compat-result-screen" data-state="ready" className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* header — D20: "ผลดวงสมพงศ์" (NOT "รายละเอียดวัน") */}
        <header className="flex items-center gap-2 py-1">
          <Link href="/v2/service" aria-label="ย้อนกลับ" className="grid size-8 shrink-0 place-items-center rounded-full text-v3-navy"><BackChevron /></Link>
          <h1 data-testid="compat-result-title" className="min-w-0 flex-1 text-[22px] font-bold leading-8 text-v3-navy">ผลดวงสมพงศ์</h1>
        </header>

        {/* the two people (name + carried birth line) */}
        <div className="flex items-stretch gap-2">
          <HeaderPerson person={persons?.a} roleLabel="ตัวเรา" testId="compat-result-person-a" />
          <HeaderPerson person={persons?.b} roleLabel="เขา" testId="compat-result-person-b" />
        </div>

        {/* score card — reuses the shared ScoreRing (D24/D25); grade/percent/hearts/emoji from overall (rule 4: hide absent) */}
        {overall && (overall.grade != null || overall.percent != null || overall.hearts != null || overall.emoji != null) ? (
          <div
            data-testid="compat-result-score"
            className="flex flex-col items-center gap-3 rounded-[20px] px-5 py-6 text-center"
            style={{ background: 'linear-gradient(150deg, #E8F1FC 0%, #CBC8FC 48%, #FCE3FA 100%)' }}
          >
            {overall.grade != null && overall.percent != null ? <ScoreRing grade={overall.grade} percent={overall.percent} /> : null}
            {overall.gradeLabel ? <p className="text-lg font-extrabold leading-6 text-v3-navy">{overall.gradeLabel}</p> : null}
            <div className="flex items-center gap-2">
              {overall.hearts != null ? <Hearts n={overall.hearts} /> : null}
              {overall.emoji ? <span className="text-[20px]" aria-hidden>{overall.emoji}</span> : null}
            </div>
          </div>
        ) : null}

        {/* ภาพรวม — overall.ratingText (goo dig). Reuses the calendar SectionCard (D24). */}
        {overall?.ratingText ? (
          <SectionCard title="ภาพรวม" info>
            <p data-testid="compat-result-overview" className="whitespace-pre-line text-[15px] leading-[26px] text-v3-text-body">{overall.ratingText}</p>
          </SectionCard>
        ) : null}

        {/* ── Slice 2E-2 continues here: รายด้าน (D22) · สี่เสา+ธาตุ · รายคน (D21) · มาสคอต · แท็บ · D26 3-case shots ── */}
      </div>
    </div>
  )
}

export default CompatibilityResultScreen
