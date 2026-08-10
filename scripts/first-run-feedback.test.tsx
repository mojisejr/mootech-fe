// #240 (ฟีมเดินจริง @393): the two silent dead-ends. .tsx (renders components) → registered in
// vitest.config.mts include. Assertions read the RENDERED DOM, not props.
//
// ① PdpaConsentScreen: pressing "ยอมรับ" while saving/failed used to change NOTHING on screen.
// ② FirstRunElementView: a null source froze the last screen on "กำลังเตรียม…" forever, no way out.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
// FirstRunElementView lives in the page module, which transitively loads next/config's getConfig() at
// import (undefined under vitest). Stub it to a benign shape so the module loads — we never touch runtime
// config here (same reason as tier-prod-pages.test.tsx).
vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { FirstRunElementView } from '@/pages/v2/first-run'

afterEach(cleanup)

describe('① pdpa save feedback', () => {
  it('saving ⇒ button locked + shows progress (no double-submit, no silence)', () => {
    render(<PdpaConsentScreen consent={true} onConsentChange={() => {}} saving={true} />)
    const btn = screen.getByRole('button', { name: /กำลังบันทึก/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('error ⇒ a retriable message is in the DOM AND the button stays usable', () => {
    render(<PdpaConsentScreen consent={true} onConsentChange={() => {}} error={true} />)
    expect(screen.getByText(/บันทึกไม่สำเร็จ/)).toBeTruthy()
    const btn = screen.getByRole('button', { name: /ยอมรับและดำเนินการต่อ/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(false) // MUTANT CONTRACT still holds: consent=true ⇒ not disabled; error must NOT disable
  })
})

describe('② element view has no permanent dead-end', () => {
  it('loading ⇒ the preparing frame', () => {
    render(<FirstRunElementView status="loading" source={null} onGoHome={() => {}} />)
    expect(screen.getByText(/กำลังเตรียม/)).toBeTruthy()
  })

  it('unavailable ⇒ NO "กำลังเตรียม" and a way out (home button)', () => {
    render(<FirstRunElementView status="unavailable" source={null} onGoHome={() => {}} />)
    expect(screen.queryByText(/กำลังเตรียม/)).toBeNull()
    expect(screen.getByRole('button', { name: /เข้าสู่หน้าหลัก/ })).toBeTruthy()
  })
})
