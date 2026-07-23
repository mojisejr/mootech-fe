// features/v2-home/components/V2HomeScreen.tsx — MuMate v2 logged-in HOME (slice-2, scope B: shell-first).
//
// PRESENTATIONAL — takes { greeting, mascotCharacter, onLogout } as props so goo's /v2 index wires the
// hooks (useV2Home / useV2Logout / useMascotFromCompute → 01.png fallback) with zero file conflict.
// Layout = EVERY section per Figma node 333-6545 (won't be re-torn later); FEATURE content is
// placeholder/empty-state (scope B). Key invariants: BG CONTINUOUS through the full scroll (no seam),
// responsive @393 + no breakage / safe-area / long scroll.
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'

export type V2HomeScreenProps = {
  greeting: { name: string }
  /** resolved character path, or the static hero fallback (/images/v2/mascot/01.png) — goo wires it */
  mascotCharacter: string
  onLogout: () => void
}

const HERO_FALLBACK = '/images/v2/mascot/01.png'

export function V2HomeScreen({ greeting, mascotCharacter, onLogout }: V2HomeScreenProps) {
  const [logoutOpen, setLogoutOpen] = useState(false)
  return (
    // page bg = bg-cream (Figma Lemon Chiffon) — the CONTINUOUS ground the whole scroll sits on
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      {/* ── BG CONTINUITY: BG01 hero at the top, gradient-faded INTO bg-cream. Below the fade there is
          only the page colour, so there is no seam anywhere across the ~2229px scroll. ── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] select-none">
        <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-v3-bg-cream/40 to-v3-bg-cream" />
      </div>

      {/* ── content column: 393 primary, centred + capped, safe-area top, clears the fixed nav ── */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Greeting name={greeting.name} mascotCharacter={mascotCharacter} onAvatarTap={() => setLogoutOpen(true)} />
        <ScoreRingCard />
        <ManifestCard />
        <WhiteMoundDivider />
        <ServiceSection
          title="ดวงสมพงค์"
          subtitle="เช็คความเข้ากันของคุณกับคนพิเศษ ดูดวงคู่ครอง ทั้งความรัก การเงิน สุขภาพ"
          tiles={['ดูดวงคู่รัก', 'ดูดวงเพื่อนร่วมงาน']}
        />
        <WhiteMoundDivider />
        <ServiceSection
          title="โหมดเซียน"
          subtitle="ปลดล็อกพลังทำนายขั้นสูง วิเคราะห์ดวงชะตาแบบเจาะลึก ด้วยระบบ AI ระดับเซียน"
          tiles={['เสี่ยงไพ่ ออราเคิล', 'เสี่ยงไพ่ จิตวิญญาณ', 'เสี่ยงเซียน เสี่ยงทาย']}
        />
        <SinseCard />
        <ServiceSection
          title="เรียนปาจื่อ"
          subtitle="ปลดล็อกพลังทำนายขั้นสูง วิเคราะห์ดวงชะตาแบบเจาะลึก รู้ก่อน เตรียมพร้อมก่อน"
          tiles={[]}
        />
      </div>

      <HomeBottomNav />
      {logoutOpen && <LogoutModal onClose={() => setLogoutOpen(false)} onConfirm={onLogout} />}
    </div>
  )
}

// Greeting mascot with missing-FILE safety: a resolved character path can 404 (asset not yet in repo /
// on S3) — Next/Image onError swaps to the static hero. This is the frozen "fallback 01.png" intent at
// the FILE level (goo's null-fallback covers "no compute"; this covers "path resolves but file missing").
function MascotImg({ src }: { src: string }) {
  const [current, setCurrent] = useState(src)
  return <Image src={current} alt="" fill sizes="28px" style={{ objectFit: 'contain' }} onError={() => setCurrent(HERO_FALLBACK)} />
}

// ── Greeting ──────────────────────────────────────────────────────────────────────────────────────
function Greeting({ name, mascotCharacter, onAvatarTap }: { name: string; mascotCharacter: string; onAvatarTap: () => void }) {
  return (
    <header className="flex items-start gap-3 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="text-2xl font-bold leading-8 text-v3-navy">สวัสดีคุณ{name}</h1>
        <div className="flex items-center gap-1.5">
          <span className="relative h-8 w-7 shrink-0">
            {/* missing-file safety (goo caught: characters/ empty → path 404s): fall back to static hero */}
            <MascotImg src={mascotCharacter} />
          </span>
          {/* element line = feature data (compute) → placeholder copy, real value lands with feature */}
          <p className="truncate text-base font-bold leading-6 text-v3-text-body">ธาตุของคุณ</p>
        </div>
      </div>
      {/* notification bell */}
      <button type="button" aria-label="การแจ้งเตือน" className="grid size-10 shrink-0 place-items-center rounded-full bg-v3-cyan text-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      </button>
      {/* avatar → tap = logout confirm (frozen decision) */}
      <button type="button" aria-label="โปรไฟล์" onClick={onAvatarTap} className="grid size-10 shrink-0 place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-white">
        {name.trim().charAt(0) || 'F'}
      </button>
    </header>
  )
}

// ── Score-ring card (daily-session) ─────────────────────────────────────────────────────────────
function ScoreRingCard() {
  return (
    <section className="mb-8 flex flex-col gap-4 rounded-[28px] bg-gradient-to-b from-white to-v3-cyan/20 p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <ScoreDonut grade="C+" pct={75} />
        <div className="min-w-0 text-lg font-bold leading-6 text-v3-navy">
          <p>วันนี้ดวงดีมาก</p>
          <p>เเค่เริ่มก็สำเร็จเเล้ว</p>
        </div>
      </div>
      <hr className="border-v3-border-card" />
      <div className="flex items-start gap-4 text-base font-bold leading-6">
        <p className="min-w-0 flex-1 text-v3-navy">วันนี้</p>
        <Link href="/v2/calendar" className="shrink-0 uppercase text-v3-sapphire underline">เปิดปฏิทินของฉัน</Link>
      </div>
      <hr className="border-v3-border-card" />
      {/* เหมาะ / เลี่ยง — FEATURE lists → empty-state placeholder (scope B) */}
      <div className="flex items-start gap-4">
        <PlaceholderList heading="เหมาะกับวันนี้" tone="cyan" />
        <div className="w-px self-stretch bg-v3-border-card" />
        <PlaceholderList heading="ควรเลี่ยง" tone="pumpkin" />
      </div>
    </section>
  )
}

function ScoreDonut({ grade, pct }: { grade: string; pct: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className="grid size-[90px] shrink-0 place-items-center rounded-full bg-v3-lime">
      <svg width="90" height="90" viewBox="0 0 90 90" className="absolute -rotate-90 text-v3-sapphire">
        <circle cx="45" cy="45" r={r} fill="none" stroke="white" strokeWidth="6" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="relative text-center text-v3-sapphire">
        <p className="text-2xl font-bold leading-8">{grade}</p>
        <p className="text-sm leading-[22px]">{pct}%</p>
      </div>
    </div>
  )
}

function PlaceholderList({ heading, tone }: { heading: string; tone: 'cyan' | 'pumpkin' }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={`text-base font-bold leading-6 ${tone === 'cyan' ? 'text-v3-cyan' : 'text-v3-pumpkin'}`}>{heading}</p>
      <div className="mt-1 space-y-1.5">
        <div className="h-3 w-4/5 rounded bg-v3-border-card" />
        <div className="h-3 w-3/5 rounded bg-v3-border-card" />
      </div>
    </div>
  )
}

