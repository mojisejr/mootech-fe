// features/v2-home/components/V2HomeScreen.tsx — MuMate v2 logged-in HOME (slice-2, scope B: shell-first).
//
// PRESENTATIONAL — takes { greeting, mascotCharacter, onLogout } as props so goo's /v2 index wires the
// hooks (useV2Home / useV2Logout / useMascotFromCompute → 01.webp fallback) with zero file conflict.
// Layout = EVERY section per Figma node 333-6545 (won't be re-torn later); FEATURE content is
// placeholder/empty-state (scope B). Key invariants: BG CONTINUOUS through the full scroll (no seam),
// responsive @393 + no breakage / safe-area / long scroll.
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { formatThaiLongDate } from '@/utils/formate-date-thai'
import { HabitCard } from './sections/HabitCard'
import { PajeuSection } from './sections/PajeuSection'
import { SinseSection } from './sections/SinseSection'
import { CalendarMenu } from './CalendarMenu'
import { hrefById, type ServiceId } from '@/features/v2-service/services'
import { HeaderTools } from '@/features/v2-shell/components/AppHeader'
import type { MembershipLike } from '@/features/v2-shell/header-badge'
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { DailyFortuneCard, HOME_FACET_RESERVE, HOME_DATEROW_RESERVE } from '@/features/v2-shell/components/DailyFortuneCard'

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
  /** resolved character path, or the static hero fallback (/images/v2/mascot/01.webp) — goo wires it */
  mascotCharacter: string
  onLogout: () => void
  /** Zone 1 — goo wires useHomeFortune(); null = no data yet (graceful fallback) */
  fortune: DailyFortune | null
  fortuneLoading: boolean
  /** Contract #2 — goo wires useHomeElement(); elementTh null = no profile yet (row hidden, graceful).
   *  No loading flag: element comes from the same settled compute as the mascot (resolved before this
   *  screen mounts), so it is never "loading" here — too caught the skeleton branch as dead in prod. */
  element: ElementInfo
  /** Header contract — goo wires from UserGetById (one call, #165): the avatar image + whether to show the
   *  upgrade badge. goo DECIDES the payment rule (is_not_expired) and sends the boolean; the UI never
   *  computes it. Optional so goo's current /v2 compiles before the wire lands — the pre-wire default is
   *  "show badge + letter avatar" (a safe fallback, NOT a rule). */
  profile?: Profile
  /** Header badge input (#384). Absent / `isPaid: null` = not determined → NO pill (never the upsell).
   *  The PAGE composes this from the fetched user row, because that row is where "we could not tell" still
   *  exists — by the time the boolean profile is derived, the distinction is already gone. */
  membership?: MembershipLike | null
  /** Per-zone data-loading flags — goo wires from useV2Home. `true` = that zone's data is not in yet →
   *  draw a GREY BLOCK, ❌ NOT the 01.webp mascot fallback (ฟีม: one clean reveal, no fallback-then-swap
   *  flicker). `profile` un-greys when the user row lands; `mascot` (+ ธาตุ) waits for the chart — they
   *  resolve at different times, hence two flags.
   *
   *  REQUIRED, and deliberately so (μุน, against goo's `loading?`). An optional loading flag fails in the
   *  one direction that costs us: a caller that forgets it renders the FALLBACK-THEN-SWAP flicker ฟีม
   *  rejected, and nothing goes red — a silent pass. Required makes "forgot to wire it" a compile error
   *  instead of a shipped flicker. It costs one line at each of the two call sites (/v2 and the preview),
   *  which is the entire price of that guarantee. */
  loading: HomeScreenLoading
}

// grey-block flags goo wires (parallel). false → the zone shows its resolved data (or safe fallback).
export type HomeScreenLoading = { profile: boolean; mascot: boolean }

// ── the grey block ────────────────────────────────────────────────────────────────────────────────
// ONE primitive for every "this zone's data is not in yet" hole, so a skeleton can never drift into
// looking like content. Same ground + same pulse as FortuneSkeleton (which shipped first and is the model
// the card points at) — a screen with two different greys reads as two different states.
//
// It is a BLOCK, never a stand-in that resembles the real thing: ฟีม chose one clean reveal over
// fallback-then-swap, and the way a fallback sneaks back in is by looking plausible. Grey cannot.
function Skeleton({ className }: { className: string }) {
  return <span aria-hidden className={`block animate-pulse bg-v3-border-card ${className}`} />
}

// header data goo wires (parallel). pictureUrl null / onError → letter avatar.
//
// #384 — `showUpgrade: boolean` LEFT this type, and that removal IS the bug fix. The badge no longer reads a
// boolean derived from the user row, because that boolean had only two values for a question with three
// answers: on an /api/user error the hook settles with `user: null`, deriveHomeProfile answered
// `showUpgrade: true`, and a member who had paid was shown "อัพเกรด". Avatar and badge fail differently — a
// letter-avatar fallback is harmless, an upsell fallback is not — so they stopped sharing one flag.
export type Profile = { pictureUrl: string | null }
const PROFILE_FALLBACK: Profile = { pictureUrl: null }

