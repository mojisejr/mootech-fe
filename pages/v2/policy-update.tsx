// MuMate v2 — /v2/policy-update: an onboarded member accepts the UPDATED privacy policy once
// (CIEL mumate-pdpa-reconsent-001 slice 1). Home (useV2Home) and chat (usePolicyGate) send members here when
// their latest accepted consent.policy_version is not the current one; ?next= is where they were going.
//
// The required tick appends one consent row at the server's version (/api/v2/policy-consent POST) and never
// touches onboarded_at. The AI box is the same optional ai_training consent as sign-up and settings:
//   • ticked on arrival only if the member already accepted the CURRENT ai_training version;
//   • left empty → nothing is recorded (an empty box is not a "no" over an earlier answer);
//   • changed from its arrival state → recorded (a tick = yes; un-ticking an existing yes = withdrawal).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { safeNext } from '@/lib/home/first-run-gate'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { aiTrainingOn, recordAiTrainingConsent } from '@/features/v2-privacy/aiTraining'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

type Status = 'loading' | 'ready' | 'saving' | 'error'

export default function V2PolicyUpdate() {
  const router = useRouter()
  const next = safeNext(router.query.next)
  const [status, setStatus] = useState<Status>('loading')
  const [consent, setConsent] = useState(false)
  const [aiAtArrival, setAiAtArrival] = useState(false)
  const [ai, setAi] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    let alive = true
    void (async () => {
      // Already on the current version (a second tab, a back button) → straight on, nothing to ask.
      const s = await fetch('/api/v2/policy-consent').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      if (!alive) return
      if (s?.ok && !s.needed) {
        void router.replace(next)
        return
      }
      const c = await fetch('/api/consent').then((r) => (r.ok ? r.json() : null)).catch(() => null)
      if (!alive) return
      const on = aiTrainingOn(c?.consents ?? [])
      setAiAtArrival(on)
      setAi(on)
      setStatus('ready')
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  const accept = async () => {
    if (!consent || status === 'saving') return
    setStatus('saving')
    const r = await fetch('/api/v2/policy-consent', { method: 'POST' }).catch(() => null)
    const j = r && r.ok ? await r.json().catch(() => null) : null
    if (!j?.ok) {
      setStatus('error')
      return
    }
    if (ai !== aiAtArrival) await recordAiTrainingConsent(ai)
    void router.replace(next)
  }

  if (status === 'loading') return <div className="min-h-screen bg-[#ECF0FD]" aria-busy="true" />

  return (
    <PdpaConsentScreen
      variant="update"
      consent={consent}
      onConsentChange={setConsent}
      aiTraining={ai}
      onAiTrainingChange={setAi}
      onAccept={accept}
      saving={status === 'saving'}
      error={status === 'error'}
    />
  )
}
