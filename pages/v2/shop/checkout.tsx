// MuMate v2 — จอ checkout (mootech-fe#363). Behind the v2 gate.
//
// This page is GLUE. Every rule it depends on lives somewhere with teeth on it: the money comes from
// useCheckout (server-priced, never recomputed), the words come from result-state / QR_COPY, the methods
// come from PaymentMethodPicker, and the card token comes from omise-token (v2 key, set at call time).
// Keeping the page thin is deliberate — a page is the one place nobody writes unit tests for, so it should
// hold as few decisions as possible.
import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed, isV2TeamPreview } from '@/lib/v2/gate'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'
import { OrderSummaryCard } from '@/features/v2-shop/components/OrderSummaryCard'
import { PaymentMethodPicker, type PayMethod } from '@/features/v2-shop/components/PaymentMethodPicker'
import { CardForm, type CardState } from '@/features/v2-shop/components/CardForm'
import { useCheckout } from '@/features/v2-shop/useCheckout'
import { createCardToken } from '@/features/v2-shop/omise-token'
import { formatSatang } from '@/features/v2-shop/usePackagePrice'
import { PLANS } from '@/features/v2-shop/packages'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: { teamPreview: isV2TeamPreview(ctx.req) } }
}

const EMPTY_CARD: CardState = { name: '', number: '', expiry: '', cvc: '' }

export default function V2CheckoutPage({ teamPreview }: { teamPreview: boolean }) {
  const router = useRouter()
  const packageCode = typeof router.query.package_code === 'string' ? router.query.package_code : ''
  const tier = useClientTier(teamPreview)
  const co = useCheckout(packageCode)
  const [method, setMethod] = useState<PayMethod>('card')
  const [card, setCard] = useState<CardState>(EMPTY_CARD)
  const [paying, setPaying] = useState(false)

  const plan = PLANS.find((p) => Object.values(p.codes).includes(packageCode))
  const planName = plan ? `${plan.name} · ${packageCode.endsWith('YEARLY') ? 'รายปี' : 'รายเดือน'}` : packageCode

  async function pay() {
    if (!co.quote || paying) return
    setPaying(true)
    try {
      if (method === 'promptpay') {
        const r = await fetch('/api/v2/payment/promptpay', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ package_code: packageCode, quote_id: co.quote.quoteId, ...(co.quote.codeApplied ? { code: co.quote.codeApplied } : {}) }),
        })
        const d = (await r.json()) as { chargeId?: string; qr?: string }
        if (!r.ok || !d.chargeId || !d.qr) { setPaying(false); void router.push('/v2/shop/result?state=OFFLINE'); return }
        void router.push(`/v2/shop/qrcode?charge=${encodeURIComponent(d.chargeId)}&qr=${encodeURIComponent(d.qr)}&amount=${co.quote.amountSatang}`)
        return
      }
      const [mm, yy] = card.expiry.split('/')
      const token = await createCardToken({ name: card.name, number: card.number, expMonth: (mm ?? '').trim(), expYear: (yy ?? '').trim(), cvc: card.cvc })
      const r = await fetch('/api/v2/payment/charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_code: packageCode, token, quote_id: co.quote.quoteId, ...(co.quote.codeApplied ? { code: co.quote.codeApplied } : {}) }),
      })
      const d = (await r.json()) as { chargeId?: string }
      if (!r.ok || !d.chargeId) { setPaying(false); void router.push('/v2/shop/result?state=CARD_DECLINED'); return }
      void router.push(`/v2/shop/result?state=PAYING&charge=${encodeURIComponent(d.chargeId)}`)
    } catch {
      // Tokenisation refused (bad number/expiry/cvc) or omise.js missing. The bank never saw a charge.
      setPaying(false)
      void router.push('/v2/shop/result?state=CARD_DECLINED')
    }
  }

  const ready = !!co.quote && !co.loading && (method === 'promptpay' || (card.name && card.number && card.expiry && card.cvc))

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ชำระเงิน · MuMate</title></Head>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <AppHeader testId="checkout-header" title="ชำระเงิน" backHref="/v2/shop" membership={tier} upgradeCta={false} className="items-center py-4" />

        {co.fatal && <p data-testid="checkout-fatal" role="alert" className="rounded-2xl bg-white p-5 text-sm text-v3-text-body">ตอนนี้ยังดึงราคาไม่ได้ ลองใหม่อีกครั้ง</p>}

        {co.quote && (
          <OrderSummaryCard
            planName={planName}
            validUntilText="1 ปีนับจากวันที่ชำระเงิน"
            quote={co.quote}
            onChangePlan={() => router.push('/v2/shop')}
            discount={{ state: co.codeState, value: co.code, onChange: co.setCode, onApply: co.applyCode, onClear: co.clearCode, errorText: co.codeError, busy: co.busy }}
          />
        )}

        <section className="flex w-full flex-col gap-4 rounded-[20px] bg-white p-4 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
          <h2 className="text-base font-bold leading-6 text-v3-navy">วิธีชำระเงิน</h2>
          <PaymentMethodPicker value={method} onChange={setMethod} />
          {method === 'card' && <CardForm value={card} onChange={setCard} />}
        </section>

        <button
          type="button"
          data-testid="checkout-pay"
          disabled={!ready || paying}
          onClick={pay}
          className="w-full rounded-pill bg-v3-sapphire px-5 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {paying ? 'กำลังดำเนินการ…' : `ชำระเงิน ${co.quote ? formatSatang(co.quote.amountSatang) : ''}`.trim()}
        </button>

        {/* 55159:5551-5555 — the reassurance line under the button. */}
        <p data-testid="checkout-secured" className="flex items-center justify-center gap-1.5 text-xs leading-4 text-v3-text-muted">
          <span aria-hidden>🛡</span> Secured by OMISE
        </p>
      </div>
    </div>
  )
}