const HERO_FALLBACK = '/images/v2/mascot/01.webp'

export function V2HomeScreen({ greeting, mascotCharacter, fortune, fortuneLoading, element, profile, membership, loading }: V2HomeScreenProps) {
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
        <Greeting name={greeting.name} mascotCharacter={mascotCharacter} element={element} profile={profile ?? PROFILE_FALLBACK} membership={membership} loading={loading} />
        {/* `fortuneLoading` is the WHOLE truth for this card, and that is a deliberate arrangement.
            It briefly wasn't: while the user row was in flight the hook reported loading=false with no
            fortune, so the card fell through to its empty state and announced "ยังไม่มีข้อมูลดวงวันนี้"
            over a request that had not finished. (Caught by eye at 320 in the DoD-5 strip, not by the
            machine leg — every column there was green, because a confidently wrong SENTENCE is not a
            layout defect.) I first patched it HERE, by or-ing in loading.profile. goo then fixed it at the
            source, where `user: null` stops being ambiguous between "still coming" and "errored".
            My patch is gone rather than kept as a harmless belt, and that is the point: with two places
            enforcing one rule, a regression in the hook would have been absorbed here and the gate would
            have stayed green while the source rule rotted. Verified as an arrangement, not assumed —
            removing this belt keeps the gate silent ✓, and removing goo's guard with the belt already
            gone turns it CLAIMED ✗. One owner for the rule, one tooth watching it. */}
        <ScoreRingCard fortune={fortune} loading={fortuneLoading} />
        <ManifestCard mascotCharacter={mascotCharacter} element={element} loading={loading.mascot} />
        <SomphongSection />
        <SianSection />
        <SinseSection />
        <PajeuSection />
      </div>

      <CalendarMenu state="default" />
    </div>
  )
}

// Greeting mascot with missing-FILE safety: a resolved character path can 404 (asset not yet in repo /
// on S3) — Next/Image onError swaps to the static hero. This is the frozen "fallback 01.webp" intent at
// the FILE level (goo's null-fallback covers "no compute"; this covers "path resolves but file missing").
function MascotImg({ src }: { src: string }) {
  const [current, setCurrent] = useState(src)
  return <Image src={current} alt="" fill sizes="28px" style={{ objectFit: 'contain' }} onError={() => setCurrent(HERO_FALLBACK)} />
}

// ── Greeting (Structure A — ฟีม 2026-07-26) ──────────────────────────────────────────────────────────
// The name must NEVER truncate (ฟีม). @393 the old single-row layout left only ~84px (6-7 Thai chars) for
// the name beside the right cluster → guaranteed cut. So: row1 = the "สวัสดีคุณ" LABEL (small, faded — a tag,
// not a headline) + the tools (badge/bell/avatar, no long text so they never squeeze anyone); row2 = the
// name at FULL width, bold, wrapping up to 2 lines (never truncated); row3 = the element line (unchanged).
function Greeting({ name, mascotCharacter, element, profile, membership, loading }: { name: string; mascotCharacter: string; element: ElementInfo; profile: Profile; membership?: MembershipLike | null; loading: HomeScreenLoading }) {
  return (
    // Home composes the shared right cluster DIRECTLY (<HeaderTools/>) instead of <AppHeader/>'s row.
    // Reason, found by looking at the render rather than the diff: AppHeader lays title and tools side by
    // side, so dropping Structure A into its `left` slot narrowed the whole column and the element line
    // started wrapping onto two lines. Structure A exists precisely so the NAME owns the full width
    // (ฟีม 2026-07-26 — a real name must never truncate); a shared header that quietly costs 96px of that
    // width defeats it. The genuinely shared thing is the CLUSTER, which is what this uses.
    //
    // The pill also changes skin here: it was lime + navy + rounded-full, Figma (636:12792) is grade-yellow +
    // cyan + r8 with a cyan glow. Correct pixels, and the UI still never computes the payment rule — but as
    // of #384 the input is `membership` (composed by the PAGE from the user row) rather than the boolean
    // `profile.showUpgrade`, because that boolean could not say "ไม่รู้" and so said "ยังไม่จ่าย" on error.
    <header data-testid="home-header" className="flex flex-col gap-1.5 py-4 font-ibm">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-v3-text-muted">สวัสดีคุณ</p>
        {loading.profile ? <HeaderToolsSkeleton /> : (
          <HeaderTools
            membership={membership}
            avatarName={name}
            avatarPictureUrl={profile.pictureUrl}
          />
        )}
      </div>
      {/* the name at FULL width, wrapping ≤2 lines — break-words handles long unbroken Thai so it can never
          overflow, line-clamp-2 caps the height.
          An EMPTY name renders a grey bar, not an empty h1: the pre-mount frame (<HomeSkeleton/>) cannot
          read the cookie, and a zero-height heading there would collapse the header and move everything
          below it on the very next frame — the layout jump this whole card exists to remove. */}
      {name
        ? <Link href="/v2/account" className="block w-fit"><h1 data-testid="greeting-name" className="line-clamp-2 break-words text-2xl font-bold leading-8 text-v3-navy">{name}</h1></Link>
        : <Skeleton className="my-1 h-6 w-40 rounded" />}
      <ElementLine mascotCharacter={mascotCharacter} element={element} loading={loading.mascot} />
    </header>
  )
}

