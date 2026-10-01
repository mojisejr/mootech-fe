import { describe, expect, it, vi } from 'vitest'

// lib/course/calendar ดึง db/subscription มาด้วย — เทสต์นี้ใช้แค่ youtubeId (pure) จึง mock db ไว้ไม่ให้ต่อจริง
vi.mock('@/lib/db', () => ({ db: {} }))

import { EPISODES, FREE_UNTIL_EP, COURSE_OFFERS, isCoursePackage } from '@/lib/course/calendar-content'
import { youtubeId } from '@/lib/course/calendar'

describe('คอร์สปฏิทิน Mumate', () => {
  it('มี 13 ตอน: EP 1-7 ฟรี, EP 8-13 ต้องมีสิทธิ์', () => {
    expect(EPISODES.map((e) => e.ep)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(EPISODES.filter((e) => e.free).map((e) => e.ep)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(FREE_UNTIL_EP).toBe(7)
  })

  it('แพ็กคอร์ส 490 / 790 และแยกจากแพ็กสมาชิกปกติ', () => {
    expect(COURSE_OFFERS.map((o) => o.price)).toEqual([490, 790])
    expect(isCoursePackage('COURSE_CAL_490')).toBe(true)
    expect(isCoursePackage('V2_PLUS_YEARLY')).toBe(false)
  })

  it('youtubeId อ่านลิงก์ทุกรูปแบบที่ฟิวอาจวาง และปฏิเสธลิงก์อื่น', () => {
    const id = 'dQw4w9WgXcQ'
    for (const u of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/embed/${id}`,
      `https://youtube.com/shorts/${id}`,
      `https://www.youtube.com/watch?feature=share&v=${id}`,
      id,
    ]) {
      expect(youtubeId(u)).toBe(id)
    }
    expect(youtubeId('https://vimeo.com/123')).toBeNull()
    expect(youtubeId('')).toBeNull()
  })
})
