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
export { useReminders, type UseReminders } from './hooks/useReminders'
