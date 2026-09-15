// MuMate v2 — จอผลการชำระเงิน (mootech-fe#363). Behind the v2 gate. Glue only.
//
// The state arrives in the URL, but a URL is a thing anyone can type — so a claimed APPROVED is VERIFIED
// against /payment/status for that chargeId before this screen will say the money moved. Trusting the query
// string would mean /v2/shop/result?state=APPROVED is a page that tells anyone their payment succeeded.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ResultScreen } from '@/features/v2-shop/components/ResultScreen'
import { QiBuySuccess } from '@/features/v2-shop/components/QiBuySuccess'
import { PlanPaySuccess } from '@/features/v2-shop/components/PlanPaySuccess'
import { SinsaeBookingSuccess } from '@/features/v2-shop/components/SinsaeBookingSuccess'
import { BookOrderSuccess } from '@/features/v2-shop/components/BookOrderSuccess'
import { RESULT_COPY, resolveResultState, tryAnotherHref, type ResultState } from '@/features/v2-shop/result-state'
import { useChargeStatus } from '@/features/v2-shop/useChargeStatus'
import { qiQtyOf, sinsaeMinutesOf, bookFormatOf } from '@/lib/payment/catalog'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

const isState = (v: unknown): v is ResultState => typeof v === 'string' && v in RESULT_COPY

