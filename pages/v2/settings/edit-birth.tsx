// MuMate v2 — /v2/settings/edit-birth. Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { EditBirthScreen } from '@/features/v2-account/components/EditBirthScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2EditBirthScreenPage() {
  return <EditBirthScreen />
}
