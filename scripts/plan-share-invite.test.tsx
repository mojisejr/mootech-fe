// โปรฯ: บล็อกแชร์โค้ดบนหน้าชำระเงินสำเร็จ (ฟิว/ซินแส 2026-09-28) — โชว์โค้ดจาก /api/referral + ปุ่มแชร์
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { PlanShareInvite } from '@/features/v2-shop/components/PlanShareInvite'

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('PlanShareInvite', () => {
  it('shows the buyer’s referral code and the share CTA once /api/referral answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ code: 'MUMATE123', redeemed: false }) })))
    render(<PlanShareInvite />)
    await waitFor(() => expect(screen.getByTestId('plan-share-code').textContent).toContain('MUMATE123'))
    expect(screen.getByTestId('plan-share-cta').textContent).toContain('แชร์ให้เพื่อนเลย!')
    // LINE deep-link carries the promo text (Pro ฟรี 1 เดือน), not a QI pitch
    const line = screen.getByTestId('plan-share-line') as HTMLAnchorElement
    expect(decodeURIComponent(line.href)).toContain('Mumate Pro ฟรี 1 เดือน')
    expect(decodeURIComponent(line.href)).toContain('MUMATE123')
  })

  it('degrades gracefully (placeholder + disabled CTA) when the code has not loaded', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    render(<PlanShareInvite />)
    expect(screen.getByTestId('plan-share-code').textContent).toContain('······')
    expect((screen.getByTestId('plan-share-cta') as HTMLButtonElement).disabled).toBe(true)
  })
})
