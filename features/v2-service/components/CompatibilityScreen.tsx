// features/v2-service/components/CompatibilityScreen.tsx — ดวงสมพงศ์ Slice 1, V3 UI (Figma 480:4549 / 636:18451).
// COMPOSES goo's useCompatibility (the locked logic seam) — every data-testid from his skeleton is preserved
// so his run-compatibility anchor still asserts the contract THROUGH this real UI. One screen, TWO states
// (differ only in row 2 + the button colour), NOT two screens.
//
// DELIBERATE divergences from Figma, by ฟีม's ruling (2026-07-29) — recorded here + in evidence, like ซินแส #145:
//  • hero "เช็คความสมพงค์" (Figma, ค์) → "เช็คความสมพงศ์" (ศ์) · tagline "ด้านความความรัก" (Figma, doubled
//    "ความ") → "ด้านความรัก". Figma still shows the typos; these strings INTENTIONALLY differ, ฟีม-ordered.
//  • person1 "แก้ไข" (edit your own birth info) is in the Figma but NOT in Slice 1's real-work list (select +
//    create only; no self-edit API is wired). Rendered per Figma; wired to a placeholder "เร็วๆ นี้" sheet so
//    it is honest (never a dead-silent button), pending บอง's call on where self-edit lands.
import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '@/features/v2-shell/components/TopBarAvatar'
import { LogoutModal } from '@/features/v2-shell/components/LogoutModal'
import { LoadingScreen } from '@/features/v2-shell/components/LoadingScreen'
import { useV2Logout } from '@/features/auth/hooks/useV2Logout'
import { useCompatibility, type CompatPerson } from '../hooks/useCompatibility'
import { calculateCompatibility } from '../hooks/useCompatibilityResult'
import type { CompatibilityConfig } from '../compatibility'
import { formatCompatBirth } from './compat-format'
import { COMPAT_CALC_LOADING } from './compat-loading-copy'
import { CompatSelectFriendModal } from './CompatSelectFriendModal'
import { AddFriendSheet } from './AddFriendSheet'
import { ComingSoonSheet } from './ComingSoonSheet'

function BackChevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function Sparkles() {
  // Figma ✨ (480:5356) — a 2-star sparkle. Inline (project convention: icons local, no lib).
  return (
    <svg viewBox="0 0 37 37" className="size-[37px]" fill="none" aria-hidden>
      <path d="M23 6l2.2 5.8L31 14l-5.8 2.2L23 22l-2.2-5.8L15 14l5.8-2.2L23 6Z" fill="#1B9AAF" />
      <path d="M11 19l1.3 3.5L16 24l-3.7 1.5L11 29l-1.3-3.5L6 24l3.7-1.5L11 19Z" fill="#E1FF00" stroke="#1B9AAF" strokeWidth="0.8" />
    </svg>
  )
}

// one profile row — Figma 636:18668 (filled) / 636:17787 (empty). `variant` picks the surface + empty CTA.
function ProfileRow({ person, loadingDob, onEdit, onPick, testId, emptyLabel }: {
  person: CompatPerson | null
  loadingDob?: boolean
  onEdit: () => void
  onPick?: () => void
  testId: 'compat-person1' | 'compat-person2'
  emptyLabel?: string
}) {
  if (!person) {
    // empty state (person2 only) — lemon-chiffon pill, dashed "+" circle, sapphire uppercase CTA
    return (
      <button type="button" onClick={onPick} data-testid={testId} className="flex h-[60px] w-full items-center gap-3 overflow-hidden rounded-[56px] bg-v3-lemon-chiffon pl-2.5 pr-4 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-v3-sapphire bg-white text-v3-sapphire">
          <svg viewBox="0 0 18 18" className="size-[18px]" fill="none" aria-hidden><path d="M9 3.75v10.5M3.75 9h10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </span>
        <span data-testid="compat-person2-empty" className="text-[16px] font-bold uppercase leading-6 text-v3-sapphire">{emptyLabel}</span>
      </button>
    )
  }
  const isP1 = testId === 'compat-person1'
  return (
    <section data-testid={testId} className="flex w-full items-center gap-3 overflow-hidden rounded-[56px] bg-v3-ghost-white py-3 pl-3 pr-6">
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white">
        {person.imageProfile
          ? <Image src={person.imageProfile} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
          : <span>{person.name.trim().charAt(0) || '?'}</span>}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 text-v3-navy">
        <p data-testid={`${testId}-name`} className="truncate text-[16px] font-bold leading-6">{person.name}</p>
        {loadingDob
          ? <span data-testid="compat-person2-dob-loading" className="h-[14px] w-32 animate-pulse rounded bg-v3-ghost-white brightness-95" aria-hidden />
          : <p data-testid={isP1 ? 'compat-person1-dob' : 'compat-person2-dob'} className="text-[14px] font-normal leading-[22px]">{formatCompatBirth(person.dob, person.time)}</p>}
        {isP1 && <span data-testid="compat-person1-time" className="sr-only">{person.time}</span>}
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-[14px] font-bold leading-5 text-v3-sapphire">แก้ไข</button>
    </section>
  )
}

