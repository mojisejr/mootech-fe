// scripts/sacred-map-screen.test.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// Rebuild ตาม Figma (2026-09-10): list = การ์ดเป็น Link ไปหน้า detail แยก (/[id]); เช็คอิน/บันทึกอยู่หน้า detail.
import React from 'react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/sacred-map', isReady: true, asPath: '/v2/service/sacred-map' }),
}))
vi.mock('@/features/v2-service/components/SacredMapLeaflet', () => ({ default: () => null }))
// หน้า detail ใช้ TopBarAvatar/Bell (useCookies) — stub กัน context error ในเทส
vi.mock('@/features/v2-shell/components/TopBarAvatar', () => ({ TopBarAvatar: () => null }))
vi.mock('@/features/v2-shell/components/TopBarBell', () => ({ TopBarBell: () => null }))

const LOC = {
  id: 'loc-1', slug: 'chaopho-suea', name: 'ศาลเจ้าพ่อเสือ', deity: 'ตั่วเหล่าเอี๊ย', description: 'ขอพรการงาน',
  province: 'กรุงเทพมหานคร', address: 'ถนนตะนาว', lat: 13.75, lng: 100.5, direction: 'ทิศเหนือ',
  rasiUpper: '寅', rasiLower: null, element: 'wood', needs: ['การงาน', 'โชคลาภ'],
  worshipGuide: 'จุดธูป 3 ดอก', imageUrl: null, hasImage: true, googleMapUrl: null, checkinCount: 12,
}
const SAVED_KEY = 'mumate-sacred-saved'
let checkinBody: unknown = null
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/v2/sacred-map') && (init?.method ?? 'GET') === 'GET') return { ok: true, status: 200, json: async () => ({ ok: true, locations: [LOC] }) }
  if (u.includes('/api/v2/sacred-map') && init?.method === 'POST') { checkinBody = JSON.parse(String(init?.body)); return { ok: true, status: 200, json: async () => ({ ok: true, checkinCount: 13 }) } }
  if (u.includes('/api/referral')) return { ok: true, status: 200, json: async () => ({ code: 'MUMATE123' }) }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import { SacredMapScreen } from '@/features/v2-service/components/SacredMapScreen'
import { SacredPlaceDetailScreen } from '@/features/v2-service/components/SacredPlaceDetailScreen'

beforeEach(() => { checkinBody = null; fetchMock.mockClear(); try { localStorage.clear() } catch { /* ignore */ } })
afterEach(() => cleanup())

describe('จอแผนที่ศักดิ์สิทธิ์ (sacred-map, ต่อ engine)', () => {
  it('โหลดรายการจาก engine + การ์ดแสดงชื่อ/needs', async () => {
    render(<SacredMapScreen />)
    await waitFor(() => expect(screen.getByTestId('sacred-map-list')).toBeTruthy())
    expect(screen.getByText('ศาลเจ้าพ่อเสือ')).toBeTruthy()
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/v2/sacred-map'))).toBe(true)
  })

  it('การ์ด = ลิงก์ไปหน้ารายละเอียด /v2/service/sacred-map/<slug>', async () => {
    render(<SacredMapScreen />)
    const card = (await waitFor(() => screen.getByTestId('sacred-map-item'))) as HTMLAnchorElement
    expect(card.getAttribute('href')).toBe('/v2/service/sacred-map/chaopho-suea')
  })

  it('ตัวกรอง "เฉพาะที่บันทึก" — โชว์เฉพาะที่ save ไว้ (localStorage)', async () => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(['loc-1'])) } catch { /* ignore */ }
    render(<SacredMapScreen />)
    await waitFor(() => expect(screen.getByTestId('sacred-map-list')).toBeTruthy())
    fireEvent.click(screen.getByTestId('sacred-map-only-saved'))
    expect(screen.getByText('ศาลเจ้าพ่อเสือ')).toBeTruthy() // save แล้ว → ยังเห็น
  })
})

describe('หน้ารายละเอียดสถานที่ (SacredPlaceDetailScreen)', () => {
  it('แสดงคำทำนายรายด้าน (โพยการมู) + เช็คอินยิง POST พร้อม id', async () => {
    render(<SacredPlaceDetailScreen loc={LOC} />)
    expect(screen.getByTestId('sacred-place-guide')).toBeTruthy()
    expect(screen.getByText('ของไหว้')).toBeTruthy()
    fireEvent.click(screen.getByTestId('sacred-place-checkin'))
    await waitFor(() => expect(screen.getByTestId('sacred-place-checkin').textContent).toContain('เช็คอินแล้ว'))
    expect(checkinBody).toMatchObject({ id: 'loc-1' })
  })

  it('บันทึก → ปุ่มเปลี่ยนเป็น "บันทึกแล้ว" + เก็บ localStorage', () => {
    render(<SacredPlaceDetailScreen loc={LOC} />)
    fireEvent.click(screen.getByTestId('sacred-place-save'))
    expect(screen.getByTestId('sacred-place-save').textContent).toContain('บันทึกแล้ว')
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    expect(saved).toContain('loc-1')
  })
})
