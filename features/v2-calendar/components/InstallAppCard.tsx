// MuMate PWA · การ์ด "ติดตั้งแอป" — ให้ผู้ใช้เพิ่ม MuMate ลงหน้าจอโฮมได้เองจากในเว็บ (#install).
//
// ทำไมต้องมี: web push จะ "เด้งเหมือนแอป + เชื่อถือได้" ที่สุดเมื่อรันเป็น PWA ที่ติดตั้งแล้ว (โดยเฉพาะ
// Samsung/Android ที่ชอบจำกัด background ของแท็บเบราว์เซอร์). แต่เดิมไม่มีปุ่มให้ลูกค้ากดติดตั้งเลย —
// Android เข้าเกณฑ์ PWA อยู่แล้วแต่ Chrome ซ่อนแถบติดตั้งไว้, iOS ต้อง Add-to-Home-Screen เอง.
//
// พฤติกรรมตาม state (feature detection ล้วน — ไม่เดา OS จาก UA):
//   • ติดตั้งแล้ว (standalone)        → การ์ดยืนยันเล็ก ๆ "✅ ติดตั้งแล้ว"
//   • Android/Chromium (มี prompt)   → ปุ่ม "ติดตั้งแอป MuMate" → ยิง beforeinstallprompt (native dialog)
//   • iOS Safari (needsInstall)      → ปุ่ม "วิธีติดตั้งแอป" → เปิด InstallGuideSheet (สอน Share→Add)
//   • อื่น ๆ                          → ปุ่มสอนติดตั้ง (fallback เมนูเบราว์เซอร์)
import { useState } from 'react'
import { usePwaInstall } from '@/lib/pwa/use-install-prompt'
import { usePwaCapability } from '@/lib/pwa/capability'
import { InstallGuideSheet } from './InstallGuideSheet'

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  )
}

export function InstallAppCard() {
  const { canInstall, installed, promptInstall } = usePwaInstall()
  const { needsInstall } = usePwaCapability()
  const [guideOpen, setGuideOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // ติดตั้งแล้ว → ยืนยันเบา ๆ (ผู้ใช้จะได้รู้ว่ากำลังอยู่ในแอป ไม่ต้องติดตั้งซ้ำ)
  if (installed) {
    return (
      <div
        data-testid="install-app-installed"
        className="flex items-center gap-2 rounded-2xl border border-v3-sapphire/20 bg-white px-4 py-3 text-sm font-bold text-v3-sapphire"
      >
        <span aria-hidden>✅</span>
        ติดตั้งแอป MuMate แล้ว — แจ้งเตือนจะเด้งเหมือนแอปทั่วไป
      </div>
    )
  }

  const onClick = async () => {
    // Android/Chromium: ยิง native prompt ตรง ๆ
    if (canInstall) {
      setBusy(true)
      try {
        await promptInstall()
      } finally {
        setBusy(false)
      }
      return
    }
    // iOS / อื่น ๆ: เปิดชีทสอนติดตั้งด้วยมือ
    setGuideOpen(true)
  }

  // ป้ายปุ่ม: Android กดติดตั้งได้เลย, ที่เหลือเป็น "วิธีติดตั้ง"
  const label = canInstall ? 'ติดตั้งแอป MuMate' : 'วิธีติดตั้งแอป MuMate'
  // เหตุผลใต้ปุ่ม — บอกว่าทำไมควรติดตั้ง (เด้งเหมือนแอป + ปิดจอก็เตือน)
  const reason =
    needsInstall === true
      ? 'iPhone ต้องเพิ่มลงหน้าจอโฮมก่อน แจ้งเตือนถึงจะทำงาน'
      : 'ติดตั้งเพื่อให้แจ้งเตือนเด้งเหมือนแอป และทำงานแม้ปิดหน้าจอ'

  return (
    <>
      <div data-testid="install-app-card" className="flex flex-col gap-2 rounded-2xl border border-v3-sapphire/25 bg-white p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-v3-ghost-white text-v3-sapphire">
            <PhoneIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-6 text-v3-navy">ติดตั้ง MuMate เป็นแอป</p>
            <p className="mt-0.5 text-sm font-normal leading-[22px] text-v3-text-body">{reason}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          data-testid="install-app-button"
          className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-v3-sapphire py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          <span aria-hidden>📲</span>
          {busy ? 'กำลังเปิดตัวติดตั้ง…' : label}
        </button>
      </div>
      {guideOpen && <InstallGuideSheet variant="install" onClose={() => setGuideOpen(false)} />}
    </>
  )
}
