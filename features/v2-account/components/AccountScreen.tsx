// features/v2-account/components/AccountScreen.tsx — จอ "สิทธิ์ของฉัน" (#365).
//
// NO FIGMA FRAME EXISTS FOR THIS SCREEN. ฟีม confirmed 2026-08-26 that it was never designed, so this is
// responsive-by-principle per DESIGN.md §9.2's "Ref rule", built from the language its two nearest siblings
// already speak — ShopScreen (shell + footer ask + mascot) and OrderSummaryCard (card + label/value rows).
// Nothing here is a new primitive; if it looks new, it drifted.
//
// Shell PATTERN copied from ShopScreen: own cream ground + BG01 hero fade + centred max-w column that clears
// the fixed Menubar. NOT AppShell — its ghost-white ground would flatten the white cards.
//
// ฟีม's three rulings, 2026-08-26, recorded so a later pass does not "fix" them back:
//   ① the level badge SHOWS here but does not navigate (tierLink={false}) — its destination is this screen.
//   ② NO "เหลืออีก N วัน" countdown. The expiry date alone. Asked and declined.
//   ③ purchase history IS in scope, APPROVED only (see ../payment-history.ts for why the other two states
//      are not "purchases").
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { useV2User } from '@/features/auth/hooks/useV2User'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'
import { parseTierCode } from '@/lib/v2/tier'
import type { MembershipLike } from '@/features/v2-shell/header-badge'
import { historyState, type PaymentRow } from '../payment-history'
import { HistoryCard } from './HistoryCard'
import { planFor, type Plan } from '../plan'

const CARD = 'flex w-full flex-col gap-4 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex w-full items-start justify-between text-sm">
      <p className="leading-[22px] text-v3-text-body">{label}</p>
      <p data-testid={testId} className="font-bold leading-5 text-v3-navy">{value}</p>
    </div>
  )
}

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
    <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function StatusCard({ plan }: { plan: Plan }) {
  return (
    <section data-testid="account-status" className={`${CARD} font-ibm`}>
      <div className="flex w-full flex-col gap-1">
        <p data-testid="account-plan" className="text-lg font-bold leading-6 text-v3-navy">{plan.heading}</p>
        <p data-testid="account-valid-until" className="text-sm leading-[22px] text-v3-text-body">{plan.sub}</p>
      </div>
      <hr className="w-full border-t border-v3-border-card" />
      {plan.isFree ? (
        <Link
          href={SHOP_HREF}
          data-testid="account-shop-cta"
          className="grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold leading-6 text-white"
        >
          ดูแพ็คเกจ
        </Link>
      ) : (
        <Row testId="account-level" label="ระดับ" value={plan.level ?? 'สมาชิก'} />
      )}
    </section>
  )
}

