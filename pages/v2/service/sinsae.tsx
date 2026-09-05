// /v2/service/sinsae — ดูดวงส่วนตัว กับซินแส (ปรึกษาตัวต่อตัว). v2 gate เดียวกับ hub.
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { SinsaeScreen } from "@/features/v2-service/components/SinsaeScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2SinsaePage() {
  return <SinsaeScreen />
}
