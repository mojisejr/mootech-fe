// MuMate v2 — /v2/login (Slice 1). Team-gated (SSR). Client identity + hydration via useV2AuthGate
// (mount-safe: no SSR mismatch; authed → /v2; login-loop invariant preserved). WRAPS next-auth via
// useV2Login (no rewrite). Figma "03-register" (route-swap: Figma register = code /login).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
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
  const { showLoading } = useV2AuthGate({ redirectWhenAuthed: '/v2' })
  const { loading, onLine, onGoogle } = useV2Login()

  if (showLoading) return <AuthLoadingGate />

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