// The right cluster while the user row is still in flight (loading.profile).
//
// 🔴 THE SAME TRAP AS THE MASCOT, ON A SECOND SURFACE — and the card only named the first one.
// <TopBarAvatar/> falls through to `01-nav.png` (the mascot) whenever there is no picture_url, so the
// un-skeletoned header does exactly what DoD 3 forbids: it shows a plausible stand-in and then swaps to
// the real photo. Greying the avatar closes it in the same move as the mascot, from the same flag.
//
// The BELL stays real: it is a static control, not user data, and it is the one thing in this row that is
// already true at frame 1. Skeletoning it would grey out something we know.
//
// The upgrade pill reserves its 84×32 as a grey block. That is a deliberate trade: a PAID member's row
// then loses the pill when the row lands (the label to its left widens; nothing moves vertically), which
// costs one horizontal reflow. The alternative — render nothing and let the pill appear for the majority
// who are unpaid — pays that same reflow for MORE people, and leaves a hole where DoD 3 asks for a block.
function HeaderToolsSkeleton() {
  return (
    <div data-testid="header-tools-skeleton" className="flex shrink-0 items-center gap-2">
      <Skeleton className="h-8 w-[84px] rounded-lg" />
      <TopBarBell variant="solid" href="/v2/calendar/notifications" />
      <Skeleton className="size-10 rounded-full" />
    </div>
  )
}

// notification panel — bottom sheet with a REAL empty state. PARKED, not deleted (Rule 1 · ฟีม 2026-07-29:
// "เอาหน้าเต็ม แล้วเอา modal เก็บไว้ก่อน เพราะหน้าเต็มคือหน้าที่ design มา"). The home bell now links to the
// full /v2/calendar/notifications page instead of opening this; kept here so re-instating the modal is a
// one-line re-wire, never a rebuild. (tsc does not enforce noUnusedLocals, so a parked local is clean.)
function NotificationPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="การแจ้งเตือน">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold leading-7 text-v3-navy">การแจ้งเตือน</h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-8 place-items-center rounded-full text-v3-text-muted hover:bg-v3-ghost-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="grid place-items-center gap-3 py-10 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-v3-ghost-white text-3xl">🔔</div>
          <p data-testid="notif-empty" className="text-sm font-medium leading-5 text-v3-text-muted">ยังไม่มีการแจ้งเตือน</p>
        </div>
      </div>
    </div>
  )
}

