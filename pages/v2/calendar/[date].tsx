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
import { useState } from 'react'
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
import { InstallGuideSheet, type InstallGuideVariant } from '@/features/v2-calendar/components/InstallGuideSheet'
import { notifyStateFrom } from '@/features/v2-calendar/notify-state'
import { remindersLocked, dayDetailCta } from '@/features/v2-calendar/tier-lock'
import { announceComingSoon, ComingSoonNotice } from '@/features/v2-shell/components/ComingSoon'
import { usePwaCapability } from '@/lib/pwa/capability'
import { requestPushSubscription } from '@/lib/pwa/subscribe'
import { saveWithNotification, postPushSubscription } from '@/lib/pwa/persist-subscription'
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
  // #286 — เพจเป็นคนอ่านความสามารถของเครื่อง แล้วส่ง *สถานะที่แปลแล้ว* ลงไปให้ชีท
  // (ชีทไม่เรียก hook เอง ⇒ unit test ป้อนครบ 6 สถานะได้โดยไม่ต้องมีเบราว์เซอร์)
  const notify = notifyStateFrom(usePwaCapability())
  const [guide, setGuide] = useState<InstallGuideVariant | null>(null)

  // per-ยาม quick-add (§11 buttons) → a real POST (server assigns id; the hook merges the returned row).
  // Fire-and-forget from the button's view; the list reflects it on success.
  const addYam = (yam: YamSlot) => {
    // ⚠️ CONFLICT #286 × #287 — ทั้งสองข้างของ conflict นี้ผิดคนละแบบ อย่าหยิบข้างใดข้างหนึ่ง
    //   ฝั่งผม (#286) เคยเขียน destinations: [] ผ่าน reminders.add() ตอนที่ hook ยัง fabricate ฝั่ง client
    //   แต่ #287 ลบ add() ทิ้ง และ planReminderCommit (reminder-plan.ts) ตอบ 400 'ต้องเลือกปลายทาง
    //   อย่างน้อย 1 อย่าง' ⇒ [] จะ**บันทึกไม่ติดเลย** และปุ่มนี้เป็น fire-and-forget (void) ⇒ เงียบสนิท
    //   นั่นแย่กว่าปัญหาเดิมที่ผมกำลังแก้ ⇒ คงปลายทาง ['mumate'] ไว้ตามของจริงบน main
    // หนี้ที่ยังเปิดอยู่ (#286 ยกไปถามใน ใบ): ปุ่มนี้ยังสัญญา push โดยไม่ผ่านชีท ⇒ ผู้ใช้ที่สิทธิ์ยัง denied/
    // needs-install จะได้รายการที่ไม่มีวันดัง · ที่พูดความจริงตอนนี้คือแถบสถานะถาวรบนหน้ารายการเท่านั้น
    void reminders.save({ date, yams: [{ yamId: yam.id, yamLabel: yam.label, window: yam.window }], destinations: ['mumate'] })
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
  // retry instead of vanishing silently (μุน's #286 adds the error copy; the machine + retry are here).
  const sheetOpen = draft.state === 'editing' || draft.state === 'saving' || draft.state === 'error'
  // while the sheet is open the menu is FormMode(4, no Mate AI); else derived from data (Saved 3 / PrimaryAction 2).
  const menuState = sheetOpen ? draft.menuState : menuStateForDay(saved)
  // #326 — free/unknown ⇒ ปุ่มบอกว่าเป็นของสมาชิก และ **ไม่มีเส้นทางไปถึง draft.open** ⇒ ไม่มี POST
  const cta = dayDetailCta({
    isPaid,
    saved,
    openSheet: () => draft.open(date),
    say: announceComingSoon,
  })

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
      // #326 — ทางเข้าที่สอง. บรรทัดที่ตัดสินอยู่ใน tier-lock.ts ไม่ใช่ที่นี่ (ไฟล์นี้ import ไม่ได้ใน unit)
      ctaLabel={cta.label}
      onCta={cta.press}
    >
      {/* #326 — ที่แขวน toast ประกาศไว้ตรงนี้ ❌ ไม่พึ่งว่าปุ่มล็อกรายยามของ #316 จะ mount อยู่พอดี
          (ComingSoon.tsx:52-53 บันทึกไว้เองว่า "safe by accident" คือรูปที่ทีมใช้เวลาทั้งวันถอดออก) */}
      <ComingSoonNotice />
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
        {/* #316 — ตัดสินด้วย remindersLocked(isPaid) ไม่ใช่ `free` (fail-closed · null = ล็อก)
            ตรรกะอยู่ที่ features/v2-calendar/tier-lock.ts เพราะไฟล์ page นี้ unit test แตะไม่ได้ */}
        <YamTimes yams={detail.yams} onAdd={addYam} locked={remindersLocked(isPaid)} />
        {/* §12/§13 [advanced] — 8 ประตู · 8 เทพ */}
        {paid && advanced && <EightGates gates={detail.gates} luckyDirection={detail.luckyDirection} />}
        {paid && advanced && <EightDeities deities={detail.spirits} />}
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
        />
      )}
      {/* ชีทสอนติดตั้ง/เปิดสิทธิ์ — เปิดทับจากในชีทตั้งเตือน จึงต้องอยู่ชั้นเหนือมัน
          #302: บรรทัดนี้เคยเขียนว่า "z สูงกว่า" ทั้งที่ของจริงเท่ากัน (z-50 ทั้งคู่) — วันนั้นมันอยู่บนได้
          เพราะบังเอิญเรียงหลัง SaveSheet ตรงนี้ ไม่ใช่เพราะชั้น. ตอนนี้ชั้นบังคับจริงที่
          InstallGuideSheet.tsx (z-[60]) ⇒ **ลำดับสองบรรทัดนี้สลับกันได้โดยผลไม่เปลี่ยน**
          และมีฟันเฝ้าอยู่ที่ harness/save-sheet-hittable.ts เคส C */}
      {guide && <InstallGuideSheet variant={guide} onClose={() => setGuide(null)} />}
    </CalendarShell>
  )
}
