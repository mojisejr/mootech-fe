import { useState } from 'react'
import { FullBleedScreen } from '@/features/v2-shell/components/FullBleedScreen'

// slice 7c (2026-10-02) — หน้า login เมื่อเปิดจากใน Facebook / Messenger / Instagram.
// ในนั้น LINE ไม่ล็อกอินอัตโนมัติ (walk 2026-10-02: ต้องกรอกอีเมล/รหัสผ่าน LINE + รหัสยืนยันในแอป LINE) และ Google
// บล็อก OAuth. พาไปเบราว์เซอร์จริงก่อนเริ่ม OAuth (ทั้ง flow อยู่ใน cookie jar เดียว) แต่ไม่ขังผู้ใช้: มีวิธีกดเอง,
// ปุ่มคัดลอกลิงก์ และ "เข้าสู่ระบบต่อในแอปนี้" เสมอ.
export function OpenInBrowserScreen({
  appName,
  browserName,
  onOpen,
  onCopy,
  onStay,
}: {
  appName: string
  browserName: string
  onOpen: () => void
  onCopy: () => Promise<boolean>
  onStay: () => void
}) {
  const [copied, setCopied] = useState<boolean | null>(null)

  return (
    <FullBleedScreen
      bgSrc="/images/v2/bg/BG01.png"
      bgFallback="linear-gradient(180deg, #FBEFE6 0%, #F7E9F0 50%, #EAF0FB 100%)"
      contentClassName="justify-center px-8"
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex flex-col gap-6 text-center">
          <div className="flex flex-col gap-2.5">
            <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
              เปิดใน {browserName} เพื่อเข้าสู่ระบบ
            </h1>
            <p className="font-ibm text-[15px] leading-[22px] text-v3-text-body">
              ลิงก์นี้เปิดอยู่ในแอป {appName} ซึ่งเข้าสู่ระบบด้วย LINE หรือ Google ไม่ได้ลื่น
              <br />
              ใน {browserName} แตะครั้งเดียวก็เข้าได้ แถมติดตั้งแอปและรับแจ้งเตือนได้ด้วยค่ะ
            </p>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-[52px] w-full items-center justify-center rounded-pill bg-v3-sapphire px-6 font-ibm text-base font-semibold leading-6 text-white transition active:brightness-95"
          >
            เปิดใน {browserName}
          </button>

          <p className="font-ibm text-sm leading-5 text-v3-text-body">
            ถ้าไม่เปิด: กดปุ่ม ⋯ มุมขวาบน แล้วเลือก &quot;เปิดในเบราว์เซอร์&quot;
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={async () => setCopied(await onCopy())}
              className="font-ibm text-sm font-bold leading-5 text-v3-sapphire"
            >
              {copied === true ? 'คัดลอกลิงก์แล้ว — วางใน Chrome หรือ Safari' : 'คัดลอกลิงก์'}
            </button>
            {copied === false ? (
              <p className="font-ibm text-xs leading-4 text-v3-text-body">คัดลอกไม่ได้ ลองกด ⋯ แล้วเลือกเปิดในเบราว์เซอร์ค่ะ</p>
            ) : null}
            <button
              type="button"
              onClick={onStay}
              className="font-ibm text-xs leading-4 text-v3-text-body underline"
            >
              เข้าสู่ระบบต่อในแอปนี้
            </button>
          </div>
        </div>
      </div>
    </FullBleedScreen>
  )
}

export default OpenInBrowserScreen
