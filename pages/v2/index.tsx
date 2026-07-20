// MuMate v2 entry (Slice 1). TWO gates stack here:
//   1. TEAM preview gate (v2_access) — SSR (getServerSideProps): no cookie → render the passkey
//      form; the whole /v2 surface is team-only.
//   2. APP identity (MEMBER_ID via useCurrentUser) — CLIENT: decides onboarding vs home.
// Identity routing is client-side and cookie-truth (useCurrentUser), mirroring pages/login and
// pages/register exactly — never raw useSession — so the fragile login-loop cannot reappear:
// anon → onboarding carousel, loading → wait (splash), authed → home. The global self-heal
// (_app <IdentitySelfHeal/>) mints MEMBER_ID for anyone who arrives authed-without-identity.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { isV2Authenticated } from '@/lib/v2/gate'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import { AppShell } from '@/features/v2-shell/components/AppShell'
import { V2GateForm } from '@/features/v2-shell/components/V2GateForm'
import { OnboardingCarousel } from '@/features/onboarding/components/OnboardingCarousel'

type Props =
  | { teamAuthed: false; gateError: string | null }
  | { teamAuthed: true }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  if (!isV2Authenticated(ctx.req)) {
    const gateError = typeof ctx.query.gate_error === 'string' ? ctx.query.gate_error : null
    return { props: { teamAuthed: false, gateError } }
  }
  return { props: { teamAuthed: true } }
}

function V2Entry() {
  const router = useRouter()
  const { status } = useCurrentUser()

  if (status === 'loading') return <AuthLoadingGate />

  if (status === 'anon') {
    return <OnboardingCarousel onComplete={() => router.push('/v2/login')} />
  }

  // status === 'authed' → home (Slice 1 placeholder; real home is a later slice)
  return (
    <AppShell title="หน้าหลัก">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="font-poppins-v3 text-xl font-bold text-v3-sapphire">MuMate v2</h1>
        <p className="mt-2 text-sm text-neutral-500">
          เข้าสู่ระบบแล้ว — โครงหน้าหลัก (ฟีเจอร์จริงมาในสไลซ์ถัดไป)
        </p>
      </section>
    </AppShell>
  )
}

export default function V2HomePage(props: Props) {
  if (!props.teamAuthed) {
    return <V2GateForm gateError={props.gateError} />
  }
  return <V2Entry />
}
