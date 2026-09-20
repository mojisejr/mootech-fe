// MuMate PWA · ป็อปอัปชวนติดตั้งแอปที่ "หน้าแรก" (#install) — bottom sheet ให้ผู้ใช้เลือกกดติดตั้งเอง.
//
// ทำไมอยู่หน้าแรก: นี่คือจุดที่ผู้ใช้เห็นก่อน — การชวนติดตั้งต้องอยู่ตรงนี้ ไม่ใช่ซ่อนในหน้าตั้งค่าแจ้งเตือน.
// ติดตั้งเป็น PWA แล้ว web push จะเด้งเหมือนแอปและทำงานแม้ปิดจอ (Android จำกัด background ของแท็บเบราว์เซอร์).
//
// พฤติกรรม (feature detection — ไม่เดา OS จาก UA):
//   • รันในแอปที่ติดตั้งแล้ว (standalone) → ไม่แสดง
//   • เพิ่งปิดไป (ภายใน 7 วัน) → ไม่แสดง (ไม่กวน)
//   • Android/Chromium (มี beforeinstallprompt) → ปุ่ม "ติดตั้งเลย" ยิง native dialog
//   • iOS Safari (needsInstall) → ปุ่ม "ดูวิธีติดตั้ง" เปิด InstallGuideSheet
//   • เบราว์เซอร์อื่นที่ยังติดตั้งไม่ได้ (เช่น LINE webview) → ไม่แสดง (ไม่มีทางให้กด)
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePwaInstall } from '@/lib/pwa/use-install-prompt'
import { useInstallReward } from '@/lib/pwa/use-install-reward'
import { usePwaCapability } from '@/lib/pwa/capability'
import { InstallGuideSheet } from '@/features/v2-calendar/components/InstallGuideSheet'

const DISMISS_KEY = 'mumate:install-prompt-dismissed-at'
const DISMISS_DAYS = 7
const MU_GREET = '/images/v2/mascot/personas/mu/greet.png'

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function InstallPromptSheet() {
  const { canInstall, installed, promptInstall } = usePwaInstall()
  const { needsInstall } = usePwaCapability()
  const [ready, setReady] = useState(false) // mount-gate: อย่าเรนเดอร์ก่อน client (กัน hydration + อ่าน localStorage)
  const [dismissed, setDismissed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // ยิงรับรางวัลติดตั้ง +30 QI ทันทีเมื่อเปิดเป็นแอปที่ติดตั้งแล้ว (idempotent ฝั่ง engine) — โฮมคือหน้าแรกที่ landing
  useInstallReward()

  useEffect(() => {
    // หน่วงเล็กน้อยให้หน้าแรกโผล่ก่อน แล้วค่อยเชิญ (ไม่กระโดดใส่ทันทีที่เข้า)
    const t = setTimeout(() => {
      setDismissed(dismissedRecently())
      setReady(true)
    }, 1200)
    return () => clearTimeout(t)
  }, [])

  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* private mode — ปิดได้ แค่ไม่จำ */
    }
    setDismissed(true)
  }

  const onInstall = async () => {
    if (canInstall) {
      setBusy(true)
      try {
        const r = await promptInstall()
        if (r === 'accepted' || r === 'dismissed') close() // เลือกแล้วไม่ต้องเชิญซ้ำรอบนี้
      } finally {
        setBusy(false)
      }
      return
    }
    setGuideOpen(true) // iOS / อื่น ๆ → สอนมือ
  }

  // เอ็ม/Janjarat 2026-09-20: กด "ดูวิธีติดตั้ง" แล้ว "เหมือนกดไม่ได้" + กด "ไว้ก่อน" แล้วชีทวิธีติดตั้งโผล่ —
  // เพราะเดิม render prompt + guide พร้อมกัน แล้ว guide อยู่ "หลัง" prompt (guide z-60 < prompt z-70) → กด CTA
  // เปิด guide ที่ถูกบัง (ดูเหมือนไม่มีอะไรเกิด), พอปิด prompt (ไว้ก่อน) guide ที่เปิดไว้ก็โผล่. แก้: เมื่อ
  // guideOpen ให้แสดง "เฉพาะชีทวิธีติดตั้ง" ไม่ render prompt ทับ (guide จบ → กลับมา prompt).
  if (guideOpen) {
    return <InstallGuideSheet variant="install" onClose={() => setGuideOpen(false)} />
  }

  // เงื่อนไขแสดง: client พร้อม · ยังไม่ติดตั้ง · ยังไม่ปิด · และ "ติดตั้งได้จริง" (Android prompt หรือ iOS)
  const installable = canInstall || needsInstall === true
  if (!ready || installed || dismissed || !installable) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={close}
      data-testid="install-prompt-scrim"
    >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-prompt-title"
          data-testid="install-prompt-sheet"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-md flex-col items-center rounded-t-[28px] bg-v3-lemon-chiffon px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 font-ibm"
        >
          {/* เสี่ยวมู่ทักทาย บนวงกลมน้ำเงินให้เข้าธีมไอคอนแอป */}
          <div className="grid size-[124px] place-items-center overflow-hidden rounded-full bg-v3-navy">
            <Image src={MU_GREET} alt="เสี่ยวมู่" width={112} height={112} className="object-contain" />
          </div>

          <h2 id="install-prompt-title" className="mt-4 text-center text-xl font-extrabold leading-7 text-v3-navy">
            ติดตั้ง MuMate เป็นแอป
          </h2>
          <p className="mt-2 text-center text-sm font-medium leading-6 text-v3-text-body">
            เพิ่มลงหน้าจอโฮม แล้วแจ้งเตือนยามมงคลจะเด้งเหมือนแอปทั่วไป — ทำงานแม้ปิดหน้าจอ ไม่ต้องเปิดเว็บค้างไว้
          </p>
          {/* โบนัสติดตั้งครั้งแรก +30 QI (ครั้งเดียวต่อบัญชี) */}
          <p className="mt-3 rounded-2xl bg-v3-lime/25 px-3 py-2 text-center text-[13px] font-bold text-v3-navy">
            🎁 ติดตั้งครั้งแรกรับ <span className="text-v3-sapphire">+30 QI</span> ฟรี · ครั้งเดียวต่อบัญชี
          </p>

          <button
            type="button"
            onClick={onInstall}
            disabled={busy}
            data-testid="install-prompt-cta"
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-v3-sapphire text-base font-bold text-white disabled:opacity-50"
          >
            <span aria-hidden>📲</span>
            {busy ? 'กำลังเปิดตัวติดตั้ง…' : canInstall ? 'ติดตั้งเลย · รับ 30 QI' : 'ดูวิธีติดตั้ง · รับ 30 QI'}
          </button>
          <button
            type="button"
            onClick={close}
            data-testid="install-prompt-later"
            className="mt-2 h-11 w-full rounded-2xl text-sm font-bold text-v3-text-muted"
          >
            ไว้ก่อน
          </button>
        </div>
      </div>
  )
}
