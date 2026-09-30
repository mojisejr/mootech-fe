// Promo B: บล็อกแชร์บนหน้าชำระเงินสำเร็จ — โชว์เฉพาะคนเข้าเกณฑ์ (ใช้ MUMATE100 + จ่ายสำเร็จ)
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PlanShareInvite } from '@/features/v2-shop/components/PlanShareInvite'

const stub = (json: unknown, ok = true) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => json })))

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('PlanShareInvite (Promo B)', () => {
  it('eligible buyer: shows the share code, remaining slots, and the promo LINE link', async () => {
    stub({ eligible: true, code: 'MMFAB2CD', used: 2, max: 10 })
    render(<PlanShareInvite />)
    await waitFor(() => expect(screen.getByTestId('plan-share-code').textContent).toContain('MMFAB2CD'))
    expect(screen.getByTestId('plan-share-invite').textContent).toContain('เหลืออีก 8 คน')
    const line = screen.getByTestId('plan-share-line') as HTMLAnchorElement
    expect(decodeURIComponent(line.href)).toContain('Mumate Pro ฟรี 1 เดือน')
    expect(decodeURIComponent(line.href)).toContain('/promo/free-month?code=MMFAB2CD')
  })

  it('NOT eligible (bought without MUMATE100): renders nothing', async () => {
    stub({ eligible: false })
    const { container } = render(<PlanShareInvite />)
    await waitFor(() => expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1))
    expect(container.querySelector('[data-testid="plan-share-invite"]')).toBeNull()
  })

  it('when all 10 slots are used: CTA is disabled and the LINE link is hidden', async () => {
    stub({ eligible: true, code: 'MMFZZ9QP', used: 10, max: 10 })
    render(<PlanShareInvite />)
    await waitFor(() => expect(screen.getByTestId('plan-share-code').textContent).toContain('MMFZZ9QP'))
    expect((screen.getByTestId('plan-share-cta') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('plan-share-line')).toBeNull()
  })
})
