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
      bgPosition="center 30%"
      // vertical rhythm: top clears the status bar, bottom clears the home indicator.
      // NOTE: core spacing classes only — an arbitrary class with commas (e.g.
      // pb-[max(2rem,env(safe-area-inset-bottom))]) breaks Tailwind's class scanner for the
      // NEXT class in the string, so the adjacent pt-10 was never generated → padding-top:0.
      contentClassName="px-8 pt-12 pb-10 sm:pt-16"
    >
      {/* fit-viewport: heading top · mascot middle (absorbs) · footer bottom — no scroll */}
      <div className="flex flex-1 flex-col gap-4">
        {/* TOP — logo (step 1) + heading */}
        <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
          {step.withLogo && (
            <Image
              src="/images/v2/logo/splash-logo.png"
              alt="MuMate"
              width={311}
              height={74}
              // real brand wordmark (teal). Fills the content column width to match Figma node
              // 588:10346 (w-full of its px-container ≈ 83% of viewport).
              className="h-auto w-full"
            />
          )}
          <h1 className="text-balance font-ibm text-lg font-bold leading-7 text-v3-text-title sm:text-xl sm:leading-8">
            {step.lines.map((line) => (
              // explicit per-line breaks = graceful Thai wrapping (no mid-word auto-break)
              <span key={line} className="block [word-break:keep-all]">
                {line}
              </span>
            ))}
          </h1>
        </div>

        {/* MIDDLE — mascot, below the text; flex-1 + min-h-0 so it fits, never forces scroll */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-2 sm:py-4">
          <Image
            src={mascotSrc}
            alt=""
            aria-hidden="true"
            width={300}
            height={300}
            // hero capped to the Figma band (~45% of viewport height → ~82% width via aspect).
            // maxHeight via inline style: reliable across viewports, and arbitrary max-h-[Npx]
            // classes silently failed to apply here (same JIT family as the padding bug).
            style={{ maxHeight: '44vh' }}
            className="h-full w-auto object-contain drop-shadow-sm"
          />
        </div>

        {/* BOTTOM — dots + next (accessible name = visible text, WCAG 2.5.3) */}
        <div className="flex flex-col items-center gap-5 sm:gap-6">
          <DotsPager count={STEPS.length} active={index} />
          <Button onClick={next}>ถัดไป</Button>
        </div>
      </div>
    </FullBleedScreen>
  )
}

export default OnboardingCarousel
