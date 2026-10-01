import { describe, expect, it, vi } from 'vitest'

// lib/course/access ดึง db มาด้วย — เทสต์นี้ใช้แค่ youtubeId (pure) จึง mock db ไว้ไม่ให้ต่อจริง
vi.mock('@/lib/db', () => ({ db: {} }))

import { COURSES, COURSE_PACKAGES, isCoursePackage, packagesGranting } from '@/lib/course/content'
import { youtubeId } from '@/lib/course/access'

describe('คอร์สออนไลน์ Mumate', () => {
  it('Win the Day: 13 บท — 1-7 ฟรี, 8-13 ต้องมีสิทธิ์ และเปิดให้สมาชิกที่จ่ายเงิน', () => {
    const c = COURSES.calendar
    expect(c.episodes.map((e) => e.ep)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(c.episodes.filter((e) => e.free).map((e) => e.ep)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(c.memberAccess).toBe(true)
  })

  it('Bazi Life Matrix: 15 บท ไม่มีบทฟรี และสมาชิกไม่ได้สิทธิ์อัตโนมัติ', () => {
    const m = COURSES['life-matrix']
    expect(m.episodes.map((e) => e.ep)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(m.episodes.some((e) => e.free)).toBe(false)
    expect(m.memberAccess).toBe(false)
  })

  it('funnel ราคา 490 → +300 (รวม 790) / +199 (รวม 689) และแพ็กให้สิทธิ์ถูกคอร์ส', () => {
    expect(COURSE_PACKAGES.COURSE_CAL_490.price + COURSE_PACKAGES.COURSE_MATRIX_UP_300.price).toBe(790)
    expect(COURSE_PACKAGES.COURSE_CAL_490.price + COURSE_PACKAGES.COURSE_MATRIX_199.price).toBe(689)
    expect(packagesGranting('calendar')).toEqual(['COURSE_CAL_490'])
    expect(packagesGranting('life-matrix')).toEqual(['COURSE_MATRIX_UP_300', 'COURSE_MATRIX_199'])
    expect(isCoursePackage('COURSE_MATRIX_199')).toBe(true)
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
