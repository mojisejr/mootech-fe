// MuMate v2 — ปฏิทินดวง · Phase 0 public surface (goo → Lamun). Import from '@/features/v2-calendar'.
// Types + pure logic + hooks + fixtures. NO components (UI is Lamun's), NO network (0 app-fetch).
export * from './types'
export * from './grade'
export * from './menu-state'
export * from './save-flow'
export * from './month-grid'
export { bangkokTodayISO, bangkokToday } from './today'
export {
  MOCK_YEAR,
  MOCK_MONTH,
  MOCK_DAYS,
  MOCK_REMINDERS,
  generateMonthDays,
  mockCalendarMonth,
  mockDayDetail,
  mockReminderList,
} from './fixtures'

export { useCalendarMonth, type UseCalendarMonth } from './hooks/useCalendarMonth'
export { useDayDetail, type UseDayDetail } from './hooks/useDayDetail'
export { useAdvancedMode, type UseAdvancedMode } from './hooks/useAdvancedMode'
export { useReminderDraft, type UseReminderDraft } from './hooks/useReminderDraft'
export { useReminders, type UseReminders, addedYamIdsForDate } from './hooks/useReminders'

// #341 — ตรรกะยาม 3 สถานะ + ปุ่มแถบล่าง 7 สถานะ (goo · P2/P3=มุน เอาไปวาด)
export {
  yamReminderStatus,
  dayReminderCta,
  type YamReminderStatus,
  type ReminderCtaKind,
  type ReminderCtaPlan,
  DAY_CTA_SAVING_LABEL,
  DAY_CTA_JUST_SAVED_LABEL,
  DAY_CTA_ADD_MORE_LABEL,
  DAY_CTA_VIEW_LIST_LABEL,
  DAY_CTA_EXPIRED_LABEL,
} from './tier-lock'
