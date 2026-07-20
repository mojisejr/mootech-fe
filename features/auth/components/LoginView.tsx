import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { TextLink } from '@/components/ui/link'
import { LineButton } from './LineButton'

// LoginView — MuMate v2 /v2/login presentational (DESIGN.md v3, Figma "03-register" 302-238).
// Route-swap: Figma "register" = code /login. Pure UI — goo wires next-auth (signIn line/google)
// into the callbacks; this never touches the auth machine.
//
// bg = /images/v2/bg/BG03.png (goo pulls) over a sunset gradient fallback.

// Minimal inline brand glyphs (placeholder; ฟีม may swap for official assets).
function LineGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.07.75.22.86.5.1.26.06.66.03.92l-.14.83c-.04.25-.2.98.86.53 1.06-.45 5.7-3.36 7.78-5.75C21.1 14.4 22 12.8 22 11c0-4.4-4.5-8-10-8Z"
        fill="#fff"
      />
    </svg>
  )
}
function GoogleGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.6-.05-1.2-.15-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .95-3.4.95-2.6 0-4.8-1.75-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.95a6 6 0 0 1 0-3.9V7.45H3.1a10 10 0 0 0 0 9.1l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 5.95c1.5 0 2.8.5 3.8 1.5l2.85-2.85A10 10 0 0 0 3.1 7.45l3.3 2.6C7.2 7.7 9.4 5.95 12 5.95Z" />
    </svg>
  )
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
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #FBEFE6 0%, #F7E9F0 50%, #EAF0FB 100%)' }}
    >
      <Image
        src="/images/v2/bg/BG03.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        className="pointer-events-none select-none object-cover"
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-center px-8">
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

          {/* provider buttons */}
          <div className="flex flex-col gap-3">
            <LineButton onClick={onLine} disabled={loading} leadingIcon={<LineGlyph />}>
              ลงทะเบียนด้วย LINE
            </LineButton>
            <Button
              variant="tertiary"
              onClick={onGoogle}
              disabled={loading}
              leadingIcon={<GoogleGlyph />}
              className="normal-case"
            >
              ลงทะเบียนด้วย Google
            </Button>
          </div>

          {/* footer link */}
          <p className="flex items-center justify-center gap-1 font-ibm text-sm leading-5 text-v3-text-body">
            มีบัญชีอยู่แล้ว?
            <TextLink
              href="#"
              onClick={(e) => {
                if (onExistingAccount) {
                  e.preventDefault()
                  onExistingAccount()
                }
              }}
            >
              เข้าสู่ระบบ
            </TextLink>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginView
