// /v2/service/manifest/done?id=<goalId> — จอสำเร็จ (ความปรารถนาเป็นจริงแล้ว)
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { ManifestDoneScreen } from "@/features/v2-service/components/ManifestDoneScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function ManifestDonePage() {
  return <ManifestDoneScreen />
}
