// pages/v2/fortune/fengshui.tsx — ไพ่อาถรรพ์ฮวงจุ้ย (ซินแสนุ้ย 2026-10-07): หน้าที่หมายเหตุท้ายแชทชวนให้มาดูไพ่
// พักไว้ก่อน (owner 2026-10-12, mumate-fengshui-hold-001): ยังไม่เปิดให้ใช้ — หลังผ่าน gate ล็อกอิน ทุกคนถูกส่งไป coming-soon.
// เปิดคืน = ON_HOLD = false (และลบ hiddenUntilArt ของ 'fengshui-cards' ใน services.ts)
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { FengshuiScreen } from "@/features/v2-fortune/components/FengshuiScreen"
import { comingSoonHrefById } from "@/features/v2-service/services"

const ON_HOLD = true

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  if (ON_HOLD) return { redirect: { destination: comingSoonHrefById("fengshui-cards"), permanent: false } }
  return { props: {} }
}

export default function FengshuiCardsPage() {
  return <FengshuiScreen />
}
