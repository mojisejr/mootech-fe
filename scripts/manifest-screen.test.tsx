// scripts/manifest-screen.test.tsx — /v2/service/manifest (สมุดแมนิเฟสต์, Figma 55512-*).
// Rebuilt screen: onboarding hero (empty) → filled home carousel of manifest cards + ธาตุประจำเดือน + ปุ่มเพิ่ม.
// Mounts with `previewData` (no fetch/load path) so the assertions read what the user actually sees.
// CookiesProvider wraps every render — TopBarAvatar → useMemberIdentity → useCookies needs it (react-cookie).
import React from 'react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/manifest', isReady: true, asPath: '/v2/service/manifest' }),
}))

// The ธาตุ card's mascot image fetches on its own; keep fetch benign so nothing rejects unhandled.
const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
vi.stubGlobal('fetch', fetchMock)

import { ManifestScreen } from '@/features/v2-service/components/ManifestScreen'

const GOAL = {
  id: 'g1', title: 'มีเงินเก็บ 1 แสน', affirmation: 'ฉันเป็นคนที่เงินไหลมาหาเสมอ', imageUrl: null, category: 'การเงิน',
  status: 'active', tasks: [], progress: { done: 0, target: 1, percent: 0 },
}
const ELEMENT = { elementTh: 'ไฟ', dayGanzhi: '甲子' }

const mount = (preview: object) => render(<CookiesProvider>{React.createElement(ManifestScreen, { previewData: preview } as never)}</CookiesProvider>)

beforeEach(() => { fetchMock.mockClear(); try { localStorage.clear() } catch { /* ignore */ } })
afterEach(() => cleanup())

describe('จอสมุดแมนิเฟสต์ (rebuilt)', () => {
  it('มีเป้าหมาย → filled home: carousel + การ์ด + affirmation + ปุ่มเพิ่ม', async () => {
    mount({ goals: [GOAL], element: ELEMENT })
    await waitFor(() => expect(screen.getByTestId('manifest-list')).toBeTruthy())
    expect(screen.getByTestId('manifest-carousel')).toBeTruthy()
    expect(screen.getByTestId('manifest-goal')).toBeTruthy()
    expect(screen.getByText('ฉันเป็นคนที่เงินไหลมาหาเสมอ')).toBeTruthy()
    expect(screen.getByTestId('manifest-add')).toBeTruthy()
  })

  it('มีการ์ดธาตุประจำเดือนจากข้อมูลผู้ใช้', async () => {
    mount({ goals: [GOAL], element: ELEMENT })
    await waitFor(() => expect(screen.getByTestId('manifest-element')).toBeTruthy())
  })

  it('ไม่มีเป้าหมาย → onboarding hero + ปุ่มเขียนแมนิเฟสต์', async () => {
    mount({ goals: [], element: ELEMENT })
    await waitFor(() => expect(screen.getByTestId('manifest-hero')).toBeTruthy())
    expect(screen.getByTestId('manifest-write')).toBeTruthy()
  })

  it('P3-18: กด "ลบ" ต้องถามยืนยันก่อน (ไม่ลบทันที) — ยกเลิกแล้วไม่ยิง DELETE', async () => {
    mount({ goals: [GOAL], element: ELEMENT })
    await waitFor(() => expect(screen.getByTestId('manifest-goal')).toBeTruthy())
    fireEvent.click(screen.getByTestId('manifest-delete'))
    expect(screen.getByTestId('manifest-delete-confirm')).toBeTruthy()
    // ยังไม่มี DELETE ถูกยิง
    expect(fetchMock.mock.calls.some((c) => (c[1] as { method?: string } | undefined)?.method === 'DELETE')).toBe(false)
    fireEvent.click(screen.getByTestId('manifest-delete-cancel'))
    expect(screen.queryByTestId('manifest-delete-confirm')).toBeNull()
    expect(fetchMock.mock.calls.some((c) => (c[1] as { method?: string } | undefined)?.method === 'DELETE')).toBe(false)
  })

  it('P3-18: ยืนยันลบ → ยิง DELETE /api/v2/manifest/goals + เอาการ์ดออก', async () => {
    mount({ goals: [GOAL], element: ELEMENT })
    await waitFor(() => expect(screen.getByTestId('manifest-goal')).toBeTruthy())
    fireEvent.click(screen.getByTestId('manifest-delete'))
    fireEvent.click(screen.getByTestId('manifest-delete-confirm-btn'))
    await waitFor(() => expect(screen.queryByTestId('manifest-goal')).toBeNull())
    const del = fetchMock.mock.calls.find((c) => (c[1] as { method?: string } | undefined)?.method === 'DELETE')
    expect(del).toBeTruthy()
    expect(String(del?.[0])).toContain('/api/v2/manifest/goals')
  })
})
