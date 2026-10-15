// pages/v2/fortune/siamsi.tsx — ไพ่เซียมซีเคี้ยงคุง 80 ใบ (ซินแสนุ้ย 2026-10-15): การชี้แนะ แผนงาน การตัดสินใจ ขอความเห็น
// สร้างไว้เผื่อ แต่ยังไม่เปิดให้ใช้ (เอ็ม 2026-10-15 "ให้ใช้ได้แค่หลังบ้าน" = engine /siamsi) — หลังผ่าน gate ล็อกอิน ทุกคนถูกส่งไป coming-soon.
// เปิดคืน = ON_HOLD = false + ลบ hiddenUntilArt ของ 'siamsi-kiangkung' ใน services.ts (+ ใส่อาร์ตการ์ดเมนู/หลังไพ่)
import type { GetServerSideProps } from "next"

import { v2RedirectIfUnauthed } from "@/lib/v2/gate"
import { CardReadingScreen } from "@/features/v2-fortune/components/CardReadingScreen"
import { comingSoonHrefById } from "@/features/v2-service/services"

const ON_HOLD = true

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "no-store, must-revalidate")
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  if (ON_HOLD) return { redirect: { destination: comingSoonHrefById("siamsi-kiangkung"), permanent: false } }
  return { props: {} }
}

export default function SiamsiCardsPage() {
  return (
    <CardReadingScreen
      mode="siamsi"
      title="ไพ่เซียมซีเคี้ยงคุง"
      resultTitle="ผลเซียมซีเคี้ยงคุง"
      introArt="/images/v2/fortune/oracle-back.png"
      endpoint="/api/fortune/siamsi"
      deckCount={80}
      pickCount={1}
    />
  )
}
