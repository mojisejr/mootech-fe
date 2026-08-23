// #363 — teeth for the PromptPay wait. MAIN lane.
//
// 🔴 MUTANT CONTRACT:
//   MU1  say "สำเร็จ" while still PENDING                 → "never claims a settle" reddens
//   MU2  say "หมดอายุแล้ว" (certain) past the deadline    → "อาจ, because we do not know" reddens
//   MU3  call a cancel/abandon endpoint on back           → "back sends nothing" reddens
//   MU4  treat a status fetch error as a failed payment   → "offline is not failure" reddens
//
// 🔑 THIS SCREEN HAS NO FIGMA FRAME, so no reviewer can diff it against a design. Its only reader is the
// per-line audit — which is why every string is a constant in QR_COPY and why the audit test below walks
// the RENDERED screen rather than the source.
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { QrScreen, QR_COPY } from '@/features/v2-shop/components/QrScreen'

vi.mock('next/image', () => ({ default: (p: Record<string, unknown>) => <img alt={String(p.alt)} src={String(p.src)} /> }))

const mockStatus = (payments: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ payments }) })))

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const props = {
  chargeId: 'chrg_mine', qrUrl: 'https://api.omise.co/charges/chrg_mine/documents/x/downloads/y',
  amountText: '฿1,590', onApproved: vi.fn(), onNewQr: vi.fn(), onBack: vi.fn(),
}

describe('#363 the QR wait says only what it can back', () => {
  it('while PENDING it says it is waiting — never that anything succeeded', async () => {
    mockStatus([{ chargeId: 'chrg_mine', status: 'PENDING' }])
    render(<QrScreen {...props} />)
    await waitFor(() => expect(screen.getByTestId('qr-waiting').textContent).toBe(QR_COPY.waiting))
    expect(document.body.textContent).not.toMatch(/สำเร็จ|เรียบร้อย|ขอบคุณ/)
  })

  it('a status fetch error is reported as OUR problem, not the payment failing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    render(<QrScreen {...props} />)
    await waitFor(() => expect(screen.getByTestId('qr-waiting').textContent).toBe(QR_COPY.offline))
    // The words that would blame the user's payment for our network.
    expect(document.body.textContent).not.toMatch(/ล้มเหลว|ไม่สำเร็จ|ถูกปฏิเสธ/)
  })

  it('APPROVED for THIS charge settles exactly once', async () => {
    const onApproved = vi.fn()
    mockStatus([{ chargeId: 'chrg_mine', status: 'APPROVED' }])
    render(<QrScreen {...props} onApproved={onApproved} />)
    await waitFor(() => expect(onApproved).toHaveBeenCalled())
    const n = onApproved.mock.calls.length
    await new Promise((r) => setTimeout(r, 60))
    expect(onApproved.mock.calls.length).toBe(n) // an effect, not a render-body call
  })

  it('someone else\'s APPROVED row never settles our screen', async () => {
    const onApproved = vi.fn()
    mockStatus([{ chargeId: 'chrg_other', status: 'APPROVED' }, { chargeId: 'chrg_mine', status: 'PENDING' }])
    render(<QrScreen {...props} onApproved={onApproved} />)
    await waitFor(() => expect(screen.getByTestId('qr-waiting')).toBeTruthy())
    await new Promise((r) => setTimeout(r, 60))
    expect(onApproved).not.toHaveBeenCalled()
  })

  it('🔴 ย้อนกลับ sends NOTHING — a charge the user may still pay is not cancelled on their way out', async () => {
    mockStatus([{ chargeId: 'chrg_mine', status: 'PENDING' }])
    const onBack = vi.fn()
    render(<QrScreen {...props} onBack={onBack} />)
    await waitFor(() => expect(screen.getByTestId('qr-waiting')).toBeTruthy())
    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length
    fireEvent.click(screen.getByTestId('qr-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    const after = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    // No NEW request, and in particular nothing that is not the read-only status poll.
    expect(after.length).toBe(before)
    for (const [url, init] of after) expect(String(url)).toBe('/api/v2/payment/status'), expect(init).toBeUndefined()
  })
})

describe('#363 the per-line audit — this screen has no frame to check it against', () => {
  it('every visible line comes from QR_COPY, and none of them claims a certainty we lack', async () => {
    mockStatus([{ chargeId: 'chrg_mine', status: 'PENDING' }])
    render(<QrScreen {...props} />)
    await waitFor(() => expect(screen.getByTestId('qr-waiting')).toBeTruthy())
    const known = new Set<string>([...Object.values(QR_COPY), '฿1,590', 'ย้อนกลับ', `${QR_COPY.amountLabel} ฿1,590`])
    const lines = Array.from(document.querySelectorAll('h1, p, span, button'))
      .map((e) => (e.textContent ?? '').trim())
      .filter((t) => t.length > 0)
    expect(lines.length).toBeGreaterThan(3) // surface size — an empty screen must not pass this
    for (const l of lines) expect(known, `unlisted copy on screen: "${l}"`).toContain(l)
  })

  it('past the deadline it says อาจ — never a flat "expired"', () => {
    // The claim we are not entitled to make: the gateway never tells us when the QR dies.
    expect(QR_COPY.maybeExpired).toContain('อาจ')
    expect(QR_COPY.maybeExpired).not.toMatch(/หมดอายุแล้ว$/)
    // ...and the way out is offered, so "we don't know" is never a dead end.
    expect(QR_COPY.checkAgain.length).toBeGreaterThan(0)
    expect(QR_COPY.newQr.length).toBeGreaterThan(0)
  })
})