// ── Manifest / mascot card ──────────────────────────────────────────────────────────────────────
function ManifestCard() {
  return (
    <section className="mb-8 overflow-hidden rounded-[24px] bg-gradient-to-r from-v3-cyan/30 to-v3-lime/20 p-6">
      <p className="max-w-[64%] text-base font-bold leading-6 text-v3-navy">มานิเฟส สิ่งที่คุณปรารถนา แล้วปล่อยให้จักรวาลนำทาง</p>
      <button type="button" className="mt-3 rounded-full bg-v3-sapphire px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-lime">เพิ่มความปรารถนาของคุณ</button>
    </section>
  )
}

// ── Service section frame (header + placeholder tiles + CTA) ──────────────────────────────────────
function ServiceSection({ title, subtitle, tiles }: { title: string; subtitle: string; tiles: string[] }) {
  return (
    <section className="mb-6 flex flex-col items-center gap-4">
      <div className="w-full">
        <h2 className="text-xl font-bold leading-7 text-v3-navy">{title}</h2>
        <p className="mt-1 text-sm font-medium leading-5 text-v3-text-body">{subtitle}</p>
      </div>
      {tiles.length > 0 ? (
        <div className="flex w-full gap-2">
          {tiles.map((t) => (
            <div key={t} className="flex min-h-[120px] flex-1 items-end rounded-2xl bg-v3-ghost-white p-4">
              <p className="text-sm font-bold uppercase leading-5 text-v3-navy">{t}</p>
            </div>
          ))}
        </div>
      ) : (
        // empty-state placeholder (scope B — feature deferred)
        <div className="grid min-h-[120px] w-full place-items-center rounded-2xl bg-v3-ghost-white text-sm text-v3-text-muted">เร็วๆ นี้</div>
      )}
      <button type="button" className="rounded-full border border-v3-sapphire px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-sapphire">ดูบริการทั้งหมด</button>
    </section>
  )
}

