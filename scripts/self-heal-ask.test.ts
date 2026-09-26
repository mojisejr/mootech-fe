// scripts/self-heal-ask.test.ts — the self-heal asks before creating
// (mumate-login-identity-001 slice 5). The self-heal is the ONLY path that creates members
// in production (index.tsx redirects to /v2 once launched; the three modals only import
// UserRegisterOrLogin), so this is where D1 is enforced.
//
// 🔴 MUTANT CONTRACT:
//   S1 drop the status check → "unowned + ask → goes to the question, never registers" red (D1)
//   S2 fail closed (no register when the status read fails) → "status unreachable → registers as today" red
//   S3 ignore the remembered choice → "chose create-new → registers without asking again" red
//   S4 heal on the question page itself → "never heals on the question page" red
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { session, registerCall, userGet, signOutMock, setCookieMock, removeCookieMock, statusMock } = vi.hoisted(() => ({
  session: { status: 'authenticated', data: { user: { name: 'ทดสอบ', image: '' }, provider: 'google', providerId: '109876543210987654321' } },
  registerCall: vi.fn(),
  userGet: vi.fn(),
  signOutMock: vi.fn(),
  setCookieMock: vi.fn(),
  removeCookieMock: vi.fn(),
  statusMock: vi.fn(),
}))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: session.data, status: session.status }),
  signOut: signOutMock,
}))
vi.mock('react-cookie', () => ({ useCookies: () => [{}, setCookieMock, removeCookieMock] }))
vi.mock('@/lib/auth/use-current-user', () => ({ useCurrentUser: () => ({ status: 'loading' }) }))
vi.mock('@/constants/api/api-user-register-or-login', () => ({ UserRegisterOrLogin: registerCall }))
vi.mock('@/constants/api/api-user-get', () => ({ UserGetById: userGet }))
vi.mock('@/lib/auth/ask-before-create', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/ask-before-create')>()),
  fetchIdentityStatus: () => statusMock(),
}))

import { useSelfHealIdentity } from '@/lib/auth/use-self-heal-identity'
import { rememberCreateNew } from '@/lib/auth/ask-before-create'

const assign = vi.fn()
let pathname = '/v2'

beforeEach(() => {
  registerCall.mockReset().mockResolvedValue({ user_id: 'u-1', ref_code: 'R1', name: 'n', picture_url: '' })
  statusMock.mockReset()
  assign.mockReset()
  pathname = '/v2'
  window.sessionStorage.clear()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { get pathname() { return pathname }, assign, origin: 'https://example.test' },
  })
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

async function fire() {
  renderHook(() => useSelfHealIdentity())
  await vi.advanceTimersByTimeAsync(3_000 + 1)
  await vi.advanceTimersByTimeAsync(10)
}

describe('self-heal · ask before creating (slice 5)', () => {
  it('unowned + ask → goes to the question, never registers (D1)', async () => {
    statusMock.mockResolvedValue({ signedIn: true, known: false, ask: true, provider: 'google' })
    await fire()
    expect(assign).toHaveBeenCalledWith('/v2/welcome-back')
    expect(registerCall).not.toHaveBeenCalled()
  })

  it('known identity → registers (logs in) exactly as today, no detour (D2)', async () => {
    statusMock.mockResolvedValue({ signedIn: true, known: true, ask: false, provider: 'google' })
    await fire()
    expect(assign).not.toHaveBeenCalled()
    expect(registerCall).toHaveBeenCalledTimes(1)
  })

  it('switch off (ask:false for an unowned identity) → registers as today (D7)', async () => {
    statusMock.mockResolvedValue({ signedIn: true, known: false, ask: false, provider: 'google' })
    await fire()
    expect(assign).not.toHaveBeenCalled()
    expect(registerCall).toHaveBeenCalledTimes(1)
  })

  it('status unreachable → registers as today (fail open)', async () => {
    statusMock.mockResolvedValue(null)
    await fire()
    expect(registerCall).toHaveBeenCalledTimes(1)
  })

  it('chose create-new for THIS identity → registers without asking again (D4)', async () => {
    rememberCreateNew(window.sessionStorage, 'google', '109876543210987654321')
    statusMock.mockResolvedValue({ signedIn: true, known: false, ask: true, provider: 'google' })
    await fire()
    expect(statusMock).not.toHaveBeenCalled()
    expect(registerCall).toHaveBeenCalledTimes(1)
  })

  it('never heals on the question page — that would create the account being asked about', async () => {
    pathname = '/v2/welcome-back'
    statusMock.mockResolvedValue({ signedIn: true, known: false, ask: true, provider: 'google' })
    await fire()
    expect(statusMock).not.toHaveBeenCalled()
    expect(registerCall).not.toHaveBeenCalled()
  })
})
