// MuMate v2 — /v2/settings ตั้งค่า (จุดหมายของปุ่ม ⚙ บนหน้าแชท).
// Reskin 2026-09-04 ตามเฟรม `settings — UX v2`: การ์ดสรุปโปรไฟล์บนสุด (avatar+ชื่อ+@name) + แถวไอคอนไทล์
// + แถวภาษา/ขนาดตัวอักษรโชว์ "ค่าปัจจุบัน" ทางขวา + logout เป็น bottom sheet (เฟรม settings-logout-dialog)
// คง 2 ขั้นยืนยันเดิม — scripts/settings-page.test.tsx คุมไว้ (S1-S3)
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { MenuRow, SectionCard, SkyHeader, SkyScreen } from '@/features/v2-profile/components/kit'

// ขนาดตัวอักษร (settings-text-size-sheet) — บันทึกเครื่องนี้ + apply ผ่าน zoom ของ <html>
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

// ชีตภาษา — ไทยพร้อมใช้ ภาษาอื่นรอทีมแปล (บอกตรง ๆ ❌ ปุ่มตาย)
const LANGUAGES = [
  { code: 'th', label: 'ไทย', available: true },
  { code: 'en', label: 'English', available: false },
  { code: 'zh', label: '中文', available: false },
]

type Profile = { firstName?: string | null; displayName?: string | null }

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2SettingsPage() {
  const { logout } = useV2Logout()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [scale, setScale] = useState<number>(1)
  const [profile, setProfile] = useState<Profile | null>(null)

  // ค่าปัจจุบันของขนาดตัวอักษร + โปรไฟล์ย่อ (ชื่อ/@name) สำหรับการ์ดบนสุดและ label ทางขวา
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(TEXT_SCALE_KEY) ?? '1')
    if (Number.isFinite(saved) && saved > 0) setScale(saved)
    let alive = true
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) setProfile(j?.profile ?? null) })
      .catch(() => { if (alive) setProfile(null) })
    return () => { alive = false }
  }, [])

  const openTextSheet = () => setTextOpen(true)

  const pickScale = (value: number) => {
    setScale(value)
    applyTextScale(value)
    window.localStorage.setItem(TEXT_SCALE_KEY, String(value))
  }

  const scaleLabel = TEXT_SCALES.find((s) => s.value === scale)?.label ?? 'ปกติ'
  const shownName = profile?.firstName?.trim() || 'คุณผู้ใช้'

  return (
    <SkyScreen>
      <Head><title>ตั้งค่า · MuMate</title></Head>
      <SkyHeader title="ตั้งค่า" testId="settings" />

      {/* การ์ดสรุปโปรไฟล์ (เฟรม settings — UX v2 บนสุด) */}
      <SectionCard className="mt-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-14 flex-none place-items-center rounded-full bg-v3-sapphire text-[22px] font-black text-white">
            {shownName.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold leading-5 text-v3-navy" data-testid="settings-user-name">{shownName}</p>
            {profile?.displayName ? (
              <p className="truncate text-[12px] leading-4 text-v3-text-muted" data-testid="settings-user-handle">@{profile.displayName}</p>
            ) : null}
          </div>
          <Link
            href="/v2/settings/edit-profile"
            data-testid="settings-profile"
            className="grid h-9 flex-none place-items-center rounded-full border-[1.5px] border-v3-sapphire px-4 text-[12px] font-bold text-v3-sapphire"
          >
            แก้ไขโปรไฟล์
          </Link>
        </div>
      </SectionCard>

      {/* บัญชี */}
      <SectionCard className="mt-4 !p-2">
        <p className="px-3 pb-1 pt-3 text-[12px] font-bold text-v3-text-muted">บัญชี</p>
        <MenuRow href="/v2/account" testId="settings-membership" icon="💎" tone="purple" title="สิทธิ์ของฉัน" sub="แผน · ชี่ · คำสั่งซื้อ" />
        <MenuRow href="/v2/settings/edit-birth" testId="settings-birth" icon="🎂" tone="pink" title="แก้ไขวันเกิด" sub="ฟรีครั้งแรก — ครั้งถัดไปใช้ชี่" />
        <MenuRow href="/v2/settings/connected" testId="settings-connected" icon="🔗" tone="green" title="ช่องทางเชื่อมต่อ" sub="LINE · Google" last />
      </SectionCard>

      {/* การตั้งค่าทั่วไป — โชว์ค่าปัจจุบันทางขวาตามเฟรม */}
      <SectionCard className="mt-4 !p-2">
        <p className="px-3 pb-1 pt-3 text-[12px] font-bold text-v3-text-muted">การตั้งค่าทั่วไป</p>
        <MenuRow href="/v2/settings/notifications" testId="settings-notifications" icon="🔔" tone="orange" title="การแจ้งเตือน" sub="ดวงรายวัน · การเตือน · ข่าวสาร" />
        <MenuRow onClick={() => setLangOpen(true)} testId="settings-language" icon="🌐" tone="blue" title="ภาษา" value="ไทย" />
        <MenuRow onClick={openTextSheet} testId="settings-text-size" icon="🔤" tone="teal" title="ขนาดตัวอักษร" value={scaleLabel} last />
      </SectionCard>

      {/* ความเป็นส่วนตัว */}
      <SectionCard className="mt-4 !p-2">
        <p className="px-3 pb-1 pt-3 text-[12px] font-bold text-v3-text-muted">ความเป็นส่วนตัว</p>
        <MenuRow href="/v2/privacy/consent" testId="settings-consent" icon="🛡️" tone="purple" title="ความยินยอม (PDPA)" sub="ให้/ถอนความยินยอม · ส่งออกข้อมูล" />
        <MenuRow href="/privacy/policy" testId="settings-privacy-policy" icon="📜" tone="ghost" title="นโยบายความเป็นส่วนตัว" />
        <MenuRow href="/v2/settings/delete-account" testId="settings-delete-account" icon="🗑️" tone="red" title="ลบบัญชี" sub="พักบัญชี 30 วัน ก่อนลบถาวร" danger last />
      </SectionCard>

      {/* ช่วยเหลือ */}
      <SectionCard className="mt-4 !p-2">
        <MenuRow href="/v2/help/faq" testId="settings-faq" icon="❓" tone="blue" title="ช่วยเหลือ / คำถามที่พบบ่อย" last />
      </SectionCard>

      {/* ออกจากระบบ — bottom sheet ยืนยัน 2 ขั้น (คง testid เดิม) */}
      <SectionCard className="mt-4 !p-2" testId="settings-logout">
        <button onClick={() => setConfirmLogout(true)} data-testid="settings-logout-ask" className="flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-v3-error">
          ออกจากระบบ
        </button>
      </SectionCard>

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
    </SkyScreen>
  )
}
