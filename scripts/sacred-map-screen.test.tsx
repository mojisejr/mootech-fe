// scripts/sacred-map-screen.test.tsx — /v2/service/sacred-map (แผนที่ศักดิ์สิทธิ์)
// ไม่มีเฟรม Figma → ออกแบบเอง; ล็อก: ธาตุ→ทิศ/สีมงคลตามเบญจธาตุ + empty state (ไม่มีวันเกิด)
import React from 'react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/sacred-map', isReady: true, asPath: '/v2/service/sacred-map' }),
}))

let hasBirth = true
const fetchMock = vi.fn(async (url: string) => {
  const u = String(url)
  if (u.includes('/api/profile')) {
    return { ok: true, status: 200, json: async () => ({ profile: hasBirth ? { birthDate: '1992-03-20', birthTime: '08:30' } : { birthDate: null } }) }
  }
  if (u.includes('/api/bazi/element-summary')) {
    return { ok: true, status: 200, json: async () => ({ summary: { elementTh: 'ไม้' } }) }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import { SacredMapScreen } from '@/features/v2-service/components/SacredMapScreen'

beforeEach(() => { hasBirth = true; fetchMock.mockClear() })
afterEach(() => cleanup())

describe('จอแผนที่ศักดิ์สิทธิ์ (sacred-map)', () => {
  it('ธาตุไม้ → ทิศ/สีมงคลถูกตามเบญจธาตุ', async () => {
    render(<SacredMapScreen />)
    await waitFor(() => expect(screen.getByTestId('sacred-map-hero')).toBeTruthy())
    // badge ธาตุ
    expect(screen.getByText(/ธาตุประจำตัว: ธาตุไม้/)).toBeTruthy()
    // ไม้: เสริมพลัง ออก/ออกเฉียงใต้ · เสริมดวง=น้ำ(เหนือ) · เลี่ยง=ทอง(ตก/ตกเฉียงเหนือ)
    expect(screen.getByText(/ตะวันออก · ตะวันออกเฉียงใต้/)).toBeTruthy()
    expect(screen.getByText(/ทิศเสริมดวง \(ธาตุน้ำ\)/)).toBeTruthy()
    expect(screen.getByText(/ทิศควรเลี่ยง \(ธาตุทอง\)/)).toBeTruthy()
    // สีมงคล
    expect(screen.getByTestId('sacred-map-colors').textContent).toContain('เขียว')
    expect(screen.getByTestId('sacred-map-bagua')).toBeTruthy()
  })

  it('ยังไม่มีวันเกิด → empty state ชวนกรอกวันเกิด', async () => {
    hasBirth = false
    render(<SacredMapScreen />)
    await waitFor(() => expect(screen.getByTestId('sacred-map-empty')).toBeTruthy())
    const cta = screen.getByTestId('sacred-map-add-birth') as HTMLAnchorElement
    expect(cta.getAttribute('href')).toBe('/v2/settings/edit-birth')
  })
})
