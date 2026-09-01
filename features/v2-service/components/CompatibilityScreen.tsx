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
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { MemberWithFriendGetDetailApi } from '@/constants/api/api-member-with-friend-get-detail'
import { friendDetailToEditForm, type EditFriendForm, type FriendEditDetail } from '../compatibility-api'
import { useCompatibility, type CompatPerson } from '../hooks/useCompatibility'
import { useQuota } from '../hooks/useQuota'
import { COLLEAGUE_ROLES } from '../compatibility'
import { compatQuotaBlockedLines } from './compat-quota-copy'
import { useCalcCooldown } from '../hooks/useCalcCooldown'
import { QuotaLine } from './QuotaLine'
import { calculateCompatibility, type CompatCalcErrorReason } from '../hooks/useCompatibilityResult'
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
function ProfileRow({ person, loadingDob, onEdit, onPick, onChangePerson, editBusy, testId, emptyLabel }: {
  person: CompatPerson | null
  loadingDob?: boolean
  onEdit: () => void
  onPick?: () => void
  /** #266 — when present the row shows TWO actions, because it HAS two: pick a different person, and
   *  change this person's data. Absent (row 1) keeps the single control it always had. */
  onChangePerson?: () => void
  /** the friend's data is being read before the edit sheet can open — the control says so itself (#265) */
  editBusy?: boolean
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
    // #266 — two actions need the horizontal room the single one did not: measured at 393, the friend's
    // birthdate was being pushed onto a second line and breaking after the "·", leaving the separator
    // dangling. Right padding drops to 8px only on the two-action row; the buttons' own inset supplies the
    // visual gutter, and rows with one action keep the original 24px.
    // #276 — THE ACTIONS TAKE THEIR OWN LINE WHEN THE BIRTHDATE CANNOT FIT BESIDE THEM. Measured, not
    // guessed: at 320 the text column gets 76px and the birthdate needs 147.6px, so it is short by 71.6px —
    // more than every scrap of padding on the row put together. The only way to give it that room is to stop
    // the two 44px targets from sharing the line, and 44 is the tap-target floor #249 established, so they
    // cannot shrink either.
    // #414 — WHAT DECIDES IS THE BIRTHDATE'S WIDTH, NOT THE VIEWPORT'S. #276 wrote that rule as
    // `min-[360px]:flex-nowrap`, and 360 was a guess: the text column measures exactly (viewport - 244)px at
    // every width tested, so a 147.6px birthdate runs out of room at 391.6 — not at 360. Everything from 360
    // to 391 kept the actions on the line and broke the date instead, leaving "23 พ.ย. 2538 ·" with the
    // separator dangling at 360-390, and an orphaned "น." at 391. That is the whole of #414, and it is the
    // same defect #276 fixed, still shipping, one pixel range over.
    // So the number here is the one that actually decides — `min-w-[148px]` is what the rendered birthdate
    // needs (147.6px, measured at DPR 2 with the real font) — and the wrap follows the CONTENT: whenever the
    // row cannot give the text column that much, the actions go to their own line, exactly as they already
    // do at 320. No viewport appears in this rule at all, so there is no width left for the next date to
    // land on the wrong side of.
    // 🔴 KNOWN, MEASURED, AND OUT OF SCOPE: 147.6px is THIS date, not the column. All twelve abbreviated
    // months were measured (harness header carries the table): the widest is เม.ย. at 150.3px and the
    // runner-up is พ.ค. at 148.1px, so 148 leaves ten months with room and two without. After this change
    // the actions sit beside the text from 392 up, where the column is (viewport - 244), so what is left
    // broken is exactly: เม.ย. at 392/393/394, and พ.ค. at 392 alone — a one-pixel window. `min-w-[151px]`
    // is the value that closes every month, at the cost of making 393 wrap for everyone, which is the
    // trade #414's DoD is not allowed to make. Filed as its own ticket.
    // Leaving the dob wrappable (no `whitespace-nowrap`) is deliberate for exactly those cases: a second
    // line is ugly, a birthdate clipped by this row's `overflow-hidden` would be silent.
    // (The month figures are ตู๋'s, from reviewing this PR, re-run by me and agreeing to 0.1px. My own
    // first list of "wide" months was arrived at by counting glyphs and had มี.ค. in it — it is 146.3px,
    // one of the narrowest. Character count is not width.)
    <section data-testid={testId} className={`flex w-full flex-wrap items-center overflow-hidden rounded-[56px] bg-v3-ghost-white py-3 pl-3 ${onChangePerson ? 'gap-x-2 gap-y-1 pr-2' : 'gap-x-3 gap-y-1 pr-6'}`}>
      <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white">
        {person.imageProfile
          ? <Image src={person.imageProfile} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} />
          : <span>{person.name.trim().charAt(0) || '?'}</span>}
      </span>
      {/* #414 — min-w is the birthdate's width, so the row wraps on CONTENT instead of on a viewport guess.
          Row 1 gets the same floor as row 2 on purpose: it is the same column showing the same kind of
          string, and its own birthdate was breaking with the same dangling "·" at 320/359/360 (measured).
          Two rules for one column is what let this defect ship twice. */}
      <div className="flex min-w-[148px] flex-1 flex-col justify-center gap-1 text-v3-navy">
        <p data-testid={`${testId}-name`} className="truncate text-[16px] font-bold leading-6">{person.name}</p>
        {loadingDob
          ? <span data-testid="compat-person2-dob-loading" className="h-[14px] w-32 animate-pulse rounded bg-v3-ghost-white brightness-95" aria-hidden />
          : <p data-testid={isP1 ? 'compat-person1-dob' : 'compat-person2-dob'} className="text-[14px] font-normal leading-[22px]">{formatCompatBirth(person.dob, person.time)}</p>}
        {isP1 && <span data-testid="compat-person1-time" className="sr-only">{person.time}</span>}
      </div>
      {/* #266 — the label now matches what the control does. "แก้ไข" on this row used to open the
          pick-someone-else modal: the screen said one thing and did another, which is the same class of
          defect #263 removed from the message below. Two actions, two labels, two testids.
          min-w/min-h 44: two small text targets side by side is exactly where #249's 41px tap-target
          failure came from — measured at 393 and 320, not eyeballed. */}
      {/* #276/#414 — `ml-auto` keeps the actions on the reading edge in BOTH arrangements: beside the text
          it changes nothing (the text column already grows into the space), and on a wrapped line it pushes
          them right, which is what `w-full justify-end` was doing before. It replaces that pair because
          `w-full` forced the wrap by itself — the row could never put the actions beside the text no matter
          how much room there was, so the layout needed a viewport rule to undo it. */}
      <div className="ml-auto flex shrink-0 items-center">
        {onChangePerson && (
          <button
            type="button" onClick={onChangePerson} data-testid={`${testId}-change`}
            className="grid min-h-[44px] min-w-[44px] place-items-center text-[14px] font-bold leading-5 text-v3-text-muted"
          >
            เปลี่ยน
          </button>
        )}
        <button
          type="button" onClick={onEdit} disabled={editBusy} aria-disabled={editBusy}
          data-testid={`${testId}-edit`}
          className={[
            'grid min-h-[44px] min-w-[44px] place-items-center text-[14px] font-bold leading-5',
            editBusy ? 'cursor-not-allowed text-v3-text-muted' : 'text-v3-sapphire',
          ].join(' ')}
        >
          {editBusy ? 'กำลังโหลด…' : 'แก้ไข'}
        </button>
      </div>
    </section>
  )
}

