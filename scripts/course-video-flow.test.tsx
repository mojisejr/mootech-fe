// scripts/course-video-flow.test.tsx — วางลิงก์ใน /ops แล้วหน้าคอร์สเปลี่ยนเอง (gafiw/เอ็ม 2026-10-21)
//   CV1 API: บทที่มีลิงก์ = ready + videoId (ลิงก์ youtu.be และ shorts) · บทที่ไม่มี = ไม่ ready · บทล็อกไม่ส่ง videoId ให้คนไม่มีสิทธิ์
//   CV2 สารบัญ: มีลิงก์ → "▶ ดู" ไม่มี "เร็ว ๆ นี้" · ไม่มีลิงก์ → "เร็ว ๆ นี้" · ล็อก → 🔒
//   CV3 หน้าคลิป: (+ กันกดออกไป YouTube: controls=0 + ชั้นคลุม + ไม่มีลิงก์ YouTube) มีลิงก์ → ปก + ปุ่ม ▶ (ไม่มีข้อความเร็ว ๆ นี้) → กดแล้วโหลด YouTube autoplay · ไม่มีลิงก์ → "กำลังจะมา เร็ว ๆ นี้"
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

// ── ตาราง course_video ที่ /ops เขียน (gafiw ส่ง 10 ลิงก์แรก) ──
const ROWS = [
  { ep: 1, video_url: 'https://youtu.be/hNCcXdjL2Lk' },
  { ep: 2, video_url: 'https://youtube.com/shorts/UgGvdWmy5Ss?feature=share' },
  { ep: 8, video_url: 'https://youtu.be/j6jeYQRGcUo' },
]
vi.mock('@/lib/db', () => ({ db: { execute: vi.fn(async () => ({ rows: ROWS })) } }))
let who: { ok: boolean; userId?: string } = { ok: false }
vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => who) }))
vi.mock('@/lib/course/access', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return { ...actual, courseAccessFor: vi.fn(async (_s: string, uid: string | null) => (uid === 'BUYER' ? { access: true, via: 'purchase' } : { access: false, via: null })) }
})
let query: Record<string, string> = { slug: 'calendar', ep: '1' }
vi.mock('next/router', () => ({ useRouter: () => ({ query, isReady: true, push: vi.fn(), pathname: '/course/[slug]/[ep]', asPath: '/' }) }))

import handler from '@/pages/api/course/[slug]'
import { EpisodeList } from '@/features/course/EpisodeList'
import EpisodePage from '@/pages/course/[slug]/[ep]'
import { COURSES } from '@/lib/course/content'

