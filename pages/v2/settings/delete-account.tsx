// pages/v2/settings/delete-account.tsx — "ลบบัญชี" ตามมีตติ้งทีม 2026-09-02 (team.mp4):
// แจ้งสิ่งที่จะหายให้ครบก่อน · พักบัญชี ~30 วันก่อนลบจริง · เปลี่ยนใจได้ถ้ากลับมาล็อกอินใน 30 วัน.
//
// 🔴 ขาหลังยังไม่มี (mootech-be ไม่มี DELETE /user) — POST /api/v2/account/delete ตอบ 501
// เสมอ หน้านี้จึงต้องโชว์สถานะ "ยังไม่เปิดใช้" อย่างตรงไปตรงมา (scripts/delete-account-screen.test.tsx
// เก็บพฤติกรรมนี้ไว้) ห้ามเขียนทับเป็นสำเร็จลอย
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { useV2Tier } from '@/features/auth/hooks/useV2Tier'

const CARD = 'flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

const LOST = [
  'ข้อมูลวันเกิดและผลดวงที่คำนวณไว้ทั้งหมด',
  'สิทธิ์สมาชิก VIP / Plus / Pro ที่เหลืออยู่',
  'ชี่ โค้ดแนะนำ และประวัติการใช้งานทั้งหมด',
  'เพื่อนร่วมงานและข้อมูลเทียบดวงที่ผูกไว้',
  'การแจ้งเตือนดวงรายวันบนอุปกรณ์นี้',
]

export default function DeleteAccountPage() {
  const [checked, setChecked] = useState(false)
  const [sending, setSending] = useState(false)
  // #384 — ทุกหน้าที่ใช้ AppHeader ต้องส่ง membership ตรง ๆ (ห้ามเดาสิทธิ์); และหน้าลบบัญชี
  // ไม่ใช่พื้นที่ขายของ จึงปิด upgrade CTA (เหตุผลเดียวกับ notifications/checkout)
  const tier = useV2Tier(false)
  // 🔴 สามสถานะจริงใส: idle → sending → notImplemented (501) หรือ errored — ไม่มี success
  // เพราะขาหลังยังไม่มี (ดูหัวไฟล์); ถ้าวันหนึ่ง BE พร้อม ให้เพิ่มสถานะ done ที่ปุ่มนี้เท่านั้น
  const [verdict, setVerdict] = useState<'idle' | 'sending' | 'notImplemented' | 'errored'>('idle')

  const submit = async () => {
    setSending(true)
    setVerdict('sending')
    try {
      const r = await fetch('/api/v2/account/delete', { method: 'POST' })
      if (r.status === 501) setVerdict('notImplemented')
      else if (!r.ok) setVerdict('errored')
      else setVerdict('errored') // ยังไม่ควรเกิด — ถ้าเกิดแปลว่าขาหลังมาแล้วแต่หน้ายังไม่รองรับ ให้ตรวจก่อนเสมอ
    } catch {
      setVerdict('errored')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ลบบัญชี · MuMate</title></Head>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <AppHeader testId="delete-header" title="ลบบัญชี" backHref="/v2/account" membership={tier} upgradeCta={false} className="items-center py-4" />

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

        <Link href="/v2/account" data-testid="delete-back-account" className="mt-4 text-center text-sm font-bold text-v3-cyan">
          ย้อนกลับไปหน้าสิทธิ์ของฉัน
        </Link>
      </div>

      <Menubar />
    </div>
  )
}
