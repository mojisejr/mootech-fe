// scripts/identity-choice-screen.test.tsx — /v2/welcome-back (mumate-login-identity-001 slice 5).
//
// 🔴 MUTANT CONTRACT:
//   Q1 "yes" signs in with the SAME provider → "yes proves with the OTHER provider" red (decision 17)
//   Q2 "no" forgets to remember the choice → "no remembers create-new" red (would loop back here)
//   Q3 proof success does not attach → "known after proof → link start for the ORIGINAL provider" red (D3)
//   Q4 proof failure dead-ends → "proof failed → retry and create-new both offered" red (D5)
//   Q5 Google inside LINE starts OAuth anyway → "Google in the LINE app → guidance, no OAuth" red (D5)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { routerState, sessionState } = vi.hoisted(() => ({
  routerState: { isReady: true, query: {} as Record<string, string> },
  sessionState: { data: { provider: 'google', providerId: '109876543210987654321', user: { name: 'n' } } as any },
}))

vi.mock('next/router', () => ({ useRouter: () => routerState }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: sessionState.data, status: 'authenticated' }) }))
vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/features/v2-shell/components/FullBleedScreen', () => ({
  FullBleedScreen: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { IdentityChoiceScreen, type IdentityChoiceDeps } from '@/features/auth/components/IdentityChoiceScreen'
import { hasChosenCreateNew, type IdentityStatus } from '@/lib/auth/ask-before-create'

function deps(status: IdentityStatus | null, over: Partial<IdentityChoiceDeps> = {}) {
  const d = {
    navigate: vi.fn(),
    startOAuth: vi.fn(),
    inLineApp: vi.fn(() => false),
    openExternal: vi.fn(),
    storage: () => window.sessionStorage,
    fetchStatus: vi.fn(async () => status),
    ...over,
  }
  return d as typeof d & IdentityChoiceDeps
}

const UNOWNED_GOOGLE: IdentityStatus = { signedIn: true, known: false, ask: true, provider: 'google' }
const UNOWNED_LINE: IdentityStatus = { signedIn: true, known: false, ask: true, provider: 'line' }

beforeEach(() => {
  routerState.query = {}
  sessionState.data = { provider: 'google', providerId: '109876543210987654321', user: { name: 'n' } }
  window.sessionStorage.clear()
})
afterEach(() => cleanup())

describe('ask', () => {
  it('asks about the OTHER provider, in words', async () => {
    render(<IdentityChoiceScreen deps={deps(UNOWNED_GOOGLE)} />)
    await screen.findByTestId('identity-choice-ask')
    expect(screen.getByText('เคยใช้มูเมทมาก่อนไหม?')).toBeTruthy()
    expect(screen.getByTestId('identity-choice-yes').textContent).toContain('ยืนยันด้วย LINE')
  })

  it('"yes" proves with the OTHER provider and comes back to attach this one (decision 17)', async () => {
    const d = deps(UNOWNED_GOOGLE)
    render(<IdentityChoiceScreen deps={d} />)
    fireEvent.click(await screen.findByTestId('identity-choice-yes'))
    expect(d.startOAuth).toHaveBeenCalledWith('line', '/v2/welcome-back?proof=google')
  })

  it('"no" remembers create-new for THIS identity and goes where the self-heal creates it (D4)', async () => {
    const d = deps(UNOWNED_GOOGLE)
    render(<IdentityChoiceScreen deps={d} />)
    fireEvent.click(await screen.findByTestId('identity-choice-no'))
    expect(hasChosenCreateNew(window.sessionStorage, 'google', '109876543210987654321')).toBe(true)
    expect(d.navigate).toHaveBeenCalledWith('/v2')
    expect(d.startOAuth).not.toHaveBeenCalled()
  })

  it('"no" leaves the referral code where /v2/register reads it (D4)', async () => {
    window.localStorage.setItem('v2:referral', 'FRIEND1')
    render(<IdentityChoiceScreen deps={deps(UNOWNED_GOOGLE)} />)
    fireEvent.click(await screen.findByTestId('identity-choice-no'))
    expect(window.localStorage.getItem('v2:referral')).toBe('FRIEND1')
  })

  it('Google in the LINE app → guidance, no OAuth started (D5)', async () => {
    sessionState.data = { provider: 'line', providerId: 'U'.padEnd(33, 'a'), lineProfile: { sub: 'U'.padEnd(33, 'a') }, user: {} }
    const d = deps(UNOWNED_LINE, { inLineApp: vi.fn(() => true) })
    render(<IdentityChoiceScreen deps={d} />)
    fireEvent.click(await screen.findByTestId('identity-choice-yes'))
    expect(await screen.findByTestId('identity-choice-google-in-line')).toBeTruthy()
    expect(d.startOAuth).not.toHaveBeenCalled()
    // still no dead end: create-new stays available
    expect(screen.getByTestId('identity-choice-create')).toBeTruthy()
  })
})

describe('after the proof', () => {
  it('known after proof → link start for the ORIGINAL provider (D3)', async () => {
    routerState.query = { proof: 'google' }
    const d = deps({ signedIn: true, known: true, ask: false, provider: 'line' })
    render(<IdentityChoiceScreen deps={d} />)
    await waitFor(() =>
      expect(d.navigate).toHaveBeenCalledWith('/api/auth/link/start/google?return_to=%2Fv2%2Fsettings%2Fconnected'),
    )
  })

  it('proof failed → says so, and offers retry AND create-new (D5)', async () => {
    routerState.query = { proof: 'google' }
    sessionState.data = { provider: 'line', providerId: 'U'.padEnd(33, 'b'), lineProfile: { sub: 'U'.padEnd(33, 'b') }, user: {} }
    const d = deps(UNOWNED_LINE)
    render(<IdentityChoiceScreen deps={d} />)
    await screen.findByTestId('identity-choice-proof-failed')
    fireEvent.click(screen.getByTestId('identity-choice-retry'))
    expect(d.startOAuth).toHaveBeenCalledWith('line', '/v2/welcome-back?proof=google')
    cleanup()

    const d2 = deps(UNOWNED_LINE)
    render(<IdentityChoiceScreen deps={d2} />)
    fireEvent.click(await screen.findByTestId('identity-choice-create'))
    expect(d2.navigate).toHaveBeenCalledWith('/v2')
    expect(hasChosenCreateNew(window.sessionStorage, 'LINE', 'U'.padEnd(33, 'b'))).toBe(true)
  })
})

describe('nothing to ask', () => {
  it('a known identity without a proof → straight to /v2', async () => {
    const d = deps({ signedIn: true, known: true, ask: false, provider: 'google' })
    render(<IdentityChoiceScreen deps={d} />)
    await waitFor(() => expect(d.navigate).toHaveBeenCalledWith('/v2'))
  })
  it('status unreadable → /v2 (fail open)', async () => {
    const d = deps(null)
    render(<IdentityChoiceScreen deps={d} />)
    await waitFor(() => expect(d.navigate).toHaveBeenCalledWith('/v2'))
  })
})
