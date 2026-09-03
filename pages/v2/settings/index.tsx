// MuMate v2 — /v2/settings ตั้งค่า (จุดหมายของปุ่ม ⚙ บนหน้าแชท — team รายงาน 2026-09-03).
// ก้อน 4: เพิ่มการแจ้งเตือน · ช่วยเหลือ/FAQ · ภาษา · ขนาดตัวอักษร (ชีต) — logout เป็น bottom sheet
// ตามเฟรม settings-logout-dialog (คง 2 ขั้นยืนยันเดิม — settings-page.test คุมไว้).
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useV2Tier } from '@/features/auth/hooks/useV2Tier'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'

const CARD = 'flex w-full flex-col gap-1 rounded-[20px] bg-white drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'
const ROW = 'flex items-center justify-between gap-2 px-5 py-4 text-sm font-bold text-v3-navy'
const CHEVRON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
    <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ขนาดตัวอักษร (settings-text-size-sheet) — บันทึกเครื่องนี้ (localStorage) + apply ผ่าน zoom ของ <html>
export const TEXT_SCALE_KEY = 'v2:text-scale'
export const TEXT_SCALES = [
  { value: 0.9, label: 'เล็ก' },
  { value: 1, label: 'ปกติ' },
  { value: 1.1, label: 'ใหญ่' },
  { value: 1.25, label: 'ใหญ่มาก' },
] as const

export function applyTextScale(scale: number) {
  if (typeof document === 'undefined') return
  document.documentElement.style.zoom = String(scale)
}

