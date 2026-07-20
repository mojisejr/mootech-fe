// MuMate v2 home (Phase 0 scaffold). getServerSideProps is the real gate: middleware lets `/v2`
// through either way (see middleware.ts guardV2) so this page renders the passkey form itself when
// unauthenticated, and the app-shell home once the v2_access cookie is valid. The home body is a
// placeholder — real feature flows land in Phase B.
import type { GetServerSideProps } from 'next'
import { isV2Authenticated } from '@/lib/v2/gate'
import { AppShell } from '@/features/v2-shell/components/AppShell'
import { V2GateForm } from '@/features/v2-shell/components/V2GateForm'

type Props =
  | { authenticated: false; gateError: string | null }
  | { authenticated: true }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  if (!isV2Authenticated(ctx.req)) {
    const gateError = typeof ctx.query.gate_error === 'string' ? ctx.query.gate_error : null
    return { props: { authenticated: false, gateError } }
  }
  return { props: { authenticated: true } }
}

export default function V2HomePage(props: Props) {
  if (!props.authenticated) {
    return <V2GateForm gateError={props.gateError} />
  }
  return (
    <AppShell title="หน้าหลัก">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="font-poppins-v3 text-xl font-bold text-v3-sapphire">MuMate v2</h1>
        <p className="mt-2 text-sm text-neutral-500">
          โครงหน้าหลัก (Phase 0) — ฟีเจอร์จริงจะมาในเฟสถัดไป
        </p>
      </section>
    </AppShell>
  )
}