// ── Sinse (ซินเเส) sapphire card ─────────────────────────────────────────────────────────────────
function SinseCard() {
  return (
    <section className="mb-6 overflow-hidden rounded-[24px] bg-v3-sapphire p-6">
      <p className="max-w-[64%] text-base font-bold leading-6 text-white">ดูดวงส่วนตัว กับซินเเส</p>
      <p className="mt-2 max-w-[64%] text-sm font-medium leading-5 text-white/90">วิเคราะห์ดวงชะตาเชิงลึก รวบรวมเป็นหนังสือส่วนตัว</p>
      <button type="button" className="mt-3 rounded-full bg-v3-lime px-6 py-2 text-sm font-semibold uppercase leading-5 text-v3-sapphire">ทักซินเเสเพื่อจอง</button>
    </section>
  )
}

// ── White-mound wave divider (rebuilt as SVG — Figma "White Mound") ──────────────────────────────
function WhiteMoundDivider() {
  return (
    <div aria-hidden className="my-2 -mx-4 h-7 w-[calc(100%+2rem)] text-v3-bg-cream">
      <svg viewBox="0 0 451 27" preserveAspectRatio="none" className="h-full w-full" fill="currentColor">
        <path d="M0 27 V10 Q112 -6 225 8 T451 10 V27 Z" />
      </svg>
    </div>
  )
}

// ── Bottom nav (sticky tab bar + Mate-AI navbar w/ hero mascot) ───────────────────────────────────
const TABS = [
  { href: '/v2', label: 'หน้าหลัก' },
  { href: '/v2/service', label: 'บริการ' },
  { href: '/v2/calendar', label: 'ปฏิทิน' },
  { href: '/v2/shop', label: 'ร้านค้า' },
]

function HomeBottomNav() {
  const { pathname } = useRouter()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center gap-3.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="flex h-[70px] items-center justify-center gap-2 rounded-2xl border-4 border-[rgba(216,143,169,0.4)] bg-v3-nav-dark p-2 backdrop-blur">
        {TABS.map((t) => {
          const active = t.href === '/v2' ? pathname === '/v2' : pathname.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} className={`grid w-[58px] place-items-center rounded-2xl py-2 text-sm font-semibold leading-5 ${active ? 'bg-v3-sapphire text-v3-lime' : 'text-v3-nav-label-off'}`}>
              {t.label}
            </Link>
          )
        })}
      </div>
      {/* Mate-AI navbar — hero mascot (01.png), lime label */}
      <Link href="/v2/service" aria-label="Mate AI" className="relative flex h-[70px] w-[74px] items-center justify-center overflow-visible rounded-2xl border-4 border-[rgba(216,143,169,0.4)] bg-gradient-to-r from-v3-mate-teal to-v3-mate-purple backdrop-blur">
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-t-[18px] bg-v3-lime px-4 text-sm font-black leading-5 text-v3-sapphire">Mate AI</span>
        <span className="absolute -bottom-2 left-1/2 h-[92px] w-[75px] -translate-x-1/2">
          <Image src="/images/v2/mascot/01-nav.png" alt="" fill sizes="75px" style={{ objectFit: 'contain', objectPosition: 'bottom' }} />
        </span>
      </Link>
    </nav>
  )
}

// ── Logout confirm modal (provisional per frozen) ────────────────────────────────────────────────
function LogoutModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="ยืนยันออกจากระบบ">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl">
        <p className="text-lg font-bold leading-7 text-v3-navy">ออกจากระบบหรือเปล่า?</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire">ยกเลิก</button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime">ออกจากระบบ</button>
        </div>
      </div>
    </div>
  )
}

export default V2HomeScreen
