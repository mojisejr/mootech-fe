// features/v2-qi/components/QiSpendSheets.tsx — ชีตคู่ของการใช้ QI (ก้อน 1.5):
//   SpendConfirmSheet   — "ยืนยัน ใช้ N QI" ก่อนยิง POST /api/qi-spend (frame `spend-confirm-sheet` 55399:7397)
//   InsufficientQiSheet — QI ไม่พอ: โชว์ขาดอีกเท่าไร + ทางสะสม (frame `insufficient-qi-sheet` 55399:7424)
// ราคา/ชื่อสิทธิ์ทุกตัวมาจาก catalog ของ engine — จอไม่เดาราคาเอง.
// 409 จาก engine = QI ไม่พอ → เปิด InsufficientQiSheet; 5xx = ระบบล้ม (engine refund QI เองแล้ว)
//   → ข้อความต้องบอกว่า "QI ไม่หาย" เพราะ engine auto-refund ให้ก่อนตอบ error.
import Link from "next/link"
import { useState } from "react"

import { AmountPill, IconTile, KitButton, SheetShell } from "@/features/v2-profile/components/kit"
import type { QiSpendLine } from "../qi-model"

const SPARK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-v3-navy">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
)
const CAL = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-v3-navy"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
)
const SHARE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-v3-navy"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
)
const CART = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[#8A6D2F]"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.3a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L22 7H6" /></svg>
)

/** hints จำนวน QI/ราคา สำหรับแถวแนะนำสะสม (มาจาก catalog ของ engine ถ้าพ่อส่งมา — ไม่งั้นซ่อนป้าย) */
type EarnHints = { checkinQi?: number; shareQi?: number; packBaht?: number }