// element sub-line under the greeting. element comes from the same settled COMPUTE as the mascot
// (resolved before this screen mounts) → never "loading" here; too caught the old skeleton branch as
// dead in prod, so it's gone. Two states:
//   has data → "ธาตุของคุณคือ {ธาตุ} · {ดิถี}" (drop the "· ดิถี" if strengthLabel is null/blank — partial)
//   no data  → render NOTHING (hide the whole row — no orphan mascot beside empty text)
// The ดิถี band (persona/bazi) enhances IN later (or never, graceful) — element must NOT wait on bazi
// liveness (decision A w/ goo 2026-07-25). Copy-agnostic: renders whatever string goo emits (ground-truth ดิถี).
function ElementLine({ mascotCharacter, element, loading }: { mascotCharacter: string; element: ElementInfo; loading: boolean }) {
  // Loading is checked BEFORE the null-element branch on purpose. Both states have no element to show, but
  // they are different sentences: "ยังไม่มา" (a grey block, the row holds its place) vs "ไม่มี" (the row is
  // hidden entirely, the old behaviour). Collapsing them would make the row appear out of nowhere the
  // moment the chart lands — the same reveal-by-surprise the grey block exists to prevent.
  if (loading) {
    return (
      <div data-testid="element-line-skeleton" className="flex items-start gap-1.5">
        <Skeleton className="h-8 w-7 shrink-0 rounded" />
        <Skeleton className="mt-1 h-4 w-48 max-w-full rounded" />
      </div>
    )
  }
  if (!element.elementTh) return null
  return (
    // items-start: mascot stays top-aligned with line 1 when the text wraps to 2 lines on narrow screens.
    <div className="flex items-start gap-1.5">
      <span className="relative h-8 w-7 shrink-0">
        {/* missing-file safety (goo caught: characters/ empty → path 404s): fall back to static hero */}
        <MascotImg src={mascotCharacter} />
      </span>
      {/* The ดิถี band is GROUND-TRUTH bazi vocab (ดิถีแข็งเกินไป ฯลฯ) — must NEVER be clipped to fit (บอง).
          So WRAP, don't truncate: 1 line at ≥393, wraps to 2 at 360/320. min-w-0 lets it wrap in the flex row. */}
      <p data-testid="element-line" className="min-w-0 text-base font-bold leading-6 text-v3-text-body">
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
// (VERDICT_ARC moved into the shared <DailyFortuneCard/> with the donut it colours — one place, not two.)
// The Zone-1 skeleton MIRRORS <DailyFortuneCard variant="home"/> row for row — donut + headline, dashed
// rule, date row, dashed rule, two facet columns — using that card's own wrappers and line-heights.
//
// It did not, before this card. It drew the donut and two short bars and stopped, so the loading card
// stood 184px shorter than the loaded one and EVERY landmark below it — the manifest CTA, both ดวงสมพงค์
// cards, โหมดเซียน — slid down 184px the instant the fortune arrived (measured once with harness/archive/skeleton-shift.ts — 🗄️ archived by #321, nothing runs it automatically
// @393). Nobody had seen it, because until this PR home never showed this skeleton: the full-screen white
// gate covered the whole wait, and the short skeleton only ever flashed behind it. Removing the gate is
// what put it on the main path — so it is this PR's to fix, even though the code predates it.
//
// Row-for-row, not a magic height: the real card's text is variable-length (a 1-line or 2-line headline, a
// 1–3 line facet), so no fixed number could be right for every fortune. Mirroring its STRUCTURE means the
// two heights track each other when either changes, instead of agreeing once and drifting apart at the
// next edit. The residual on the standard fortune is measured and reported in the PR, not rounded to zero.
function SkeletonBar({ className }: { className: string }) {
  return <span className={`block rounded bg-v3-border-card ${className}`} />
}

function FortuneSkeleton({ empty }: { empty: boolean }) {
  return (
    <div className="flex animate-pulse flex-col gap-4" data-testid="zone1-skeleton-body">
      {/* donut + headline — the real row is `flex items-center gap-4`, headline text-lg/leading-6 ×2 lines */}
      <div className="flex items-center gap-4">
        <span className="block size-[90px] shrink-0 rounded-full bg-v3-border-card" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBar className="h-6 w-full" />
          <SkeletonBar className="h-6 w-3/5" />
        </div>
      </div>
      <hr className="border-dashed border-v3-border-card" />
      {/* date row — real: `flex items-center gap-4 text-base leading-6` (date + "เปิดปฏิทินของฉัน") */}
      <div className={`flex items-center gap-4 ${HOME_DATEROW_RESERVE}`}>
        <SkeletonBar className="h-6 min-w-0 flex-1" />
        <SkeletonBar className="h-6 w-[124px] shrink-0" />
      </div>
      <hr className="border-dashed border-v3-border-card" />
      {/* two facet columns — real: heading leading-6, then a line at mt-1 leading-[22px], divider between */}
      <div className="flex items-stretch gap-4">
        {/* the facet columns wear the CARD'S OWN reserve class (HOME_FACET_RESERVE), not a copy of its
            pixel value. Heights that must agree should be the same string in one place — a hand-copied
            66px here is a value that stays right until the day someone tunes the card and not this. */}
        <div className="min-w-0 flex-1">
          <SkeletonBar className="h-6 w-24" />
          <div className={`mt-1 space-y-1 ${HOME_FACET_RESERVE}`}>
            <SkeletonBar className="h-[22px] w-full" />
            <SkeletonBar className="h-[22px] w-4/5" />
          </div>
        </div>
        <div className="self-stretch border-l border-dashed border-v3-border-card" />
        <div className="min-w-0 flex-1">
          <SkeletonBar className="h-6 w-20" />
          <div className={`mt-1 space-y-1 ${HOME_FACET_RESERVE}`}>
            <SkeletonBar className="h-[22px] w-full" />
            <SkeletonBar className="h-[22px] w-3/5" />
          </div>
        </div>
      </div>
      {empty && <p className="mt-4 text-center text-sm font-medium text-v3-text-muted">ยังไม่มีข้อมูลดวงวันนี้</p>}
    </div>
  )
}

function ScoreRingCard({ fortune, loading }: { fortune: DailyFortune | null; loading: boolean }) {
  if (loading || !fortune) {
    return (
      <section data-testid="zone1-skeleton" className="mb-8 flex flex-col gap-4 rounded-[28px] bg-gradient-to-b from-white to-v3-cyan/20 p-6 shadow-sm">
        <FortuneSkeleton empty={!loading && !fortune} />
      </section>
    )
  }
  // The card body is now the SHARED <DailyFortuneCard/> (variant 'home' reproduces this screen's exact
  // render — same ground, same verdict-coloured arc, same one-line columns, same "เปิดปฏิทินของฉัน" link).
  // ปฏิทินดวง renders the same component with Figma's calendar variant, so the two screens can no longer
  // drift the way home's card and the calendar's little local card already had.
  return (
    <DailyFortuneCard
      variant="home"
      ring={{ grade: fortune.grade, percent: fortune.percent, verdict: fortune.verdict }}
      // strip a trailing "(เหมาะ NN%)" — the percent already lives in the donut, so the headline repeating
      // it is redundant (Figma shows it only once). Non-matching headlines pass through unchanged.
      headline={fortune.headline.replace(/\s*\(เหมาะ\s*\d+\s*%\)\s*$/, '').trim()}
      // #3: API "2026-06-01" → "1 มิถุนายน 2569" (พ.ศ.). If formatting fails, NEVER leak a raw ISO: a
      // malformed ISO-shaped string → hide; a non-ISO string (already formatted) → pass through.
      dateLine={formatThaiLongDate(fortune.date) || (/^\d{4}-\d{2}-\d{2}/.test(fortune.date) ? '' : fortune.date)}
      dateAside={<Link href="/v2/calendar" className="shrink-0 text-v3-sapphire underline">เปิดปฏิทินของฉัน</Link>}
      suitable={[fortune.best.text]}
      avoid={[fortune.worst.text]}
    />
  )
}

// ── Manifest / mascot card (Zone 2) ──────────────────────────────────────────────────────────────
// The card's gradient comes from the USER'S element (ดวง → มาสคอต → ธาตุ → สีพื้น, ฟีม's idea). ไม้ (wood)
// is EXACT from Figma; the other four are Lamun's PROPOSAL — kept in ONE map so ฟีม can swap without a
// rebuild. ⚠️ ไฟ/ดิน/ทอง/น้ำ AWAIT ฟีม's decision (see PR) — not final.
const ELEMENT_GRADIENTS: Record<string, { from: string; to: string }> = {
  'ไม้': { from: '#91d8d2', to: '#e0ffc4' }, // wood — Figma exact (LOCKED)
  'ไฟ': { from: '#f6a99f', to: '#ffe6c8' }, // fire — proposal (warm coral → peach)
  'ดิน': { from: '#e8cd94', to: '#fbf1d2' }, // earth — proposal (golden sand → cream)
  'ทอง': { from: '#cfd7e1', to: '#f3f6fb' }, // metal — proposal (soft silver → near-white)
  'น้ำ': { from: '#9cc5f1', to: '#d9edff' }, // water — proposal (sky → pale blue)
}
const WOOD_GRADIENT = ELEMENT_GRADIENTS['ไม้'] // default when elementTh is null/unknown — card is never colourless
// While the chart is still in flight the card must not wear an ELEMENT colour. WOOD is the settled-but-
// unknown default; using it during loading would paint a specific person's element (green) and then
// re-paint it (e.g. fire) the instant the chart lands — a whole-card colour flip, which is DoD 3's
// fallback-then-swap at the largest scale on the screen. Neutral grey cannot be mistaken for an element,
// so the single reveal stays single.
const LOADING_GRADIENT = { from: '#EDEEEF', to: '#F7F8F8' }

function ManifestCard({ mascotCharacter, element, loading }: { mascotCharacter: string; element: ElementInfo; loading: boolean }) {
  const g = loading ? LOADING_GRADIENT : (element.elementTh && ELEMENT_GRADIENTS[element.elementTh]) || WOOD_GRADIENT
  return (
    // overflow-hidden clips the overflowing mascot (intended). The mascot scales with the card (w-[48%]) so
    // the left lane stays proportional at 393/360/320 (a fixed 187px mascot cramped the title to 4 lines @320).
    <section className="relative mb-8 overflow-hidden rounded-[24px] py-6 pl-6 pr-5" style={{ background: `linear-gradient(to right, ${g.from}, ${g.to})` }}>
      {/* content — z ABOVE the mascot/coin so the button is always readable + clickable (ฟีม, all 60 mascots) */}
      <div className="relative z-10 flex flex-col items-start gap-3">
        {/* title wraps in the LEFT lane (max-w keeps it off the mascot) */}
        <p className="max-w-[54%] text-base font-bold leading-6 text-[#1f2937]">มานิเฟส สิ่งที่คุณปรารถนา แล้วปล่อยให้จักรวาลนำทาง</p>
        {/* button: single line, extends under the mascot (Figma ~198px > column) — on top (z-10) so it stays
            readable. spelling: ปรารถนา (Figma's ปราถนา is a typo).
            A1: now goes to the shared เร็วๆ นี้ page as มานิเฟส — the service exists in the catalog, the
            feature does not, so the honest destination is the one that says so by name. */}
        <Link href={hrefById('manifest')} className="inline-block whitespace-nowrap rounded-full bg-v3-sapphire px-6 py-2 text-center text-sm font-semibold uppercase leading-5 text-v3-lime">เพิ่มความปรารถนาของคุณ</Link>
      </div>
      {/* mascot from the chart — right-anchored + rotated + overflowing (clipped). pointer-events-none so a
          tap passes through to the button. onError → hero fallback (like MascotImg).
          Loading → the SAME box as a grey block, so the mascot arrives once, in place, at final size. */}
      {loading
        ? <div aria-hidden data-testid="manifest-mascot-skeleton" className="pointer-events-none absolute right-[-5.8%] top-[-22px] z-[1] aspect-[187/217] w-[52%] rotate-[7deg] animate-pulse rounded-2xl bg-black/5" />
        : <ManifestMascot src={mascotCharacter} />}
      {/* coin — decorative, bottom-right, gentle 2s float. pointer-events-none. reduced-motion → still. */}
      <Image src="/images/v2/zone2/coin.png" alt="" width={56} height={56} aria-hidden className="zone2-coin pointer-events-none absolute bottom-[-12px] right-[7%] z-[5] size-[56px]" />
      <style dangerouslySetInnerHTML={{ __html: `@keyframes zone2-coin{0%{transform:rotate(0) scale(1) translateY(0)}25%{transform:rotate(-3deg) scale(1.03) translateY(-3px)}50%{transform:rotate(0) scale(1.05) translateY(-6px)}75%{transform:rotate(3deg) scale(1.03) translateY(-3px)}100%{transform:rotate(0) scale(1) translateY(0)}}.zone2-coin{animation:zone2-coin 2s cubic-bezier(.45,0,.55,1) infinite;transform-origin:center}@media(prefers-reduced-motion:reduce){.zone2-coin{animation:none}}` }} />
    </section>
  )
}

// mascot inside the manifest card — same missing-file safety as MascotImg (404 → hero fallback).
function ManifestMascot({ src }: { src: string }) {
  const [current, setCurrent] = useState(src)
  return (
    <div aria-hidden data-testid="manifest-mascot" className="pointer-events-none absolute right-[-5.8%] top-[-22px] z-[1] aspect-[187/217] w-[52%] rotate-[7deg]">
      <Image src={current} alt="" fill sizes="187px" style={{ objectFit: 'contain' }} onError={() => setCurrent(HERO_FALLBACK)} />
    </div>
  )
}

// ── Zone 3: ดวงสมพงค์ (mindful-moments-section, Figma 421:826) ──────────────────────────────────────
// Full-bleed bubble bg + white mounds top/bottom · 2 cards (love=pink / colleague=purple) with mascots
// FIXED per Figma (NOT the user's chart — unlike Zone 2) + radial circles + a beating heart. Heavy 2s-loop
// animation (10 mascots) with a prefers-reduced-motion guard. Destinations not wired (ฟีม: UI เป๊ะก่อน).
const COLLEAGUE_MASCOTS = ['04_เถาะ-ไฟ', '04_เถาะ-ไม้', '05_มะโรง-ดิน', '05_มะโรง-ไม้', '06_มะเส็ง-ทอง', '06_มะเส็ง-ไฟ', '06_มะเส็ง-ดิน']
const COLLEAGUE_DELAY = [0.05, 0.125, 0.2, 0.275, 0.35, 0.425, 0.5] // staggered appear (~0.075s apart)
const COLLEAGUE_LIFT = [10, 5, 0, 0, 0, 5, 10] // px: raise outer mascots into a back row → layered huddle (Figma)
const charSrc = (n: string) => `/images/v2/characters/${n}.webp`

function SomphongSection() {
  return (
    <section className="relative -mx-4 mb-6 overflow-hidden px-4 py-14">
      <Image src="/images/v2/zone3/section-bg.jpg" alt="" fill priority sizes="100vw" aria-hidden className="pointer-events-none -z-10 object-cover" />
      {/* white mound: top (flipped vertical) + bottom — full-bleed, overflowing both edges */}
      <SomphongMound className="top-0 -scale-y-100" />
      <SomphongMound className="bottom-0" />
      <h2 className="text-xl font-bold leading-7 text-[#0B305B]">ดวงสมพงค์</h2>
      {/* 2 FIXED lines per Figma (was one long flowing string) */}
      <p className="mt-2 text-sm font-medium leading-5 text-[#464646]">
        เช็คความเข้ากันของคุณกับคนพิเศษ ดูดวงคู่ครอง
        <br />
        ทั้งความรัก การเงิน สุขภาพ เพื่อเสริมดวงคู่ให้แข็งแกร่ง
      </p>
      <div className="mt-4 flex gap-2">
        <SomphongCard title="ดูดวงคู่รัก" bg="#FBD9E7" radial="pink" href="/v2/service/compatibility/love">
          {/* Figma 421:826: LEFT = ไฟ (พลิกซ้ายขวา, z3-rock-r) · RIGHT = ไม้ (+7°, z3-rock-l) · หัวใจ chest-height ระหว่างคู่ */}
          <div className="absolute inset-x-1 bottom-1 z-[5] flex items-end justify-center">
            <Zone3Mascot name="01_ชวด-ไฟ" className="z3-rock-r h-[92px] w-[78px]" />
            <img src="/images/v2/zone3/icon-somphong-vector.svg" alt="" aria-hidden className="z3-heart mx-[-10px] mb-7 h-6 w-6 shrink-0" />
            <Zone3Mascot name="01_ชวด-ไม้" className="z3-rock-l h-[92px] w-[78px]" />
          </div>
        </SomphongCard>
        <SomphongCard title="ดูดวงเพื่อนร่วมงาน" bg="#ECD9FB" radial="purple" href="/v2/service/compatibility/colleague">
          {/* 7 มาสคอตเป็นกลุ่มแน่น (huddle) เต็มครึ่งล่างการ์ด — outer ยกขึ้นเป็นแถวหลัง (COLLEAGUE_LIFT) */}
          <div className="absolute inset-x-0 bottom-1 z-[5] flex items-end justify-center">
            {COLLEAGUE_MASCOTS.map((n, i) => (
              <Zone3Mascot key={n} name={n} className="z3-pop -mx-[16px] h-[60px] w-[50px]" style={{ animationDelay: `${COLLEAGUE_DELAY[i]}s`, marginBottom: COLLEAGUE_LIFT[i] }} />
            ))}
          </div>
        </SomphongCard>
      </div>
      <Link href="/v2/service" className="mx-auto mt-4 block w-fit rounded-full border border-[#1455A4] px-6 py-2 text-center text-sm font-semibold uppercase leading-5 text-[#1455A4]">ดูบริการทั้งหมด</Link>
      <SomphongKeyframes />
    </section>
  )
}

// full-bleed white wave (reuses the WhiteMoundDivider shape), 451px wide overflowing both edges.
function SomphongMound({ className }: { className: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 z-0 h-7 w-[451px] max-w-none -translate-x-[29px] text-v3-bg-cream ${className}`}>
      <svg viewBox="0 0 451 27" preserveAspectRatio="none" className="h-full w-full" fill="currentColor"><path d="M0 27 V10 Q112 -6 225 8 T451 10 V27 Z" /></svg>
    </div>
  )
}

// A2/A3: the whole card is the tap target (it always looked like one). `href` is a prop, not a constant,
// because the two cards differ ONLY by it — a card that knew its own destination would make the pair
// indistinguishable in the place where they actually differ.
function SomphongCard({ title, bg, radial, href, children }: { title: string; bg: string; radial: 'pink' | 'purple'; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative block h-[150px] flex-1 overflow-hidden rounded-2xl px-4 py-6" style={{ backgroundColor: bg }}>
      {/* radial circles behind (real SVG, ฟีม: not CSS) */}
      <img src={`/images/v2/zone3/radial-group-${radial}.svg`} alt="" aria-hidden className="pointer-events-none absolute -left-[43px] -top-[9px] z-0 w-[262px] max-w-none" />
      {radial === 'pink' && <img src="/images/v2/zone3/radial-group-pink.svg" alt="" aria-hidden className="pointer-events-none absolute left-[130px] -top-[48px] z-0 w-[150px] max-w-none opacity-80" />}
      <h3 className="relative z-10 text-base font-bold uppercase leading-6 text-[#0B305B]">{title}</h3>
      {children}
    </Link>
  )
}

// fixed mascot with missing-file safety (404 → hero), for the Zone-3 cards.
function Zone3Mascot({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const [broken, setBroken] = useState(false)
  return <img src={broken ? HERO_FALLBACK : charSrc(name)} alt="" aria-hidden onError={() => setBroken(true)} style={style} className={`pointer-events-none shrink-0 object-contain ${className ?? ''}`} />
}

function SomphongKeyframes() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
    @keyframes z3-heart{0%{transform:scale(1) translateY(0)}25%{transform:scale(1.2) translateY(-5px)}50%{transform:scale(1) translateY(0)}75%{transform:scale(1.15) translateY(-3px)}100%{transform:scale(1) translateY(0)}}
    @keyframes z3-rl{0%,100%{transform:rotate(7deg) translate(0,0)}50%{transform:rotate(10deg) translate(5px,-4px)}}
    @keyframes z3-rr{0%,100%{transform:scaleX(-1) rotate(8.55deg) translate(0,0)}50%{transform:scaleX(-1) rotate(11.55deg) translate(5px,-4px)}}
    @keyframes z3-pop{0%{opacity:0;transform:scale(.85) translateY(15px)}30%,100%{opacity:1;transform:scale(1) translateY(0)}65%{transform:scale(1) translateY(-4px)}}
    .z3-heart{animation:z3-heart 2s cubic-bezier(.34,1.56,.64,1) infinite;transform-origin:center;will-change:transform}
    .z3-rock-l{transform:rotate(7deg);animation:z3-rl 2s ease-in-out infinite;transform-origin:bottom center;will-change:transform}
    .z3-rock-r{transform:scaleX(-1) rotate(8.55deg);animation:z3-rr 2s ease-in-out infinite;transform-origin:bottom center;will-change:transform}
    .z3-pop{animation:z3-pop 2s ease-in-out infinite;will-change:transform,opacity}
    /* reduced-motion: stop the animation but KEEP each element's base transform (on the class, not only the
       keyframe) — z3-rock-l/r carry rotate/flip, so a blanket transform:none un-tilts + un-flips the rats.
       z3-heart/z3-pop rest at identity, so dropping transform:none is safe for them. */
    @media(prefers-reduced-motion:reduce){.z3-heart,.z3-rock-l,.z3-rock-r,.z3-pop{animation:none!important;opacity:1!important}}
  `,
      }}
    />
  )
}

