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
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed, isV2TeamPreview } from '@/lib/v2/gate'
import { useDayDetail, useAdvancedMode, useReminders, useReminderDraft, menuStateForDay, type YamSlot } from '@/features/v2-calendar'
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
import { PersonalCalendarUpsell } from '@/features/v2-calendar/components/upsell/PersonalCalendarUpsell'
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
  const { detail } = useDayDetail(date)
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
  const { isPaid } = useClientTier(teamPreview)
  const paid = isPaid === true
  const free = isPaid === false
  const reminders = useReminders()
  const draft = useReminderDraft() // goo's save-flow machine — the page MASKS it, adds no state of its own

  // per-ยาม quick-add (§11 buttons) → a real POST (server assigns id; the hook merges the returned row).
  // Fire-and-forget from the button's view; the list reflects it on success.
  const addYam = (yam: YamSlot) => {
    void reminders.save({ date, yams: [{ yamId: yam.id, yamLabel: yam.label, window: yam.window }], destinations: ['mumate'] })
  }

  // save-sheet commit (#287): build the batch from the ticked ยาม + the day's yams, then drive the machine
  // through the REAL POST. save() returns true on 2xx → machine → saved (and the list already has the rows);
  // false (past 422 / free 403 / network) → machine → error, and the sheet stays open to retry. The saving
  // latch + the server's natural-key dedup mean spamming บันทึก saves each ยาม exactly once.
  const onSheetSave = () => {
    const yams = draft.draft.selectedYamIds.map((yamId) => {
      const yam = detail?.yams.find((y) => y.id === yamId) // fires past the render guard (detail set); ?. narrows the earlier closure
      return { yamId, yamLabel: yam?.label ?? yamId, window: yam?.window ?? '' }
    })
    void draft.commit(async () => {
      const outcome = await reminders.save({ date, yams, destinations: draft.draft.destinations })
      return outcome.ok
    })
  }

  const saved = reminders.hasReminderFor(date)
  // observable count of THIS date's reminders — lets the anchor prove list-+1 / cancel-no-add / no-op-single-row.
  const dateReminderCount = [...reminders.list.upcoming, ...reminders.list.past].filter((r) => r.date === date).length
  // keep the sheet mounted on `error` too, so a failed save (past/free/network) leaves the form open to
  // retry instead of vanishing silently (μุน's #286 adds the error copy; the machine + retry are here).
  const sheetOpen = draft.state === 'editing' || draft.state === 'saving' || draft.state === 'error'
  // while the sheet is open the menu is FormMode(4, no Mate AI); else derived from data (Saved 3 / PrimaryAction 2).
  const menuState = sheetOpen ? draft.menuState : menuStateForDay(saved)

  // goo · G-2 minimal compile-guard — NOT a designed loading state (that's มุน's M-D). useDayDetail now
  // fetches async, so `detail` is null while it loads; every section below binds it (yams/pillars/percent).
  // Early-return a bare spinner shell so the page compiles and isn't blank. No layout, no skeleton, no
  // copy — M-D replaces this. Mirrors the existing isPaid===null spinner. (After all hooks — no hook-order break.)
  if (!detail) {
    return (
      <CalendarShell title="รายละเอียดวัน" menuState={menuState} ctaLabel="" onCta={() => {}}>
        <div data-testid="day-detail-pending" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/3 grid place-items-center">
          <span className="size-8 animate-spin rounded-full border-[3px] border-v3-sapphire/20 border-t-v3-sapphire" />
          <span className="sr-only">กำลังโหลดรายละเอียดวัน</span>
        </div>
      </CalendarShell>
    )
  }

  return (
    <CalendarShell
      title="รายละเอียดวัน"
      menuState={menuState}
      ctaLabel={saved ? 'คุณบันทึกลงปฏิทินแล้ว' : 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน'}
      onCta={() => draft.open(date)}
    >
      <DayHeader showUpgrade={free} />
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
        {/* Phase 7 A2 — after a save, the entry-point to the full list, in view while the user is paying attention */}
        {saved && (
          <Link href="/v2/calendar/notifications" data-testid="view-all-reminders" className="flex items-center justify-center gap-2 rounded-2xl border border-v3-sapphire/25 bg-v3-sapphire/[0.06] py-3 text-sm font-bold text-v3-sapphire">
            ✓ บันทึกแล้ว · ดูรายการทั้งหมด →
          </Link>
        )}
        {paid && <AdvancedToggle on={advanced} onToggle={toggle} />}
        {/* §5 [advanced] — ดวงของฉัน (binds goo's detail.pillars) */}
        {paid && advanced && <MyChart pillars={detail.pillars} />}
        {/* Figma Free-2 375:11286 puts the upsell exactly here — after the score card, before ทิศ สีมงคล —
            standing in for the three sections below it. The percent is the SAME one the ring shows. */}
        {free && <PersonalCalendarUpsell percent={detail.percent} />}
        {paid && <CompatList areas={detail.compatAreas} insight={detail.insight} />}
        {paid && <PredictionCards areas={detail.compatAreas} advice={detail.advice} />}
        {/* §9 [advanced] — ดิถีวันนี้ · สะสม */}
        {paid && advanced && <Dithi dithi={detail.dithi} />}
        {/* every tier gets these two — Free-2 draws them in full */}
        <LuckyColors colors={detail.luckyColors} deity={detail.dayDeity} />
        <YamTimes yams={detail.yams} onAdd={addYam} />
        {/* §12/§13 [advanced] — 8 ประตู · 8 เทพ */}
        {paid && advanced && <EightGates gates={detail.gates} luckyDirection={detail.luckyDirection} />}
        {paid && advanced && <EightDeities deities={detail.spirits} />}
      </div>
      {/* screen 5 — save sheet, shown only while the machine is editing/saving (375:13316) */}
      {sheetOpen && <SaveSheet date={date} yams={detail.yams} draft={draft} onSave={onSheetSave} />}
    </CalendarShell>
  )
}
