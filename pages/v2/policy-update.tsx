// MuMate v2 — /v2/policy-update: an onboarded member accepts the UPDATED privacy policy once
// (CIEL mumate-pdpa-reconsent-001 slice 1). Home (useV2Home) and chat (usePolicyGate) send members here when
// their latest accepted consent.policy_version is not the current one; ?next= is where they were going.
//
// The tick (read to the end first, PdpaConsentScreen) appends one consent row at the server's version
// (/api/v2/policy-consent POST) and never touches onboarded_at. Plan 0.3 (owner 2026-10-23): accepting also turns the
// ai_training item on (opt-out), unless the member's latest answer is a no, then the member goes straight on to ?next=.
// Plan 0.4 (the team, 2026-10-24): no notice after accepting — 3.1 in the policy they just read is where it is said.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { safeNext } from '@/lib/home/first-run-gate'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { turnOnAiTrainingOnAcceptance } from '@/features/v2-privacy/aiTraining'

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
    await turnOnAiTrainingOnAcceptance()
    void router.replace(next)
  }

  if (status === 'loading') return <div className="min-h-screen bg-[#ECF0FD]" aria-busy="true" />

  return (
    <PdpaConsentScreen
      variant="update"
      consent={consent}
      onConsentChange={setConsent}
      onAccept={accept}
      saving={status === 'saving'}
      error={status === 'error'}
    />
  )
}
