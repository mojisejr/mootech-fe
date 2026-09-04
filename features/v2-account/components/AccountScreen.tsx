// features/v2-account/components/AccountScreen.tsx — จอ "โปรไฟล์" (เฟรม `profile-and-qi-wallet — UX v2`
// หน้า "- profile", อ่านจริงจาก Figma 2026-09-04) — hero กระเป๋าชี่มีมาสคอต + quick actions 4 ปุ่ม +
// การ์ดแผน + เมนูไอคอนไทล์. ก่อนหน้านี้ (#365) จอนี้เคยเป็น "สิทธิ์ของฉัน" แบบไม่มีดีไซน์ — ตอนนี้มีเฟรมแล้ว
// จึงเดินตามเฟรม: ไม่ใช้ AppHeader (ไม่มี badge/กระดิ่ง/avatar ในดีไซน์) และประวัติการซื้อย้ายไป /v2/orders
// เต็มที่ (เฟรม my-plan/order-history) แทนการ์ดย่อในหน้านี้
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'
import { planFor, type Plan } from '../plan'
import { MenuRow, QuickAction, SectionCard, SkyHeader, SkyScreen } from '@/features/v2-profile/components/kit'

type QiWallet = { qi?: number; coins?: number; level?: number | string; xp?: number; history?: unknown[] }
type Profile = { firstName?: string | null; displayName?: string | null }

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <section data-testid="account-status" className="v3-shadow-card flex w-full flex-col rounded-[24px] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p data-testid="account-plan" className="text-lg font-bold leading-6 text-v3-navy">{plan.heading}</p>
          <p data-testid="account-valid-until" className="mt-[2px] text-[13px] leading-5 text-v3-text-body">{plan.sub}</p>
        </div>
        {/* มงกุฎ tier ตามภาษาดีไซน์ (vip-crown.png มีอยู่แล้วใน repo) */}
        {!plan.isFree ? (
          <span aria-hidden className="relative size-10 flex-none">
            <Image src="/images/v2/destiny/vip-crown.png" alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
          </span>
        ) : null}
      </div>
      <hr className="my-3 w-full border-t border-v3-border-card" />
      {plan.isFree ? (
        <Link
          href={SHOP_HREF}
          data-testid="account-shop-cta"
          className="grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-[14px] font-bold text-white"
        >
          ดูแพ็คเกจ
        </Link>
      ) : (
        <div className="flex items-center justify-between text-sm">
          <p className="leading-[22px] text-v3-text-body">ระดับ</p>
          <p data-testid="account-level" className="font-bold leading-5 text-v3-navy">{plan.level ?? 'สมาชิก'}</p>
        </div>
      )}
    </section>
  )
}

