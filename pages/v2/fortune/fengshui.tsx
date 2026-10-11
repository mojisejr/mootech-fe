// pages/v2/fortune/fengshui.tsx — ไพ่อาถรรพ์ฮวงจุ้ย (ซินแสนุ้ย 2026-10-07): หน้าที่หมายเหตุท้ายแชทชวนให้มาดูไพ่
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { FengshuiScreen } from "@/features/v2-fortune/components/FengshuiScreen"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function FengshuiCardsPage() {
  return <FengshuiScreen />
}
