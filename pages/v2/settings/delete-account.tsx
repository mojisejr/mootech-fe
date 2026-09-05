// pages/v2/settings/delete-account.tsx — โฟลว์ลบบัญชีครบตามเฟรม Figma (delete-01..05b):
//   ① delete-01 what-you-lose (สิ่งที่จะหาย + มูลค่าจริง + คำเตือนคืนเงิน)
//   ② delete-02 alternatives (ทางเลือกก่อนลบ — รวม "ดาวน์โหลดข้อมูลก่อนลบ" + จัดการความยินยอม)
//   ③ ยืนยัน → POST /api/v2/account/delete → engine พักบัญชี 30 วัน
//   ④ delete-04 pending-recovery (วงกลมนับถอยหลัง + สิ่งที่จะได้กลับคืน + ยกเลิกได้ทันที)
//   ⑤ delete-05b feedback (checklist เหตุผล + textarea, ข้ามได้)
// ขาหลังจริง = engine /api/account/delete — คำขอซ้ำ 409, ยกเลิกทันที, cron purge ครบกำหนด
//
// 🔴 สัญญาเดิม (scripts/delete-account-screen.test.tsx): ปุ่มกันตัวเอง (D1) · 501 → "ยังไม่เปิดใช้" (D2) ·
// copy ครบ "อะไรจะหาย"+"พักบัญชี 30 วัน"+"ยกเลิกการลบ"+"ข้อมูลวันเกิดและผลดวง" (D3)
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'
import { Menubar } from '@/features/v2-shell/components/Menubar'

const CARD = 'flex w-full flex-col gap-3 rounded-[24px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

const LOST = [
  'ข้อมูลวันเกิดและผลดวงที่คำนวณไว้ทั้งหมด',
  'สิทธิ์สมาชิก VIP / Plus / Pro ที่เหลืออยู่',
  'QI โค้ดแนะนำ และประวัติการใช้งานทั้งหมด',
  'เพื่อนร่วมงานและข้อมูลเทียบดวงที่ผูกไว้',
  'การแจ้งเตือนดวงรายวันบนอุปกรณ์นี้',
]

// delete-05b — เหตุผลที่จะลบ (checklist, ไม่บังคับ)
const REASONS = [
  'คำทำนายไม่ตรงใจ',
  'ราคาแพงเกินไป',
  'ใช้ไม่บ่อยพอ',
  'กังวลเรื่องข้อมูลส่วนตัว',
  'เจอปัญหาการใช้งาน',
  'อื่น ๆ',
]

function thaiDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** จำนวนวันที่เหลือก่อนลบถาวร (ปัดขึ้น, ไม่ต่ำกว่า 0) */
function daysUntil(iso?: string): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.ceil((t - Date.now()) / 86_400_000))
}

