// MuMate v2 — ปฏิทิน · รายละเอียดวัน (screen 2 · Figma 634:8194 ธรรมดา). Behind the v2 gate.
//
// Phase 3a (Lamun · designed UI): the scaffold body is replaced by the real 10-section normal-mode screen
// (§1 header · §2 date strip · §3 score card · §4 toggle · §6 ความเข้ากัน · §7 insight · §8 คำทำนายรายด้าน ·
// §10 ทิศ สีมงคล · §11 เวลามงคล · §14 floating menu). goo's hooks/routing are UNCHANGED — the page only reads
// them. Advanced-only sections (§5 ดวงของฉัน · §9 ดิถี · §12 8ประตู · §13 8เทพ) + toggle-ON land in 3b (634:8752).
// Data: grade/percent/ganzhi/summary/yams come from goo's DayDetail; the life-area / lucky-colour / deity
// M-D (มุน 2026-08-06): every section below reads goo's real `detail`. The Figma-frozen content module
// (day-detail/content.ts) is DELETED — ตู๋'s review call, and the reasoning is worth keeping: a superseded
// module full of Figma-sampled values is not neutral history, it is a set of plausible constants sitting
// one import away. The gate positions in particular were 14 July's fortune, so a future "just reuse the
// frozen list" would ship an inverted compass. History lives in git (last touched 9cf9bdf) and the
// per-decision reasons live in the ledger entry + each component's header.
import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'
import { v2RedirectIfUnauthed, isV2TeamPreview } from '@/lib/v2/gate'
import { useDayDetail, useAdvancedMode, useReminders, useReminderDraft, menuStateForDay, CalendarMenuState, type YamSlot } from '@/features/v2-calendar'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { DayHeader } from '@/features/v2-calendar/components/day-detail/DayHeader'
import { DayStrip } from '@/features/v2-calendar/components/day-detail/DayStrip'
import { DayScoreCard } from '@/features/v2-calendar/components/day-detail/DayScoreCard'
import { AdvancedToggle } from '@/features/v2-calendar/components/day-detail/AdvancedToggle'
import { CompatList } from '@/features/v2-calendar/components/day-detail/CompatList'
import { PredictionCards } from '@/features/v2-calendar/components/day-detail/PredictionCards'
import { LuckyColors } from '@/features/v2-calendar/components/day-detail/LuckyColors'
import { YamTimes } from '@/features/v2-calendar/components/day-detail/YamTimes'
import { MyChart } from '@/features/v2-calendar/components/day-detail/MyChart'
import { Dithi } from '@/features/v2-calendar/components/day-detail/Dithi'
import { EightGates } from '@/features/v2-calendar/components/day-detail/EightGates'
import { EightDeities } from '@/features/v2-calendar/components/day-detail/EightDeities'
import { SaveSheet } from '@/features/v2-calendar/components/day-detail/SaveSheet'
import { InstallGuideSheet, type InstallGuideVariant } from '@/features/v2-calendar/components/InstallGuideSheet'
import { notifyStateFrom } from '@/features/v2-calendar/notify-state'
import { remindersLocked, dayReminderCta, yamReminderStatus } from '@/features/v2-calendar/tier-lock'
import { announceComingSoon, ComingSoonNotice } from '@/features/v2-shell/components/ComingSoon'
import { usePwaCapability } from '@/lib/pwa/capability'
import { requestPushSubscription } from '@/lib/pwa/subscribe'
import { saveWithNotification, postPushSubscription } from '@/lib/pwa/persist-subscription'
import { PersonalCalendarUpsell } from '@/features/v2-calendar/components/upsell/PersonalCalendarUpsell'
import { dayBodyState } from '@/features/v2-calendar/refusal-view'
import { CalendarRefusalCard } from '@/features/v2-calendar/components/refusal/CalendarRefusalCard'
import { useClientTier } from '@/features/v2-shell/hooks/useClientTier'

