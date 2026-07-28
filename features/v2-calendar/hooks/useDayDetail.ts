// MuMate v2 — ปฏิทินดวง · useDayDetail (goo · layer-2 mock data, API-fed later).
// Given a date (the /v2/calendar/[date] route param), returns the day-detail payload for screens 2/3.
import { useMemo } from 'react'
import type { DayDetail } from '../types'
import { mockDayDetail } from '../fixtures'

export interface UseDayDetail {
  detail: DayDetail
}

/** `date` is the ISO route param. Mock now; at API-time swap mockDayDetail → adapter (same shape). */
export function useDayDetail(date: string): UseDayDetail {
  const detail = useMemo(() => mockDayDetail(date), [date])
  return { detail }
}