export default function DeleteAccountPage() {
  const [checked, setChecked] = useState(false)
  const [sending, setSending] = useState(false)
  // สถานะ: idle → sending → pending (สำเร็จ) | notImplemented (501) | errored
  const [verdict, setVerdict] = useState<'idle' | 'sending' | 'pending' | 'notImplemented' | 'errored'>('idle')
  const [pendingInfo, setPendingInfo] = useState<{ requestedAt?: string; purgeAt?: string } | null>(null)
  const [cancelMsg, setCancelMsg] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [reasons, setReasons] = useState<string[]>([])
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  // มูลค่าจริงของบัญชี (สำหรับ delete-01 + restore-preview) — จาก endpoint เดิม, guard ทุกจุด
  const [stats, setStats] = useState<{ qi: number; historyCount: number; friends: number } | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/v2/account/delete')
      if (!r || !r.ok) return
      const j = (await r.json()) as { deletion?: { status: string; requestedAt: string; purgeAt: string } | null }
      if (j.deletion) {
        setPendingInfo(j.deletion)
        setVerdict('pending')
      }
    } catch {
      // สถานะอ่านไม่ได้ = ยังไปกันได้ตามปกติ (ไม่บล็อกหน้า)
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([fetch('/api/qi-wallet?history=100'), fetch('/api/referral')])
      const wj = w && w.ok ? await w.json() : null
      const rj = r && r.ok ? await r.json() : null
      setStats({ qi: wj?.qi ?? 0, historyCount: wj?.history?.length ?? 0, friends: rj?.invitedCount ?? 0 })
    } catch {
      // ไม่มีมูลค่า = ซ่อนแถวมูลค่า (ไม่บล็อกหน้า)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    void loadStats()
  }, [loadStatus, loadStats])

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

  const toggleReason = (r: string) =>
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  const sendFeedback = async () => {
    const note = [reasons.join(' · '), feedback.trim()].filter(Boolean).join(' — ')
    const res = await fetch('/api/v2/account/delete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: note, reasons }),
    })
    setFeedbackMsg(res.ok ? 'ขอบคุณสำหรับคำติชม' : 'ส่งไม่สำเร็จ — ไม่เป็นไรครับ')
    setFeedbackOpen(false)
  }

  const daysLeft = daysUntil(pendingInfo?.purgeAt)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ลบบัญชี · MuMate</title></Head>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <SkyHeader title="ลบบัญชี" backHref="/v2/account" testId="delete" />

        {/* สถานะ pending (เฟรม delete-04 pending-recovery) — วงกลมนับถอยหลัง + สิ่งที่จะได้กลับคืน + ยกเลิก */}
        {verdict === 'pending' && pendingInfo ? (
          <section data-testid="delete-pending" className={CARD}>
            <div className="flex flex-col items-center gap-2 text-center">
              <span aria-hidden className="grid size-24 place-items-center rounded-full border-4 border-v3-pumpkin/30 text-v3-pumpkin">
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[30px] font-black" data-testid="delete-days-left">{daysLeft ?? '—'}</span>
                  <span className="text-[11px] font-bold">วัน</span>
                </span>
              </span>
              <p className="text-base font-bold text-v3-pumpkin">บัญชีของคุณอยู่ระหว่างพักลบ</p>
              <p className="text-[13px] leading-5 text-v3-text-body">
                จะลบถาวรเมื่อ <b data-testid="delete-purge-date">{pendingInfo.purgeAt ? thaiDate(pendingInfo.purgeAt) : '—'}</b>
                {' '}— เข้าสู่ระบบหรือกดยกเลิกก่อนถึงกำหนดเพื่อใช้บัญชีต่อ
              </p>
            </div>

            {/* สิ่งที่จะได้กลับคืนถ้ายกเลิก */}
            {stats ? (
              <div className="mt-1 rounded-[16px] bg-[#ECF0FD] p-4" data-testid="delete-restore-preview">
                <p className="text-[13px] font-bold text-v3-navy">สิ่งที่จะได้กลับคืนถ้ายกเลิก</p>
                <div className="mt-2 flex flex-col gap-1.5 text-[13px] text-v3-text-body">
                  <div className="flex items-center justify-between"><span>พลังชี่</span><b className="text-v3-navy">{stats.qi.toLocaleString('th-TH')} QI</b></div>
                  <div className="flex items-center justify-between"><span>ประวัติการดูดวง</span><b className="text-v3-navy">{stats.historyCount.toLocaleString('th-TH')} รายการ</b></div>
                  <div className="flex items-center justify-between"><span>เพื่อนที่เชื่อมไว้</span><b className="text-v3-navy">{stats.friends.toLocaleString('th-TH')} คน</b></div>
                </div>
              </div>
            ) : null}

            <button
              onClick={() => void cancelDeletion()}
              data-testid="delete-cancel"
              className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold uppercase text-v3-lime"
            >
              ยกเลิกการลบบัญชี
            </button>
            {cancelMsg && <p data-testid="delete-cancel-msg" className="text-center text-[12px] font-bold text-v3-sapphire">{cancelMsg}</p>}
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

              {/* มูลค่าจริงของบัญชีนี้ */}
              {stats ? (
                <div className="rounded-[16px] bg-[#FBF1F2] p-4" data-testid="delete-value">
                  <p className="text-[13px] font-bold text-v3-navy">มูลค่าที่จะหายจากบัญชีนี้</p>
                  <div className="mt-2 flex flex-col gap-1.5 text-[13px] text-v3-text-body">
                    <div className="flex items-center justify-between"><span>พลังชี่คงเหลือ</span><b className="text-v3-navy">{stats.qi.toLocaleString('th-TH')} QI</b></div>
                    <div className="flex items-center justify-between"><span>ประวัติการดูดวง</span><b className="text-v3-navy">{stats.historyCount.toLocaleString('th-TH')} รายการ</b></div>
                    <div className="flex items-center justify-between"><span>เพื่อนที่เชื่อมไว้</span><b className="text-v3-navy">{stats.friends.toLocaleString('th-TH')} คน</b></div>
                  </div>
                </div>
              ) : null}

              {/* คำเตือนคืนเงิน (แถบชมพู) */}
              <p className="rounded-[12px] bg-[#FDECEC] px-3 py-2.5 text-[12px] leading-[18px] text-[#A83238]">
                พลังชี่และแพ็กเกจที่ซื้อมาจะถูกลบทันทีและไม่สามารถขอคืนเงินได้
              </p>
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
              <Link href="/v2/privacy/data-export" data-testid="delete-alt-export" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
                <span>
                  <span className="block py-3 text-sm font-bold text-v3-navy">ดาวน์โหลดข้อมูลก่อนลบ</span>
                  <span className="block pb-3 text-[12px] leading-4 text-v3-text-body -mt-3">ขอไฟล์ข้อมูลทั้งหมดเก็บไว้ก่อน</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
              <Link href="/v2/privacy/consent" data-testid="delete-alt-consent" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
                <span>
                  <span className="block py-3 text-sm font-bold text-v3-navy">จัดการความยินยอมข้อมูล</span>
                  <span className="block pb-3 text-[12px] leading-4 text-v3-text-body -mt-3">กังวลเรื่องข้อมูล? เลือกได้ว่าให้ใช้อะไรบ้าง</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
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
            <label className="flex w-full items-start gap-3 rounded-[24px] bg-white p-4 text-[13px] leading-5 text-v3-navy drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]">
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
          ย้อนกลับไปหน้าโปรไฟล์
        </Link>
      </div>

      {/* ⑤ feedback sheet (เฟรม delete-05b) — checklist เหตุผล + textarea, ปิด/ข้ามได้เสมอ */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setFeedbackOpen(false)}>
          <div className="w-full max-w-md rounded-t-[28px] bg-white px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="บอกเหตุผลที่จะลบ (ไม่บังคับ)">
            <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-v3-border-card" />
            <h2 data-testid="delete-feedback-title" className="text-[18px] font-bold text-v3-navy">ก่อนไป — บอกเราได้ไหมว่าทำไมถึงลบ?</h2>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">คำติชมของคุณช่วยให้เราทำงานดีขึ้น (ไม่บังคับ — ข้ามได้)</p>
            <div className="mt-3 flex flex-col gap-2" data-testid="delete-feedback-reasons">
              {REASONS.map((r) => {
                const on = reasons.includes(r)
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleReason(r)}
                    className={`flex items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-[14px] ${on ? 'border-v3-sapphire bg-[#ECF0FD] font-bold text-v3-navy' : 'border-v3-border-card text-v3-navy'}`}
                  >
                    <span className={`grid size-5 flex-none place-items-center rounded-[6px] border-2 ${on ? 'border-v3-sapphire bg-v3-sapphire text-white' : 'border-v3-border-card'}`}>
                      {on ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> : null}
                    </span>
                    {r}
                  </button>
                )
              })}
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="อยากบอกอะไรเพิ่มไหม (ไม่บังคับ)"
              data-testid="delete-feedback-input"
              className="mt-3 w-full rounded-[16px] border border-v3-border-input bg-white p-4 text-[14px] outline-none placeholder:text-v3-placeholder"
            />
            <button
              onClick={() => void sendFeedback()}
              disabled={reasons.length === 0 && !feedback.trim()}
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