export function AccountScreen() {
  const { user, done, errored } = useV2User()
  const [rows, setRows] = useState<PaymentRow[] | null>(null)
  const [historyDone, setHistoryDone] = useState(false)
  // 🔴 #365 (ตู๋, 8cbe56b): a failed read used to land on `rows = []`, which HistoryCard rendered as
  // "ยังไม่มีรายการ" — telling a paying member they had never bought anything. The three outcomes are now
  // three states, and this flag is the one that keeps our failure from being reported as their fact.
  const [historyErrored, setHistoryErrored] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // profile-and-qi-wallet (ก้อน 3.1) — กระเป๋าชี่โชว์คู่แผนในจอเดียว; day-one = ชี่ 0 และไม่มีประวัติ
  const [qiWallet, setQiWallet] = useState<{ qi?: number; coins?: number; level?: number | string; history?: unknown[] } | null>(null)

  useEffect(() => {
    let alive = true
    setHistoryDone(false)
    setHistoryErrored(false)
    fetch('/api/v2/payment/status')
      // ❌ NOT `r.ok ? ... : { payments: [] }` — a 401/500 is not an empty history.
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) setRows(Array.isArray(j?.payments) ? j.payments : []) })
      // A failed read must not blank the whole screen either: the level and expiry above it are the reason
      // the user opened this page. Mark the card errored, leave the rest standing.
      .catch(() => { if (alive) { setHistoryErrored(true); setRows(null) } })
      .finally(() => { if (alive) setHistoryDone(true) })
    // กระเป๋าชี่ — ล้มแล้วไม่ต้องบล็อกจอ (ส่วนแผนยังใช้ได้) แค่ไม่โชว์ hero
    fetch('/api/qi-wallet')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) setQiWallet(j) })
      .catch(() => { if (alive) setQiWallet(null) })
    return () => { alive = false }
  }, [attempt])

  const membership = user?.membership ?? null
  // The composite types every field optional (the server may omit the whole key). `headerBadge` needs the
  // three-valued isPaid explicitly, and `undefined` is NOT a fourth state — it means the same thing null
  // does: not determined. Normalise ONCE, here, so the header and the card below cannot disagree about a
  // user; two independent reads of "who is this" is how a paid member gets an upsell on one half of a screen.
  const headerMembership: MembershipLike | null =
    membership == null ? null : { isPaid: membership.isPaid ?? null, tier: parseTierCode(membership.tier ?? '') }
  // NOT DETERMINED = say nothing yet. Rendering "Mumate Free" while the fetch is in flight would tell a
  // paying member they are not one, every single load (the exact failure #246 cost us).
  const undetermined = !done || errored || membership == null || membership.isPaid == null

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>สิทธิ์ของฉัน · MuMate</title></Head>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[365px] select-none">
        <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-v3-bg-cream/40 to-v3-bg-cream" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Two separate opt-outs, and they are not the same thing (#384 proved that):
              tierLink   — this screen IS the badge's destination, so the badge must not navigate here.
              upgradeCta — this screen already TELLS a free user they are free, and offers ดูแพ็คเกจ in the
                           card below. A second seller in the header says it twice to someone who came here
                           for reassurance. (Caught by scripts/header-tier-badge.test.tsx, which noticed the
                           list called this screen non-selling while the screen never said so — ผมประกาศไว้
                           ในลิสต์ แต่ลืมส่ง prop จริง.)
            membership still flows in either way, so a member still SEES their level here. */}
        <AppHeader
          testId="account-header"
          title="สิทธิ์ของฉัน"
          backHref="/v2"
          membership={headerMembership}
          tierLink={false}
          upgradeCta={false}
          className="items-center py-4"
        />

        {undetermined ? (
          <section data-testid="account-undetermined" className={`${CARD} font-ibm`}>
            <div aria-hidden className="h-6 w-1/2 animate-pulse rounded bg-v3-border-card" />
            <div aria-hidden className="h-4 w-2/3 animate-pulse rounded bg-v3-border-card" />
          </section>
        ) : (
          <StatusCard plan={planFor(membership)} />
        )}

        {/* กระเป๋าชี่ (เฟรม profile-and-qi-wallet + profile — day one) — ชี่ 0 และไม่มีประวัติ = มือใหม่ */}
        {qiWallet ? (
          <Link href="/v2/qi" data-testid="account-qi-wallet" className={`${CARD} font-ibm`}>
            <div className="flex w-full items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] leading-4 text-v3-text-muted">พลังชี่ของคุณ</p>
                <p data-testid="account-qi-balance" className="text-[26px] font-black leading-8 text-v3-navy">
                  {(qiWallet.qi ?? 0).toLocaleString('th-TH')} ชี่
                </p>
                <p className="text-[11px] leading-4 text-v3-text-muted">
                  เหรียญ {qiWallet.coins ?? 0} · Level {qiWallet.level ?? 1}
                </p>
              </div>
              <span className="flex-none rounded-full bg-v3-lime px-3 py-1 text-[12px] font-black text-v3-navy">
                {(qiWallet.qi ?? 0) === 0 && !(qiWallet.history?.length) ? 'เริ่มสะสมชี่' : 'จัดการชี่ →'}
              </span>
            </div>
          </Link>
        ) : null}

        {/* ทางเข้า "ดวงของฉัน" — hub ผลดวงเต็มระบบ (Figma page ดวงฉัน, node 55349-3070) */}
        <Link
          href="/v2/destiny"
          data-testid="account-destiny-entry"
          className={`${CARD} font-ibm`}
        >
          <p className="text-base font-bold text-v3-navy">ดวงของฉัน</p>
          <p className="text-[12px] leading-4 text-v3-text-body">
            ครบทุกเรื่องที่ต้องรู้ วิเคราะห์รายด้าน จบในแพ็กเกจเดียว
          </p>
        </Link>

        {/* ทางเข้า "พลังชี่ของฉัน" — wallet + วิธีสะสม + referral (qi-token-guide) */}
        <Link
          href="/v2/qi"
          data-testid="account-qi-entry"
          className={`${CARD} font-ibm`}
        >
          <p className="text-base font-bold text-v3-navy">🪙 พลังชี่ของฉัน</p>
          <p className="text-[12px] leading-4 text-v3-text-body">
            สะสมชี่จากภารกิจรายวัน ชวนเพื่อน และแลกสิทธิ์อ่านดวงเจาะลึก
          </p>
        </Link>

        {/* แถวบัญชีครบชุด (เฟรม profile-and-qi-wallet / my-plan / edit-personal-info / edit-birth-data /
            account-login — connected) — ทุกแถวมีหน้าจริง ❌ ปุ่มตาย (#587) */}
        <section data-testid="account-links" className={`${CARD} font-ibm`}>
          <Link href="/v2/account/plan" data-testid="account-plan-link" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
            <span className="py-4 text-sm font-bold text-v3-navy">แผนของฉัน</span>
            <Chevron />
          </Link>
          <Link href="/v2/orders" data-testid="account-orders-link" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
            <span className="py-4 text-sm font-bold text-v3-navy">ประวัติคำสั่งซื้อและใบเสร็จ</span>
            <Chevron />
          </Link>
          <Link href="/v2/qi/referral" data-testid="account-referral-link" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
            <span className="py-4 text-sm font-bold text-v3-navy">ชวนเพื่อนรับโบนัส</span>
            <Chevron />
          </Link>
          <Link href="/v2/settings/edit-profile" data-testid="account-edit-profile" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
            <span className="py-4 text-sm font-bold text-v3-navy">แก้ไขข้อมูลส่วนตัว</span>
            <Chevron />
          </Link>
          <Link href="/v2/settings/edit-birth" data-testid="account-edit-birth" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
            <span>
              <span className="block py-4 text-sm font-bold text-v3-navy">แก้วันเกิด</span>
              <span className="block pb-4 text-[12px] leading-4 text-v3-text-body -mt-4">ฟรี 1 ครั้ง — ครั้งถัดไปใช้ชี่ เพราะดวงเปลี่ยนทั้งหมด</span>
            </span>
            <Chevron />
          </Link>
          <Link href="/v2/settings/connected" data-testid="account-connected" className="flex items-center justify-between gap-2">
            <span className="py-4 text-sm font-bold text-v3-navy">ช่องทางเข้าใช้งาน</span>
            <Chevron />
          </Link>
        </section>

        {/* ตั้งค่าและความเป็นส่วนตัว — มีตติ้งทีม 2026-09-02 (team.mp4) · PDPA/นโยบาย · ลบบัญชี (พัก 30 วัน) */}
        <section data-testid="account-settings" className={`${CARD} font-ibm`}>
          <p className="text-base font-bold text-v3-navy">ตั้งค่าและความเป็นส่วนตัว</p>
          <Link href="/v2/settings" data-testid="account-settings-link" className="flex items-center justify-between gap-2 border-b border-v3-border-card">
            <span className="py-4 text-sm font-bold text-v3-navy">ตั้งค่า</span>
            <Chevron />
          </Link>
          <Link href="/privacy/policy" data-testid="account-privacy" className="flex items-center justify-between gap-2">
            <span>
              <span className="block text-sm font-bold text-v3-navy">นโยบายความเป็นส่วนตัว (PDPA)</span>
              <span className="block text-[12px] leading-4 text-v3-text-body">ข้อมูลที่เราเก็บ วิธีใช้ และการถอนความยินยอม</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
              <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href="/v2/settings/delete-account" data-testid="account-delete-account" className="flex items-center justify-between gap-2">
            <span>
              <span className="block text-sm font-bold text-v3-pumpkin">ลบบัญชี</span>
              <span className="block text-[12px] leading-4 text-v3-text-body">พักบัญชี 30 วัน ก่อนลบถาวร — เปลี่ยนใจได้ใน 30 วันนี้</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
              <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </section>

        <HistoryCard state={historyState({ done: historyDone, errored: historyErrored, rows })} onRetry={() => setAttempt((n) => n + 1)} />

        <section data-testid="account-footer-ask" className="mt-8 flex items-center gap-4 rounded-3xl bg-white/70 px-6 py-5">
          <div className="flex-1">
            <p className="text-base font-bold leading-6 text-v3-navy">อยากได้สิทธิ์เพิ่ม?</p>
            <Link href={SHOP_HREF} data-testid="account-footer-shop" className="mt-1 inline-block text-sm font-bold leading-5 text-v3-cyan">
              ดูแพ็คเกจทั้งหมด →
            </Link>
          </div>
          {/* In flow, like ShopScreen's — a mascot that overlaps a control is a bug this repo already named. */}
          <span data-testid="account-mascot" className="relative size-16 shrink-0">
            <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="64px" style={{ objectFit: 'contain' }} />
          </span>
        </section>
      </div>

      <Menubar />
    </div>
  )
}
