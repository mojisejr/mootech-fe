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
import { formatThaiLongDate } from '@/utils/formate-date-thai'

// Zone 1 daily-fortune (bazi /api/home). goo wires useHomeFortune() → this shape; I compose against it.
export type DailyFortune = {
  percent: number // 0–100 → ring fill
  grade: string // gradeForPercent(percent) — goo
  verdict: 'good' | 'neutral' | 'caution' // → ring colour (green / yellow / orange)
  headline: string // summaryHeadline → message
  date: string // fortune.date
  best: { text: string } // ⭐ เหมาะกับวันนี้
  worst: { text: string } // ⚠️ ควรเลี่ยง
}

// Contract #2 (greeting element line) — goo wires useHomeElement() → this shape; I render it copy-agnostic.
// strengthLabel is the GROUND-TRUTH bazi vocab (ดิถีแข็ง/อ่อน/สมดุล — ฟีม's call 2026-07-25), NOT Figma's
// "แข็งแรง". The component renders whatever string arrives — the vocab decision lives at the data layer.
export type ElementInfo = {
  elementTh: string | null // ธาตุ e.g. "ไม้" — null = no profile/compute yet
  strengthLabel: string | null // ดิถี band — null = not computed (render element alone, drop the "·")
}

export type V2HomeScreenProps = {
  greeting: { name: string }
  /** resolved character path, or the static hero fallback (/images/v2/mascot/01.png) — goo wires it */
  mascotCharacter: string
  onLogout: () => void
  /** Zone 1 — goo wires useHomeFortune(); null = no data yet (graceful fallback) */
  fortune: DailyFortune | null
  fortuneLoading: boolean
  /** Contract #2 — goo wires useHomeElement(); elementTh null = no profile yet (row hidden, graceful).
   *  No loading flag: element comes from the same settled compute as the mascot (resolved before this
   *  screen mounts), so it is never "loading" here — too caught the skeleton branch as dead in prod. */
  element: ElementInfo
}

const HERO_FALLBACK = '/images/v2/mascot/01.png'

export function V2HomeScreen({ greeting, mascotCharacter, onLogout, fortune, fortuneLoading, element }: V2HomeScreenProps) {
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
        <Greeting name={greeting.name} mascotCharacter={mascotCharacter} onAvatarTap={() => setLogoutOpen(true)} element={element} />
        <ScoreRingCard fortune={fortune} loading={fortuneLoading} />
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
function Greeting({ name, mascotCharacter, onAvatarTap, element }: { name: string; mascotCharacter: string; onAvatarTap: () => void; element: ElementInfo }) {
  return (
    <header className="flex flex-col gap-2 py-4">
      {/* #1: top row = name (truncates) + อัพเกรด badge + bell + avatar on ONE line. ElementLine (goo's #2)
          drops BELOW at full width so "ธาตุ · ดิถี" isn't squeezed by the right cluster (Figma layout). */}
      <div className="flex items-center gap-2">
        {/* smaller than the old text-2xl + truncate so a long name can't push the right cluster or wrap */}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold leading-7 text-v3-navy">สวัสดีคุณ{name}</h1>
        {/* อัพเกรด badge slot (Figma 477:4543 — navy on lime). Not wired this zone (slot). */}
        <button type="button" className="shrink-0 rounded-full bg-v3-lime px-3 py-1.5 text-sm font-bold leading-5 text-v3-navy">อัพเกรด</button>
        {/* notification bell */}
        <button type="button" aria-label="การแจ้งเตือน" className="grid size-10 shrink-0 place-items-center rounded-full bg-v3-cyan text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        </button>
        {/* avatar → tap = logout confirm (frozen decision) */}
        <button type="button" aria-label="โปรไฟล์" onClick={onAvatarTap} className="grid size-10 shrink-0 place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-white">
          {name.trim().charAt(0) || 'F'}
        </button>
      </div>
      <ElementLine mascotCharacter={mascotCharacter} element={element} />
    </header>
  )
}

// element sub-line under the greeting. element comes from the same settled COMPUTE as the mascot
// (resolved before this screen mounts) → never "loading" here; too caught the old skeleton branch as
// dead in prod, so it's gone. Two states:
//   has data → "ธาตุของคุณคือ {ธาตุ} · {ดิถี}" (drop the "· ดิถี" if strengthLabel is null/blank — partial)
//   no data  → render NOTHING (hide the whole row — no orphan mascot beside empty text)
// The ดิถี band (persona/bazi) enhances IN later (or never, graceful) — element must NOT wait on bazi
// liveness (decision A w/ goo 2026-07-25). Copy-agnostic: renders whatever string goo emits (ground-truth ดิถี).
function ElementLine({ mascotCharacter, element }: { mascotCharacter: string; element: ElementInfo }) {
  if (!element.elementTh) return null
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative h-8 w-7 shrink-0">
        {/* missing-file safety (goo caught: characters/ empty → path 404s): fall back to static hero */}
        <MascotImg src={mascotCharacter} />
      </span>
      <p data-testid="element-line" className="truncate text-base font-bold leading-6 text-v3-text-body">
        ธาตุของคุณคือ {element.elementTh}
        {/* trim-guard: a whitespace-only band (" ") is truthy but paints an orphan " · " — drop it.
            goo closes this at the data layer (too's whitespace bare-bullet catch); this is the visual belt. */}
        {element.strengthLabel?.trim() ? ` · ${element.strengthLabel.trim()}` : ''}
      </p>
    </div>
  )
}

