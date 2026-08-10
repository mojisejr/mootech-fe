// MuMate v2 — /v2/first-run REAL route (#233). Before this existed, useV2Home's onboarded-gate
// redirected new users here and they hit a 404. This page holds the 3-screen first-run flow
// (intent → pdpa → element) for a logged-in, chart-having user who has not finished onboarding.
//
// Team-gated exactly like the other /v2 pages (SSR passkey) — NOT NODE_ENV — so it is reachable on a
// Vercel/prod deploy behind the V2_PREVIEW_KEY, same as first-run-preview.tsx.
//
// Element screen `source` (μุน's ElementResultSource, #238): the MASCOT (card art + element) is the
// free, immediate half — resolved from the same compute home uses (useFirstRunMascot), so the two
// screens never disagree. `cycle` (element_cycle facets) and `summary` (bazi reading) are PHASE C:
// they start `loading` here — "not asked yet", NOT `unavailable`.
//
// PHASE C seam: onAccept currently just advances; it will POST /consent (save goal + consent, stamp
// onboarded_at) so the returning user lands home instead of first-run.
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import {
  ElementResultScreen,
  type ElementResultSource,
} from '@/features/v2-first-run/components/ElementResultScreen'
import { IntentCheckScreen, type GoalId } from '@/features/v2-first-run/components/IntentCheckScreen'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { Button } from '@/components/ui/button'
import { useFirstRunSource } from '@/features/v2-first-run/hooks/useFirstRunSource'
import { useSaveOnboarding } from '@/features/v2-first-run/hooks/useSaveOnboarding'

const HOME = '/v2'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

type Step = 'intent' | 'pdpa' | 'element'

export default function V2FirstRun() {
  const router = useRouter()
  const { source, status } = useFirstRunSource()
  const { save, state: saveState } = useSaveOnboarding()
  const [step, setStep] = useState<Step>('intent')
  const [goal, setGoal] = useState<GoalId | null>(null)
  const [consent, setConsent] = useState(false)

  const goHome = () => router.replace(HOME)

  // Save goal + PDPA consent (stamps onboarded_at) THEN advance — only on a real success, so a failed
  // save never leaves a user "onboarded" in the UI but not the DB (which would loop them next visit).
  const acceptAndSave = async () => {
    if (!goal || saveState === 'saving') return // goal is guaranteed by the intent gate; guard re-entry
    if (await save(goal)) setStep('element')
    // on failure saveState becomes 'error' and we stay on pdpa so the user can retry (no silent advance).
  }

  if (step === 'pdpa') {
    return (
      <PdpaConsentScreen
        consent={consent}
        onConsentChange={setConsent}
        onBack={() => setStep('intent')}
        onAccept={acceptAndSave}
        saving={saveState === 'saving'}
        error={saveState === 'error'}
      />
    )
  }

  if (step === 'element') {
    return (
      <FirstRunElementView
        status={status}
        source={source}
        onBack={() => setStep('pdpa')}
        onGoHome={goHome}
      />
    )
  }

  return (
    <IntentCheckScreen
      selected={goal}
      onSelect={setGoal}
      // advance only once a goal is chosen — the intent screen is a required 1-of-6 choice.
      onNext={() => goal && setStep('pdpa')}
    />
  )
}

// The element step, as its own view so the three-state behaviour is unit-testable at the call site (#240):
//   loading      → a frame while the chart fetches
//   ready(source)→ the real screen (mascot + cycle now; the slow summary streams via its own AsyncState)
//   unavailable  → a reason + a way OUT (never a permanent spinner — μุน's #240 ask)
export function FirstRunElementView({
  status,
  source,
  onBack,
  onGoHome,
}: {
  status: 'loading' | 'ready' | 'unavailable'
  source: ElementResultSource | null
  onBack?: () => void
  onGoHome: () => void
}) {
  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center p-8 text-center font-ibm text-v3-text-body">
        กำลังเตรียมผลธาตุของคุณ…
      </main>
    )
  }
  if (status === 'unavailable' || !source) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
        <p className="max-w-[280px] font-ibm text-base leading-6 text-v3-text-body">
          ยังแสดงผลธาตุของคุณไม่ได้ตอนนี้ ลองเข้าหน้าหลักแล้วกลับมาใหม่อีกครั้ง
        </p>
        <Button onClick={onGoHome}>เข้าสู่หน้าหลัก</Button>
      </main>
    )
  }
  return (
    <ElementResultScreen source={source} onBack={onBack} onReadFull={onGoHome} onGoHome={onGoHome} />
  )
}
