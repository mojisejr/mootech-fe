// features/v2-profile/components/kit.tsx — design kit ของคลัสเตอร์โปรไฟล์ ตาม Figma หน้า "- profile"
// (ไฟล์ final อ่านจริงผ่านเบราว์เซอร์ 2026-09-04: ทุกเฟรมใช้พื้น BG01 ท้องฟ้าด้านบน + หัวจอตัวน้ำเงิน
// หนาไม่มี badge + การ์ดขาว rounded ใหญ่เงานุ่ม + แถวเมนูมี "ไอคอนไทล์" สีพาสเทลมุมมน)
//
// จอที่ใช้ kit นี้จะ "ไม่" render AppHeader (ป้ายสิทธิ์/กระดิ่ง/avatar ไม่อยู่ในดีไซน์หน้ากลุ่มนี้) —
// ผลคือไฟล์นั้น ๆ หลุดจากลิสต์ SCREENS ของ scripts/header-tier-badge.test.tsx โดยชอบ (walk บังคับ
// ให้ลิสต์ตรงความจริงเสมอ) เหมือนที่ QiScreen เคยทำ
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

/** พื้นท้องฟ้า BG01 ด้านบน + ไล่เฟดลงขาว (สูง ~ครึ่งจอแรกตามเฟรม) */
export function SkyBackdrop({ height = 460 }: { height?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 select-none" style={{ height }}>
      <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
      {/* เฟดลงพื้นขาวแบบเบา ๆ ให้เมฆ BG01 โผล่ให้เห็นตามเฟรม (ไม่ล้างเป็นขาวเร็วเกิน) */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[55%] to-white" />
    </div>
  )
}

/** ปุ่มย้อนกลับ: "กลับหน้าก่อนหน้า" จริง (history.back) ถ้ามีประวัติ — ไม่งั้น fallback ไปหน้าที่กำหนด
 *  (คงเป็น <Link> จึงยังใช้ href fallback ได้ตอนเปิดตรง/SSR/คลิกขวา; คลิกปกติเมื่อมีประวัติ = ย้อนกลับ) */
export function BackButton({
  fallbackHref = '/v2',
  testId,
  className = 'grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5',
}: {
  fallbackHref?: string
  testId?: string
  className?: string
}) {
  return (
    <Link
      href={fallbackHref}
      aria-label="ย้อนกลับ"
      data-testid={testId}
      className={className}
      onClick={(e) => {
        // มีหน้าก่อนหน้าในแท็บนี้ → กลับหน้านั้น (ไม่ใช่กระโดดไป fallback/หน้าแรก)
        if (typeof window !== 'undefined' && window.history.length > 1) {
          e.preventDefault()
          window.history.back()
        }
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

/** สวิตช์เปิด/ปิดสไตล์ iOS (เฟรม toggle-on/off/locked 48×29) — เปิด = cyan */
export function Toggle({ on, onChange, disabled, locked, testId }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; locked?: boolean; testId?: string }) {
  const off = Boolean(disabled || locked)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={off || undefined}
      disabled={off}
      data-testid={testId}
      onClick={() => !off && onChange?.(!on)}
      className={`relative inline-flex h-[29px] w-12 flex-none items-center rounded-full transition-colors ${on ? 'bg-v3-cyan' : 'bg-v3-border-card'} ${off ? 'opacity-60' : ''}`}
    >
      <span className={`absolute top-[3px] size-[23px] rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-[3px]'}`} />
    </button>
  )
}

/** หัวจอย่อยของคลัสเตอร์: ลูกศรย้อน + ชื่อจอตัวน้ำเงินหนา (ไม่มี badge/กระดิ่ง/avatar ตามเฟรม)
 *  (จอเองเป็นเจ้าของ <Head> — ห้ามซ้ำซ้อน) */
export function SkyHeader({
  title,
  backHref = '/v2',
  testId,
}: {
  title: string
  backHref?: string
  testId?: string
}) {
  return (
    <header className="flex w-full items-center gap-2 pt-[max(0.9rem,env(safe-area-inset-top))]">
      <BackButton fallbackHref={backHref} testId={testId ? `${testId}-back` : undefined} />
      <h1 className="text-lg font-black leading-6 text-v3-navy">{title}</h1>
    </header>
  )
}

/** โครงจอของคลัสเตอร์โปรไฟล์: ขาว + ท้องฟ้าบน + คอลัมน์กลาง 393 */
export function SkyScreen({ children, menubar }: { children: ReactNode; menubar?: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36">{children}</div>
      {menubar}
    </div>
  )
}

/** การ์ดขาวมุมมนใหญ่เงานุ่ม (24px ตามเฟรม) */
export const SectionCard = ({ children, className = '', testId, id }: { children: ReactNode; className?: string; testId?: string; id?: string }) => (
  <section id={id} data-testid={testId} className={`v3-shadow-card flex w-full flex-col rounded-[24px] bg-white p-5 ${className}`}>{children}</section>
)

/** ไอคอนไทล์สีพาสเทลมุมมน — ใส่ emoji/รูปข้างใน */
export const IconTile = ({ children, tone = 'ghost', className = '' }: { children: ReactNode; tone?: 'ghost' | 'blue' | 'pink' | 'green' | 'orange' | 'purple' | 'teal' | 'lime' | 'red'; className?: string }) => {
  const bg: Record<string, string> = {
    ghost: 'bg-v3-ghost-white',
    blue: 'bg-[#E3F2FD]',
    pink: 'bg-[#FCE4EC]',
    green: 'bg-[#E8F5E9]',
    orange: 'bg-[#FFF3E0]',
    purple: 'bg-[#F3E5F5]',
    teal: 'bg-[#E0F2F1]',
    lime: 'bg-v3-lime/40',
    red: 'bg-[#FFEBEE]',
  }
  return <span aria-hidden className={`grid size-11 flex-none place-items-center rounded-[14px] text-[20px] ${bg[tone]} ${className}`}>{children}</span>
}

const CHEVRON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
    <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function MenuRow({
  href,
  onClick,
  testId,
  icon,
  tone,
  title,
  sub,
  value,
  danger,
  last,
}: {
  href?: string
  onClick?: () => void
  testId: string
  icon: ReactNode
  tone?: Parameters<typeof IconTile>[0]['tone']
  title: string
  sub?: string
  /** ข้อความค่าปัจจุบันทางขวา (แทน chevron) — เช่น ภาษา: ไทย */
  value?: string
  danger?: boolean
  last?: boolean
}) {
  const inner = (
    <>
      <IconTile tone={danger ? 'red' : tone}>{icon}</IconTile>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-bold leading-5 ${danger ? 'text-v3-pumpkin' : 'text-v3-navy'}`}>{title}</span>
        {sub ? <span className="block text-[11px] leading-4 text-v3-text-muted">{sub}</span> : null}
      </span>
      {value !== undefined ? (
        <span className="flex-none text-[12px] font-bold text-v3-text-muted">{value}</span>
      ) : (
        CHEVRON
      )}
    </>
  )
  const cls = `flex w-full items-center gap-3 py-3 ${last ? '' : 'border-b border-v3-border-card'}`
  if (href) {
    return (
      <Link href={href} data-testid={testId} className={cls}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} data-testid={testId} className={`${cls} text-left`}>
      {inner}
    </button>
  )
}

/** ปุ่ม quick action วงกลมใต้ hero (ภารกิจ/ประวัติ/ชวนเพื่อน/แลกสิทธิ์ ตามเฟรมโปรไฟล์) */
export function QuickAction({ href, icon, label, testId }: { href: string; icon: ReactNode; label: string; testId: string }) {
  return (
    <Link href={href} data-testid={testId} className="flex flex-1 flex-col items-center gap-1">
      <span className="v3-shadow-line grid size-[54px] place-items-center rounded-full bg-white text-[22px]">{icon}</span>
      <span className="text-[11px] font-bold text-v3-navy">{label}</span>
    </Link>
  )
}

/** ปุ่มหลักตามเฟรม Figma: primary = navy เต็มกว้าง · outline · danger · ghost
 *  ใช้เป็น <Link href> หรือ <button onClick> ก็ได้ (ปุ่มหลักในดีไซน์ใหม่เป็น navy ไม่ใช่ cyan) */
export function KitButton({
  children,
  href,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  testId,
  className = '',
}: {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'outline' | 'danger' | 'ghost'
  disabled?: boolean
  testId?: string
  className?: string
}) {
  const styles: Record<string, string> = {
    // ปุ่มหลักเต็มกว้างตาม Figma "Primary Buttons": พื้น sapphire + ตัวอักษร lime uppercase
    primary: 'h-12 bg-v3-sapphire text-v3-lime uppercase',
    outline: 'h-12 border border-v3-border-card bg-white text-v3-navy',
    danger: 'h-12 bg-v3-pumpkin text-white',
    ghost: 'h-11 text-v3-text-muted',
  }
  const cls = `grid w-full place-items-center rounded-full text-[15px] font-bold transition disabled:opacity-40 ${styles[variant]} ${className}`
  if (href && !disabled) {
    return (
      <Link href={href} data-testid={testId} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`${cls} text-center`}>
      {children}
    </button>
  )
}

/** แบนเนอร์สถานะโทนพาสเทลตามเฟรม (quota เขียว · เตือน/ถูกล็อกชมพู · info ฟ้า · error แดง) */
export function NoticeBanner({
  tone = 'green',
  title,
  sub,
  right,
  className = '',
  testId,
}: {
  tone?: 'green' | 'pink' | 'blue' | 'red'
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  className?: string
  testId?: string
}) {
  const tones: Record<string, string> = {
    green: 'bg-[#E8F5E9] text-[#1B7F3B]',
    pink: 'bg-[#FCE4EC] text-v3-pumpkin',
    blue: 'bg-v3-ghost-white text-v3-navy',
    red: 'bg-[#FFEBEE] text-v3-error',
  }
  return (
    <div data-testid={testId} className={`flex w-full items-center gap-3 rounded-[16px] px-4 py-3 ${tones[tone]} ${className}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold leading-5">{title}</p>
        {sub ? <p className="text-[11px] leading-4 opacity-80">{sub}</p> : null}
      </div>
      {right ? <div className="flex-none">{right}</div> : null}
    </div>
  )
}

/** ป้ายจำนวน QI แบบ +/- (เขียวได้รับ · ชมพูหักออก) — ใช้ในประวัติ/ภารกิจ/แนะนำสะสม */
export function AmountPill({ qi, sign = qi >= 0 ? '+' : '-', baht, testId }: { qi: number; sign?: '+' | '-'; baht?: number; testId?: string }) {
  if (baht !== undefined) {
    return <span data-testid={testId} className="rounded-full bg-[#F3EEE3] px-3 py-1 text-[12px] font-black text-[#8A6D2F]">฿{baht.toLocaleString('th-TH')}</span>
  }
  const pos = sign === '+'
  return (
    <span data-testid={testId} className={`rounded-full px-3 py-1 text-[12px] font-black ${pos ? 'bg-[#E8F5E9] text-[#1B7F3B]' : 'bg-[#FCE4EC] text-v3-pumpkin'}`}>
      {sign}{Math.abs(qi).toLocaleString('th-TH')} QI
    </span>
  )
}

/** โครงบอตทอมชีตกลาง: แถบจับด้านบน (grab handle) + ปิดเมื่อแตะพื้นหลัง (ตามเฟรมชีตทั้งหมด — ไม่มีปุ่ม X) */
export function SheetShell({
  label,
  onClose,
  children,
  className = '',
}: {
  label: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-t-[28px] bg-white px-5 pb-10 pt-3 font-ibm ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={label}
        aria-modal="true"
      >
        <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-v3-border-card" />
        {children}
      </div>
    </div>
  )
}

/** กองเหรียญ 3 ลูกซ้อน (ใช้ coin.png — 🪙 เป็นกล่องโหว่บน Windows 10) */
export function CoinStack({ size = 34 }: { size?: number }) {
  return (
    <span aria-hidden className="relative block" style={{ width: size + 14, height: size + 22 }}>
      <Image src="/images/v2/zone2/coin.png" alt="" width={size} height={size} unoptimized className="absolute left-0 top-0 -rotate-12 object-contain" style={{ width: size, height: size }} />
      <Image src="/images/v2/zone2/coin.png" alt="" width={size} height={size} unoptimized className="absolute right-0 top-2 rotate-12 object-contain" style={{ width: size, height: size }} />
      <Image src="/images/v2/zone2/coin.png" alt="" width={size} height={size} unoptimized className="absolute bottom-0 left-1/2 -translate-x-1/2 object-contain" style={{ width: size, height: size }} />
    </span>
  )
}
