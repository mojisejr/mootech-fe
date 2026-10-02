// mumate-member-identity-hardening-001 slice 1 step 4 — "ID สมาชิก" in settings, with a copy button.
//
// Members copy their full user_id and send it to the team on LINE; support pastes it into /ops/users.
// The value shown is the server-resolved identity (the /api/user row, which since step 2 is always the
// signed caller's own), never the client-set MEMBER_ID cookie.
//
// 🔴 MUTANT CONTRACT:
//   I1  the row shows the MEMBER_ID cookie instead of the server row's user_id → the cookie test reddens
//   I2  the copy button copies something other than the full id             → the clipboard test reddens
//   I3  no fallback where the Clipboard API is missing (LINE in-app)         → the fallback test reddens
//   I4  the row guesses while the row is unknown                             → the hidden test reddens
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider, Cookies } from 'react-cookie'

const COOKIE_ID = '99999999-8888-4777-8666-555555555555'
const SERVER_ID = '11111111-2222-4333-8444-555555555555'

const h = vi.hoisted(() => ({ user: null as null | { user_id?: string } }))

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), query: {}, pathname: '/v2/settings', isReady: true }),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('@/features/auth/hooks/useV2Logout', () => ({ useV2Logout: () => ({ logout: vi.fn() }) }))
vi.mock('@/features/auth/hooks/useV2User', () => ({
  useV2User: () => ({ userId: COOKIE_ID, done: true, errored: false, user: h.user }),
}))

import V2SettingsPage from '@/pages/v2/settings/index'
import { SupportIdRow, copyText } from '@/features/v2-settings/components/SupportIdRow'

function renderSettings() {
  const cookies = new Cookies()
  cookies.set('cookie-mumate-id', COOKIE_ID, { path: '/' })
  return render(
    <CookiesProvider cookies={cookies}>
      <V2SettingsPage />
    </CookiesProvider>,
  )
}

beforeEach(() => {
  h.user = null
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('settings · ID สมาชิก', () => {
  it('I1 — shows the server row\'s user_id in full, not the MEMBER_ID cookie', () => {
    h.user = { user_id: SERVER_ID }
    renderSettings()
    expect(screen.getByTestId('settings-support-id-value').textContent).toBe(SERVER_ID)
    expect(document.body.textContent).not.toContain(COOKIE_ID)
  })

  it('I4 — while the row is unknown (or has no id) the row is not shown at all', () => {
    for (const user of [null, {}]) {
      h.user = user
      renderSettings()
      expect(screen.queryByTestId('settings-support-id')).toBeNull()
      cleanup()
    }
  })

  it('tells the member when to send it', () => {
    h.user = { user_id: SERVER_ID }
    renderSettings()
    expect(screen.getByTestId('settings-support-id').textContent).toContain('ทีมงาน')
  })
})

describe('SupportIdRow · copy', () => {
  it('I2 — copy puts the full id on the clipboard and says so', async () => {
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<SupportIdRow userId={SERVER_ID} />)
    fireEvent.click(screen.getByTestId('settings-support-id-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SERVER_ID))
    await waitFor(() => expect(screen.getByTestId('settings-support-id-copy').textContent).toContain('คัดลอกแล้ว'))
  })

  it('I3 — without the Clipboard API (LINE in-app browser) it falls back to a selected textarea', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const exec = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    let selected = ''
    const orig = HTMLTextAreaElement.prototype.select
    HTMLTextAreaElement.prototype.select = function () {
      selected = this.value
    }
    try {
      expect(await copyText(SERVER_ID)).toBe(true)
      expect(exec).toHaveBeenCalledWith('copy')
      expect(selected).toBe(SERVER_ID)
    } finally {
      HTMLTextAreaElement.prototype.select = orig
    }
  })

  it('a copy that fails everywhere reports false (the id stays visible to copy by hand)', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: async () => { throw new Error('denied') } } })
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
    expect(await copyText(SERVER_ID)).toBe(false)
  })
})
