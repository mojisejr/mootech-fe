// components/sales-closed-notice.tsx — #376 "the shop is closed; the app is not."
//
// v1 stopped selling on 2026-08-24 (ฟีม: "ปิด v1 ก่อนเลยไม่ต้องรอ v2 เดี๋ยวมีคนจ่ายเข้ามาแล้วต้องจัดการเพิ่ม").
// Everything else in v1 keeps working — login, ดูดวง, แชต, โปรไฟล์, ปฏิทิน, and every right an existing
// member already paid for. ONLY the buy paths are shut.
//
// WHY NOT REUSE pages/maintenance.tsx. It exists, it is the repo's own mechanism, and it was the first thing
// I reached for. Its sentence is "ปิดปรับปรุงชั่วคราว 🔧 / ขณะนี้เรากำลังอัปเกรดระบบ" — which, on a screen the
// user reached by tapping "แพ็คเกจราคา", reads as THE SITE IS DOWN. It is not. A user who believes the app is
// broken closes it and does not come back to the parts that still work; that is a worse outcome than the one
// we are preventing. The visual language is borrowed verbatim (same gradient, same glass card, same wordmark)
// so it still looks like the same product — only the sentence tells the truth about what is actually closed.
//
// NOT SILENT, ON PURPOSE. features/v2-shell/components/ComingSoon.tsx:10 already ruled this for v2: "It does
// not pretend to succeed." A page that renders nothing, or a button that swallows the tap, is indistinguishable
// from a broken app on a phone. So the closure is stated, and the user is given somewhere to go.
import Head from 'next/head';
import Image from 'next/image';

const BRAND_GRADIENT = 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)';

export const SALES_CLOSED_TITLE = 'ปิดการขายชั่วคราว';
export const SALES_CLOSED_BODY = 'ตอนนี้เรากำลังปรับแพ็กเกจใหม่ จึงปิดการซื้อไว้ก่อน';
/** the half users actually worry about — say it before they ask */
export const SALES_CLOSED_REASSURANCE = 'บัญชีของคุณและสิทธิ์ที่ซื้อไว้แล้ว ยังใช้งานได้ตามปกติทุกอย่าง';

export default function SalesClosedNotice({ onBack }: { onBack?: () => void }) {
  return (
    <>
      <Head>
        <title>{`${SALES_CLOSED_TITLE} | Mumate`}</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        data-testid="sales-closed"
        className="font-ibm relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 animate-gradient-shift"
        style={{ background: BRAND_GRADIENT, backgroundSize: '200% 200%' }}
      >
        <Image
          src="/images/mumate/Sparkles.svg"
          alt=""
          width={120}
          height={120}
          aria-hidden
          className="pointer-events-none absolute left-5 top-10 opacity-20 select-none"
        />
        <Image
          src="/images/mumate/Sparkles.svg"
          alt=""
          width={88}
          height={88}
          aria-hidden
          className="pointer-events-none absolute bottom-16 right-6 opacity-20 select-none"
        />

        <section className="animate-slide-up w-full max-w-[460px] rounded-[32px] bg-white/45 px-7 py-9 text-center shadow-custom backdrop-blur-md">
          <div className="mx-auto mb-5 flex h-[180px] w-[120px] items-center justify-center">
            <Image
              src="/images/mumate/loading.png"
              alt="Mumate"
              width={120}
              height={180}
              priority
            />
          </div>

          <h1 className="text-[24px] font-semibold text-moumate_blue">
            {SALES_CLOSED_TITLE} 🛍️
          </h1>

          <p className="mt-3 text-[16px] leading-relaxed text-moumate_black">
            {SALES_CLOSED_BODY}
          </p>
          {/* authored as its own element, not a wrapped sentence: this is the line that keeps a user from
              concluding the app is dead, so it must not be the one that gets visually swallowed. */}
          <p className="mt-2 text-[15px] leading-relaxed text-moumate_gray">
            {SALES_CLOSED_REASSURANCE}
          </p>

          {onBack ? (
            <button
              type="button"
              data-testid="sales-closed-back"
              onClick={onBack}
              className="mt-7 inline-flex w-full items-center justify-center rounded-[16px] bg-moumate_blue py-[14px] text-[16px] font-medium text-white transition active:scale-[0.99]"
            >
              กลับไปหน้าหลัก
            </button>
          ) : null}

          <a
            href="https://line.me/ti/p/~@mumate"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center rounded-[16px] border border-moumate_blue py-[14px] text-[16px] font-medium text-moumate_blue transition active:scale-[0.99]"
          >
            ติดตามข่าวสารที่ LINE @mumate
          </a>
        </section>

        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <Image
            src="/images/mumate/ic_logo.svg"
            alt="Mumate"
            width={110}
            height={26}
            className="opacity-90"
          />
        </div>
      </main>
    </>
  );
}
