// VipGate — template กลางของ "ล็อกฟีเจอร์ที่ยังไม่จ่าย 🔒" (มีตติ้งทีม 2026-09-02, team.mp4).
//
// ทีมขอ lock แบบ IG premium: คนจ่ายเห็นเนื้อหา คนยังไม่จ่ายเห็นกรอบสิทธิพิเศษที่มีมงกุฎ
// และกดแล้วพาไปหน้าจ่าย (SHOP_HREF) — งานนี้คือ component เดียวที่ทุกจุดห้ามประกอบเอง
// (จุดที่จะใช้จริงตามมีตติ้ง: ปฏิทินขั้นสูง / ดวงสมพงศ์ advanced — wire ทีละจุด อย่า double-gate
// กับ tier logic ที่ปฏิทินมีอยู่แล้ว)
//
// สถานะ 3 แบบ ตามวินัย honesty ของ repo (ครั้งเดียวกับ #246/#365 — การเดาสิทธิ์คือบั๊ก):
//   undetermined → skeleton เท่านั้น ห้ามตัดสินว่า "ไม่จ่าย" ขณะยังโหลด
//   paid         → เนื้อหาจริง
//   free         → กรอบมงกุฎ + 🔒 + ปุ่มพาไป SHOP_HREF
//
// มงกุฎ = vip-crown.png (Drive icon/premium.png ของ designer — ของจริงจาก Figma icon set)
import Image from 'next/image'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'

export function VipGate({
  label,
  description,
  testId = 'vip-gate',
  variant = 'card',
  children,
}: {
  /**
   * 'card'    = กรอบมงกุฎเต็ม (default — จุดที่ทีมสั่งใช้ template นี้ตรง ๆ)
   * 'section' = ตามเฟรม Figma 720:29221 (ผลสมพงศ์ของฟรี): การ์ดขาว r20 px16 py24 มีแค่ header
   *             "ตารางดวงจีน" 18 bold + ไอคอนล็อก 20 + chevron — แตะแล้วกางเป็นกรอบมงกุฎ/ปุ่มปลดล็อกอันเดิม
   */
  variant?: 'card' | 'section'

  /** ชื่อสิทธิพิเศษที่โชว์บนกรอบล็อก เช่น "ปฏิทินดวงขั้นสูง" */
  label: string
  /** บรรทัดอธิบายสั้น ๆ ใต้ชื่อ (ไม่ใส่ก็ได้) */
  description?: string
  testId?: string
  children: ReactNode
}) {
  const { user, done, errored } = useV2User()
  const [open, setOpen] = useState(false)
  const membership = user?.membership ?? null
  // undefined ≠ สถานะที่สี่ — ไม่รู้ = ไม่รู้ (AccountScreen อธิบายเคสนี้ไว้แล้ว)
  const isPaid = membership?.isPaid ?? null

  if (isPaid === true) {
    return (
      <div data-testid={`${testId}-content`}>
        {children}
      </div>
    )
  }

  if (isPaid === null) {
    // ยังไม่รู้สิทธิ์ (ยังโหลด / /api/user ล่ม) — โชว์กรอบเปล่า ห้ามโชว์ปุ่มขายให้คนจ่าย
    return (
      <section data-testid={`${testId}-undetermined`} className="flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
        <div aria-hidden className="h-6 w-2/3 animate-pulse rounded bg-v3-border-card" />
        <div aria-hidden className="h-12 w-full animate-pulse rounded-full bg-v3-border-card" />
      </section>
    )
  }

  // free (และเคส errored = จบแล้วด้วย isPaid null → เข้า undetermined ข้างบนอยู่แล้ว;
  // บรรทัดนี้จึงคือ "done แล้วรู้แน่ว่ายังไม่จ่าย")
  void done
  void errored
  const lockedBody = (
    <>
      <span data-testid={`${testId}-crown`} className="relative block h-12 w-12">
        <Image src="/images/v2/destiny/vip-crown.png" alt="" fill sizes="48px" style={{ objectFit: 'contain' }} />
      </span>
      <p className="flex items-center gap-1 text-base font-bold text-v3-navy">
        {label} <span aria-hidden>🔒</span>
      </p>
      {description && <p className="text-[12px] leading-4 text-v3-text-body">{description}</p>}
      <Link
        href={SHOP_HREF}
        data-testid={`${testId}-cta`}
        className="mt-1 grid h-11 w-full max-w-[260px] place-items-center rounded-full bg-v3-pumpkin text-sm font-bold text-white"
      >
        ปลดล็อกด้วย VIP
      </Link>
    </>
  )
  if (variant === 'section') {
    return (
      <section data-testid={`${testId}-locked`} data-variant="section" className="flex w-full flex-col rounded-[20px] bg-white px-4 py-6 shadow-[0_4px_30px_rgba(26,38,77,0.12)]">
        <button type="button" data-testid={`${testId}-header`} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
          <span className="flex-1 text-[18px] font-bold leading-6 text-v3-navy">{label}</span>
          {/* ไอคอนล็อก = asset จากเฟรม (flat-color-icons:lock 20px) */}
          <Image src="/images/v2/compat/lock.svg" alt="" width={20} height={20} className="size-5" />
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden className={`text-v3-navy transition-transform ${open ? 'rotate-180' : ''}`}><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open ? <div className="mt-4 flex flex-col items-center gap-2 text-center">{lockedBody}</div> : null}
      </section>
    )
  }
  return (
    <section
      data-testid={`${testId}-locked`}
      className="relative flex w-full flex-col items-center gap-2 overflow-hidden rounded-[20px] bg-gradient-to-b from-[#FFF7E6] to-white p-5 text-center drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"
    >
      {lockedBody}
    </section>
  )
}
