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
import { ElementResultScreen } from '@/features/v2-first-run/components/ElementResultScreen'
import { IntentCheckScreen, type GoalId } from '@/features/v2-first-run/components/IntentCheckScreen'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { useFirstRunMascot } from '@/features/v2-first-run/hooks/useFirstRunMascot'

const HOME = '/v2'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

type Step = 'intent' | 'pdpa' | 'element'

export default function V2FirstRun() {
  const router = useRouter()
  const { mascot } = useFirstRunMascot()
  const [step, setStep] = useState<Step>('intent')
  const [goal, setGoal] = useState<GoalId | null>(null)
  const [consent, setConsent] = useState(false)

  const goHome = () => router.replace(HOME)

  if (step === 'pdpa') {
    return (
      <PdpaConsentScreen
        consent={consent}
        onConsentChange={setConsent}
        onBack={() => setStep('intent')}
        // PHASE C: replace with the save-hook (POST /consent → onboarded_at) before advancing.
        onAccept={() => setStep('element')}
      />
    )
  }

  if (step === 'element') {
    // Hold a minimal frame while the chart resolves rather than drawing a fake element. In practice the
    // fetch (kicked off on mount) has resolved by the time the user finishes intent + pdpa.
    if (!mascot) {
      return (
        <main className="flex min-h-dvh items-center justify-center p-8 text-center font-ibm text-v3-text-body">
          กำลังเตรียมผลธาตุของคุณ…
        </main>
      )
    }
    return (
      <ElementResultScreen
        source={{ mascot, cycle: { status: 'loading' }, summary: { status: 'loading' } }}
        onBack={() => setStep('pdpa')}
        onReadFull={goHome}
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
