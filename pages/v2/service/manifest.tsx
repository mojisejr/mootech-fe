// /v2/service/manifest — มานิเฟส (ตั้งเป้าหมาย+affirmation+ภารกิจรายวัน). v2 gate เดียวกับ hub.
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { ManifestScreen } from "@/features/v2-service/components/ManifestScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ManifestPage() {
  return <ManifestScreen />
}
