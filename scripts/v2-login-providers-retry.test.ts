// scripts/v2-login-providers-retry.test.ts — 2026-09-20 (เอ็ม live พบ): สมัครใหม่ด้วย LINE ครั้งแรกพัง
// "เข้าสู่ระบบไม่สำเร็จ / รหัสอ้างอิง: undefined" — root cause: next-auth's signIn() ยิง
// fetch('/api/auth/providers') เองก่อนเปิด OAuth เสมอ, ถ้า fetch นั้นพลาด (cold-start ครั้งแรกใน LINE
// webview) จะเด้งไป /api/auth/error แบบไม่มี query เลย. ensureAuthProvidersReachable() = pre-check
// พร้อม retry สั้นๆ ก่อนเรียก signIn() จริง เพื่อลด race นี้.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureAuthProvidersReachable } from '../features/auth/hooks/useV2Login'

describe('ensureAuthProvidersReachable — retry ก่อนเรียก next-auth signIn()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('fetch สำเร็จรอบแรก → resolve ทันที ไม่ retry', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await ensureAuthProvidersReachable()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fetch พลาด 2 รอบแรก (cold-start) → retry แล้วสำเร็จรอบที่ 3', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls += 1
      if (calls < 3) throw new Error('network')
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = ensureAuthProvidersReachable(2, 350)
    await vi.advanceTimersByTimeAsync(2 * 350)
    await p

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('fetch พลาดทุกรอบ → resolve เฉยๆ (ไม่ throw) เพื่อให้ signIn() ยังถูกเรียกต่อเหมือนพฤติกรรมเดิม', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('still down')
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = ensureAuthProvidersReachable(2, 350)
    await vi.advanceTimersByTimeAsync(2 * 350)
    await expect(p).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 ครั้งแรก + retry 2 ครั้ง
  })

  it('response ไม่ ok (เช่น 500) → นับเป็นพลาด ลอง retry ต่อ', async () => {
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls += 1
      if (calls === 1) return new Response(null, { status: 500 })
      return new Response(null, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = ensureAuthProvidersReachable(2, 350)
    await vi.advanceTimersByTimeAsync(1 * 350)
    await p

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