async function api(uid: string | null) {
  who = uid ? { ok: true, userId: uid } : { ok: false }
  let body: any = null
  const res = { setHeader: vi.fn(), status: () => ({ json: (b: unknown) => { body = b } }) }
  await handler({ method: 'GET', query: { slug: 'calendar' } } as never, res as never)
  return body
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => api(null) })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('วางลิงก์ใน /ops แล้วหน้าคอร์สเปลี่ยนเอง', () => {
  it('CV1 API ready/videoId ตามลิงก์ในตาราง (youtu.be + shorts) · บทล็อกไม่ส่ง id', async () => {
    const anon = await api(null)
    const e = (n: number) => anon.episodes.find((x: { ep: number }) => x.ep === n)
    expect(e(1)).toMatchObject({ ready: true, videoId: 'hNCcXdjL2Lk' })
    expect(e(2)).toMatchObject({ ready: true, videoId: 'UgGvdWmy5Ss' })
    expect(e(3)).toMatchObject({ ready: false, videoId: null })
    expect(e(8)).toMatchObject({ ready: true, videoId: null }) // บทเสียเงิน: ไม่ส่ง id ให้คนไม่มีสิทธิ์
    const buyer = await api('BUYER')
    expect(buyer.episodes.find((x: { ep: number }) => x.ep === 8).videoId).toBe('j6jeYQRGcUo')
  })

  it('CV2 สารบัญ: มีลิงก์ = ▶ ดู · ไม่มี = เร็ว ๆ นี้ · ล็อก = 🔒', async () => {
    const { episodes } = await api(null)
    render(<EpisodeList course={COURSES.calendar} episodes={episodes} access={false} />)
    expect(screen.getByTestId('course-ep-1').textContent).toContain('▶ ดู')
    expect(screen.getByTestId('course-ep-1').textContent).not.toContain('เร็ว ๆ นี้')
    expect(screen.getByTestId('course-ep-2').textContent).toContain('▶ ดู')
    expect(screen.getByTestId('course-ep-3').textContent).toContain('เร็ว ๆ นี้')
    expect(screen.getByTestId('course-ep-8').textContent).toContain('🔒')
    expect(screen.getByTestId('course-ep-cover-1').getAttribute('src')).toBe('/images/course/calendar/cover-1.webp')
  })

  it('CV3 หน้าคลิปที่มีลิงก์: ปก + ▶ → กดแล้วเล่น YouTube (autoplay)', async () => {
    query = { slug: 'calendar', ep: '1' }
    render(<EpisodePage />)
    await waitFor(() => expect(screen.getByTestId('course-play')).toBeTruthy())
    expect(screen.getByTestId('course-cover')).toBeTruthy()
    expect(document.body.textContent).not.toContain('เร็ว ๆ นี้')
    expect(screen.queryByTestId('course-player')).toBeNull() // ยังไม่โหลด YouTube จนกว่าจะกด
    fireEvent.click(screen.getByTestId('course-play'))
    const player = screen.getByTestId('course-player')
    expect(player.getAttribute('src')).toContain('/embed/hNCcXdjL2Lk')
    expect(player.getAttribute('src')).toContain('autoplay=1')
    // กันกดออกไป YouTube (เอ็ม 2026-10-21): ซ่อนแถบควบคุม/คีย์ลัด/เต็มจอของ YouTube · iframe แตะไม่ได้ · ชั้นคลุมรับแตะแทน
    expect(player.getAttribute('src')).toContain('controls=0')
    expect(player.getAttribute('src')).toContain('disablekb=1')
    expect(player.getAttribute('src')).toContain('fs=0')
    expect(player.className).toContain('pointer-events-none')
    expect(screen.getByTestId('course-player-shield')).toBeTruthy()
    expect(screen.getByTestId('course-player-seek')).toBeTruthy()
    expect(document.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]')).toBeNull()
  })

  it('CV3b หน้าคลิปที่ยังไม่มีลิงก์: ปก + "กำลังจะมา เร็ว ๆ นี้" ไม่มีปุ่มเล่น', async () => {
    query = { slug: 'calendar', ep: '3' }
    render(<EpisodePage />)
    await waitFor(() => expect(document.body.textContent).toContain('คลิปบทนี้กำลังจะมา เร็ว ๆ นี้'))
    expect(screen.queryByTestId('course-play')).toBeNull()
    expect(screen.getByTestId('course-cover')).toBeTruthy()
  })
})

// คอร์สของฉันในหน้าโปรไฟล์ (เอ็ม 2026-10-21)
import { MyCoursesCard } from '@/features/v2-account/components/MyCoursesCard'
describe('คอร์สของฉัน (โปรไฟล์)', () => {
  it('มีสิทธิ์ → เรียนต่อ · ยังไม่มี → ปุ่มซื้อคอร์สไปหน้าขาย · ไม่มีรายการ → ไม่วาด', () => {
    const { rerender } = render(<MyCoursesCard courses={[{ slug: 'calendar', name: 'Win the Day', access: true, via: 'purchase', ready: 10, total: 13 }]} />)
    const row = screen.getByTestId('account-course-calendar')
    expect(row.getAttribute('href')).toBe('/course/calendar')
    expect(row.textContent).toContain('ซื้อแล้ว · พร้อมเรียน 10/13 บท')
    expect(screen.getByTestId('account-course-calendar-learn').textContent).toBe('เรียนต่อ')
    rerender(<MyCoursesCard courses={[{ slug: 'calendar', name: 'Win the Day', access: false, via: null, ready: 10, total: 13, priceLabel: '฿490' }]} />)
    expect(screen.getByTestId('account-course-calendar').getAttribute('href')).toBe('/course/calendar')
    expect(screen.getByTestId('account-course-calendar-buy').textContent).toBe('ซื้อคอร์ส ฿490')
    expect(screen.getByTestId('account-my-courses').textContent).toContain('คอร์สเรียน Mumate')
    rerender(<MyCoursesCard courses={[]} />)
    expect(screen.queryByTestId('account-my-courses')).toBeNull()
  })
})
