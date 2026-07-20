// MuMate v2 onboarding route (มุน owns — UI/compose). Renders the 4-step carousel inside its
// FullBleedScreen container. Gate: reuses goo's v2 preview guard (redirect to /v2 when the team
// passkey cookie is missing) — same discipline as every other /v2/* page.
//
// Entry routing (logged-out → carousel, logged-in → home) is goo's `useV2AuthGate` on `/v2`;
// this page is simply where the carousel lives so it has a real, verifiable route.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { OnboardingCarousel } from '@/features/onboarding/components/OnboardingCarousel'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2OnboardingPage() {
  const router = useRouter()
  return <OnboardingCarousel onComplete={() => router.push('/v2/login')} />
}
