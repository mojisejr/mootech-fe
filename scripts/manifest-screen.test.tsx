// scripts/manifest-screen.test.tsx — /v2/service/manifest (มานิเฟส) — ต่อ engine /api/manifest/*
import React from 'react'
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/service/manifest', isReady: true, asPath: '/v2/service/manifest' }),
}))

const GOAL = {
  id: 'g1', title: 'มีเงินเก็บ 1 แสน', affirmation: 'ฉันเป็นคนที่เงินไหลมาหาเสมอ', imageUrl: null, status: 'active',
  tasks: [{ id: 't1', title: 'เก็บเงินวันละ 50 บาท', targetCount: 30, isDaily: true, doneCount: 1 }],
  progress: { done: 1, target: 30, percent: 3 },
}
let goals: unknown[] = [GOAL]
let checkinBody: unknown = null
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  if (u.includes('/api/v2/manifest/goals') && (init?.method ?? 'GET') === 'GET') return { ok: true, status: 200, json: async () => ({ goals }) }
  if (u.includes('/api/v2/manifest/checkin')) { checkinBody = JSON.parse(String(init?.body)); return { ok: true, status: 200, json: async () => ({ done: true }) } }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import { ManifestScreen } from '@/features/v2-service/components/ManifestScreen'

beforeEach(() => { goals = [GOAL]; checkinBody = null; fetchMock.mockClear(); try { localStorage.clear() } catch { /* ignore */ } })
afterEach(() => cleanup())

describe('จอมานิเฟส (manifest, ต่อ engine)', () => {
  it('แสดงเป้าหมาย + affirmation + ภารกิจ + progress จาก engine', async () => {
    render(<ManifestScreen />)
    await waitFor(() => expect(screen.getByTestId('manifest-list')).toBeTruthy())
    expect(screen.getByText('มีเงินเก็บ 1 แสน')).toBeTruthy()
    expect(screen.getByText(/เงินไหลมาหาเสมอ/)).toBeTruthy()
    expect(screen.getByText('เก็บเงินวันละ 50 บาท')).toBeTruthy()
  })

  it('ติ๊กภารกิจ → ยิง checkin done=true พร้อม taskId', async () => {
    render(<ManifestScreen />)
    fireEvent.click(await waitFor(() => screen.getByTestId('manifest-task')))
    await waitFor(() => expect(checkinBody).toMatchObject({ taskId: 't1', done: true }))
  })

  it('ไม่มีเป้าหมาย → empty state ชวนสร้าง', async () => {
    goals = []
    render(<ManifestScreen />)
    await waitFor(() => expect(screen.getByTestId('manifest-empty')).toBeTruthy())
    expect(screen.getByTestId('manifest-add')).toBeTruthy()
  })
})