// #263 — ONE MESSAGE PER CAUSE. The screen used to say "คำนวณไม่สำเร็จ ลองอีกครั้ง" for every failure,
// which invites a retry — and on the quota path a retry is exactly what costs the user more (measured on
// prod: 454 people burned past their ceiling by tapping again). goo's seam hands over WHY it failed; the
// words are this file's job, and the RAW BE message is never shown (it still claims "ต่อวัน" and predates
// the 100 ceiling — #263).
//
// 'navigate' is NOT one of goo's reasons: it is the local catch below, where the calc SUCCEEDED and only
// the router failed. It gets its own copy because it is the one failure where the quota is already spent
// and the result already exists server-side — telling that user to "ลองอีกครั้ง" would charge them twice
// for a reading they can already open from "ดูดวงสมพงศ์ล่าสุด".
//
// tone picks colour + live-region role, and it is a claim about the user's situation, not decoration:
//   'retry'   red   + role=alert  — something is broken and tapping again may genuinely fix it
//   'blocked' navy  + role=status — nothing is broken; this is a fact about your account or your result,
//                                   and there is somewhere to go. Red here would read as "you did something
//                                   wrong", and the only repair the screen offers is the retry we are
//                                   trying to stop. v3-navy is the existing heading token — no new colour.
type CompatFailure = CompatCalcErrorReason | 'navigate'

