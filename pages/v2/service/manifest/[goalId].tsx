// /v2/service/manifest/[goalId] — อ่าน/รีวิว manifest 1 ข้อ (mood + note + ปุ่ม)
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { ManifestReadScreen } from "@/features/v2-service/components/ManifestReadScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function ManifestReadPage() {
  return <ManifestReadScreen />
}