export default function V2ResultPage() {
  const router = useRouter()
  const charge = typeof router.query.charge === 'string' ? router.query.charge : ''
  const claimed: ResultState = isState(router.query.state) ? router.query.state : 'PAYING'
  // #438 — carried through from checkout so "เลือกวิธีชำระเงินอื่น" can land on the SAME package's checkout
  // instead of a bare /v2/shop/checkout, which resolves package_code to '' and makes /payment/preview 400.
  const packageCode = typeof router.query.package_code === 'string' ? router.query.package_code : ''
  // #439 — a cardholder returning from their bank arrives with `order`, never `charge`: the return_uri had
  // to be handed to Omise before Omise minted a charge id, so the only identifier it can carry is ours.
  const order = typeof router.query.order === 'string' ? router.query.order : ''
  // #466 — the plan to name in a refusal, handed over by checkout. A display name, never a tier code: it is
  // only ever read back out as words, so a stranger typing one in can make the page say a different plan
  // name and nothing else. The verdict itself still comes from `state`, which is checked against the union.
  const planName = typeof router.query.plan === 'string' ? router.query.plan : null
  // buy-qi (ก้อน 1.6) — แพ็กชี่จบที่หน้าชี่ ไม่ใช่หน้าแพ็กเกจ: ปุ่ม done พากลับ /v2/qi และบอกจำนวนชี่
  // ของแพ็ก (จาก QI_PACK_QTY server-side map — ไม่อ่านจาก URL นอกจากโค้ดแพ็กที่ตรวจแล้ว)
  const qiQty = qiQtyOf(packageCode)
  const qiLine = qiQty !== null ? `แพ็ก ${qiQty.toLocaleString('th-TH')} QI` : null
  const { status, method, phase, qrDeadline, failureCode, check, tierCode } = useChargeStatus({ chargeId: charge || null, orderId: order || null })

  // 🔴 เลนสินค้า: ยึด tierCode จาก "แถวจ่ายเงินจริง" (แหล่งความจริง จาก /api/v2/payment/status) ก่อน แล้วค่อย
  // fallback ไป package_code ใน URL. เหตุ (2026-09-15): เลน PromptPay ไม่ส่ง package_code กลับมา (qrcode.tsx
  // onApproved) ⇒ จองซินแสแล้ว packageCode='' ⇒ ตกไปหน้าสมาชิก PlanPaySuccess ทั้งที่จ่ายค่าจองซินแส. tierCode
  // มากับทุก charge/order เสมอ ⇒ เลือกจอถูกเลนแม้ URL ไม่มี package_code.
  const lane: 'SINSAE' | 'BOOK' | 'QI' | 'MEMBER' | null =
    tierCode === 'SINSAE' || sinsaeMinutesOf(packageCode) !== null ? 'SINSAE'
      : tierCode === 'BOOK' || bookFormatOf(packageCode) !== null ? 'BOOK'
        : tierCode === 'QI' || qiQty !== null ? 'QI'
          : tierCode ? 'MEMBER' // แถวโหลดแล้ว เป็น tier สมาชิก
            : packageCode ? 'MEMBER' // deep-link ปกติที่พก package_code (ไม่ใช่ 3 เลนบน)
              : null // ยังไม่รู้: แถวยังไม่โหลด + ไม่มี package_code ⇒ รอ ไม่เดาว่าเป็นสมาชิก

  // Glue only — the rule lives in result-state.ts next to the words it chooses between, so it can be tested
  // without a router. That is not tidiness: the branch this ticket adds was missing precisely because the
  // only way to exercise the old nested ternary was to render this page.
  const state: ResultState = resolveResultState({ status, method, claimed, phase, qrDeadline, failureCode })

  // 🔴 เงินเข้าจริงแล้ว แต่ยังไม่รู้เลน (แถวยังโหลดไม่เสร็จ + URL ไม่มี package_code — เช่นเลน PromptPay) ⇒ รอ
  // ไม่เดาว่าเป็นสมาชิก. ถ้าเดา จะโชว์หน้าสมาชิกผิด ๆ ให้คนจ่ายค่าจองซินแสเห็นชั่ววูบ (บั๊กที่กำลังแก้).
  if (RESULT_COPY[state].paid && lane === null) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-v3-bg-cream">
        <Head><title>กำลังเปิดใบเสร็จ · MuMate</title></Head>
        <p role="status" aria-live="polite" className="text-sm text-v3-text-muted">กำลังเปิดใบเสร็จ…</p>
      </div>
    )
  }

  // จองซินแส (tier SINSAE): เงินเข้าจริงแล้ว → หน้า "จองสำเร็จ" (ใบเสร็จย่อ + ทักไลน์ยืนยันคิว).
  if (RESULT_COPY[state].paid && lane === 'SINSAE') {
    return (
      <div className="flex min-h-screen w-full flex-col bg-v3-bg-cream">
        <Head><title>จองสำเร็จ · MuMate</title></Head>
        <SinsaeBookingSuccess packageCode={packageCode} charge={charge} order={order} />
      </div>
    )
  }

  // สั่งซื้อหนังสือ (tier BOOK): เงินเข้าจริงแล้ว → หน้า "สั่งซื้อสำเร็จ" (ใบเสร็จย่อ + 10-15 วัน + กลุ่ม BLM).
  if (RESULT_COPY[state].paid && lane === 'BOOK') {
    return (
      <div className="flex min-h-screen w-full flex-col bg-v3-bg-cream">
        <Head><title>สั่งซื้อสำเร็จ · MuMate</title></Head>
        <BookOrderSuccess packageCode={packageCode} charge={charge} order={order} />
      </div>
    )
  }

  // buy-qi (เฟรม success): เมื่อเงินเข้าแล้วจริง + เป็นแพ็ก QI → จอ success เฉพาะ QI (ยอดใหม่/delta/ใบเสร็จ).
  // สถานะอื่น (กำลังจ่าย/ถูกปฏิเสธ/QR หมดอายุ ฯลฯ) ยังใช้ ResultScreen ที่ copy/retry ถูก audit ไว้แล้ว.
  if (RESULT_COPY[state].paid && lane === 'QI') {
    return (
      <div className="flex min-h-screen w-full flex-col justify-center bg-v3-bg-cream">
        <Head><title>เติม QI สำเร็จ · MuMate</title></Head>
        <QiBuySuccess packageCode={packageCode} charge={charge} order={order} />
      </div>
    )
  }

  // 402:22087 — a settled MEMBERSHIP purchase gets the receipt-card success screen (the QI twin above does
  // the same for packs). ALREADY_PAID is `paid` too and lands here on purpose: the card it shows is the
  // one payment that exists, which is exactly what that state is trying to say.
  if (RESULT_COPY[state].paid && lane === 'MEMBER') {
    return (
      <div className="flex min-h-screen w-full flex-col bg-v3-bg-cream">
        <Head><title>ชำระเงินสำเร็จ · MuMate</title></Head>
        <PlanPaySuccess packageCode={packageCode} charge={charge} order={order} />
      </div>
    )
  }

  return (
    // Centred for the same reason as the QR screen: top-aligned, the outcome sat above half a phone of
    // empty cream and read as an unfinished page. On the screen that tells someone whether their money moved,
    // "unfinished" is the worst possible impression to leave.
    <div className="flex min-h-screen w-full flex-col justify-center bg-v3-bg-cream">
      <Head><title>ผลการชำระเงิน · MuMate</title></Head>
      <ResultScreen
        state={state}
        onRetrySame={check}
        // 🔴 #438 — WITH the package, or not at all. Pushing a bare /v2/shop/checkout sends the user to a
        // screen that cannot price anything (checkout.tsx:34 → '' → /payment/preview 400), which turns
        // "try another method" into a second dead end. No package in the URL (an old link, a hand-typed
        // one) ⇒ send them somewhere that works: the package list.
        onTryAnother={() => router.push(tryAnotherHref(packageCode))}
        planName={planName}
        successLine={qiLine}
        // ฟีมเคาะ 2026-08-26: a refused purchase lands back on the package list. That falls out of the
        // existing rule — paid:false already goes to /v2/shop — so there is nothing special-cased here.
        // buy-qi: paid พากลับ /v2/qi (บ้านของชี่) แทน /v2 เพราะสิ่งที่ซื้อคือชี่ ไม่ใช่สมาชิก
        onDone={() => router.push(RESULT_COPY[state].paid ? (qiQty !== null ? '/v2/qi' : '/v2') : '/v2/shop')}
      />
    </div>
  )
}