// Every case is authored as TWO lines on purpose. At 393 the paragraph is ~345px of centred 14px Thai, and
// a single long sentence wraps wherever it lands — the captured frames had it breaking mid-phrase
// ("ลองอีก / ครั้งได้เลย", "ลองอีก / ครั้ง"). Both unit and e2e were green through that: the STRING was
// right and only the line-break was wrong, which is a thing no assertion on textContent can see. Choosing
// the break here means the headline is always one line and the guidance is always the second.
const CALC_ERROR_COPY: Record<CompatFailure, { tone: 'retry' | 'blocked'; lines: [string, string] }> = {
  // 🔴 #557 — THE LINES FOR `quota` ARE NO LONGER HERE. They are built by compatQuotaBlockedLines() from
  // the reset date the server sends, because this entry is where the bug kept coming back: it read
  // "สำหรับปีนี้" (justified by a BE fact that #358 Phase 6 retired), then "สำหรับเดือนนี้", and neither
  // spelling could go red when the window under it moved. The placeholder below is never rendered — the
  // render site calls the function — and exists so the Record still covers every CompatFailure and a new
  // failure kind cannot be added without meeting this one.
  quota: { tone: 'blocked', lines: compatQuotaBlockedLines() },
  // "ไม่ใช่ข้อมูลของคุณผิด" is the house phrasing for our-fault failures (ElementResultScreen.tsx:403).
  // Without it people go and re-edit their friend's birth date, which was never the problem.
  // ✓ retrying here is free: BE writes the quota row only after a successful calculation
  // (matching.service.ts — userMatchingRepository.save sits inside `if (resultMatching && result)`),
  // so a 5xx costs nothing and "ลองอีกครั้งได้เลย" is not an invitation to pay twice.
  system: { tone: 'retry', lines: ['ระบบขัดข้องชั่วคราว', 'ไม่ใช่ข้อมูลของคุณผิด ลองอีกครั้งได้เลย'] },
  // Deliberately NOT "คำขอยังไม่ถูกส่ง สิทธิ์ของคุณยังไม่ถูกใช้" — with no response back we cannot know
  // whether BE processed it (timeout especially), and this ticket exists to stop the screen from claiming
  // things it does not know.
  network: { tone: 'retry', lines: ['เชื่อมต่อไม่ได้', 'ตรวจสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง'] },
  navigate: { tone: 'blocked', lines: ['คำนวณเสร็จแล้ว แต่เปิดหน้าผลไม่สำเร็จ', 'ดูผลของคุณได้ที่ "ดูดวงสมพงศ์ล่าสุด" ด้านล่าง'] },
}

