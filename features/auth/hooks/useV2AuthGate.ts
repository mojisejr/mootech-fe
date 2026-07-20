// MuMate v2 — useV2AuthGate (logic seam). The loop-SAFE routing gate for every /v2 page, extracted
// out of the page files ON PURPOSE: the pages are now designer-owned (Lamun), and the login-loop
// invariant must NOT live inline in a file that gets edited for visual reasons — it lives here, in
// goo's hook, so the designer's page just consumes `status` and renders. (Codified seam,
// 2026-07-21: safety/invariant logic → hook, never inline in a designer-owned page.)
//
// THE INVARIANT (verified vs resolveAuth, and why the loop can't come back):
//   - `status` is cookie-truth (useCurrentUser → resolveAuth): 'anon' ONLY when there's no session
//     AND no valid MEMBER_ID; the authed-but-no-MEMBER_ID window is 'loading' (never 'anon'), while
//     the global self-heal (_app <IdentitySelfHeal/>) mints identity.
//   - Redirects fire ONLY on a settled 'authed'/'anon' — NEVER on 'loading'. Bouncing during
//     'loading' is exactly the login-loop; this hook makes that structurally impossible for callers.
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useCurrentUser, type AuthStatus } from '@/lib/auth/use-current-user'

export type V2AuthGateConfig = {
  /** Where to send a settled-authenticated user (e.g. /v2/login → '/v2'). Omit to render authed. */
  redirectWhenAuthed?: string
  /** Where to send a settled-anonymous user (e.g. /v2/register → '/v2'). Omit to render anon. */
  redirectWhenAnon?: string
}

export type V2AuthGate = {
  status: AuthStatus
  /** True while a configured redirect is being applied (a settled authed/anon that we bounce). */
  redirecting: boolean
  /** Render <AuthLoadingGate/> when true (still resolving, OR a redirect is in flight). */
  showLoading: boolean
}

export function useV2AuthGate(config: V2AuthGateConfig = {}): V2AuthGate {
  const router = useRouter()
  const { status } = useCurrentUser()
  const { redirectWhenAuthed, redirectWhenAnon } = config

  // A redirect is warranted only on a SETTLED status — 'loading' is deliberately excluded so we
  // never bounce during the self-heal window.
  const redirecting =
    (status === 'authed' && Boolean(redirectWhenAuthed)) ||
    (status === 'anon' && Boolean(redirectWhenAnon))

  useEffect(() => {
    if (status === 'authed' && redirectWhenAuthed) {
      router.replace(redirectWhenAuthed)
    } else if (status === 'anon' && redirectWhenAnon) {
      router.replace(redirectWhenAnon)
    }
    // status 'loading' → do nothing; wait for it to settle (login-loop invariant).
  }, [status, redirectWhenAuthed, redirectWhenAnon, router])

  return {
    status,
    redirecting,
    showLoading: status === 'loading' || redirecting,
  }
}
