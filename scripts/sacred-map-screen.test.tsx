// scripts/sacred-map-screen.test.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ต่อ engine /api/sacred-map (BFF /api/v2/sacred-map): list → การ์ด → โมดัลรายละเอียด + เช็คอิน/บันทึก
import React from 'react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/sacred-map', isReady: true, asPath: '/v2/service/sacred-map' }),
}))
// leaflet map = dynamic ssr:false → stub เป็น no-op กันโหลด leaflet ในเทสต์
vi.mock('@/features/v2-service/components/SacredMapLeaflet', () => ({ default: () => null }))

const LOC = {
  id: 'loc-1', name: 'ศาลเจ้าพ่อเสือ', deity: 'ตั่วเหล่าเอี๊ย', description: 'ขอพรการงาน',
  province: 'กรุงเทพมหานคร', address: 'ถนนตะนาว', lat: 13.75, lng: 100.5, direction: 'ทิศเหนือ',
  rasiUpper: '寅', rasiLower: null, element: 'wood', needs: ['การงาน', 'โชคลาภ'],
  worshipGuide: 'จุดธูป 3 ดอก', imageUrl: null, hasImage: true, googleMapUrl: null, checkinCount: 12,
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
  it('โหลดรายการจาก engine + การ์ดแสดงชื่อ/needs', async () => {
    render(<SacredMapScreen />)
    await waitFor(() => expect(screen.getByTestId('sacred-map-list')).toBeTruthy())
    expect(screen.getByText('ศาลเจ้าพ่อเสือ')).toBeTruthy()
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/v2/sacred-map'))).toBe(true)
  })

  it('แตะการ์ด → โมดัลรายละเอียด (โพยการมู) → เช็คอินยิง POST พร้อม id', async () => {
    render(<SacredMapScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('sacred-map-item')))
    await waitFor(() => expect(screen.getByTestId('sacred-map-detail')).toBeTruthy())
    expect(screen.getByText('โพยการมู')).toBeTruthy()
    expect(screen.getByText('ทิศมงคล')).toBeTruthy() // label เฉพาะในโมดัล
    fireEvent.click(screen.getByTestId('sacred-map-detail-checkin'))
    await waitFor(() => expect(screen.getByTestId('sacred-map-detail-checkin').textContent).toContain('เช็คอินแล้ว'))
    expect(checkinBody).toMatchObject({ id: 'loc-1' })
  })

  it('บันทึก → เฉพาะที่บันทึก กรองเหลือเฉพาะที่ save', async () => {
    render(<SacredMapScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('sacred-map-item')))
    fireEvent.click(await waitFor(() => screen.getByTestId('sacred-map-detail-save')))
    fireEvent.click(screen.getByTestId('sacred-map-detail-close'))
    // เปิด "เฉพาะที่บันทึก" → ยังเห็น loc-1 (เพราะ save แล้ว)
    fireEvent.click(screen.getByTestId('sacred-map-only-saved'))
    expect(screen.getByText('ศาลเจ้าพ่อเสือ')).toBeTruthy()
  })
})