export function CompatibilityScreen({ config }: { config: CompatibilityConfig }) {
  const c = useCompatibility(config)
  const { logout } = useV2Logout()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [selectOpen, setSelectOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // #266 — the edit flow, as three states rather than one boolean, because "loading the friend's data"
  // and "we could not load it" are NOT the same as "the sheet is open".
  //   🔴 The sheet is opened ONLY once real values are in hand. Opening it on a failed read would put an
  //   EMPTY form in front of the user, and saving that would overwrite the friend's real name/dob/surname
  //   with blanks — the same silent-erase class as the surname gap goo closed in the seam.
  const [editForm, setEditForm] = useState<EditFriendForm | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editLoadFailed, setEditLoadFailed] = useState(false)

  async function openEditFriend() {
    const friendId = c.person2?.id
    if (!friendId || editLoading) return
    setEditLoading(true)
    setEditLoadFailed(false)
    try {
      const detail = (await MemberWithFriendGetDetailApi(friendId)) as FriendEditDetail | null
      if (!detail || detail.error) throw new Error('detail-unavailable')
      setEditForm(friendDetailToEditForm(detail))
    } catch {
      setEditLoadFailed(true) // say it on the screen; never open a blank form (see above)
    } finally {
      setEditLoading(false)
    }
  }
  const [comingSoon, setComingSoon] = useState<string | null>(null)
  const router = useRouter()
  // #264 — identity straight from the cookie rather than waiting on person1's fetch: the two requests are
  // independent, and the indicator has no reason to arrive later than it has to.
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const quota = useQuota(userId)
  // #265 — one minute between calculations, from the button that spends the quota.
  const cooldown = useCalcCooldown(userId)
  const [calculating, setCalculating] = useState(false)
  // #263: was a boolean ("did it fail?"). Now it carries WHICH failure, because that is what decides the
  // words. null = no failure showing.
  const [calcError, setCalcError] = useState<CompatFailure | null>(null)

  // #545 — "there is nothing left to fire this month", read from BOTH sources on purpose. The failed
  // attempt is the certain one; the pre-click indicator is the one that is already true BEFORE any error
  // exists, which is the case a user hits by spending their LAST allowance (the cooldown starts on the
  // press, the refusal only exists on the next one).
  const quotaSpent =
    calcError === 'quota' ||
    (quota.matching.state === 'known' && quota.matching.remaining === 0)
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
    // #265 — checked HERE as well as on the button's `disabled`, because `disabled` is a RENDERING of the
    // state, not the state. Today this line is unreachable from the button (React filters clicks on a
    // disabled control using its own props, so nothing in the DOM can get past it) and no test kills a
    // mutant that deletes it — said plainly in scripts/calc-cooldown.test.tsx rather than left to look
    // covered. It is here for the second caller: an Enter key, a retry link inside the #263 message, a
    // div styled as a button. Whoever adds that caller inherits this guard, and owes it a test.
    if (cooldown.active) return
    firingRef.current = true
    // Start the minute at the PRESS, not at the answer (done-cond). Two consequences, both wanted: a
    // calculation that FAILS still cools down — otherwise the quota-exhausted user, whom the copy tells
    // to wait, is the one person free to hammer the button — and the countdown is already running while
    // the loader is up, so it does not appear to start over when the loader lifts.
    cooldown.start()
    setCalculating(true)
    setCalcError(null)
    const res = await calculateCompatibility(c.person1, c.person2, c.matchingType)
    if (!res.ok) {
      firingRef.current = false
      setCalculating(false)
      setCalcError(res.reason) // #263 — carry goo's cause through; the copy map below turns it into words
      return
    }
    // The quota was ALREADY spent (calc succeeded). router.push returns a Promise; if the navigation is
    // rejected (a thrown getServerSideProps on the result route) OR cancelled (resolves false), an
    // un-awaited push would leave calculating=true + the latch closed → the user is stranded on the loader
    // FOREVER (ตู๋'s reported symptom; the real cause is here, not a calc throw — calc is fully try/caught).
    // So await it and, on any non-success, release the latch and fall back to the form with the error (D34).
    try {
      const navigated = await router.push(`/v2/service/compatibility/result/${res.matchingId}`)
      if (!navigated) throw new Error('navigation-prevented')
      // navigated OK → this screen is unmounting; keep the latch closed so nothing re-fires mid-navigate.
    } catch {
      firingRef.current = false
      setCalculating(false)
      // NOT 'system': the calc already succeeded and the quota is already spent. See CALC_ERROR_COPY.
      setCalcError('navigate')
    }
  }

  // 2F/D30+D32: while the calc is in flight, replace the whole form with the SAME loader + SAME copy (D35)
  // the result screen uses. Next's client-nav keeps this page mounted until the result route's data
  // resolves, then swaps to the result — which mounts already-loading with the identical loader. Same
  // component + copy means no content/copy swap across the two phases (the frame-level rAF trace in
  // run-compat-2f.ts checks role=status is present every frame across the handoff).
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

          {/* #569 — which work role is this? Only the colleague screen has one; the love screen renders
              nothing here. The label names THE OTHER PERSON ("เจ้านาย" = they are my boss) because that is
              the direction the engine reads it in — see COLLEAGUE_ROLES in compatibility.ts, which carries
              the measured ourLabel/partnerLabel for each value. Chips, not a dropdown: three short options
              that must all be readable at once, and the choice changes the whole reading. */}
          {config.hasRoles && (
            <div
              data-testid="compat-role-picker"
              role="radiogroup"
              aria-label="ดูความเข้ากันในฐานะอะไร"
              className="flex w-full items-center gap-2"
            >
              {COLLEAGUE_ROLES.map((r) => {
                const on = c.role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-testid={`compat-role-${r.value}`}
                    onClick={() => c.setRole(r.value)}
                    className={[
                      // 🔴 WRAPS, and that is the point. Measured on the real route: "หุ้นส่วน / เพื่อน"
                      // needs 98px and a third of a 320-wide screen gives 75 — `truncate` turned it into
                      // "หุ้นส่วน / เ…" at 320 and 360, and cleared 393 by ONE pixel. Truncating the middle
                      // option is worse than two lines: the word that survives is "หุ้นส่วน", so a user
                      // looking for "เพื่อน" cannot see that this is where it lives.
                      // ❌ Do not put `truncate` back without re-measuring at 320.
                      'grid min-h-[44px] min-w-0 flex-1 place-items-center rounded-full px-2 py-1.5 text-center text-[13px] leading-[18px] transition-none',
                      on ? 'bg-v3-sapphire font-bold text-white' : 'bg-v3-ghost-white font-normal text-v3-text-body',
                    ].join(' ')}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* row 2 — the person-2 picker → wrapped v1 modal; filled → name+picture now, dob enriches (skeleton) */}
          <ProfileRow
            person={c.person2}
            loadingDob={c.loadingPerson2}
            onEdit={openEditFriend}                 // #266 — now really edits THIS friend
            onChangePerson={() => setSelectOpen(true)} // …and the old behaviour keeps its own, honest label
            onPick={() => setSelectOpen(true)}
            editBusy={editLoading}
            testId="compat-person2"
            emptyLabel={config.pickLabel}
          />

          {/* #266 — could not read the friend's current data. Said out loud instead of opening an empty
              form: an empty form looks like the friend HAS no data, and saving it would erase what is
              there. Red + alert per the tone rule from #263 — this one really is broken. */}
          {editLoadFailed && (
            <p role="alert" data-testid="compat-edit-load-error" className="text-center text-[14px] font-medium text-v3-error">
              <span className="block font-bold">เปิดข้อมูลเพื่อนไม่ได้</span>
              <span className="block font-normal">ยังไม่ได้แก้อะไร ลองกดแก้ไขอีกครั้ง</span>
            </p>
          )}

          {/* button — gray until BOTH people (done-cond #5). Fires the (side-effecting) calc ONCE (guarded by
              firingRef), then the whole form swaps to the loader. 2F/D31: the button no longer carries a
              loading state — the wait lives on the full-screen loader, never on this label. */}
          {/* 🔴 mojisejr/mootech-fe#545 — THE COUNTDOWN IS SUPPRESSED ONCE THE ALLOWANCE IS GONE. The two
              used to render together: the label said "รออีก 56 วินาที" directly above a message saying the
              month's allowance was finished. One told you to wait, the other told you waiting was
              pointless, in the same frame.
              The countdown means "you may fire again in N seconds", which is only true when there is
              something left to fire.
              ⚠️ ONLY THE LABEL CHANGES. The button stays disabled by `cooldown.active` exactly as before —
              the rate limit is real and #265's reason for it does not go away (its mutant U3 still
              reddens). And the button is NOT additionally disabled on `quotaSpent`: that value comes from a
              client indicator, and the server is the gate. Locking the control on a stale read would deny
              a calculation someone is entitled to, which is worse than a press that gets an honest refusal.
              The reason lives in #263's message immediately below, so a neutral label here is not the
              silent grey button #263 removed. */}
          {/* #265 — during the cooldown the button carries its OWN reason and its own remaining time.
              A greyed-out control that will not say why is the same defect #263 removed one line below
              it: the screen knows something the person does not. Putting the countdown IN the label
              costs no layout, so it cannot fight the #264 indicator or the #263 message for the space
              under this button — both of those keep saying their own thing at the same time. */}
          <button
            type="button"
            data-testid="compat-view-result"
            disabled={!c.canViewResult || cooldown.active}
            aria-disabled={!c.canViewResult || cooldown.active}
            onClick={onViewResult}
            className={[
              'w-full rounded-[100px] py-3.5 text-center font-poppins-v3 text-[16px] font-semibold transition-colors',
              c.canViewResult && !cooldown.active ? 'bg-v3-sapphire text-white' : 'cursor-not-allowed bg-v3-disabled-bg',
              // The label only became load-bearing during the cooldown — it is the "why" and the "how much
              // longer". White on the #DDDDDD disabled fill measures ~1.4:1, so it was decoration you could
              // squint at; as information it has to be readable. v3-text-body on that fill is ~6.3:1.
              // (The other disabled state, "no friend chosen yet", keeps the old white — its label carries
              // nothing the user needs to read. That low contrast predates this ticket; reported, not
              // changed here, because it is a different reason for a different screen state.)
              cooldown.active ? 'text-v3-text-body' : !c.canViewResult ? 'text-white' : '',
            ].join(' ')}
          >
            {cooldown.active && !quotaSpent ? `รออีก ${cooldown.secondsLeft} วินาที` : 'ดูผลลัพธ์เลย'}
          </button>

          {/* #264 — how many calculations are left, right where the decision is made (this is a fact about
              what THAT button does; the header is identity/nav and the person rows are about WHO).
              Hidden once the quota-exhausted message is up: "เหลือ 0 ครั้ง" directly above "ใช้สิทธิ์ครบแล้ว"
              is the same sentence twice. Every other cause keeps it — a 5xx says nothing about the count. */}
          {calcError === 'quota' ? null : <QuotaLine quota={quota.matching} label={(n) => `เหลือ ${n} ครั้ง`} testId="compat-quota-matching" />}

          {/* calc error → stay on this screen (done-cond: no navigate to a blank result), surface honestly.
              #263: one message per cause. The testid stays the same so goo's/ตู๋'s existing anchors keep
              pointing here; what changed is that the TEXT now differs per cause. */}
          {calcError ? (
            <p
              role={CALC_ERROR_COPY[calcError].tone === 'blocked' ? 'status' : 'alert'}
              data-testid="compat-result-error"
              className={[
                'text-center text-[14px] font-medium',
                CALC_ERROR_COPY[calcError].tone === 'blocked' ? 'text-v3-navy' : 'text-v3-error',
              ].join(' ')}
            >
              {/* line 1 (bold) = WHAT happened · line 2 (normal) = what to do about it.
                  #557: the quota case reads its second line from the wire (the day the allowance is back);
                  every other case is a constant, because none of them is about time. */}
              {(calcError === 'quota'
                ? compatQuotaBlockedLines(quota.matching.state === 'known' ? quota.matching.resetAt : undefined)
                : CALC_ERROR_COPY[calcError].lines
              ).map((line, i) => (
                <span key={line} className={i === 0 ? 'block font-bold' : 'block font-normal'}>{line}</span>
              ))}
            </p>
          ) : null}

          {/* "ดูดวงสมพงศ์ล่าสุด" — 2G/D38: was a ComingSoon placeholder; now opens the history list. */}
          <button type="button" onClick={() => router.push('/v2/service/compatibility/recent')} className="mt-1 text-[16px] font-normal leading-6 text-v3-cyan underline">
            ดูดวงสมพงศ์ล่าสุด
          </button>
        </div>
      </div>

      <Menubar />

      {logoutOpen && <LogoutModal onClose={() => setLogoutOpen(false)} onConfirm={logout} />}
      {selectOpen && (
        <CompatSelectFriendModal
          title={config.pickLabel}
          onClose={() => setSelectOpen(false)}
          onSelect={(input) => { c.selectFriend(input); setSelectOpen(false) }}
          onAddNew={() => { setSelectOpen(false); setAddOpen(true) }}
          // #264 — the friend allowance, shown where the decision to spend one is made. Both indicators
          // read the SAME single fetch; two independent reads could disagree on screen at the same moment.
          friendQuota={quota.friend}
        />
      )}
      {/* #266 — same sheet, edit mode: identical fields, so a second screen would only be a copy of the
          date/gender/time controls waiting to drift out of step with this one. */}
      {editForm && c.person2 && (
        <AddFriendSheet
          onClose={() => setEditForm(null)}
          edit={{
            initial: editForm,
            onSave: async (form) => {
              const res = await c.updateFriendProfile(c.person2!.id, form)
              if (res.ok) {
                // Re-read the friend so the ROW stops showing the old birthdate. The calculation itself
                // would already be right (BE reads the friend fresh by id) — which is exactly why this
                // matters: without it the screen would state one birthdate and the result would be
                // computed from another, and only the screen is visible.
                c.selectFriend({ id: c.person2!.id, name: form.name, surname: form.surname })
                setEditForm(null)
              }
              return res
            },
          }}
        />
      )}

      {addOpen && (
        <AddFriendSheet
          onClose={() => setAddOpen(false)}
          onCreate={async (form) => {
            const res = await c.createFriend(form)
            // #264 — this is the one change that spends quota WITHOUT leaving the screen, so mount-time
            // loading cannot cover it: refetch or the next open shows a count that is one too generous.
            if (res.ok) quota.refetch()
            // #570 — no c.selectFriend here ON PURPOSE. createFriend already made the new friend person2
            // (useCompatibility.ts, and `res.selected` reports it), so selecting again from this side would
            // be a second placement path racing the first. The sheet closes itself on res.ok and the row is
            // already filled by then.
            return res
          }}
        />
      )}
      {comingSoon && <ComingSoonSheet label={comingSoon} onClose={() => setComingSoon(null)} />}
    </div>
  )
}
