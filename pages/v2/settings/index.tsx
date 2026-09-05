// MuMate v2 — /v2/settings ตั้งค่า (จุดหมายของปุ่ม ⚙ บนหน้าแชท).
// Reskin 2026-09-04 (เฟรม `settings — UX v2` 55399:5049): ลิสต์ iOS เรียบ ไม่มีไอคอน/การ์ดโปรไฟล์ —
// กลุ่ม บัญชี · พลังชี่ · การใช้งาน · ความเป็นส่วนตัว · เกี่ยวกับ · ช่วยเหลือ + ออกจากระบบ/ลบบัญชีถาวร + เวอร์ชัน.
// คง logout 2 ขั้น (scripts/settings-page.test.tsx S2/S3) + testid หลัก (profile/membership/privacy-policy/delete).
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { SkyHeader, SkyScreen } from '@/features/v2-profile/components/kit'

const APP_VERSION = 'Mumate v2.1.0'

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

// แถวลิสต์ iOS เรียบ: ชื่อ (+คำอธิบายย่อย) + ค่าปัจจุบันทางขวา หรือลูกศร ›
function Row({ href, onClick, testId, title, sub, value, danger, last }: {
  href?: string
  onClick?: () => void
  testId?: string
  title: string
  sub?: string
  value?: string
  danger?: boolean
  last?: boolean
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] leading-5 ${danger ? 'font-bold text-v3-error' : 'text-v3-navy'}`}>{title}</span>
        {sub ? <span className="block text-[12px] leading-4 text-v3-text-muted">{sub}</span> : null}
      </span>
      {value !== undefined ? (
        <span className="flex-none text-[13px] text-v3-text-muted">{value}</span>
      ) : (
        <span className="flex-none text-[16px] font-bold text-v3-text-muted">›</span>
      )}
    </>
  )
  const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-left ${last ? '' : 'border-b border-v3-border-card'}`
  return href ? (
    <Link href={href} data-testid={testId} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} data-testid={testId} className={cls}>{inner}</button>
  )
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      {title ? <p className="mb-1.5 px-1 text-[12px] font-medium text-v3-text-muted">{title}</p> : null}
      <div className="overflow-hidden rounded-[18px] border border-v3-border-card bg-white">{children}</div>
    </div>
  )
}

