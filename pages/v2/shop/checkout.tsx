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
import { createCardToken, OmiseTokenError } from '@/features/v2-shop/omise-token'
import { validateCard } from '@/features/v2-shop/card-rules'
import { payReady } from '@/features/v2-shop/pay-ready'
import { formatSatang } from '@/features/v2-shop/usePackagePrice'
import { PLANS, planNameForTier } from '@/features/v2-shop/packages'
import { payDestination, tokenizationFailedDestination, type PayBody, type PayLane } from '@/features/v2-shop/pay-destination'

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
  // One clock for the page. Held in state so a re-render cannot silently move the month boundary
  // underneath a buyer who is mid-form.
  const [now] = useState(() => new Date())
  const [paying, setPaying] = useState(false)

  const plan = PLANS.find((p) => Object.values(p.codes).includes(packageCode))
  const planName = plan ? `${plan.name} · ${packageCode.endsWith('YEARLY') ? 'รายปี' : 'รายเดือน'}` : packageCode

  // 🔴 #466 round 2 — THE PAGE HOLDS NO ROUTING DECISION AT ALL ANY MORE (ตู๋, review of 983d3b0).
  // Round 1 moved WHERE a refusal goes into a pure function but left WHEN it is asked as a line of ordering
  // here — and ตู๋ proved that half was still unguarded: deleting the refusal check, or moving `!r.ok`
  // above it, both kept `npm test` green and both put "ธนาคารปฏิเสธการชำระเงิน" back in front of a paying
  // member. So the order came out too. Everything below is transport; the answer comes from payDestination.
  async function pay() {
    if (!co.quote || paying) return
    setPaying(true)
    try {
      const lane: PayLane = method === 'promptpay' ? 'promptpay' : 'card'
      const body: Record<string, unknown> = {
        package_code: packageCode,
        quote_id: co.quote.quoteId,
        ...(co.quote.codeApplied ? { code: co.quote.codeApplied } : {}),
      }
      if (lane === 'card') {
        const [mm, yy] = card.expiry.split('/')
        body.token = await createCardToken({
          name: card.name, number: card.number,
          expMonth: (mm ?? '').trim(), expYear: (yy ?? '').trim(), cvc: card.cvc,
        })
      }
      const r = await fetch(lane === 'promptpay' ? '/api/v2/payment/promptpay' : '/api/v2/payment/charge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = (await r.json()) as PayBody

      const dest = payDestination({
        lane, status: r.status, ok: r.ok, body: d,
        packageCode, amountSatang: co.quote.amountSatang,
        // the plan they tried to buy · and the plan they already hold — the only two things this page knows
        // that the server's 409 deliberately does not say (it names the SITUATION, not the tier).
        targetPlanName: plan?.name,
        heldPlanName: planNameForTier(tier.tier),
      })
      if (!dest.keepPaying) setPaying(false)
      // 🔴 #439 — window.location, not router.push: an external destination is not Next's to route.
      if (dest.kind === 'external') { window.location.href = dest.href; return }
      void router.push(dest.href)
  } catch (e) {
      // Tokenisation refused, or omise.js is missing. The bank never saw a charge and no request was ever
      // made — so there is no server answer to reason about. It gets its own pure answer rather than an
      // invented status code passed to payDestination.
      // #438 — package_code rides along so the result screen can offer a way BACK to this same checkout.
      // 🔴 #492 — and the REASON rides along too. This was a bare `catch {}`: every refusal, from a
      // mistyped digit to our own key being wrong, arrived here as the same nothing and the buyer was
      // told their BANK declined. Omise sends a code; we were discarding it at this exact line.
      setPaying(false)
      const code = e instanceof OmiseTokenError ? e.code : null
      void router.push(tokenizationFailedDestination(packageCode, code).href)
    }
  }

  // 🔴 #492 — THE ONE CALL SITE. Before this, `ready` asked only whether the four boxes were non-empty,
  // so "a" in every field could press Pay. The form no longer computes this for itself; it is handed the
  // result below, so the button and the red borders can never disagree about the same card.
  // `now` lives here and only here — see the CardForm props for why it is not a defaulted prop there.
  //
  // 🔴 `payReady` is IMPORTED, not written out here (ตู๋, review r1 B2). The first version inlined this
  // condition and the test inlined its own copy, so deleting the rule from this page kept every lane
  // green. Sharing the function makes that deletion a compile error instead of a silent pass.
  const validation = validateCard(card, now)
  const ready = payReady({ hasQuote: !!co.quote, loading: co.loading, method, card, now })

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
          {method === 'card' && <CardForm value={card} onChange={setCard} validation={validation} />}
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
