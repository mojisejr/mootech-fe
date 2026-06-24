import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';

const BRAND_GRADIENT = 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)';

// NextAuth `pages.error` points here (see pages/api/auth/[...nextauth].ts).
// Before this page existed the route 404'd, which masked the real OAuth failure
// and made a broken handshake look like a generic "เข้าไม่ได้/วน". Surface a
// calm, branded error with a clear way back to /login. (#mootech-maint-gate-incognito-login)
//
// Force SSR + no-cache so an error response is never CDN-cached (mirrors
// pages/maintenance.tsx).
export const getServerSideProps: GetServerSideProps<{ errorCode: string }> = async (
  ctx,
) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate');
  const raw = ctx.query.error;
  const errorCode = (Array.isArray(raw) ? raw[0] : raw) || '';
  return { props: { errorCode } };
};

// Map NextAuth error codes -> calm Thai copy. Unknown codes fall back to Default.
const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'ระบบเข้าสู่ระบบขัดข้องชั่วคราว ทีมงานกำลังดูแลให้อยู่ค่ะ',
  AccessDenied: 'การเข้าสู่ระบบถูกปฏิเสธ กรุณาลองอนุญาตสิทธิ์อีกครั้งค่ะ',
  Verification: 'ลิงก์ยืนยันหมดอายุหรือถูกใช้ไปแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้งค่ะ',
  OAuthAccountNotLinked:
    'บัญชีนี้เคยเข้าสู่ระบบด้วยช่องทางอื่น กรุณาใช้ช่องทางเดิมที่เคยใช้ค่ะ',
  Default: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ',
};

export default function AuthErrorPage({ errorCode }: { errorCode: string }) {
  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default;

  return (
    <>
      <Head>
        <title>เข้าสู่ระบบไม่สำเร็จ | Mumate</title>
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
            เข้าสู่ระบบไม่สำเร็จ
          </h1>

          <p className="mt-3 text-[16px] leading-relaxed text-moumate_black">
            {message}
          </p>
          {errorCode ? (
            <p className="mt-2 text-[13px] text-moumate_gray">
              รหัสอ้างอิง: {errorCode}
            </p>
          ) : null}

          <Link
            href="/login"
            className="mt-7 inline-flex w-full items-center justify-center rounded-[16px] bg-moumate_blue py-[14px] text-[16px] font-medium text-white transition active:scale-[0.99]"
          >
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
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
