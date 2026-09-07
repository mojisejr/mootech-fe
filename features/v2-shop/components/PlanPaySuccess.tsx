// features/v2-shop/components/PlanPaySuccess.tsx — "ชำระเงินสำเร็จ" for a MEMBERSHIP purchase
// (Figma 402:22087 "11-payment-processing", the paid variant). The QI twin is QiBuySuccess.tsx.
//
// Frame: check-circle 64 → "ชำระเงินสำเร็จ" 24 bold Sapphire → "ขอบคุณที่ให้ Mumate ดูเเล" 20 bold Pacific Cyan
// → one white receipt card (plan · ใช้ได้ถึง · "ใช้งานอยู่" chip · ยอดชำระ / วิธีชำระ / เลขที่ใบเสร็จ ·
// "ส่งใบเสร็จไปที่อีเมลแล้ว · ออกโดย Omise") → Primary Buttons "กลับสู่หน้าหลัก".
//
// 🔴 NOTHING HERE IS COMPUTED. The row comes from /api/v2/payment/status (same read QiBuySuccess and the
// orders screens make), the expiry from the user composite (lib/v2/subscription attaches it), and the
// title/subtitle from RESULT_COPY so the paid state can never say two different things on two screens.
// The frame's "ต่ออายุอัตโนมัติ" line is NOT reproduced: round one has no auto-renewal (ฟีม 2026-08-13),
// so the card says ใช้ได้ถึง — the same departure OrderSummaryCard records.
import Image from 'next/image'
import { useEffect, useState } from 'react'

import { KitButton } from '@/features/v2-profile/components/kit'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { bahtOf, methodWord, type FullPaymentRow } from '@/features/v2-account/components/OrdersScreen'
import { formatThaiDateAbbr } from '@/lib/v2/thai-date'
import { RESULT_COPY } from '../result-state'
import { planNameForTier } from '../packages'

export const PLAN_SUCCESS_SUBTITLE = 'ขอบคุณที่ให้ Mumate ดูเเล'

export function PlanPaySuccess({ packageCode, charge, order }: { packageCode: string; charge: string; order: string }) {
  const { user } = useV2User()
  const [row, setRow] = useState<FullPaymentRow | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/v2/payment/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return
        const rows: FullPaymentRow[] = Array.isArray(j?.payments) ? j.payments : []
        setRow(rows.find((r) => (charge && r.chargeId === charge) || (order && r.orderId === order)) ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [charge, order])

  const tier = row?.tierCode ?? null
  const planName = planNameForTier(tier) ?? planNameForTier(packageCode.replace(/^V2_/, '').replace(/_(YEARLY|MONTHLY)$/, '')) ?? 'Mumate'
  const period = packageCode.endsWith('MONTHLY') ? 'รายเดือน' : 'รายปี'
  const expire = user?.membership?.expireAt ? formatThaiDateAbbr(user.membership.expireAt.slice(0, 10)) : ''

  return (
    <div data-testid="plan-pay-success" className="mx-auto flex w-full max-w-md flex-col items-center gap-3.5 px-6 pb-8 pt-[90px] font-ibm">
      <div className="flex w-full flex-col items-center gap-6">
        {/* 402:22134 — the frame's own check-circle export, 64×64. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/v2/shop/check-circle.svg" alt="" width={64} height={64} className="size-16" aria-hidden />
        <div className="flex w-full flex-col gap-1 text-center">
          <h1 data-testid="plan-pay-success-title" role="status" aria-live="polite" className="text-2xl font-bold leading-normal text-v3-sapphire">
            {RESULT_COPY.APPROVED.title}
          </h1>
          <p className="text-xl font-bold leading-[30px] tracking-[0.2px] text-v3-cyan">{PLAN_SUCCESS_SUBTITLE}</p>
        </div>
      </div>

      {/* 402:22196 plan-Mumate Pro — white 22px card, 16 padding, 11 gap, v3 card shadow. */}
      <section data-testid="plan-pay-success-card" className="v3-shadow-card flex w-full flex-col gap-[11px] rounded-[22px] bg-white p-4">
        <div className="flex w-full items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <p className="text-lg font-bold leading-6 text-v3-navy">{`${planName} · ${period}`}</p>
            {expire ? <p className="text-sm leading-[22px] text-v3-text-body">ใช้ได้ถึง {expire}</p> : null}
          </div>
          <span className="shrink-0 rounded-pill bg-[#E7F6F8] px-2 py-1 text-[9px] font-bold leading-none text-v3-cyan">ใช้งานอยู่</span>
        </div>
        <hr className="w-full border-t border-v3-border-card" />
        {row ? (
          <>
            <div className="flex items-center justify-between text-sm"><span className="leading-[22px] text-v3-text-body">ยอดชำระ</span><b className="leading-5 text-v3-text-price">{bahtOf(row.amountSatang)}</b></div>
            <div className="flex items-center justify-between text-sm"><span className="leading-[22px] text-v3-text-body">วิธีชำระ</span><b className="leading-5 text-v3-text-price">{methodWord(row.method)}</b></div>
            {row.orderId ? (
              <div className="flex items-center justify-between gap-3 text-sm"><span className="leading-[22px] text-v3-text-body">เลขที่ใบเสร็จ</span><b className="break-all text-right leading-5 text-v3-text-price">{row.orderId}</b></div>
            ) : null}
          </>
        ) : (
          <div aria-hidden className="h-[66px] w-full animate-pulse rounded-lg bg-v3-border-card/60" />
        )}
        <hr className="w-full border-t border-v3-border-card" />
        <p className="flex items-center justify-center gap-[5px] text-[9px] leading-none text-v3-text-muted">
          <span>ส่งใบเสร็จไปที่อีเมลแล้ว · ออกโดย</span>
          <Image src="/images/v2/shop/omise-logo.png" alt="Omise" width={56} height={12} className="h-3 w-14 object-contain" />
        </p>
      </section>

      <KitButton href="/v2" testId="plan-pay-success-home" className="!h-[52px]">
        กลับสู่หน้าหลัก
      </KitButton>
    </div>
  )
}

export default PlanPaySuccess
