// /v2/service/manifest/history — ประวัติย้อนหลัง (streak + entries)
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { ManifestHistoryScreen } from "@/features/v2-service/components/ManifestHistoryScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function ManifestHistoryPage() {
  return <ManifestHistoryScreen />
}