// ── Zone 4 — โหมดเซียน (mindful-moments-section · Figma 333:6885) ──────────────────────────────────
// The blue habit-card is the shared <HabitCard/> (with the 3-piece cohort motion); this section adds the
// header, the 3 property cards, and the tertiary CTA around it.
// `lines` is DISPLAY copy, broken to fit a narrow card — it is not the service name and must never be
// joined back into one ("เสี่ยงไพ่ออราเคิลเคี้ยงคุง" has no space where the line break is). `serviceId`
// is what travels; the title comes from the catalog. See comingSoonHrefById.
const SIAN_CARDS: { icon: string; lines: string[]; serviceId: ServiceId }[] = [
  { icon: 'icon-oracle', lines: ['เสี่ยงไพ่', 'ออราเคิล', 'เคี้ยงคุง'], serviceId: 'oracle-kiang' },
  { icon: 'icon-spirit', lines: ['เสี่ยงไพ่', 'จิตวิญญาณ', 'แดนสวรรค์'], serviceId: 'spirit-heaven' },
  { icon: 'icon-sian', lines: ['เสี่ยงเซียน', 'เสี่ยงทาย'], serviceId: 'sian' },
]

function SianSection() {
  return (
    <section className="mb-6 flex w-full flex-col items-center gap-2">
      {/* section-header (left) */}
      <div className="flex w-full flex-col gap-2 pb-2">
        <h2 className="text-xl font-bold leading-7 text-v3-navy">โหมดเซียน</h2>
        <p className="text-sm font-medium leading-5 text-v3-text-body">
          ปลดล็อกพลังทำนายขั้นสูง วิเคราะห์ดวงชะตาแบบเจาะลึก
          <br />
          รู้ก่อน เตรียมพร้อมก่อน ด้วยระบบ AI ระดับเซียน
        </p>
      </div>
      {/* habit-card (big blue) — shared component, now with the 3-piece cohort motion (Zone 4 + Zone 6) */}
      <HabitCard
        // 112x120.8 keeps roughly the visual weight of the 97.94x142.46 rectangle it replaces (same area at
        // the artwork's own 536:578 ratio) — a near-square book at the old WIDTH would have read as smaller.
        art={{ src: '/images/v2/home/%E0%B8%A0%E0%B8%B2%E0%B8%9E%E0%B8%AB%E0%B8%99%E0%B8%B1%E0%B8%87%E0%B8%AA%E0%B8%B7%E0%B8%AD.webp', w: 112, h: 120.8 }}
        // the card's mascots stay: the 水 printed on the cover is visibly smaller than the card's own, so the
        // two read as foreground and background (ฟีม's call after seeing the real route).
        smallMascotAt={{ xPct: 56, yPct: -14 }}
        title="หนังสือเล่มเดียวในโลก"
        desc={
          <>
            วิเคราะห์ดวงชะตาเชิงลึก
            <br />
            รวบรวมเป็นหนังสือส่วนตัว
          </>
        }
        cta={{ variant: 'primary', label: 'ซื้อเลย', href: hrefById('one-book') }}
      />
      {/* 3 property cards (pastel-blue) */}
      <div className="flex w-full gap-2">
        {SIAN_CARDS.map((c) => (
          <Link key={c.icon} href={hrefById(c.serviceId)} className="flex flex-1 self-stretch rounded-2xl bg-v3-pastel-blue p-4">
            <div className="flex flex-1 flex-col justify-start gap-2">
              <img src={`/images/v2/zone4/${c.icon}.svg`} alt="" aria-hidden className="size-8" />
              <p className="text-sm font-semibold uppercase leading-5 text-v3-navy">
                {c.lines.map((l) => (
                  <span key={l} className="block leading-5">{l}</span>
                ))}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <Link href="/v2/service" className="mx-auto block w-fit rounded-full border border-v3-sapphire px-6 py-2 text-center text-sm font-semibold uppercase leading-5 text-v3-sapphire">
        ดูบริการทั้งหมด
      </Link>
    </section>
  )
}

// (ServiceSection + SinseCard removed 2026-07-28 — Zones 4/5/6 now render real sections SianSection ·
//  SinseSection · PajeuSection; the two empty-placeholder frames were dead. Git history preserves them.)

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

// (Bottom nav extracted 2026-07-28 → features/v2-home/components/CalendarMenu.tsx — a shared multi-state menu
//  used by home + the calendar flow. Home renders <CalendarMenu state="default" />. Git history preserves the
//  inline HomeBottomNav.)

// ── Logout confirm modal (provisional per frozen) ────────────────────────────────────────────────
export default V2HomeScreen
