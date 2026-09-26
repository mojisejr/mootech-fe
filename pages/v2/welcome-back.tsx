// MuMate v2 — /v2/welcome-back. Asked before a second account is created
// (mumate-login-identity-001 slice 5). Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { IdentityChoiceScreen } from '@/features/auth/components/IdentityChoiceScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2WelcomeBackPage() {
  return <IdentityChoiceScreen />
}
