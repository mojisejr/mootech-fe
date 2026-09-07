import Image from 'next/image'
import { FullBleedScreen } from '@/features/v2-shell/components/FullBleedScreen'
import { LineButton } from './LineButton'
import { GoogleButton } from './GoogleButton'

// LoginView — MuMate v2 /v2/login presentational (DESIGN.md v3, Figma "03-register" 302-238).
// Route-swap: Figma "register" = code /login. Pure UI — goo wires next-auth (signIn line/google)
// into the callbacks; this never touches the auth machine.
//
// Container = FullBleedScreen (container-contract §9.1) · bg = BG01 (ฟีม lock 2026-07-21).

// Brand glyphs = the Figma exports (public/images/v2/onboarding, byte-identical to 302:268 "twitter"
// [sic — it is the LINE mark, 20px] and 626:950 devicon:google [24px]). Never redrawn.
function LineGlyph() {
  return <Image src="/images/v2/onboarding/line.svg" alt="" width={20} height={20} className="size-5" />
}
function GoogleGlyph() {
  return <Image src="/images/v2/onboarding/google.svg" alt="" width={24} height={24} className="size-6" />
}

export function LoginView({
  onLine,
  onGoogle,
  onExistingAccount,
  loading = false,
}: {
  onLine: () => void
  onGoogle: () => void
  onExistingAccount?: () => void
  loading?: boolean
}) {
  return (
    <FullBleedScreen
      bgSrc="/images/v2/bg/BG01.png"
      bgFallback="linear-gradient(180deg, #FBEFE6 0%, #F7E9F0 50%, #EAF0FB 100%)"
      contentClassName="justify-center px-8"
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col gap-7">
          {/* heading */}
          <div className="flex flex-col gap-2.5 text-center">
            <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
              ยินดีต้อนรับสู่ มิวเมท
            </h1>
            <p className="font-ibm text-[15px] leading-[22px] text-v3-text-body">
              มาร่วมสร้างบันทึกทางใจ
              <br />
              และค้นพบความสงบไปกับพวกเรา
            </p>
          </div>

          {/* Registration Options (302:254): buttons stack gap 12 · stack↔login link gap 20 */}
          <div className="flex flex-col items-center gap-5">
            <div className="flex w-full flex-col gap-3">
              <LineButton onClick={onLine} disabled={loading} leadingIcon={<LineGlyph />}>
                ลงทะเบียนด้วย LINE
              </LineButton>
              <GoogleButton onClick={onGoogle} disabled={loading} leadingIcon={<GoogleGlyph />}>
                ลงทะเบียนด้วย Google
              </GoogleButton>
            </div>

            {/* login link (302:262): Body/Regular-Medium 14/20 #464646 + Label/Bold 14/20 #1455A4.
                IBM Plex Sans Thai on both halves — NOT the Poppins TextLink primitive, which is a
                different Figma component (284-1037) than the one this frame uses. */}
            <p className="flex items-center justify-center gap-1 font-ibm text-sm font-medium leading-5 text-v3-text-body">
              มีบัญชีอยู่แล้ว?
              <a
                href="#"
                className="font-bold text-v3-sapphire focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-shade-02"
                onClick={(e) => {
                  if (onExistingAccount) {
                    e.preventDefault()
                    onExistingAccount()
                  }
                }}
              >
                เข้าสู่ระบบ
              </a>
            </p>
          </div>
        </div>
      </div>
    </FullBleedScreen>
  )
}

export default LoginView
