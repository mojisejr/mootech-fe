// MuMate PWA · install-prompt capture (Android/Chromium) + standalone detection.
//
// Android Chrome ปล่อย event `beforeinstallprompt` เมื่อเว็บเข้าเกณฑ์ PWA (มี manifest + SW + https).
// เบราว์เซอร์จะ "ไม่แสดง" แถบติดตั้งเองถ้าเราเรียก preventDefault() — เราเก็บ event ไว้แล้วยิงเองตอนผู้ใช้
// กดปุ่ม "ติดตั้งแอป" (ต้องมาจาก user gesture). iOS Safari ไม่มี event นี้ → ใช้ InstallGuideSheet สอนมือแทน.
//
// 🔴 ดัก event ที่ module scope (ตอน import) ไม่ใช่ใน useEffect: beforeinstallprompt ยิงครั้งเดียวตอนโหลด
// หน้า ก่อน component จะ mount — ถ้าไปดักใน effect มักพลาด. _app.tsx import ไฟล์นี้ (side-effect) ให้ listener
// ติดตั้งตั้งแต่แอปเริ่ม. hook แค่ "อ่าน" event ที่ดักไว้แล้ว + subscribe การเปลี่ยนแปลง.
import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | null = null
const CHANGED = 'mumate:install-availability-changed'

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // กันแถบ mini-infobar ของ Chrome — เราจะยิงเองจากปุ่มของเรา
    deferred = e as BeforeInstallPromptEvent
    window.dispatchEvent(new Event(CHANGED))
  })
  window.addEventListener('appinstalled', () => {
    deferred = null // ติดตั้งแล้ว → ไม่มี prompt ให้ยิงอีก
    window.dispatchEvent(new Event(CHANGED))
  })
}

/** true = กำลังรันในโหมดแอปที่ติดตั้งแล้ว (display-mode standalone หรือ iOS navigator.standalone). */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  )
}

export type InstallState = {
  /** Android/Chromium มี prompt พร้อมยิง (ยังไม่ได้ติดตั้ง) */
  canInstall: boolean
  /** กำลังรันเป็นแอปที่ติดตั้งแล้ว */
  installed: boolean
  /** ยิง prompt ติดตั้ง (ต้องเรียกจาก user gesture). คืนผลลัพธ์ หรือ 'unavailable' ถ้าไม่มี prompt */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

export function usePwaInstall(): InstallState {
  const [canInstall, setCanInstall] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const sync = () => {
      setCanInstall(deferred !== null)
      setInstalled(isRunningStandalone())
    }
    sync()
    window.addEventListener(CHANGED, sync)
    // display-mode อาจเปลี่ยนตอนผู้ใช้ติดตั้งแล้วเปิดจากไอคอน
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null
    mq?.addEventListener?.('change', sync)
    return () => {
      window.removeEventListener(CHANGED, sync)
      mq?.removeEventListener?.('change', sync)
    }
  }, [])

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null // prompt ใช้ได้ครั้งเดียว
    window.dispatchEvent(new Event(CHANGED))
    return outcome
  }

  return { canInstall, installed, promptInstall }
}