export const getServerSideProps: GetServerSideProps<{ teamPreview: boolean }> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  // Past the gate ⇒ team member — relay so the client-side ?tier= override can key off it (issue #225).
  return { props: { teamPreview: isV2TeamPreview(ctx.req) } }
}

export default function V2CalendarDayPage({ teamPreview }: { teamPreview: boolean }) {
  const router = useRouter()
  const date = typeof router.query.date === 'string' ? router.query.date : ''
  const { detail, loading: detailLoading, outOfSpan } = useDayDetail(date)
  // ฟีม: โหมดแอดวานซ์เปิดเป็นค่าเริ่มต้น (goo's useAdvancedMode default ON). Toggling OFF hides the 4
  // advanced-only sections (§5/§9/§12/§13) → the exact 3a normal frame (634:8194); toggling ON brings them back.
  const { advanced, toggle } = useAdvancedMode()
  // Zone 4 — the gate. Until this shipped, this screen had no tier logic at all: every section Figma marks
  // paid (ความเข้ากัน 5 ด้าน · คำทำนายรายด้าน · โหมดแอดวานซ์ and the four advanced-only sections behind it)
  // rendered for everyone, including members who never paid.
  //
  // THREE states, not two. `isPaid === null` means the tier is not determined (in flight, or the user fetch
  // failed) and there is no safe default: assume free and a paying member loses what they bought; assume
  // paid and the leak stays open. So neither branch renders — the screen shows the part every tier gets
  // (score card · ทิศ สีมงคล · เวลามงคล) and fills in once the answer is real.
  const tier = useClientTier(teamPreview)
  const { isPaid } = tier
  const paid = isPaid === true
  const free = isPaid === false
  const reminders = useReminders()
  const draft = useReminderDraft() // goo's save-flow machine — the page MASKS it, adds no state of its own
  // #286 — เพจเป็นคนอ่านความสามารถของเครื่อง แล้วส่ง *สถานะที่แปลแล้ว* ลงไปให้ชีท
  // (ชีทไม่เรียก hook เอง ⇒ unit test ป้อนครบ 6 สถานะได้โดยไม่ต้องมีเบราว์เซอร์)
  const notify = notifyStateFrom(usePwaCapability())
  const [guide, setGuide] = useState<InstallGuideVariant | null>(null)

  // #343 — ปุ่มรายยาม **เปิดชีทโดยติ๊กยามนั้นไว้ให้** ❌ ไม่ยิง POST ทันทีเหมือนเดิม
  //
  // ของเดิมเป็น fire-and-forget (`void reminders.save(...)`) ⇒ ผลลัพธ์ทั้งก้อนถูกทิ้ง: สำเร็จก็เงียบ
  // ล้มก็เงียบ · และมันสัญญา push ให้ผู้ใช้ที่สิทธิ์ยัง denied/needs-install โดยไม่ผ่านหน้าจอที่บอกความจริง
  // เรื่องนั้นเลย (หนี้ที่ #286 ยกไว้) ⇒ ทางเดียวกับชีททำให้ทั้งสองอย่างหายพร้อมกัน: ผู้ใช้เห็นสิ่งที่กำลัง
  // จะบันทึก · เห็นสถานะกำลังบันทึก/ล้ม (#342) · และเห็นเหตุที่เครื่องจะไม่ดังก่อนกดยืนยัน
  const addYam = (yam: YamSlot) => {
    draft.open(date, [yam.id])
  }


  // save-sheet commit (#287 · reframed #298): ONE tap saves the reminder AND registers the device for push.
  // The destination switch is gone — the system fills ['mumate'] itself (reminder-plan.ts:43 still rejects an
  // empty destinations from any OTHER caller). save() returns true on 2xx → machine → saved; false (past 422 /
  // free 403 / network) → machine → error, sheet stays open to retry.
  //
  // 🔴 This is the user gesture, so saveWithNotification must request permission BEFORE it awaits the save —
  // Safari only shows the prompt inside the gesture. Building yams is synchronous; the first await is inside
  // saveWithNotification, after requestPushSubscription() has already fired. ❌ Do NOT await anything here first.
  const onSheetSave = () => {
    const yams = draft.draft.selectedYamIds.map((yamId) => {
      const yam = detail?.yams.find((y) => y.id === yamId) // fires past the render guard (detail set); ?. narrows the earlier closure
      return { yamId, yamLabel: yam?.label ?? yamId, window: yam?.window ?? '' }
    })
    void saveWithNotification({
      notify,
      requestSubscription: () => requestPushSubscription(),
      post: (sub) => postPushSubscription(sub, navigator.userAgent),
      // drive the save-flow machine through the REAL POST; resolve with whether the row was saved
      saveReminder: () => {
        let ok = false
        return draft
          .commit(async () => {
            const outcome = await reminders.save({ date, yams, destinations: ['mumate'] })
            ok = outcome.ok
            return outcome.ok
          })
          .then(() => ok)
      },
    })
  }

  const saved = reminders.hasReminderFor(date)
  // observable count of THIS date's reminders — lets the anchor prove list-+1 / cancel-no-add / no-op-single-row.
  const dateReminderCount = [...reminders.list.upcoming, ...reminders.list.past].filter((r) => r.date === date).length
  // keep the sheet mounted on `error` too, so a failed save (past/free/network) leaves the form open to
  // retry instead of vanishing silently. #342 shipped the copy that makes that visible (SaveSheet reads
  // draft.state now); the machine + retry are here.
  const sheetOpen = draft.state === 'editing' || draft.state === 'saving' || draft.state === 'error'
  // while the sheet is open the menu is FormMode(4, no Mate AI); else derived from data (Saved 3 / PrimaryAction 2).
  const menuState = sheetOpen ? draft.menuState : menuStateForDay(saved)
  // #326 — free/unknown ⇒ ปุ่มบอกว่าเป็นของสมาชิก และ **ไม่มีเส้นทางไปถึง draft.open** ⇒ ไม่มี POST
  // #343 — "ยามไหนของวันนี้ถูกเพิ่มแล้ว" (ไม่ใช่แค่ "วันนี้มีไหม") ⇒ ป้อนให้ทั้งปุ่มรายยาม ชีท และปุ่มแถบล่าง
  const addedYamIds = reminders.addedYamIdsFor(date)
  // 🔴 `now` อ่านนาฬิกาจริงตอน render — จงใจให้อยู่ที่นี่ที่เดียว และ**ไม่มีฟันตัวไหนยิงผ่านเพจเพื่อทดสอบเวลา**
  // ฟันของ "เลยเวลา" ยิงที่ `yamReminderStatus`/`dayReminderCta` ตรงๆ พร้อม `now` ที่ป้อนเอง — ฟันที่พึ่ง
  // นาฬิกาผนังจะเขียว/แดงตามเวลาที่รัน ไม่ใช่ตามโค้ด
  const now = new Date()
  const statusFor = (yam: YamSlot) => yamReminderStatus({ yam, date, addedYamIds, now })
  const goToList = () => { void router.push('/v2/calendar/notifications') }
  // #359 — สถานะล็อกของ CTA แถบล่างพาไปหน้าแพ็กเกจ ❌ ไม่ประกาศ 'เร็วๆ นี้' อีกต่อไป
  const goToShop = () => { void router.push(SHOP_HREF) }

  // 3 · "บันทึกเรียบร้อยแล้ว" ~2 วินาที แล้วกลายเป็น "เพิ่มยาม"
  //
  // 🔴 และ **ปล่อยเครื่องสถานะกลับ idle ด้วย** (ตู๋จับใน #350) — `save-flow.ts:64` `saved: { dismiss: 'idle' }`
  // คือทางออกทางเดียวของ `saved` และ **ทั้งรีโปไม่เคยมีใครเรียก `dismiss()` เลย** ⇒ หลังบันทึกสำเร็จ state
  // ค้างที่ `saved` ⇒ `open()` กลายเป็น NO-OP ตามตาราง ⇒ ปุ่ม "เพิ่มยาม" และปุ่มรายยาม (สายเดียวกัน)
  // **กดแล้วเงียบทั้งคู่** — และ `setDraft` ใน `open` รันไปแล้ว ⇒ ยามที่ติ๊กไว้เปลี่ยนเงียบๆ โดยไม่มีจอโผล่
  // ⇒ ทางที่ตายคือ "เพิ่มยามหลายอันในวันเดียว" ซึ่งเป็นชื่อของใบร่ม #340 ตรงๆ
  //
  // ⚠️ **แยกสอง effect โดยตั้งใจ** ❌ ไม่ใช่ยัด dismiss ลงใน effect เดียวกับตัวจับเวลา:
  // `dismiss()` เปลี่ยน `draft.state` ทันที ⇒ effect ที่ผูก dep กับ `draft.state` จะ **cleanup ทิ้งทันที**
  // ⇒ `clearTimeout` ยิงก่อนครบ 2 วิ ⇒ `justSaved` ค้าง true ตลอดกาล และปุ่มไม่มีวันกลับไปเป็น "เพิ่มยาม"
  // (ป้ายที่กดไม่ได้ค้างถาวร = แย่กว่าบั๊กที่กำลังแก้) ⇒ ตัวจับเวลาผูกกับ `justSaved` ของเพจเอง
  // ซึ่งเป็นชั้นเดียวกับที่มันมีชีวิตอยู่ — บทเรียนตรงกับ #323 เป๊ะ (อายุต้องอยู่ชั้นเดียวกับ state)
  const [justSaved, setJustSaved] = useState(false)
  // ดึงสองชิ้นที่ effect ใช้ออกมาก่อน ❌ ไม่ใส่ `draft` ทั้งก้อนลง deps — ฮุคคืนอ็อบเจกต์ใหม่ทุก render
  // ⇒ effect จะวิ่งทุกรอบ · `state` เป็น string และ `dismiss` เป็น useCallback deps ว่าง
  // (useReminderDraft.ts:107) ⇒ ทั้งคู่นิ่งจริง และ exhaustive-deps ตรวจได้ครบโดยไม่ต้องปิดกฎ
  const { state: draftState, dismiss: dismissDraft } = draft
  useEffect(() => {
    if (draftState !== 'saved') return
    setJustSaved(true)
    dismissDraft() // saved → idle ⇒ ทางเข้าทั้งสองทางกลับมาใช้ได้ทันทีในหน้าเดิม
  }, [draftState, dismissDraft])
  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 2000)
    return () => clearTimeout(t)
  }, [justSaved])

  const cta = dayReminderCta({
    isPaid,
    saving: draft.state === 'saving',
    justSaved,
    yams: detail?.yams ?? [],
    addedYamIds,
    date,
    now,
    openSheet: () => draft.open(date),
    goToShop,
    goToList,
  })

  // #529 — this used to read `if (!detail)` and return the spinner, full stop. Three different situations
  // arrive here with `detail === null`, and only ONE of them has anything coming:
  //
  //   a day past what the package sells   fetch DONE, outOfSpan true   → spun forever, and it is a SALE
  //   the upstream failed / no profile    fetch DONE, outOfSpan false  → spun forever
  //   the fetch really is in flight       loading true                 → the spinner told the truth
  //
  // A spinner that never stops is worse than a blank screen (calendar-view-state.ts:16,
  // CalendarSkeleton.tsx:9): blank reads as broken and the person leaves, a pulse reads as "any second
  // now" and they sit and wait. So the three are separated, by the rule in refusal-view.ts that the month
  // screen reads too. `dayBodyState` puts outOfSpan FIRST and fail-closed — see the note on it.
  // #533 9fa30dc answers "the row has not arrived" as loading at the hook, so the page has nothing left
  // to guess about identity here. The version of this line that guessed is described in refusal-view.ts.
  const bodyState = dayBodyState({ detail, loading: detailLoading, outOfSpan })
  // `|| !detail` is here for the COMPILER, not for the runtime: a state variable cannot narrow `detail`
  // the way the old `if (!detail)` did, and every section below dereferences it. It can never fire on its
  // own — dayBodyState answers 'ready' ONLY when detail is truthy — and that implication is pinned by a
  // test case rather than left as a comment, so the day someone reorders those branches this line stops
  // being redundant and something reddens.
  if (bodyState !== 'ready' || !detail) {
    // 🔴 THE BOTTOM BAR IS PART OF THE SCREEN, and this is the defect the pixels caught that the string
    // assertions did not. `ctaLabel=""` is the sentinel Menubar.tsx:92 reads as "still loading", so it
    // prints กำลังโหลด… — on a walled day whose fetch finished, that is the same lie in a second place,
    // one bar below the card that just said the truth. The month screen shows NO bottom CTA in its walled
    // state (CalendarMenuState.Normal), so the day screen now matches it: same behaviour, both routes.
    // `loading` keeps the sentinel, because there the word is true.
    const settled = bodyState !== 'loading'
    return (
      <CalendarShell
        title="รายละเอียดวัน"
        menuState={settled ? CalendarMenuState.Normal : menuState}
        {...(settled ? {} : { ctaLabel: '', onCta: () => {} })}
      >
        {bodyState === 'loading' && (
          <div data-testid="day-detail-pending" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/3 grid place-items-center">
            <span className="size-8 animate-spin rounded-full border-[3px] border-v3-sapphire/20 border-t-v3-sapphire" />
            <span className="sr-only">กำลังโหลดรายละเอียดวัน</span>
          </div>
        )}
        {/* The chrome stays: which day this is, is the first thing the person needs, and losing the header
            on the walled day would make the upgrade card read as a page-level error again. */}
        {bodyState === 'upgrade' && (
          <div className="flex flex-col gap-4 px-4 pt-3">
            <DayHeader membership={tier} />
            <DayStrip date={date} />
            <CalendarRefusalCard surface={{ kind: 'upgrade', scope: 'day' }} />
          </div>
        )}
        {/* Settled, nothing to show, and NOT walled. It says so and stops drawing furniture — the same call
            CalendarSkeleton.tsx makes for the month body. It must never borrow the sales card: #529's DoD
            asks for a control proving a genuine failure still reads as a failure. */}
        {bodyState === 'unavailable' && (
          <div data-testid="day-detail-unavailable" className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center">
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-white text-2xl shadow-[0_4px_14px_rgba(26,38,77,0.06)]">📄</span>
            <p className="text-base font-bold leading-6 text-v3-navy [word-break:keep-all]">ยังแสดงรายละเอียดของวันนี้ไม่ได้ตอนนี้</p>
            <p className="text-sm font-medium leading-6 text-v3-text-muted [word-break:keep-all]">
              ลองรีเฟรชอีกครั้ง หรือกลับไปเลือกวันใหม่จากปฏิทิน
            </p>
          </div>
        )}
      </CalendarShell>
    )
  }

  return (
    <CalendarShell
      title="รายละเอียดวัน"
      menuState={menuState}
      // #326 — ทางเข้าที่สอง. บรรทัดที่ตัดสินอยู่ใน tier-lock.ts ไม่ใช่ที่นี่ (ไฟล์นี้ import ไม่ได้ใน unit)
      ctaLabel={cta.label}
      // #343 — 3 ใน 7 สถานะกดไม่ได้จริง (saving · justSaved · expired) · ก่อนหน้านี้ Menubar ปิดปุ่มได้
      // ทางเดียวคือ sentinel '' ของ "กำลังโหลด" ⇒ ปุ่มจะกดได้ทั้งที่ press เป็น no-op = กดแล้วเงียบ
      ctaDisabled={cta.disabled}
      onCta={cta.press}
    >
      {/* #326 — ที่แขวน toast ประกาศไว้ตรงนี้ ❌ ไม่พึ่งว่าปุ่มล็อกรายยามของ #316 จะ mount อยู่พอดี
          (ComingSoon.tsx:52-53 บันทึกไว้เองว่า "safe by accident" คือรูปที่ทีมใช้เวลาทั้งวันถอดออก) */}
      <ComingSoonNotice />
      <DayHeader membership={tier} />
      <span data-testid="reminder-count" className="sr-only">{dateReminderCount}</span>
      {/* Same layout decision as the month screen, and the case for it is stronger here: the two branches
          differ by three whole sections, so whichever one paints first, the other's arrival would drag
          everything under it. The body waits for the tier and then paints once, in its final position —
          a shift needs something already painted to move. Spinner is out of flow, so it shifts nothing. */}
      {isPaid === null && (
        <div data-testid="day-tier-pending" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/3 grid place-items-center">
          <span className="size-8 animate-spin rounded-full border-[3px] border-v3-sapphire/20 border-t-v3-sapphire" />
          <span className="sr-only">กำลังโหลดรายละเอียดวัน</span>
        </div>
      )}
      <div className={`flex flex-col gap-4 px-4 pt-3 ${isPaid === null ? 'hidden' : ''}`}>
        <DayStrip date={date} />
        <DayScoreCard detail={detail} />
        {/* 🔴 #226 (ตู๋ B1) — จากนี้ทุกหัวข้อที่ขายเงิน **วาดเมื่อข้อมูลของมันมาถึง** ❌ ไม่ใช่เมื่อกฎ paid
            ชุดที่สองบนจอบอกว่าควรมี · เหตุผล: BFF ตัดฟิลด์ตาม tier แล้ว (seam v2 · resolveSubscription)
            แต่จอตัดสินด้วย isPaidMember (ธง v1) ⇒ สองที่เห็นไม่ตรงกันได้จริง และทางที่ง่ายที่สุดคือ
            `catch { paid = false }` ที่ใบนี้เพิ่งเพิ่มเอง (DB สะดุด 1 ครั้ง) ⇒ จอเชื่อว่า paid แล้วส่ง
            undefined เข้า .map()/.find()/.length ⇒ throw ตอน render ⇒ **หลุดทั้งหน้า** (ไม่มี error
            boundary ที่ไหนเลยในรีโป) ⇒ ด่านที่ตั้งใจกันรายได้ กลับทำให้ "คนที่จ่ายเงินแล้ว" เจอจอว่าง
            🔑 หลังใบนี้ การมีอยู่ของฟิลด์ = คำตัดสินของเซิร์ฟเวอร์อยู่แล้ว จอไม่ต้องเดาซ้ำ
            ⚠️ เงื่อนไขต้องเป็นฟิลด์ที่ **paid เท่านั้น** — `dithi` กับ `luckyDirection` เป็นของฟรีหลัง #226
            (การ์ดคะแนนใช้) ⇒ ใช้มันเป็นเงื่อนไข = โชว์หัวข้อที่ขายเงินให้คนใช้ฟรี */}
        {detail.compatAreas && <AdvancedToggle on={advanced} onToggle={toggle} />}
        {/* §5 [advanced] — ดวงของฉัน (binds goo's detail.pillars) */}
        {advanced && detail.pillars && <MyChart pillars={detail.pillars} />}
        {/* Figma Free-2 375:11286 puts the upsell exactly here — after the score card, before ทิศ สีมงคล —
            standing in for the three sections below it. The percent is the SAME one the ring shows. */}
        {free && <PersonalCalendarUpsell percent={detail.percent} />}
        {detail.compatAreas && <CompatList areas={detail.compatAreas} insight={detail.insight ?? ''} />}
        {detail.compatAreas && detail.advice && (
          <PredictionCards areas={detail.compatAreas} advice={detail.advice} />
        )}
        {/* §9 [advanced] — ดิถีวันนี้ · สะสม · เงื่อนไขคือ jianchu (ครึ่งที่ขายเงินของ dithi)
            ❌ ไม่ใช่ `detail.dithi` ทั้งก้อน ซึ่งผู้ใช้ฟรีก็มี (officer ไปเป็นชิปบนการ์ดคะแนน) */}
        {advanced && detail.dithi?.jianchu && <Dithi dithi={detail.dithi} />}
        {/* every tier gets these two — Free-2 draws them in full */}
        <LuckyColors colors={detail.luckyColors} deity={detail.dayDeity} />
        {/* #316 — ตัดสินด้วย remindersLocked(isPaid) ไม่ใช่ `free` (fail-closed · null = ล็อก)
            ตรรกะอยู่ที่ features/v2-calendar/tier-lock.ts เพราะไฟล์ page นี้ unit test แตะไม่ได้ */}
        <YamTimes yams={detail.yams} onAdd={addYam} locked={remindersLocked(isPaid)} statusFor={statusFor} onViewList={goToList} />
        {/* §12/§13 [advanced] — 8 ประตู · 8 เทพ */}
        {/* เงื่อนไขคือ `gates` (paid) ❌ ไม่ใช่ `luckyDirection` ซึ่งเป็นของฟรีหลัง #226 */}
        {advanced && detail.gates && <EightGates gates={detail.gates} luckyDirection={detail.luckyDirection} />}
        {advanced && detail.spirits && <EightDeities deities={detail.spirits} />}
        {/* #343 — **ย้าย** ลิงก์นี้ลงมา ❌ ไม่ได้เพิ่มอันที่สอง (ของเดิมอยู่บนสุด ใต้กล่องคะแนน)
            เหตุผล: จังหวะที่ลิงก์นี้มีความหมายคือ "เพิ่งบันทึกเสร็จ" ซึ่งสายตาอยู่ที่ปุ่มแถบล่าง
            ตำแหน่งเดิมอยู่เหนือจอไปหลายส่วน ⇒ ผู้ใช้ต้องเลื่อนกลับขึ้นไปหาสิ่งที่ตัวเองเพิ่งทำ */}
        {saved && (
          <Link href="/v2/calendar/notifications" data-testid="view-all-reminders" className="flex items-center justify-center gap-2 rounded-2xl border border-v3-sapphire/25 bg-v3-sapphire/[0.06] py-3 text-sm font-bold text-v3-sapphire">
            ✓ บันทึกแล้ว · ดูรายการทั้งหมด →
          </Link>
        )}
      </div>
      {/* screen 5 — save sheet, shown only while the machine is editing/saving (375:13316) */}
      {sheetOpen && (
        <SaveSheet
          date={date}
          yams={detail.yams}
          draft={draft}
          onSave={onSheetSave}
          notify={notify}
          onShowGuide={setGuide}
          statusFor={statusFor}
        />
      )}
      {/* ชีทสอนติดตั้ง/เปิดสิทธิ์ — เปิดทับจากในชีทตั้งเตือน จึงต้องอยู่ชั้นเหนือมัน
          #302: บรรทัดนี้เคยเขียนว่า "z สูงกว่า" ทั้งที่ของจริงเท่ากัน (z-50 ทั้งคู่) — วันนั้นมันอยู่บนได้
          เพราะบังเอิญเรียงหลัง SaveSheet ตรงนี้ ไม่ใช่เพราะชั้น. ตอนนี้ชั้นบังคับจริงที่
          InstallGuideSheet.tsx (z-[60]) ⇒ **ลำดับสองบรรทัดนี้สลับกันได้โดยผลไม่เปลี่ยน**
          เคส C ของ harness/archive/save-sheet-hittable.ts เคยเฝ้าไว้ — 🗄️ #321 ย้ายเข้า archive แล้ว
          ⇒ **ตอนนี้ไม่มีอะไรรันมันอัตโนมัติ** ประโยคนี้เก็บไว้เพื่อบอกว่าทำไมชั้นนี้เป็นแบบนี้
          ❌ ห้ามอ่านว่ายังมีฟันเฝ้าอยู่ */}
      {guide && <InstallGuideSheet variant={guide} onClose={() => setGuide(null)} />}
    </CalendarShell>
  )
}
