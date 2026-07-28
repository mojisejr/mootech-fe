// MuMate v2 — ปฏิทิน · รายละเอียดวัน (screen 2 · Figma 634:8194 ธรรมดา). Behind the v2 gate.
//
// Phase 3a (Lamun · designed UI): the scaffold body is replaced by the real 10-section normal-mode screen
// (§1 header · §2 date strip · §3 score card · §4 toggle · §6 ความเข้ากัน · §7 insight · §8 คำทำนายรายด้าน ·
// §10 ทิศ สีมงคล · §11 เวลามงคล · §14 floating menu). goo's hooks/routing are UNCHANGED — the page only reads
// them. Advanced-only sections (§5 ดวงของฉัน · §9 ดิถี · §12 8ประตู · §13 8เทพ) + toggle-ON land in 3b (634:8752).
// Data: grade/percent/ganzhi/summary/yams come from goo's DayDetail; the life-area / lucky-colour / deity
// content is Figma-frozen in day-detail/content.ts (TODO there: folds into goo's adapter at API-time). 0 network.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useDayDetail, useAdvancedMode, useReminders, menuStateForDay, type Reminder, type YamSlot } from '@/features/v2-calendar'
import { CalendarShell } from '@/features/v2-calendar/components/CalendarShell'
import { getDayFortuneContent } from '@/features/v2-calendar/components/day-detail/content'
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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2CalendarDayPage() {
  const router = useRouter()
  const date = typeof router.query.date === 'string' ? router.query.date : ''
  const { detail } = useDayDetail(date)
  // ฟีม: โหมดแอดวานซ์เปิดเป็นค่าเริ่มต้น (goo's useAdvancedMode default ON). Toggling OFF hides the 4
  // advanced-only sections (§5/§9/§12/§13) → the exact 3a normal frame (634:8194); toggling ON brings them back.
  const { advanced, toggle } = useAdvancedMode()
  const reminders = useReminders()
  const content = getDayFortuneContent(date)

  // per-ยาม quick-add (goo's client-truth list; de-duped in the hook) — makes the CTA + §11 buttons real.
  const addYam = (yam: YamSlot) => {
    const r: Reminder = {
      id: `${date}-${yam.id}`,
      date,
      yamId: yam.id,
      yamLabel: yam.label,
      window: yam.window,
      destinations: ['mumate'],
      group: 'upcoming',
    }
    reminders.add([r])
  }

  const saved = reminders.hasReminderFor(date)
  const menuState = menuStateForDay(saved) // PrimaryAction(2) → primary-cta · Saved(3) → saved

  return (
    <CalendarShell
      title="รายละเอียดวัน"
      menuState={menuState}
      ctaLabel={saved ? 'คุณบันทึกลงปฏิทินแล้ว' : 'เพิ่มลงปฏิทิน เพื่อแจ้งเตือน'}
      onCta={() => detail.yams[0] && addYam(detail.yams[0])}
    >
      <DayHeader />
      <div className="flex flex-col gap-4 px-4 pt-3">
        <DayStrip date={date} />
        <DayScoreCard detail={detail} content={content} />
        <AdvancedToggle on={advanced} onToggle={toggle} />
        {/* §5 [advanced] — ดวงของฉัน (binds goo's detail.pillars) */}
        {advanced && <MyChart pillars={detail.pillars} />}
        <CompatList areas={content.compatAreas} insight={content.insight} />
        <PredictionCards areas={content.compatAreas} />
        {/* §9 [advanced] — ดิถีวันนี้ · สะสม */}
        {advanced && <Dithi items={content.dithi} />}
        <LuckyColors colors={content.luckyColors} deity={content.dayDeity} />
        <YamTimes yams={detail.yams} onAdd={addYam} />
        {/* §12/§13 [advanced] — 8 ประตู · 8 เทพ */}
        {advanced && <EightGates gates={content.gates} />}
        {advanced && <EightDeities deities={content.deities} />}
      </div>
    </CalendarShell>
  )
}