// ชีตภาษา (settings-language-sheet) — ไทยพร้อมใช้ ภาษาอื่นรอทีมแปล (บอกตรง ๆ ❌ ปุ่มตาย)
const LANGUAGES = [
  { code: 'th', label: 'ไทย', available: true },
  { code: 'en', label: 'English', available: false },
  { code: 'zh', label: '中文', available: false },
]

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2SettingsPage() {
  const tier = useV2Tier(false)
  const { logout } = useV2Logout()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [scale, setScale] = useState<number>(1)

  const openTextSheet = () => {
    if (typeof window !== 'undefined') {
      const saved = Number(window.localStorage.getItem(TEXT_SCALE_KEY) ?? '1')
      setScale(Number.isFinite(saved) && saved > 0 ? saved : 1)
    }
    setTextOpen(true)
  }

  const pickScale = (value: number) => {
    setScale(value)
    applyTextScale(value)
    if (typeof window !== 'undefined') window.localStorage.setItem(TEXT_SCALE_KEY, String(value))
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <AppHeader testId="settings-header" title="ตั้งค่า" backHref="/v2" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {/* บัญชีและโปรไฟล์ */}
        <section data-testid="settings-account" className={CARD}>
          <p className="px-5 pt-4 text-base font-bold text-v3-navy">บัญชีและโปรไฟล์</p>
          <Link href="/v2/settings/edit-profile" data-testid="settings-profile" className={ROW}>
            แก้ไขข้อมูลส่วนตัว {CHEVRON}
          </Link>
          <Link href="/v2/account" data-testid="settings-membership" className={`${ROW} border-t border-v3-border-card`}>
            สิทธิ์ของฉัน {CHEVRON}
          </Link>
          <Link href="/v2/settings/connected" data-testid="settings-connected" className={`${ROW} border-t border-v3-border-card`}>
            ช่องทางเข้าใช้งาน {CHEVRON}
          </Link>
        </section>

        {/* การตั้งค่าทั่วไป (ภาษา/ขนาดตัวอักษร = ชีต, แจ้งเตือน = หน้าเต็ม) */}
        <section data-testid="settings-general" className={CARD}>
          <p className="px-5 pt-4 text-base font-bold text-v3-navy">การตั้งค่าทั่วไป</p>
          <button onClick={() => setLangOpen(true)} data-testid="settings-language" className={`${ROW} w-full border-t border-v3-border-card`}>
            ภาษา {CHEVRON}
          </button>
          <button onClick={openTextSheet} data-testid="settings-text-size" className={`${ROW} w-full border-t border-v3-border-card`}>
            ขนาดตัวอักษร {CHEVRON}
          </button>
          <Link href="/v2/settings/notifications" data-testid="settings-notifications" className={`${ROW} w-full border-t border-v3-border-card`}>
            การแจ้งเตือน {CHEVRON}
          </Link>
        </section>

        {/* ความเป็นส่วนตัว */}
        <section data-testid="settings-privacy" className={CARD}>
          <p className="px-5 pt-4 text-base font-bold text-v3-navy">ความเป็นส่วนตัว</p>
          <Link href="/v2/privacy/consent" data-testid="settings-consent" className={`${ROW} w-full border-t border-v3-border-card`}>
            ความยินยอม (PDPA) {CHEVRON}
          </Link>
          <Link href="/privacy/policy" data-testid="settings-privacy-policy" className={`${ROW} border-t border-v3-border-card`}>
            นโยบายความเป็นส่วนตัว {CHEVRON}
          </Link>
          <Link href="/v2/settings/delete-account" data-testid="settings-delete-account" className={`${ROW} border-t border-v3-border-card text-v3-pumpkin`}>
            ลบบัญชี {CHEVRON}
          </Link>
        </section>

        {/* ช่วยเหลือ */}
        <section data-testid="settings-help" className={CARD}>
          <Link href="/v2/help/faq" data-testid="settings-faq" className={`${ROW}`}>
            ช่วยเหลือ / คำถามที่พบบ่อย {CHEVRON}
          </Link>
        </section>

        {/* ออกจากระบบ — bottom sheet ยืนยัน 2 ขั้น (เฟรม settings-logout-dialog; testid คงเดิม) */}
        <section data-testid="settings-logout" className={CARD}>
          <button onClick={() => setConfirmLogout(true)} data-testid="settings-logout-ask" className={`${ROW} w-full text-v3-error`}>
            ออกจากระบบ {CHEVRON}
          </button>
        </section>
      </div>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setConfirmLogout(false)}>
          <div
            className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="ออกจากระบบ"
            data-testid="settings-logout-sheet"
          >
            <p className="text-[16px] font-bold text-v3-navy">ออกจากระบบ MuMate ใช่ไหม?</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => { void logout() }}
                data-testid="settings-logout-confirm"
                className="h-12 w-full rounded-full bg-v3-error text-sm font-bold text-white"
              >
                ออกจากระบบ
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                data-testid="settings-logout-cancel"
                className="h-11 w-full rounded-full border border-v3-border-card text-sm font-bold text-v3-navy"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {langOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setLangOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ภาษา" data-testid="settings-language-sheet">
            <p className="text-[16px] font-bold text-v3-navy">ภาษา</p>
            <div className="mt-3 flex flex-col gap-2">
              {LANGUAGES.map((l) => (
                <div
                  key={l.code}
                  data-testid={`settings-language-${l.code}`}
                  className={'flex h-11 items-center justify-between rounded-full border border-v3-border-card px-4 text-sm font-bold ' + (l.available ? 'text-v3-navy' : 'text-v3-text-muted')}
                >
                  <span>{l.label}</span>
                  <span className="text-[11px] text-v3-text-muted">{l.available ? 'ใช้งานอยู่' : 'เร็วๆ นี้'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {textOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setTextOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ขนาดตัวอักษร" data-testid="settings-text-sheet">
            <p className="text-[16px] font-bold text-v3-navy">ขนาดตัวอักษร</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {TEXT_SCALES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => pickScale(s.value)}
                  data-testid={`settings-text-${s.value}`}
                  className={
                    (scale === s.value ? 'bg-v3-cyan text-white' : 'border border-v3-border-card text-v3-navy') +
                    ' grid h-11 place-items-center rounded-full text-[13px] font-bold'
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-v3-text-muted">บันทึกไว้ในเครื่องนี้ — เปลี่ยนอุปกรณ์ต้องตั้งใหม่</p>
          </div>
        </div>
      )}
    </div>
  )
}
