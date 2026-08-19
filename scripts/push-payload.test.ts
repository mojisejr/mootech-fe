// #288 phase 4 — the notification payload carries ชื่อยาม + เวลา and deep-links to the day (goo).
import { describe, it, expect } from 'vitest'
import { buildReminderPayload } from '@/lib/push/payload'

describe('buildReminderPayload', () => {
  it('carries the ยาม name + time and deep-links to that day (sw.ts reads title/body/url)', () => {
    const p = buildReminderPayload({ date: '2026-08-19', yamLabel: 'ยามรุ่ง', window: '06:00-07:00' })
    expect(p.title).toContain('ยามรุ่ง') // ชื่อยาม
    expect(p.body).toContain('06:00-07:00') // เวลา
    expect(p.url).toBe('/v2/calendar/2026-08-19') // กด → เปิดหน้าวันนั้น
  })
})
