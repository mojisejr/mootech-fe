import Head from 'next/head';
import Image from 'next/image';

const BRAND_GRADIENT = 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)';

export default function MaintenancePage() {
  return (
    <>
      <Head>
        <title>ปิดปรับปรุงชั่วคราว | Mumate</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        className="font-ibm relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 animate-gradient-shift"
        style={{ background: BRAND_GRADIENT, backgroundSize: '200% 200%' }}
      >
        {/* decorative sparkles */}
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

        {/* glass card */}
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
            ปิดปรับปรุงชั่วคราว 🔧
          </h1>

          <p className="mt-3 text-[16px] leading-relaxed text-moumate_black">
            ขณะนี้เรากำลังอัปเกรดระบบ
            <br />
            เพื่อให้ใช้งานได้ดียิ่งขึ้น
          </p>
          <p className="mt-2 text-[15px] text-moumate_gray">
            ขออภัยในความไม่สะดวก เปิดให้ใช้เร็ว ๆ นี้ ✨
          </p>

          <a
            href="https://line.me/ti/p/~@mumate"
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex w-full items-center justify-center rounded-[16px] bg-moumate_blue py-[14px] text-[16px] font-medium text-white transition active:scale-[0.99]"
          >
            ติดตามข่าวสารที่ LINE @mumate
          </a>
        </section>

        {/* brand wordmark */}
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
