// scripts/oauth-redirect.test.ts — 2026-09-20 (เอ็ม live: LINE signup ใหม่ยังพังหลัง #723):
// startOAuthRedirect เลี่ยง getProviders ของ next-auth signIn() (ต้นเหตุ "รหัสอ้างอิง: undefined") ด้วย
// full-page form POST ตรงไป /api/auth/signin/<provider>. เทสต์: csrf retry + สร้างฟอร์มถูกเส้น/ถูก field +
// fallback ไป signIn() เมื่อ csrf พังจริง.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signInMock = vi.fn()
vi.mock('next-auth/react', () => ({ signIn: (...a: unknown[]) => signInMock(...a) }))

import { fetchCsrfToken, startOAuthRedirect } from '../lib/auth/oauth-redirect'

describe('fetchCsrfToken — retry ก่อน POST signin', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    signInMock.mockReset()
  })

  it('สำเร็จรอบแรก → คืน token, ยิงครั้งเดียว', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ csrfToken: 'tok-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCsrfToken()).resolves.toBe('tok-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/csrf', { credentials: 'same-origin' })
  })

  it('พลาด 2 รอบแรก (cold-start) → retry แล้วสำเร็จรอบที่ 3', async () => {
    let n = 0
    const fetchMock = vi.fn(async () => {
      n += 1
      if (n < 3) throw new Error('network')
      return new Response(JSON.stringify({ csrfToken: 'tok-3' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = fetchCsrfToken(2, 350)
    await vi.advanceTimersByTimeAsync(2 * 350)
    await expect(p).resolves.toBe('tok-3')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('พลาดทุกรอบ → คืน null (ให้ผู้เรียก fallback)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('down')
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = fetchCsrfToken(2, 350)
    await vi.advanceTimersByTimeAsync(2 * 350)
    await expect(p).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('200 แต่ไม่มี csrfToken → นับเป็นพลาด retry ต่อ', async () => {
    let n = 0
    const fetchMock = vi.fn(async () => {
      n += 1
      if (n === 1) return new Response(JSON.stringify({}), { status: 200 })
      return new Response(JSON.stringify({ csrfToken: 'tok-2' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = fetchCsrfToken(2, 350)
    await vi.advanceTimersByTimeAsync(1 * 350)
    await expect(p).resolves.toBe('tok-2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('startOAuthRedirect — form POST ตรง เลี่ยง getProviders', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    signInMock.mockReset()
    document.body.innerHTML = ''
  })

  it('csrf ผ่าน → สร้างฟอร์ม POST /api/auth/signin/<provider> + csrfToken/callbackUrl แล้ว submit (ไม่เรียก signIn)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ csrfToken: 'tok-x' }), { status: 200 })))
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})

    let submittedForm: HTMLFormElement | null = null
    submitSpy.mockImplementation(function (this: HTMLFormElement) {
      submittedForm = this
    })

    await startOAuthRedirect('line', '/v2')

    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(signInMock).not.toHaveBeenCalled()
    const form = submittedForm as unknown as HTMLFormElement
    expect(form).toBeTruthy()
    expect(form.method).toBe('post')
    expect(form.getAttribute('action')).toBe('/api/auth/signin/line')
    const fields = Object.fromEntries(
      Array.from(form.querySelectorAll('input')).map((i) => [i.name, i.value]),
    )
    expect(fields.csrfToken).toBe('tok-x')
    expect(fields.callbackUrl).toBe('/v2')

    submitSpy.mockRestore()
  })

  it('csrf พังจริง → fallback ไป signIn(provider, {callbackUrl}) เหมือนเดิม', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('down')
    }))
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})

    await startOAuthRedirect('line', '/auth/after/line')

    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith('line', { callbackUrl: '/auth/after/line' })
    expect(submitSpy).not.toHaveBeenCalled()

    submitSpy.mockRestore()
  })
})
