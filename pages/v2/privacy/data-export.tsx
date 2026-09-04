// MuMate v2 — /v2/privacy/data-export. Behind the v2 gate. Glue only.
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { DataExportScreen } from '@/features/v2-settings/components/DataExportScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2Page() {
  return <DataExportScreen />
}
