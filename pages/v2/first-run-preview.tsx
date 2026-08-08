// DEV-ONLY preview of the three post-first-login screens (issue #215). notFound in prod.
// Nothing is mounted into a real flow yet: first-login detection and routing are ใบ 3, so this page
// is the ONLY way in — no login, no user, no backend.
//
//   ?step=intent|pdpa|element   which screen (default: intent)
//   ?goal=finance|health|family|growth|love|work|none   intent-check selection
//                               (default: health — the state Figma 300:1548 draws)
//   ?consent=1                  pdpa starts ticked → button ACTIVE (Figma 300:2137)
//                               omitted → unticked → button DISABLED (Figma 300:1582)
//
// The two PDPA frames are one screen in two states, so they are one URL knob, not two routes —
// which is what lets a design-verify pass shoot both from the same build with no source patch.
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { ElementResultScreen } from '@/features/v2-first-run/components/ElementResultScreen'
import { IntentCheckScreen, type GoalId } from '@/features/v2-first-run/components/IntentCheckScreen'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true }
  return { props: {} }
}

export default function V2FirstRunPreview() {
  const q = useRouter().query
  const step = (q.step as string) || 'intent'

  const goalParam = (q.goal as string) || 'health'
  const [goal, setGoal] = useState<GoalId | null>(goalParam === 'none' ? null : (goalParam as GoalId))
  const [consent, setConsent] = useState(q.consent === '1')

  if (step === 'pdpa') {
    return (
      <PdpaConsentScreen
        consent={consent}
        onConsentChange={setConsent}
        onBack={() => undefined}
        onAccept={() => window.alert('accept()')}
      />
    )
  }

  if (step === 'element') {
    return (
      <ElementResultScreen
        onBack={() => undefined}
        onReadFull={() => window.alert('readFull()')}
        onGoHome={() => window.alert('goHome()')}
      />
    )
  }

  return (
    <IntentCheckScreen
      selected={goal}
      onSelect={setGoal}
      onBack={() => undefined}
      onNext={() => window.alert('next()')}
    />
  )
}
