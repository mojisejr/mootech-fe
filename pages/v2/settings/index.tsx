// MuMate v2 — /v2/settings ตั้งค่า (จุดหมายของปุ่ม ⚙ บนหน้าแชท — team รายงาน 2026-09-03:
// "ปุ่ม setting ต้องไปหน้า setting"). รวมทางเข้าของที่ "มีอยู่จริง" ทั้งหมดไว้ที่เดียว;
// ❌ ไม่ใส่รายการที่ยังไม่มีหน้าจริง (กันปุ่มกดแล้วไม่ตอบ — #587)
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useV2Tier } from '@/features/auth/hooks/useV2Tier'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { useState } from 'react'

const CARD = 'flex w-full flex-col gap-1 rounded-[20px] bg-white drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'
const ROW = 'flex items-center justify-between gap-2 px-5 py-4 text-sm font-bold text-v3-navy'
const CHEVRON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
    <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

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

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <AppHeader testId="settings-header" title="ตั้งค่า" backHref="/v2" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {/* บัญชีและโปรไฟล์ */}
        <section data-testid="settings-account" className={CARD}>
          <p className="px-5 pt-4 text-base font-bold text-v3-navy">บัญชีและโปรไฟล์</p>
          <Link href="/v2/register" data-testid="settings-profile" className={ROW}>
            แก้ไขโปรไฟล์และวันเกิด {CHEVRON}
          </Link>
          <Link href="/v2/account" data-testid="settings-membership" className={`${ROW} border-t border-v3-border-card`}>
            สิทธิ์ของฉัน {CHEVRON}
          </Link>
        </section>

        {/* ความเป็นส่วนตัว */}
        <section data-testid="settings-privacy" className={CARD}>
          <p className="px-5 pt-4 text-base font-bold text-v3-navy">ความเป็นส่วนตัว</p>
          <Link href="/privacy/policy" data-testid="settings-privacy-policy" className={`${ROW} border-t border-v3-border-card`}>
            นโยบายความเป็นส่วนตัว (PDPA) {CHEVRON}
          </Link>
          <Link href="/v2/settings/delete-account" data-testid="settings-delete-account" className={`${ROW} border-t border-v3-border-card text-v3-pumpkin`}>
            ลบบัญชี {CHEVRON}
          </Link>
        </section>

        {/* ออกจากระบบ — ยืนยันก่อน (กันกดพลาด) */}
        <section data-testid="settings-logout" className={CARD}>
          {!confirmLogout ? (
            <button onClick={() => setConfirmLogout(true)} data-testid="settings-logout-ask" className={`${ROW} w-full text-v3-error`}>
              ออกจากระบบ {CHEVRON}
            </button>
          ) : (
            <div className="flex flex-col gap-3 p-5">
              <p className="text-sm leading-5 text-v3-text-body">ออกจากระบบ MuMate ใช่ไหม?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { void logout() }}
                  data-testid="settings-logout-confirm"
                  className="h-11 flex-1 rounded-full bg-v3-error text-sm font-bold text-white"
                >
                  ออกจากระบบ
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  data-testid="settings-logout-cancel"
                  className="h-11 flex-1 rounded-full border border-v3-border-card text-sm font-bold text-v3-navy"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
