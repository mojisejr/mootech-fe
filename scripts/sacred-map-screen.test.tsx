// scripts/sacred-map-screen.test.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ต่อ engine /api/sacred-map (ผ่าน BFF /api/v2/sacred-map): directory สถานที่ verified + เช็คอิน
import React from 'react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/sacred-map', isReady: true, asPath: '/v2/service/sacred-map' }),
}))

const LOC = {
  id: 'loc-1', name: 'ศาลเจ้าพ่อเสือ', deity: 'ตั่วเหล่าเอี๊ย', description: 'ขอพรการงาน',
  province: 'กรุงเทพมหานคร', address: null, lat: 13.75, lng: 100.5, direction: 'ทิศเหนือ',
  element: 'wood', needs: ['การงาน', 'โชคลาภ'], worshipGuide: 'จุดธูป 3 ดอก', imageUrl: null,
  googleMapUrl: null, checkinCount: 12,
}
let checkinBody: unknown = null
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/profile')) return { ok: true, status: 200, json: async () => ({ profile: { birthDate: '1992-03-20', birthTime: '08:30' } }) }
  if (u.includes('/api/bazi/element-summary')) return { ok: true, status: 200, json: async () => ({ summary: { elementTh: 'ไม้' } }) }
  if (u.includes('/api/v2/sacred-map') && (init?.method ?? 'GET') === 'GET') return { ok: true, status: 200, json: async () => ({ ok: true, locations: [LOC] }) }
  if (u.includes('/api/v2/sacred-map') && init?.method === 'POST') { checkinBody = JSON.parse(String(init?.body)); return { ok: true, status: 200, json: async () => ({ ok: true, checkinCount: 13 }) } }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import { SacredMapScreen } from '@/features/v2-service/components/SacredMapScreen'

beforeEach(() => { checkinBody = null; fetchMock.mockClear(); try { localStorage.clear() } catch { /* ignore */ } })
afterEach(() => cleanup())

describe('จอแผนที่ศักดิ์สิทธิ์ (sacred-map, ต่อ engine)', () => {
  it('โหลดรายการจาก engine + แสดงสถานที่/ธาตุ/needs', async () => {
    render(<SacredMapScreen />)
    await waitFor(() => expect(screen.getByTestId('sacred-map-list')).toBeTruthy())
    expect(screen.getByText('ศาลเจ้าพ่อเสือ')).toBeTruthy()
    // "การงาน" โผล่ทั้ง chip กรอง + badge บนการ์ด → ต้องเจออย่างน้อย 2
    expect(screen.getAllByText('การงาน').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/องค์เทพ: ตั่วเหล่าเอี๊ย/)).toBeTruthy()
    // ยิง GET ผ่าน BFF จริง
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/v2/sacred-map'))).toBe(true)
  })

  it('เช็คอิน → ยิง POST พร้อม id + ปุ่มเปลี่ยนเป็นเช็คอินแล้ว', async () => {
    render(<SacredMapScreen />)
    const btn = await waitFor(() => screen.getByTestId('sacred-map-checkin'))
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByTestId('sacred-map-checkin').textContent).toContain('เช็คอินแล้ว'))
    expect(checkinBody).toMatchObject({ id: 'loc-1' })
  })
})
