// MuMate v2 — /v2/login (Slice 1). Team-gated (SSR). Client identity routing via useCurrentUser
// (cookie-truth, never raw useSession — the login-loop invariant): authed → skip to /v2, loading →
// splash, anon → show the login buttons. WRAPS next-auth via useV2Login (no rewrite).
import type { GetServerSideProps } from 'next'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import { LoginView } from '@/features/auth/components/LoginView'
import { useV2Login } from '@/features/auth/hooks/useV2Login'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req) // team preview gate
  if (redirect) return redirect
  return { props: {} }
}

export default function V2LoginPage() {
  const router = useRouter()
  const { status } = useCurrentUser()
  const { loading, onLine, onGoogle } = useV2Login()

  // Already logged in → skip login (mirror pages/login's redirect-if-authed, but stay inside /v2).
  useEffect(() => {
    if (status === 'authed') router.replace('/v2')
  }, [status, router])

  if (status === 'loading' || status === 'authed') return <AuthLoadingGate />

  return (
    <LoginView
      onLine={onLine}
      onGoogle={onGoogle}
      // Slice 1: returning users log in with the same OAuth buttons; no separate credential flow.
      onExistingAccount={() => undefined}
      loading={loading}
    />
  )
}
