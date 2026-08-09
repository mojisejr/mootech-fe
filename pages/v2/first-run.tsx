// MuMate v2 — /v2/first-run REAL route (#233 Phase A). Before this existed, useV2Home's onboarded-gate
// redirected new users here (useV2Home.ts) and they hit a 404. This page holds the 3-screen first-run
// flow (intent → pdpa → element) for a logged-in, chart-having user who has not finished onboarding.
//
// Team-gated exactly like the other /v2 pages (SSR passkey) — NOT NODE_ENV — so it is reachable on a
// Vercel/prod deploy behind the V2_PREVIEW_KEY, same as first-run-preview.tsx.
//
// PHASE A scope = the route exists and the 3 screens navigate (kills the 404). Two seams are filled in
// Phase C and are marked `PHASE C` below:
//   1. onAccept → POST /consent (save goal + consent, stamp onboarded_at) instead of just advancing.
//   2. ElementResultScreen `result` → the real per-user source (mascot + element_cycle + summary),
//      owned with มุน. Until then it renders WOOD_FIXTURE as an explicit placeholder (NOT a silent
//      default) so the screen is visibly a stand-in, and the swap is one prop.
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ElementResultScreen, WOOD_FIXTURE } from '@/features/v2-first-run/components/ElementResultScreen'
import { IntentCheckScreen, type GoalId } from '@/features/v2-first-run/components/IntentCheckScreen'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'

const HOME = '/v2'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

type Step = 'intent' | 'pdpa' | 'element'

export default function V2FirstRun() {
  const router = useRouter()
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
    return (
      <ElementResultScreen
        // PHASE C: swap WOOD_FIXTURE for the real ElementResultSource (mascot + cycle + summary).
        result={WOOD_FIXTURE}
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
