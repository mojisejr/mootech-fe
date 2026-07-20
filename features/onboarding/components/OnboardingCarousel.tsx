import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { DotsPager } from './DotsPager'

// OnboardingCarousel — MuMate v2 onboarding (DESIGN.md v3, Figma 588:10335→588:10311→298:476→619:12978).
// 4 self-contained steps: heading + mascot art + Dots + "ถัดไป". Last step → onComplete().
// goo mounts this on the /v2 entry and routes onComplete → /v2/login.
//
// Placeholders (ฟีม finalises later, not blocking): mascot poses = the package-mascot svg;
// bg = /images/v2/bg/BG01.png (goo pulls it) over a sky-pink gradient fallback so it renders
// before the asset lands.

type Step = {
  /** headline lines (rendered stacked, centered) */
  lines: string[]
  /** true only on step 1 → also shows the MuMate wordmark above the mascot */
  withLogo?: boolean
}

const STEPS: Step[] = [
  { lines: ['ความสงบเริ่มต้นที่ใจ', 'สรรค์สร้างสมดุลแห่งชีวิต'], withLogo: true },
  { lines: ['ศาสตร์จีนโบราณกว่า 3,000 ปี', 'ที่คนนับล้านใช้นำใจเส้นทางชีวิตตัวเอง'] },
  { lines: ['แนวทางการใช้ชีวิต', 'หาคู่-หุ้นส่วนที่ใช่', 'วันมงคลของคุณ'] },
  { lines: ['เน้นความแม่นยำจากข้อมูลวันเกิดจริง', 'ไม่ใช่คำทำนายทั่วไปแบบราศี'] },
]

// TODO(assets): swap for the per-step mascot poses once ฟีม picks them (main-mascot set).
const MASCOT_PLACEHOLDER = '/images/icons/image_mascot_package.svg'

export function OnboardingCarousel({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  function next() {
    if (isLast) {
      onComplete()
      return
    }
    setIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      // BG01 (goo pulls) over a sky-pink gradient fallback (onboarding = photo bg, §13)
      style={{
        background:
          'linear-gradient(180deg, #EAF2FF 0%, #F7ECF6 55%, #FCEFEA 100%)',
      }}
    >
      {/* real bg photo — 404-safe: sits over the gradient above until the asset lands */}
      <Image
        src="/images/v2/bg/BG01.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        className="pointer-events-none select-none object-cover"
        onError={(e) => {
          // keep the gradient fallback if BG01 isn't in /public yet
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col px-8 pb-10 pt-16">
        {/* content — centered */}
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          {step.withLogo && (
            <Image
              src="/images/mumate/ic_logo.svg"
              alt="MuMate"
              width={148}
              height={40}
              className="h-10 w-auto"
            />
          )}
          <Image
            src={MASCOT_PLACEHOLDER}
            alt=""
            aria-hidden="true"
            width={220}
            height={220}
            className="h-[220px] w-[220px] object-contain drop-shadow-sm"
          />
          <h1 className="font-ibm text-xl font-bold leading-8 text-v3-text-body">
            {step.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
        </div>

        {/* footer — dots + next */}
        <div className="flex flex-col items-center gap-6">
          <DotsPager count={STEPS.length} active={index} />
          {/* accessible name = visible text (WCAG 2.5.3 Label-in-Name). The button reads
              "ถัดไป" throughout per Figma; on the last step it advances to /v2/login. */}
          <Button onClick={next}>ถัดไป</Button>
        </div>
      </div>
    </div>
  )
}

export default OnboardingCarousel
