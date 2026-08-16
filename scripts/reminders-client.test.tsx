// #287 client slice — teeth on the transport mapping + useReminders state + the client past-guard (goo).
// Only the transport (global.fetch) is stubbed; the hook's own load/merge/dedupe/remove logic runs for
// real ([[thin-wrapper-mocked-both-sides]]). .test.tsx = vitest-only lane.
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  saveReminders,
  fetchReminders,
  cancelReminder,
  type SaveReminderInput,
} from '@/features/v2-calendar/hooks/reminders-api'
import { useReminders } from '@/features/v2-calendar/hooks/useReminders'
import { pastSelectedYams } from '@/features/v2-calendar/save-flow'
import type { ReminderDTO } from '@/features/v2-calendar/hooks/reminder-adapter'

const res = (status: number, body: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response

const dto = (id: string, date = '2026-09-20'): ReminderDTO => ({
  id, date, yamId: 'y1', yamLabel: 'ยาม', window: '05:00-06:59', destinations: ['mumate'],
  fireAtUtc: '2026-09-20T00:00:00.000Z',
})

const input: SaveReminderInput = { date: '2026-09-20', yams: [{ yamId: 'y1', yamLabel: 'ยาม', window: '05:00-06:59' }], destinations: ['mumate'] }

afterEach(() => vi.restoreAllMocks())

describe('reminders-api · every server status → a distinct typed outcome', () => {
  it('201 → ok with the returned rows', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(201, { reminders: [dto('a')] })))
    expect(await saveReminders(input)).toEqual({ ok: true, reminders: [dto('a')] })
  })
  it('422 → past with pastYamIds (never a silent success)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(422, { pastYamIds: ['y1'] })))
    expect(await saveReminders(input)).toEqual({ ok: false, kind: 'past', pastYamIds: ['y1'] })
  })
  it('403 → forbidden · 401 → unauthorized · 400 → invalid', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(403, {})))
    expect(await saveReminders(input)).toEqual({ ok: false, kind: 'forbidden' })
    vi.stubGlobal('fetch', vi.fn(async () => res(401, {})))
    expect(await saveReminders(input)).toEqual({ ok: false, kind: 'unauthorized' })
    vi.stubGlobal('fetch', vi.fn(async () => res(400, { error: 'bad' })))
    expect(await saveReminders(input)).toMatchObject({ ok: false, kind: 'invalid' })
  })
  it('5xx → error (retryable) · a thrown/network fetch → error, NOT a throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(500, {})))
    expect(await saveReminders(input)).toEqual({ ok: false, kind: 'error' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await saveReminders(input)).toEqual({ ok: false, kind: 'error' })
  })
  it('fetchReminders returns rows · throws on non-2xx · cancel maps ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { reminders: [dto('a'), dto('b')] })))
    expect((await fetchReminders()).map((r) => r.id)).toEqual(['a', 'b'])
    vi.stubGlobal('fetch', vi.fn(async () => res(500, {})))
    await expect(fetchReminders()).rejects.toThrow()
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { ok: true })))
    expect(await cancelReminder('a')).toBe(true)
  })
})

describe('useReminders · loads, saves (merge+dedupe), cancels', () => {
  it('mounts → loading → list from GET (StrictMode double-mount safe)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { reminders: [dto('a')] })))
    const { result } = renderHook(() => useReminders(), { wrapper: React.StrictMode })
    expect(result.current.loading).toBe(true) // first paint = empty, no hydration mismatch
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.list.totalYams).toBe(1)
    expect(result.current.hasReminderFor('2026-09-20')).toBe(true)
  })

  it('save merges the server rows; a retry returning the SAME id stays one row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { reminders: [] })))
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.stubGlobal('fetch', vi.fn(async () => res(201, { reminders: [dto('a')] })))
    await act(async () => { await result.current.save(input) })
    expect(result.current.list.totalYams).toBe(1)
    // idempotent retry: same id returned again → dedupe keeps ONE
    await act(async () => { await result.current.save(input) })
    expect(result.current.list.totalYams).toBe(1)
  })

  it('cancel removes the row after the server confirms', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { reminders: [dto('a'), dto('b')] })))
    const { result } = renderHook(() => useReminders())
    await waitFor(() => expect(result.current.list.totalYams).toBe(2))

    vi.stubGlobal('fetch', vi.fn(async () => res(200, { ok: true })))
    await act(async () => { await result.current.cancel('a') })
    expect(result.current.list.totalYams).toBe(1)
    expect(result.current.hasReminderFor('2026-09-20')).toBe(true) // 'b' still there
  })
})

describe('pastSelectedYams · client half of ③ reject-in-the-past', () => {
  const now = new Date('2026-09-20T00:00:00Z') // 07:00 BKK on 09-20
  const windows = { y3: '05:00-06:59', y5: '23:00-00:59' }
  it('flags a ยาม whose fire time already passed, not a future one', () => {
    // y3 05:00 BKK 09-20 → fire 04:30 already past; y5 23:00 → fire 22:30 still future
    expect(pastSelectedYams('2026-09-20', windows, ['y3', 'y5'], now)).toEqual(['y3'])
  })
  it('an unknown ยาม window is NOT false-flagged (server stays the authority)', () => {
    expect(pastSelectedYams('2026-09-20', windows, ['yX'], now)).toEqual([])
  })
})