export function AccountScreen() {
  const { user, done, errored } = useV2User()
  const [qiWallet, setQiWallet] = useState<QiWallet | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [deletePending, setDeletePending] = useState<string | null>(null)
  // 🔴 #365-class: การอ่านล้มต้องเงียบส่วนที่เสริม (hero/แบนเนอร์ซ่อน) แต่ห้าม render เป็นเลข 0/false fact
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/api/qi-wallet')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) setQiWallet(j as QiWallet) })
      .catch(() => { if (alive) setQiWallet(null) })
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) setProfile(j?.profile ?? null) })
      .catch(() => { if (alive) setProfile(null) })
    fetch('/api/v2/account/delete')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive && j?.deletion?.purgeAt) setDeletePending(j.deletion.purgeAt) })
      .catch(() => { if (alive) setDeletePending(null) })
    return () => { alive = false }
  }, [attempt])

  const membership = user?.membership ?? null
  const undetermined = !done || errored || membership == null || membership.isPaid == null
  const plan: Plan | null = undetermined ? null : planFor(membership)

  const dayOne = qiWallet ? (qiWallet.qi ?? 0) === 0 && !(qiWallet.history?.length) : false

  return (
    <SkyScreen menubar={<Menubar />}>
      <Head><title>โปรไฟล์ · MuMate</title></Head>
      <SkyHeader title="โปรไฟล์" backHref="/v2" testId="profile" />

      {/* ทักทาย + @name (Figma: สวัสดี ชื่อ / @name จาง ๆ) */}
      <div className="mt-2 px-1" data-testid="account-greeting">
        <p className="text-[22px] font-black leading-7 text-v3-navy">
          สวัสดี{profile?.firstName ? `, ${profile.firstName}` : ''}
        </p>
        {profile?.displayName ? <p className="text-[12px] leading-4 text-v3-text-muted">@{profile.displayName}</p> : null}
      </div>

      {/* hero กระเป๋าชี่ — การ์ดใหญ่ + มาสคอตขวา (เฟรม profile-and-qi-wallet) */}
      {qiWallet ? (
        <div className="v3-shadow-card mt-3 flex w-full items-center rounded-[24px] bg-white p-5" data-testid="account-qi-wallet">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] leading-4 text-v3-text-muted">{dayOne ? 'เริ่มสะสมชี่วันนี้' : 'พลังชี่สะสมของคุณ'}</p>
            <p className="mt-1 flex items-center gap-2" data-testid="account-qi-balance">
              <Image src="/images/v2/zone2/coin.png" alt="" width={34} height={34} unoptimized className="size-[34px] object-contain" />
              <span className="text-[34px] font-black leading-10 text-v3-navy">{(qiWallet.qi ?? 0).toLocaleString('th-TH')}</span>
            </p>
            <p className="mt-1 text-[12px] leading-4 text-v3-text-muted">
              เหรียญ {(qiWallet.coins ?? 0).toLocaleString('th-TH')} · Level {qiWallet.level ?? 1}
            </p>
            <Link
              href="/v2/qi/buy"
              data-testid="qi-topup-link"
              className="mt-3 grid h-10 w-[132px] place-items-center rounded-full bg-v3-lime text-[13px] font-black text-v3-navy"
            >
              เติมชี่
            </Link>
          </div>
          <span aria-hidden className="v3-float-wide relative size-[110px] flex-none">
            <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="110px" style={{ objectFit: 'contain' }} />
          </span>
        </div>
      ) : null}

      {/* quick actions 4 ปุ่มตามเฟรม */}
      <div className="mt-4 flex items-start gap-2" data-testid="account-quick-actions">
        <QuickAction href="/v2/qi/missions" icon="🎯" label="ภารกิจ" testId="account-qa-missions" />
        <QuickAction href="/v2/qi/history" icon="📋" label="ประวัติชี่" testId="account-qa-history" />
        <QuickAction href="/v2/qi/referral" icon="🤝" label="ชวนเพื่อน" testId="account-qa-referral" />
        <QuickAction href="/v2/qi" icon="🎁" label="แลกสิทธิ์" testId="account-qa-redeem" />
      </div>

      {/* แบนเนอร์บัญชีระหว่างพักลบ (เฟรม account-deletion — missing states) */}
      {deletePending ? (
        <Link href="/v2/settings/delete-account" data-testid="account-delete-pending" className="v3-shadow-card mt-4 flex w-full flex-col rounded-[24px] border-2 border-v3-pumpkin bg-white p-4">
          <p className="text-[14px] font-bold text-v3-pumpkin">บัญชีอยู่ระหว่างพักลบ — ยกเลิกได้ถึง 30 วัน</p>
          <p className="text-[12px] leading-4 text-v3-text-body">กดเพื่อดูสถานะหรือยกเลิกการลบ</p>
        </Link>
      ) : null}

      {/* แผนของฉัน */}
      <div className="mt-4">
        {undetermined ? (
          <section data-testid="account-undetermined" className="v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5">
            <div aria-hidden className="h-6 w-1/2 animate-pulse rounded bg-v3-border-card" />
            <div aria-hidden className="h-4 w-2/3 animate-pulse rounded bg-v3-border-card" />
          </section>
        ) : (
          <PlanCard plan={planFor(membership)} />
        )}
      </div>

      {/* เมนูหลัก — ไอคอนไทล์ต่อแถวตามเฟรม */}
      <SectionCard className="mt-4 !p-2">
        <MenuRow href="/v2/destiny" testId="account-destiny-entry" icon="🔮" tone="purple" title="ดวงของฉัน" sub="ผลดวงครบทุกด้านในที่เดียว" />
        <MenuRow href="/v2/settings/edit-profile" testId="account-edit-profile" icon="✏️" tone="blue" title="แก้ไขข้อมูลส่วนตัว" sub="ชื่อ-นามสกุล เพศ และ @name" />
        <MenuRow href="/v2/settings/edit-birth" testId="account-edit-birth" icon="🎂" tone="pink" title="แก้ไขวันเกิด" sub="ฟรีครั้งแรก — ครั้งถัดไปใช้ชี่" />
        <MenuRow href="/v2/settings/connected" testId="account-connected" icon="🔗" tone="green" title="ช่องทางเชื่อมต่อ" sub="LINE · Google" />
        <MenuRow href="/v2/settings/notifications" testId="account-notifications" icon="🔔" tone="orange" title="การแจ้งเตือน" sub="ดวงรายวัน · การเตือน · ข่าวสาร" />
        <MenuRow href="/v2/orders" testId="account-orders-link" icon="🧾" tone="teal" title="ประวัติคำสั่งซื้อ" sub="ใบเสร็จและสถานะการชำระ" />
        <MenuRow href="/v2/privacy/consent" testId="account-consent" icon="🛡️" tone="purple" title="ความเป็นส่วนตัว" sub="ความยินยอม · ส่งออกข้อมูล · PDPA" />
        <MenuRow href="/v2/help/faq" testId="account-faq" icon="❓" tone="blue" title="ช่วยเหลือ" sub="คำถามที่พบบ่อย" />
        <MenuRow href="/v2/settings" testId="account-settings-link" icon="⚙️" tone="ghost" title="ตั้งค่า" sub="ภาษา ขนาดตัวอักษร และอื่น ๆ" />
        <MenuRow href="/v2/settings/delete-account" testId="account-delete-account" icon="🗑️" tone="red" title="ลบบัญชี" sub="พักบัญชี 30 วัน ก่อนลบถาวร" danger last />
      </SectionCard>
    </SkyScreen>
  )
}