// ── Score-ring card (daily-session) ─────────────────────────────────────────────────────────────
// verdict → ring colour. good=green(teal) · neutral=yellow · caution=orange. (Figma's lime donut is
// replaced by a verdict-coloured arc — the lime bg would hide a lime/neutral arc; verdict must read.)
const VERDICT_ARC: Record<DailyFortune['verdict'], string> = {
  good: 'text-v3-cyan',
  neutral: 'text-v3-lime',
  caution: 'text-v3-pumpkin',
}

function ScoreRingCard({ fortune, loading }: { fortune: DailyFortune | null; loading: boolean }) {
  return (
    <section className="mb-8 flex flex-col gap-4 rounded-[28px] bg-gradient-to-b from-white to-v3-cyan/20 p-6 shadow-sm">
      {loading || !fortune ? (
        <FortuneSkeleton empty={!loading && !fortune} />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <ScoreDonut grade={fortune.grade} pct={fortune.percent} verdict={fortune.verdict} />
            <p className="min-w-0 flex-1 text-lg font-bold leading-6 text-v3-navy">{fortune.headline}</p>
          </div>
          {/* #4: dashed dividers per Figma (was solid hr) */}
          <hr className="border-dashed border-v3-border-card" />
          <div className="flex items-center gap-4 text-base font-bold leading-6">
            {/* #3: API "2026-06-01" → "1 มิถุนายน 2569" (พ.ศ.); fall back to the raw string if malformed */}
            <p data-testid="fortune-date" className="min-w-0 flex-1 text-v3-navy">{formatThaiLongDate(fortune.date) || fortune.date}</p>
            {/* calendar link kept, NOT wired this zone (ฟีม: skip) */}
            <Link href="/v2/calendar" className="shrink-0 text-v3-sapphire underline">เปิดปฏิทินของฉัน</Link>
          </div>
          <hr className="border-dashed border-v3-border-card" />
          <div className="flex items-stretch gap-4">
            {/* #4: check/x-circle icons (Figma 333-6585/6596), not emoji · vertical dashed divider between chips */}
            <FortuneChip heading="เหมาะกับวันนี้" text={fortune.best.text} tone="cyan" icon="check" />
            <div className="self-stretch border-l border-dashed border-v3-border-card" />
            <FortuneChip heading="ควรเลี่ยง" text={fortune.worst.text} tone="pumpkin" icon="cross" />
          </div>
        </>
      )}
    </section>
  )
}

function ScoreDonut({ grade, pct, verdict }: { grade: string; pct: number; verdict: DailyFortune['verdict'] }) {
  const r = 40
  const c = 2 * Math.PI * r
  // clamp ONCE (goo รู1): out-of-range data (pct>100 / <0) must never overflow the arc OR the label — the
  // ring can't fill past full, and the number the user reads can't say "150%". Same clamp drives both.
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className={`relative grid size-[90px] shrink-0 place-items-center ${VERDICT_ARC[verdict]}`}>
      <svg width="90" height="90" viewBox="0 0 90 90" className="absolute -rotate-90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
      </svg>
      <div className="relative text-center text-v3-navy">
        <p data-testid="fortune-grade" className="text-2xl font-bold leading-8">{grade}</p>
        <p data-testid="fortune-pct" className="text-sm leading-[22px]">{p}%</p>
      </div>
    </div>
  )
}

// #4: circle icons per Figma (333-6585 check / 333-6596 x), stroke idiom matching the greeting bell.
// currentColor → inherits the chip tone (เหมาะ=cyan / เลี่ยง=pumpkin).
function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4L15 9" /></svg>
  )
}
function XCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></svg>
  )
}

function FortuneChip({ heading, text, tone, icon }: { heading: string; text: string; tone: 'cyan' | 'pumpkin'; icon: 'check' | 'cross' }) {
  // empty-facet guard (goo รู2): a fortune can arrive with percent but no facets → text = "" (empty, not
  // null). goo guarantees non-empty at the data layer; this is the visual belt — an empty facet renders a
  // graceful "—", never a bare icon with nothing beside it (which reads as broken).
  const body = text.trim() || '—'
  const toneClass = tone === 'cyan' ? 'text-v3-cyan' : 'text-v3-pumpkin'
  return (
    <div className="min-w-0 flex-1">
      <p className={`text-base font-bold leading-6 ${toneClass}`}>{heading}</p>
      <p className="mt-1 flex items-start gap-1.5 text-sm leading-[22px] text-v3-text-body">
        <span aria-hidden className={`mt-0.5 shrink-0 ${toneClass}`}>{icon === 'check' ? <CheckCircleIcon /> : <XCircleIcon />}</span>
        <span data-testid="fortune-chip" className="min-w-0">{body}</span>
      </p>
    </div>
  )
}

function FortuneSkeleton({ empty }: { empty: boolean }) {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-4">
        <div className="size-[90px] shrink-0 rounded-full bg-v3-border-card" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-4/5 rounded bg-v3-border-card" />
          <div className="h-4 w-3/5 rounded bg-v3-border-card" />
        </div>
      </div>
      {empty && <p className="mt-4 text-center text-sm font-medium text-v3-text-muted">ยังไม่มีข้อมูลดวงวันนี้</p>}
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
