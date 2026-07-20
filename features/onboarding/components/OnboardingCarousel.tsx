import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { FullBleedScreen } from '@/features/v2-shell/components/FullBleedScreen'
import { DotsPager } from './DotsPager'

// OnboardingCarousel — MuMate v2 onboarding (DESIGN.md v3, Figma 588:10335→588:10311→298:476→619:12978).
// 4 self-contained steps, verified @393 vs Figma: **heading on TOP, mascot BELOW**, footer (dots +
// "ถัดไป") at the bottom — the whole thing fits one viewport (no scroll). Last step → onComplete().
// Container = FullBleedScreen (owns the viewport, BG03 photo). Mascot = real per-step art
// (/images/v2/mascot/01-04.png). goo mounts this on /v2 and routes onComplete → /v2/login.

type Step = {
  /** headline lines (rendered stacked, centered) */
  lines: string[]
  /** true only on step 1 → shows the MuMate wordmark above the heading */
  withLogo?: boolean
}

const STEPS: Step[] = [
  { lines: ['ความสงบเริ่มต้นที่ใจ', 'สรรค์สร้างสมดุลแห่งชีวิต'], withLogo: true },
  { lines: ['ศาสตร์จีนโบราณกว่า 3,000 ปี', 'ที่คนนับล้านใช้นำใจเส้นทางชีวิตตัวเอง'] },
  { lines: ['แนวทางการใช้ชีวิต', 'หาคู่-หุ้นส่วนที่ใช่', 'วันมงคลของคุณ'] },
  { lines: ['เน้นความแม่นยำจากข้อมูลวันเกิดจริง', 'ไม่ใช่คำทำนายทั่วไปแบบราศี'] },
]

export function OnboardingCarousel({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1
  // real per-step mascot: step 0 → 01.png … step 3 → 04.png
  const mascotSrc = `/images/v2/mascot/0${index + 1}.png`

  function next() {
    if (isLast) {
      onComplete()
      return
    }
    setIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  return (
    <FullBleedScreen
      bgSrc="/images/v2/bg/BG03.png"
      bgFallback="linear-gradient(180deg, #FBEFE6 0%, #F7E9F0 48%, #DCEBFB 100%)"
      contentClassName="px-8 pb-10 pt-16"
    >
      {/* fit-viewport: heading top · mascot middle (absorbs) · footer bottom — no scroll */}
      <div className="flex flex-1 flex-col">
        {/* TOP — logo (step 1) + heading */}
        <div className="flex flex-col items-center gap-4 text-center">
          {step.withLogo && (
            <Image
              src="/images/mumate/ic_logo.svg"
              alt="MuMate"
              width={148}
              height={40}
              className="h-10 w-auto"
            />
          )}
          <h1 className="font-ibm text-xl font-bold leading-8 text-v3-text-title">
            {step.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
        </div>

        {/* MIDDLE — mascot, below the text; flex-1 + min-h-0 so it fits, never forces scroll */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-6">
          <Image
            src={mascotSrc}
            alt=""
            aria-hidden="true"
            width={280}
            height={280}
            className="h-full max-h-[300px] w-auto object-contain drop-shadow-sm"
          />
        </div>

        {/* BOTTOM — dots + next (accessible name = visible text, WCAG 2.5.3) */}
        <div className="flex flex-col items-center gap-6">
          <DotsPager count={STEPS.length} active={index} />
          <Button onClick={next}>ถัดไป</Button>
        </div>
      </div>
    </FullBleedScreen>
  )
}

export default OnboardingCarousel