export function CompatibilityScreen({ config }: { config: CompatibilityConfig }) {
  const c = useCompatibility(config)
  const { logout } = useV2Logout()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [selectOpen, setSelectOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [comingSoon, setComingSoon] = useState<string | null>(null)
  const router = useRouter()
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState(false)
  // Fire-once latch. calculateCompatibility has NO in-flight guard of its own (it consumes the user's
  // matching quota + writes a log row), and the hook's comment hands that guard to THIS state machine.
  // A `calculating` state var alone is racy: a synchronous double-tap re-enters onViewResult before the
  // re-render, so its closure still sees calculating=false and fires twice. A ref latches in the SAME
  // tick → the second tap short-circuits. (D33: still fired from here, once — the call site is unchanged.)
  const firingRef = useRef(false)

  // The view-result flow (μุน's lane per goo's 2C note): fire the side-effecting calc ONCE, then cover the
  // whole form with the loader (2F/D30) so the wait shows here — where the heavy work actually is — instead
  // of behind the button. On success navigate to the result route; on error KEEP the user on this screen,
  // release the latch, and surface it (D34 — never strand on the loader, never navigate to a blank result).
  async function onViewResult() {
    if (!c.canViewResult || firingRef.current || !c.person1 || !c.person2) return
    firingRef.current = true
    setCalculating(true)
    setCalcError(false)
    const res = await calculateCompatibility(c.person1, c.person2, c.matchingType)
    if (res.ok) {
      // leaving this screen — keep the latch closed so nothing can re-fire during the navigate
      router.push(`/v2/service/compatibility/result/${res.matchingId}`)
    } else {
      firingRef.current = false
      setCalculating(false)
      setCalcError(true)
    }
  }

  // 2F/D30+D32: while the calc is in flight, replace the whole form with the SAME loader (SAME copy, D35)
  // the result screen uses. Client-nav to the result page keeps this loader painted until the result
  // mounts its own identical loader → one continuous wait, no white flash between the two screens.
  if (calculating) {
    return <LoadingScreen title={COMPAT_CALC_LOADING.title} subtitle={COMPAT_CALC_LOADING.subtitle} />
  }

  return (
    <div data-testid="compat-screen" data-matching-type={c.matchingType} className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      {/* BG01 hero fading into the ground (same continuity pattern as home/service) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[365px] select-none">
        <Image src="/images/v2/bg/BG01.png" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'top center' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-v3-bg-cream/40 to-v3-bg-cream" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col px-4 pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* header — back · title · shared TopBar bell(→ full notifications) + avatar(→ logout) */}
        <header className="flex items-center gap-2 py-2">
          <Link href="/v2/service" aria-label="ย้อนกลับ" className="grid size-8 shrink-0 place-items-center rounded-full text-v3-navy"><BackChevron /></Link>
          <h1 data-testid="compat-title" className="min-w-0 flex-1 truncate text-[24px] font-bold leading-8 text-v3-navy">{c.title}</h1>
          <TopBarBell variant="solid" href="/v2/calendar/notifications" />
          <TopBarAvatar variant="sapphire" onClick={() => setLogoutOpen(true)} />
        </header>

        {/* hero — sparkles + heading + tagline (verbatim Figma; spelling flagged in the header comment) */}
        <div className="flex flex-col items-center gap-2 px-6 pb-4 pt-8 text-center">
          <Sparkles />
          <h2 className="text-[32px] font-semibold uppercase leading-[1.5] text-v3-navy [word-break:break-word]">เช็คความสมพงศ์</h2>
          <p className="text-[16px] font-normal leading-6 text-v3-text-body [word-break:break-word]">
            เลือกโปรไฟล์สองโปรไฟล์เพื่อดูดวงสมพงศ์<br />ด้านความรักหรือมิตรภาพ
          </p>
        </div>

        {/* the two rows + button + link */}
        <div className="flex flex-col items-center gap-3 px-6">
          {/* row 1 — คุณ (real user). loading → skeleton the whole row's name */}
          {c.loadingPerson1
            ? <div data-testid="compat-person1" className="flex h-[64px] w-full items-center gap-3 rounded-[56px] bg-v3-ghost-white py-3 pl-3 pr-6"><span data-testid="compat-person1-loading" className="size-10 shrink-0 animate-pulse rounded-full bg-white/60" /><span className="h-4 w-40 animate-pulse rounded bg-white/60" /></div>
            : <ProfileRow person={c.person1} onEdit={() => setComingSoon('แก้ไขข้อมูลของคุณ')} testId="compat-person1" />}

          {/* row 2 — เลือกเพื่อน/คู่รัก → wrapped v1 modal; filled → name+picture now, dob enriches (skeleton) */}
          <ProfileRow person={c.person2} loadingDob={c.loadingPerson2} onEdit={() => setSelectOpen(true)} onPick={() => setSelectOpen(true)} testId="compat-person2" emptyLabel="เลือกเพื่อน / คู่รัก" />

          {/* button — gray until BOTH people (done-cond #5). Fires the (side-effecting) calc ONCE (guarded by
              firingRef), then the whole form swaps to the loader. 2F/D31: the button no longer carries a
              loading state — the wait lives on the full-screen loader, never on this label. */}
          <button
            type="button"
            data-testid="compat-view-result"
            disabled={!c.canViewResult}
            aria-disabled={!c.canViewResult}
            onClick={onViewResult}
            className={[
              'w-full rounded-[100px] py-3.5 text-center font-poppins-v3 text-[16px] font-semibold text-white transition-colors',
              c.canViewResult ? 'bg-v3-sapphire' : 'cursor-not-allowed bg-v3-disabled-bg',
            ].join(' ')}
          >
            ดูผลลัพธ์เลย
          </button>

          {/* calc error → stay on this screen (done-cond: no navigate to a blank result), surface honestly */}
          {calcError ? (
            <p role="alert" data-testid="compat-result-error" className="text-center text-[14px] font-medium text-v3-error">
              คำนวณไม่สำเร็จ ลองอีกครั้ง
            </p>
          ) : null}

          {/* "ดูดวงสมพงศ์ล่าสุด" — ฟีม: พักไว้ = placeholder ("เรากำลังจะทำอันใหม่"), honest not-open */}
          <button type="button" onClick={() => setComingSoon('ดูดวงสมพงศ์ล่าสุด')} className="mt-1 text-[16px] font-normal leading-6 text-v3-cyan underline">
            ดูดวงสมพงศ์ล่าสุด
          </button>
        </div>
      </div>

      <Menubar />

      {logoutOpen && <LogoutModal onClose={() => setLogoutOpen(false)} onConfirm={logout} />}
      {selectOpen && (
        <CompatSelectFriendModal
          onClose={() => setSelectOpen(false)}
          onSelect={(input) => { c.selectFriend(input); setSelectOpen(false) }}
          onAddNew={() => { setSelectOpen(false); setAddOpen(true) }}
        />
      )}
      {addOpen && (
        <AddFriendSheet
          onClose={() => setAddOpen(false)}
          onCreate={c.createFriend}
        />
      )}
      {comingSoon && <ComingSoonSheet label={comingSoon} onClose={() => setComingSoon(null)} />}
    </div>
  )
}
