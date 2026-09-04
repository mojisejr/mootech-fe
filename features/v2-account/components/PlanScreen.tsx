// features/v2-account/components/PlanScreen.tsx — /v2/account/plan (เฟรม `my-plan`)
// แผนปัจจุบัน + สิทธิ์ที่ได้ + ทางออกไปร้าน/ประวัติคำสั่งซื้อ. ข้อมูลแผนจาก useV2User เดิม
// (planFor — กติกาเดียวกับ AccountScreen ❌ คำนวณ tier ใหม่ในจอนี้)
import Head from "next/head"
import Link from "next/link"
import { SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { Menubar } from "@/features/v2-shell/components/Menubar"
import { useV2User } from "@/features/auth/hooks/useV2User"
import { SHOP_HREF } from "@/features/v2-shop/upgrade-cta"
import { parseTierCode } from "@/lib/v2/tier"
import type { MembershipLike } from "@/features/v2-shell/header-badge"
import { PLANS } from "@/features/v2-shop/packages"
import { planFor, type Plan } from "../plan"

const CARD = "flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

export function PlanScreen() {
  const { user, done, errored } = useV2User()
  const membership = user?.membership ?? null
  const headerMembership: MembershipLike | null =
    membership == null ? null : { isPaid: membership.isPaid ?? null, tier: parseTierCode(membership.tier ?? "") }
  const undetermined = !done || errored || membership == null || membership.isPaid == null
  const plan: Plan | null = undetermined ? null : planFor(membership)
  // สิทธิ์รายการ — เอาจาก PLANS ของร้าน (บัตรเดียวกับที่ขาย) ตาม plan id
  const features = plan ? PLANS.find((p) => p.id === (plan.level ?? "").toLowerCase())?.features ?? [] : []

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>แผนของฉัน · MuMate</title></Head>
      <SkyHeader title="แผนของฉัน" backHref="/v2/account" testId="plan" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {undetermined ? (
          <section data-testid="plan-undetermined" className={CARD}>
            <div aria-hidden className="h-6 w-1/2 animate-pulse rounded bg-v3-border-card" />
            <div aria-hidden className="h-4 w-2/3 animate-pulse rounded bg-v3-border-card" />
          </section>
        ) : plan ? (
          <section className={CARD} data-testid="plan-card">
            <p data-testid="plan-heading" className="text-lg font-bold leading-6 text-v3-navy">{plan.heading}</p>
            <p data-testid="plan-sub" className="text-sm leading-[22px] text-v3-text-body">{plan.sub}</p>
            {plan.level && features.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-v3-border-card pt-3" data-testid="plan-features">
                {features.map((f) => (
                  <li key={f} className="text-[13px] leading-5 text-v3-text-body">✓ {f}</li>
                ))}
              </ul>
            )}
            {plan.isFree ? (
              <Link href={SHOP_HREF} data-testid="plan-shop-cta" className="grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white">
                ดูแพ็คเกจ
              </Link>
            ) : null}
          </section>
        ) : null}

        <Link href="/v2/orders" data-testid="plan-orders-link" className={CARD}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-v3-navy">ประวัติคำสั่งซื้อและใบเสร็จ</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
              <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>
      </div>

      <Menubar />
    </div>
  )
}

export default PlanScreen