export default function V2SettingsPage() {
  const { logout } = useV2Logout()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [scale, setScale] = useState<number>(1)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [qi, setQi] = useState<number | null>(null)

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(TEXT_SCALE_KEY) ?? '1')
    if (Number.isFinite(saved) && saved > 0) setScale(saved)
    let alive = true
    fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive) setProfile(j?.profile ?? null) }).catch(() => {})
    fetch('/api/qi-wallet').then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && typeof j?.qi === 'number') setQi(j.qi) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const pickScale = (value: number) => {
    setScale(value)
    applyTextScale(value)
    window.localStorage.setItem(TEXT_SCALE_KEY, String(value))
  }

  const scaleLabel = TEXT_SCALES.find((s) => s.value === scale)?.label ?? 'ปกติ'
  const lineValue = profile?.displayName ? `@${profile.displayName}` : 'LINE'

  return (
    <SkyScreen>
      <Head><title>ตั้งค่า · MuMate</title></Head>
      <SkyHeader title="ตั้งค่า" testId="settings" />

      {/* บัญชี */}
      <Group title="บัญชี">
        <Row href="/v2/settings/connected" testId="settings-connected" title="เข้าสู่ระบบด้วย LINE" value={lineValue} />
        <Row href="/v2/settings/edit-profile" testId="settings-profile" title="แก้ไขข้อมูลส่วนตัว" />
        <Row href="/v2/settings/edit-birth" testId="settings-birth" title="ข้อมูลวันเกิดและธาตุ" sub="แก้แล้วคำทำนายทั้งแอปจะเปลี่ยน" />
        <Row href="/v2/account" testId="settings-membership" title="แพ็กเกจของฉัน" value="Free Tier" last />
      </Group>

      {/* พลังชี่ */}
      <Group title="พลังชี่">
        <Row href="/v2/qi/history" testId="settings-qi" title="ยอด QI และประวัติ" value={qi !== null ? `${qi.toLocaleString('th-TH')} QI` : undefined} />
        <Row href="/v2/qi/buy" testId="settings-qi-buy" title="ซื้อ QI เพิ่ม" last />
      </Group>

      {/* การใช้งาน */}
      <Group title="การใช้งาน">
        <Row href="/v2/settings/notifications" testId="settings-notifications" title="การแจ้งเตือน" />
        <Row href="/v2/orders" testId="settings-orders" title="ประวัติการสั่งซื้อ" />
        <Row onClick={() => setLangOpen(true)} testId="settings-language" title="ภาษา" value="ไทย" />
        <Row onClick={() => setTextOpen(true)} testId="settings-text-size" title="ขนาดตัวอักษร" value={scaleLabel} last />
      </Group>

      {/* ความเป็นส่วนตัว */}
      <Group title="ความเป็นส่วนตัว">
        <Row href="/v2/privacy/consent" testId="settings-consent" title="จัดการความยินยอม" sub="เลือกได้ว่าให้ใช้ข้อมูลอะไรบ้าง" />
        <Row href="/v2/privacy/data-export" testId="settings-data-export" title="ดาวน์โหลดข้อมูลของฉัน" sub="ส่งไฟล์ไปที่อีเมลภายใน 30 วัน" last />
      </Group>
      <p className="px-2 pt-1.5 text-[11px] leading-4 text-v3-text-muted">วันเกิดและเวลาเกิดเป็นข้อมูลส่วนบุคคล คุณถอนความยินยอมได้ทุกเมื่อ</p>

      {/* ช่วยเหลือ (เฟรมวางก่อน เกี่ยวกับ) */}
      <Group title="ช่วยเหลือ">
        <Row href="/v2/help/faq" testId="settings-help" title="ช่วยเหลือ / ติดต่อเรา" value="Line @mumate.co" />
        <Row href="/v2/help/faq" testId="settings-faq" title="คำถามที่พบบ่อย" last />
      </Group>

      {/* เกี่ยวกับ */}
      <Group title="เกี่ยวกับ">
        <Row href="/privacy/policy" testId="settings-privacy-policy" title="นโยบายความเป็นส่วนตัว (PDPA)" />
        <Row href="/terms" testId="settings-terms" title="ข้อกำหนดการใช้งาน" />
        <Row href="/v2/help/about" testId="settings-about" title="ข้อมูลบริษัท" last />
      </Group>

      {/* ออกจากระบบ + ลบบัญชีถาวร + เวอร์ชัน (เฟรม danger zone) */}
      <div className="mt-5 flex flex-col items-center gap-3">
        <button
          onClick={() => setConfirmLogout(true)}
          data-testid="settings-logout-ask"
          className="h-11 w-full rounded-full border border-v3-border-card bg-white text-sm font-bold text-v3-text-body"
        >
          ออกจากระบบ
        </button>
        <Link href="/v2/settings/delete-account" data-testid="settings-delete-account" className="text-[13px] font-medium text-v3-error underline">
          ลบบัญชีถาวร
        </Link>
        <p className="text-[11px] text-v3-text-muted">{APP_VERSION}</p>
      </div>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6" onClick={() => setConfirmLogout(false)}>
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ออกจากระบบ" data-testid="settings-logout-sheet">
            <p className="text-[18px] font-bold text-v3-navy">ออกจากระบบ?</p>
            <p className="mt-2 text-[13px] leading-5 text-v3-text-body">
              ยอด{qi !== null ? ` ${qi.toLocaleString('th-TH')} ` : ' '}QI สถิติเช็คอิน และข้อมูลของคุณยังอยู่ครบ เข้าสู่ระบบใหม่เมื่อไรก็ได้
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmLogout(false)} data-testid="settings-logout-cancel" className="h-12 flex-1 rounded-full border border-v3-border-card text-sm font-bold text-v3-navy">ยกเลิก</button>
              <button onClick={() => { void logout() }} data-testid="settings-logout-confirm" className="h-12 flex-1 rounded-full bg-v3-error text-sm font-bold text-white">ออกจากระบบ</button>
            </div>
          </div>
        </div>
      )}

      {langOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setLangOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ภาษา" data-testid="settings-language-sheet">
            <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-v3-border-card" />
            <p className="text-[16px] font-bold text-v3-navy">ภาษา</p>
            <div className="mt-3 overflow-hidden rounded-[18px] border border-v3-border-card">
              {LANGUAGES.map((l, i) => (
                <div key={l.code} data-testid={`settings-language-${l.code}`} className={`flex h-[52px] items-center justify-between px-4 ${i === LANGUAGES.length - 1 ? '' : 'border-b border-v3-border-card'} ${l.available ? 'bg-[#ECF0FD]' : 'bg-white'}`}>
                  <span className={`text-[15px] ${l.available ? 'font-bold text-v3-navy' : 'text-v3-text-muted'}`}>{l.label}</span>
                  {l.available ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1455A4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                  ) : (
                    <span className="text-[11px] text-v3-text-muted">เร็วๆ นี้</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-v3-text-muted">เปลี่ยนแล้วมีผลทันที — ตอนนี้รองรับภาษาไทย ภาษาอื่นกำลังจะมา</p>
          </div>
        </div>
      )}

      {textOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setTextOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ขนาดตัวอักษร" data-testid="settings-text-sheet">
            <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-v3-border-card" />
            <p className="text-[16px] font-bold text-v3-navy">ขนาดตัวอักษร</p>
            {/* การ์ดตัวอย่าง — เรนเดอร์ตามสเกลที่เลือกสด ๆ */}
            <div className="mt-3 rounded-[16px] bg-[#F7F9FC] p-4">
              <p className="text-[11px] text-v3-text-muted">ตัวอย่าง</p>
              <p className="mt-1 font-bold text-v3-navy" style={{ fontSize: 15 * scale, lineHeight: 1.5 }}>วันนี้ดวงดีมาก เหมาะกับการเริ่มต้นสิ่งใหม่</p>
            </div>
            <div className="mt-3 overflow-hidden rounded-[18px] border border-v3-border-card">
              {TEXT_SCALES.map((s, i) => (
                <button key={s.value} onClick={() => pickScale(s.value)} data-testid={`settings-text-${s.value}`} className={`flex w-full items-center justify-between px-4 py-3 text-left ${i === TEXT_SCALES.length - 1 ? '' : 'border-b border-v3-border-card'} ${scale === s.value ? 'bg-[#ECF0FD]' : 'bg-white'}`}>
                  <span className={`font-bold ${scale === s.value ? 'text-v3-navy' : 'text-v3-navy'}`} style={{ fontSize: 15 * s.value }}>{s.label}</span>
                  {scale === s.value ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1455A4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                  ) : null}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-v3-text-muted">บันทึกไว้ในเครื่องนี้ — เปลี่ยนอุปกรณ์ต้องตั้งใหม่</p>
          </div>
        </div>
      )}
    </SkyScreen>
  )
}