export function SpendConfirmSheet({
  line,
  balance,
  onClose,
  onSpent,
  onInsufficient,
}: {
  line: QiSpendLine
  balance: number
  onClose: () => void
  /** แลกสำเร็จ — ส่งยอด QI ล่าสุดที่ engine ตอบกลับมาให้ parent อัปเดต wallet */
  onSpent: (qiLeft: number) => void
  /** engine ตอบ 409 (QI ไม่พอ) — parent เปลี่ยนไปเปิด InsufficientQiSheet */
  onInsufficient: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const short = Math.max(0, line.qi - balance)
  const after = Math.max(0, balance - line.qi)

  const confirm = async () => {
    setBusy(true)
    setFailed(null)
    try {
      const res = await fetch("/api/qi-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: line.code }),
      })
      const j = (await res.json().catch(() => ({}))) as { qi?: number; error?: string }
      if (res.ok) {
        onSpent(typeof j.qi === "number" ? j.qi : balance - line.qi)
        return
      }
      if (res.status === 409) {
        onInsufficient()
        return
      }
      // 5xx — engine refund QI เองก่อนตอบ error, QI ของผู้ใช้ไม่หาย บอกตรง ๆ กัน panic
      setFailed(res.status >= 500 ? "ระบบขัดข้องชั่วคราว — QI ของคุณไม่หาย ลองอีกครั้งภายหลัง" : String(j.error ?? "ใช้ QI ไม่สำเร็จ"))
    } catch {
      setFailed("เชื่อมต่อไม่สำเร็จ — ลองอีกครั้ง")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell label="ยืนยันการใช้ QI" onClose={onClose}>
      <div className="flex flex-col items-center gap-1 text-center">
        <IconTile tone="blue" className="mb-1 !size-16 !rounded-[20px]">{SPARK}</IconTile>
        <h2 className="text-[18px] font-bold leading-7 text-v3-navy" data-testid="qi-spend-title">{line.title}</h2>
        <p className="max-w-xs text-[13px] leading-5 text-v3-text-body">{line.note}</p>
      </div>

      {/* สรุปการหัก 3 แถว (ยอดปัจจุบัน / ค่าบริการ / ยอดหลังหัก) — ค่าจริงจาก wallet ไม่ใช่ mock */}
      <dl className="mt-4 flex flex-col gap-3 rounded-[16px] bg-[#FBF1F2] px-4 py-4 text-[14px]" data-testid="qi-spend-breakdown">
        <div className="flex items-center justify-between">
          <dt className="text-v3-text-body">ยอดปัจจุบัน</dt>
          <dd className="font-black text-v3-navy">{balance.toLocaleString("th-TH")} QI</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-v3-text-body">ค่าบริการครั้งนี้</dt>
          <dd className="font-black text-[#E08586]" data-testid="qi-spend-price">−{line.qi.toLocaleString("th-TH")} QI</dd>
        </div>
        <div className="flex items-center justify-between border-t border-black/5 pt-3">
          <dt className="text-v3-text-body">ยอดหลังหัก</dt>
          <dd className="font-black text-v3-navy">{after.toLocaleString("th-TH")} QI</dd>
        </div>
      </dl>

      {failed && (
        <p className="mt-3 text-center text-[12px] font-bold text-v3-error" data-testid="qi-spend-failed">{failed}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <KitButton onClick={() => void confirm()} disabled={busy || short > 0} testId="qi-spend-confirm">
          {busy ? "กำลังใช้..." : `ยืนยัน ใช้ ${line.qi.toLocaleString("th-TH")} QI`}
        </KitButton>
        <KitButton variant="outline" onClick={onClose}>ยกเลิก</KitButton>
      </div>

      <p className="mt-3 text-center text-[11px] leading-4 text-v3-text-muted">
        ระบบจะหัก QI เมื่อเริ่มใช้บริการ ถ้าระบบขัดข้องจะคืน QI ให้อัตโนมัติ
      </p>
    </SheetShell>
  )
}

function SuggestRow({ href, tone, icon, title, sub, pill, testId }: {
  href: string
  tone: Parameters<typeof IconTile>[0]["tone"]
  icon: React.ReactNode
  title: string
  sub: string
  pill?: React.ReactNode
  testId?: string
}) {
  return (
    <Link href={href} data-testid={testId} className="flex items-center gap-3 rounded-[16px] border border-v3-border-card bg-white px-3 py-3">
      <IconTile tone={tone}>{icon}</IconTile>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold leading-5 text-v3-navy">{title}</span>
        <span className="block text-[11px] leading-4 text-v3-text-muted">{sub}</span>
      </span>
      {pill ? <span className="flex-none">{pill}</span> : null}
    </Link>
  )
}

export function InsufficientQiSheet({
  line,
  balance,
  onClose,
  hints = {},
}: {
  line: QiSpendLine
  balance: number
  onClose: () => void
  /** จำนวน QI/ราคาแพ็กจาก catalog สำหรับแถวแนะนำ (ถ้าไม่ส่ง = ซ่อนป้ายจำนวน) */
  hints?: EarnHints
}) {
  const short = Math.max(0, line.qi - balance)
  const freeSum = (hints.checkinQi ?? 0) + (hints.shareQi ?? 0)
  return (
    <SheetShell label="QI ไม่พอ" onClose={onClose}>
      <div className="flex flex-col items-center gap-1 text-center">
        <span aria-hidden className="mb-1 grid size-16 place-items-center rounded-full bg-[#FDF3E0] text-[20px] font-black text-[#8A5A0C]">
          {short.toLocaleString("th-TH")}
        </span>
        <h2 className="text-[20px] font-black leading-7 text-v3-navy" data-testid="qi-insufficient-title">ขาดอีก {short.toLocaleString("th-TH")} QI</h2>
        <p className="text-[13px] leading-5 text-v3-text-muted" data-testid="qi-insufficient-short">
          {line.title}ใช้ {line.qi.toLocaleString("th-TH")} QI แต่คุณมีอยู่ {balance.toLocaleString("th-TH")} QI
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <SuggestRow
          href="/v2/qi/checkin"
          tone="blue"
          icon={CAL}
          title="เช็คอินวันนี้"
          sub="ยังไม่ได้เช็คอิน กดรับได้เลย"
          pill={hints.checkinQi ? <AmountPill qi={hints.checkinQi} sign="+" /> : undefined}
          testId="qi-insufficient-checkin"
        />
        <SuggestRow
          href="/v2/qi/missions"
          tone="green"
          icon={SHARE}
          title="แชร์ดวงวันนี้"
          sub="แชร์การ์ดลงโซเชียล วันละ 1 ครั้ง"
          pill={hints.shareQi ? <AmountPill qi={hints.shareQi} sign="+" /> : undefined}
          testId="qi-insufficient-share"
        />
        <SuggestRow
          href="/v2/qi/buy"
          tone="orange"
          icon={CART}
          title="ซื้อแพ็ก 60 QI"
          sub="พร้อมใช้ทันที"
          pill={hints.packBaht ? <AmountPill qi={0} baht={hints.packBaht} /> : undefined}
          testId="qi-insufficient-buy"
        />
      </div>

      {freeSum >= short && short > 0 && (
        <p className="mt-3 text-center text-[12px] font-bold text-[#14707E]">
          ทำภารกิจฟรีสองอย่างข้างบนได้ {freeSum.toLocaleString("th-TH")} QI พอดี
        </p>
      )}

      <div className="mt-4">
        <KitButton variant="outline" onClick={onClose} testId="qi-insufficient-close">ปิด</KitButton>
      </div>
    </SheetShell>
  )
}
