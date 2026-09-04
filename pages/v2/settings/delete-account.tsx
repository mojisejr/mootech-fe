// pages/v2/settings/delete-account.tsx — โฟลว์ลบบัญชีครบ 4 ขั้น (ก้อน 2):
//   ① delete-01 what-you-lose (สิ่งที่จะหาย) · ② delete-02 alternatives (ทางเลือกก่อนลบ)
//   ③ ยืนยัน → POST /api/v2/account/delete → engine พักบัญชี 30 วัน
//   ④ delete-04 pending-recovery (วันหมดอายุ + ยกเลิกได้ทันที) + delete-05b feedback sheet (skip ได้)
// ขาหลังจริง = engine /api/account/delete (bazi-pdf-dev 0042) — คำขอซ้ำ 409, ยกเลิกทันที, cron purge ครบกำหนด
//
// 🔴 สัญญาเดิมที่ยังคงอยู่ (scripts/delete-account-screen.test.tsx): ปุ่มกันตัวเอง (D1) ·
// 501 → "ยังไม่เปิดใช้" ตรงไปตรงมา (D2) · copy ครบสิ่งที่หาย+30 วัน+ยกเลิกได้ (D3)
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { Menubar } from '@/features/v2-shell/components/Menubar'

const CARD = 'flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

const LOST = [
  'ข้อมูลวันเกิดและผลดวงที่คำนวณไว้ทั้งหมด',
  'สิทธิ์สมาชิก VIP / Plus / Pro ที่เหลืออยู่',
  'ชี่ โค้ดแนะนำ และประวัติการใช้งานทั้งหมด',
  'เพื่อนร่วมงานและข้อมูลเทียบดวงที่ผูกไว้',
  'การแจ้งเตือนดวงรายวันบนอุปกรณ์นี้',
]

// delete-02-alternatives — ทางเลือกก่อนลบ (ลิงก์ไปหน้าจริงเท่านั้น ❌ ปุ่มตาย — #587)

function thaiDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DeleteAccountPage() {
  const [checked, setChecked] = useState(false)
  const [sending, setSending] = useState(false)
  // #384 — ทุกหน้าที่ใช้ AppHeader ต้องส่ง membership ตรง ๆ; หน้าลบบัญชีไม่ใช่พื้นที่ขาย (cta false)
  // สถานะ: idle → sending → pending (สำเร็จ) | notImplemented (501) | errored
  const [verdict, setVerdict] = useState<'idle' | 'sending' | 'pending' | 'notImplemented' | 'errored'>('idle')
  const [pendingInfo, setPendingInfo] = useState<{ requestedAt?: string; purgeAt?: string } | null>(null)
  const [cancelMsg, setCancelMsg] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/v2/account/delete')
      if (!r.ok) return
      const j = (await r.json()) as { deletion?: { status: string; requestedAt: string; purgeAt: string } | null }
      if (j.deletion) {
        setPendingInfo(j.deletion)
        setVerdict('pending')
      }
    } catch {
      // สถานะอ่านไม่ได้ = ยังไปกันได้ตามปกติ (ไม่บล็อกหน้า)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const submit = async () => {
    setSending(true)
    setVerdict('sending')
    setCancelMsg(null)
    try {
      const r = await fetch('/api/v2/account/delete', { method: 'POST' })
      if (r.status === 501) setVerdict('notImplemented')
      else if (r.ok) {
        const j = (await r.json().catch(() => ({}))) as { requestedAt?: string; purgeAt?: string }
        setPendingInfo(j)
        setVerdict('pending')
        setFeedbackOpen(true) // delete-05b — ชีต feedback ปรากฏหลังยืนยัน (ปิด/skip ได้)
      } else if (r.status === 409) {
        await loadStatus() // มีคำขอรออยู่แล้ว — ไปโชว์สถานะ pending เดิม
      } else setVerdict('errored')
    } catch {
      setVerdict('errored')
    } finally {
      setSending(false)
    }
  }

  const cancelDeletion = async () => {
    try {
      const r = await fetch('/api/v2/account/delete', { method: 'DELETE' })
      if (r.ok) {
        setVerdict('idle')
        setPendingInfo(null)
        setCancelMsg('ยกเลิกการลบแล้ว — บัญชีกลับมาใช้ได้ตามปกติ')
      } else {
        setCancelMsg('ยกเลิกไม่สำเร็จ ลองอีกครั้ง')
      }
    } catch {
      setCancelMsg('ยกเลิกไม่สำเร็จ ลองอีกครั้ง')
    }
  }

  const sendFeedback = async () => {
    const res = await fetch('/api/v2/account/delete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: feedback.trim() }),
    })
    setFeedbackMsg(res.ok ? 'ขอบคุณสำหรับคำติชม' : 'ส่งไม่สำเร็จ — ไม่เป็นไรครับ')
    setFeedbackOpen(false)
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ลบบัญชี · MuMate</title></Head>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <SkyHeader title="ลบบัญชี" backHref="/v2/account" testId="delete" />

        {/* สถานะ pending (เฟรม delete-04 pending-recovery) — เข้าหน้าซ้ำเห็นสถานะ + ยกเลิกได้ */}
        {verdict === 'pending' && pendingInfo ? (
          <section data-testid="delete-pending" className={CARD}>
            <p className="text-base font-bold text-v3-pumpkin">บัญชีของคุณอยู่ระหว่างพักลบ</p>
            <p className="text-[13px] leading-5 text-v3-text-body">
              ขอลบเมื่อ {pendingInfo.requestedAt ? thaiDate(pendingInfo.requestedAt) : '—'} — จะลบถาวรเมื่อ{' '}
              <b data-testid="delete-purge-date">{pendingInfo.purgeAt ? thaiDate(pendingInfo.purgeAt) : '—'}</b>
            </p>
            <p className="text-[13px] leading-5 text-v3-text-body">
              เปลี่ยนใจได้ตลอดใน 30 วันนี้ — กดยกเลิกด้านล่างได้ทันที
            </p>
            <button
              onClick={() => void cancelDeletion()}
              data-testid="delete-cancel"
              className="grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white"
            >
              ยกเลิกการลบบัญชี
            </button>
            {cancelMsg && <p data-testid="delete-cancel-msg" className="text-[12px] font-bold text-v3-sapphire">{cancelMsg}</p>}
          </section>
        ) : (
          <>
            {/* ① สิ่งที่จะหาย (เฟรม delete-01) */}
            <section data-testid="delete-lost" className={CARD}>
              <p className="text-base font-bold text-v3-navy">ก่อนลบบัญชี ต้องรู้ว่าอะไรจะหาย</p>
              <ul className="list-disc space-y-1 pl-5 text-[13px] leading-[20px] text-v3-text-body">
                {LOST.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            </section>

            <section data-testid="delete-grace" className={CARD}>
              <p className="text-base font-bold text-v3-navy">พักบัญชี 30 วัน ก่อนลบจริง</p>
              <p className="text-[13px] leading-[20px] text-v3-text-body">
                หลังยืนยัน บัญชีจะถูกระงับไว้ 30 วัน ระหว่างนี้ถ้าคุณเข้าสู่ระบบอีกครั้ง
                จะถือว่า<b>ยกเลิกการลบ</b> และใช้งานต่อได้ทุกอย่างเหมือนเดิม เกิน 30 วัน
                ข้อมูลทั้งหมดจะถูกลบถาวรและเรียกคืนไม่ได้
              </p>
            </section>

            {/* ② ทางเลือกก่อนลบ (เฟรม delete-02-alternatives) */}
            <section data-testid="delete-alternatives" className={CARD}>
              <p className="text-base font-bold text-v3-navy">หรือลองทางเลือกเหล่านี้ก่อน</p>
              <Link href="/v2/settings/notifications" data-testid="delete-alt-notifications" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
                <span>
                  <span className="block py-3 text-sm font-bold text-v3-navy">ปิด/ปรับการแจ้งเตือน</span>
                  <span className="block pb-3 text-[12px] leading-4 text-v3-text-body -mt-3">รำคาญแจ้งเตือน? ปิดเฉพาะหมวดได้</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/v2/help/faq" data-testid="delete-alt-faq" className="flex items-center justify-between gap-2">
                <span>
                  <span className="block py-3 text-sm font-bold text-v3-navy">มีปัญหาที่ทีมช่วยได้</span>
                  <span className="block pb-3 text-[12px] leading-4 text-v3-text-body -mt-3">ดูคำถามที่พบบ่อยหรือขอความช่วยเหลือ</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </section>

            {/* ③ ยืนยัน (คง testid เดิม — สัญญา D1) */}
            <label className="flex w-full items-start gap-3 rounded-[20px] bg-white p-4 text-[13px] leading-5 text-v3-navy drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
              <input
                type="checkbox"
                data-testid="delete-confirm-check"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-[2px] size-5 accent-v3-pumpkin"
              />
              <span>ฉันเข้าใจแล้วว่าข้อมูลจะหายถาวรเมื่อครบ 30 วัน และยืนยันขอลบบัญชีนี้</span>
            </label>

            <button
              onClick={submit}
              disabled={!checked || sending}
              data-testid="delete-submit"
              className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-pumpkin text-base font-bold text-white disabled:opacity-40"
            >
              {sending ? 'กำลังส่งคำขอ…' : 'ยืนยันลบบัญชี'}
            </button>

            {verdict === 'notImplemented' && (
              <p data-testid="delete-not-implemented" className="mt-3 rounded-[14px] bg-white p-4 text-[13px] leading-5 text-v3-text-body drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
                ระบบลบบัญชียังไม่เปิดใช้งาน คำขอของคุณยังไม่ถูกดำเนินการใด ๆ
                กรุณาลองใหม่ภายหลัง หรือติดต่อทีมงาน
              </p>
            )}
            {verdict === 'errored' && (
              <p data-testid="delete-errored" className="mt-3 rounded-[14px] bg-white p-4 text-[13px] leading-5 text-v3-text-body drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
                ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง
              </p>
            )}
          </>
        )}

        <Link href="/v2/account" data-testid="delete-back-account" className="mt-4 text-center text-sm font-bold text-v3-cyan">
          ย้อนกลับไปหน้าสิทธิ์ของฉัน
        </Link>
      </div>

      {/* ④ feedback sheet (เฟรม delete-05b-feedback-optional) — ปิด/ข้ามได้เสมอ */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setFeedbackOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="บอกเหตุผลที่จะลบ (ไม่บังคับ)">
            <h2 data-testid="delete-feedback-title" className="text-[18px] font-bold text-v3-navy">ก่อนไป — บอกเราได้ไหมว่าทำไมถึงลบ?</h2>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">คำติชมของคุณช่วยให้เราทำงานดีขึ้น (ไม่บังคับ — ข้ามได้)</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="เช่น ใช้ไม่บ่อย ฟีเจอร์ยังไม่ตอบโจทย์ ฯลฯ"
              data-testid="delete-feedback-input"
              className="mt-3 w-full rounded-[16px] border border-v3-border-input bg-white p-4 text-[14px] outline-none placeholder:text-v3-placeholder"
            />
            <button
              onClick={() => void sendFeedback()}
              disabled={!feedback.trim()}
              data-testid="delete-feedback-send"
              className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-pumpkin text-base font-bold text-white disabled:opacity-40"
            >
              ส่งคำติชม
            </button>
            <button
              onClick={() => setFeedbackOpen(false)}
              data-testid="delete-feedback-skip"
              className="mt-2 grid h-11 w-full place-items-center rounded-full text-sm font-bold text-v3-text-muted"
            >
              ข้าม
            </button>
          </div>
        </div>
      )}

      <Menubar />
    </div>
  )
}
