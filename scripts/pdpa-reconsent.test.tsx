// scripts/pdpa-reconsent.test.tsx — members accept an updated privacy policy once (CIEL mumate-pdpa-reconsent-001).
//   R1 gate rule: ask only on a DETERMINED older version; an undetermined read never locks anyone out
//   R2 ?next= stays inside /v2
//   R3 /api/v2/policy-consent: identity from the session, version from the server, needed = accepted ≠ current
//   R4 /v2/policy-update: main button needs the main tick only; AI box never pre-ticked unless already accepted;
//      an untouched empty AI box records nothing; un-ticking an existing yes records the withdrawal; then → next
//   R5 chat gate redirects on a clear "needed" only
//   R6 the update screen's words; the policy page shows its version and effective date; the stamp check warns
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(),
  who: { ok: true, userId: 'CALLER-A' } as { ok: true; userId: string } | { ok: false; status: 401; error: string },
}))
vi.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/v2/policy-update', asPath: '/v2/chat?topic=love', route: '/v2/policy-update', query: h.query, isReady: true, push: vi.fn(), replace: h.replace, prefetch: vi.fn(() => Promise.resolve()), events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } }),
}))
vi.mock('@/lib/v2/resolve-user', () => ({ resolveSessionUserId: vi.fn(async () => h.who) }))
const store = vi.hoisted(() => ({ latestPolicyVersion: vi.fn(), recordPolicyConsent: vi.fn(), recordOnboardingConsent: vi.fn() }))
vi.mock('@/lib/v2/consent-store', () => store)

import { PDPA_POLICY_VERSION } from '@/constants/pdpa'
import { PRIVACY_POLICY, PRIVACY_POLICY_STAMP } from '@/constants/privacy-policy'
import { needsReconsent, safeNext } from '@/lib/home/first-run-gate'
import { checkPolicyStamp, policyContentSha256 } from '@/lib/privacy/policy-stamp'
import { AI_TRAINING_KIND, AI_TRAINING_VERSION } from '@/features/v2-privacy/aiTraining'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { usePolicyGate } from '@/features/v2-privacy/usePolicyGate'
import handler from '../pages/api/v2/policy-consent'
import V2PolicyUpdate from '../pages/v2/policy-update'
import PrivacyPolicyPage from '../pages/privacy/policy'

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  h.query = {}
  h.replace.mockReset()
  h.who = { ok: true, userId: 'CALLER-A' }
  store.latestPolicyVersion.mockReset()
  store.recordPolicyConsent.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('R1 gate rule', () => {
  it('asks on an older or missing version, never on an undetermined read or the current version', () => {
    expect(needsReconsent({ policyConsent: { version: 'v1' } })).toBe(true)
    expect(needsReconsent({ policyConsent: { version: null } })).toBe(true)
    expect(needsReconsent({ policyConsent: { version: PDPA_POLICY_VERSION } })).toBe(false)
    expect(needsReconsent({ policyConsent: null })).toBe(false)
    expect(needsReconsent({})).toBe(false)
    expect(PDPA_POLICY_VERSION).toBe(PRIVACY_POLICY.version)
    expect(PDPA_POLICY_VERSION).not.toBe('v1')
  })
})

describe('R2 safeNext', () => {
  it('keeps /v2 paths and refuses everything else', () => {
    expect(safeNext('/v2/chat?topic=love')).toBe('/v2/chat?topic=love')
    expect(safeNext('/v2')).toBe('/v2')
    for (const bad of ['//evil.example', 'https://evil.example', '/v2chat', '/admin', '', undefined, 3]) expect(safeNext(bad)).toBe('/v2')
    expect(safeNext(['/v2/qi', '/x'])).toBe('/v2/qi')
  })
})

function makeRes() {
  const res: { statusCode: number; body: any; status: any; json: any; setHeader: any } = {
    statusCode: 0,
    body: undefined,
    status: vi.fn((c: number) => ((res.statusCode = c), res)),
    json: vi.fn((b: unknown) => ((res.body = b), res)),
    setHeader: vi.fn(),
  }
  return res
}
const req = (method: string, body: unknown = {}) => ({ method, body }) as never

describe('R3 /api/v2/policy-consent', () => {
  it('GET reports needed from the latest accepted version', async () => {
    store.latestPolicyVersion.mockResolvedValue('v1')
    const res = makeRes()
    await handler(req('GET'), res as never)
    expect(res.body).toEqual({ ok: true, current: PDPA_POLICY_VERSION, accepted: 'v1', needed: true })
    expect(store.latestPolicyVersion).toHaveBeenCalledWith('CALLER-A')
    store.latestPolicyVersion.mockResolvedValue(PDPA_POLICY_VERSION)
    const res2 = makeRes()
    await handler(req('GET'), res2 as never)
    expect(res2.body.needed).toBe(false)
  })

  it('POST writes the session member at the server version, whatever the body says', async () => {
    store.recordPolicyConsent.mockResolvedValue({ accepted_at: '2026-10-23 09:00:00' })
    const res = makeRes()
    await handler(req('POST', { userId: 'VICTIM', policyVersion: 'v0' }), res as never)
    expect(res.statusCode).toBe(200)
    expect(store.recordPolicyConsent).toHaveBeenCalledWith({ userId: 'CALLER-A', policyVersion: PDPA_POLICY_VERSION })
  })

  it('no session → no read, no write; a store failure → 500 without the driver message', async () => {
    h.who = { ok: false, status: 401, error: 'unauthenticated' }
    const res = makeRes()
    await handler(req('POST'), res as never)
    expect(res.statusCode).toBe(401)
    expect(store.recordPolicyConsent).not.toHaveBeenCalled()
    h.who = { ok: true, userId: 'CALLER-A' }
    store.latestPolicyVersion.mockRejectedValue(new Error('relation "consent" secret detail'))
    const res2 = makeRes()
    await handler(req('GET'), res2 as never)
    expect(res2.statusCode).toBe(500)
    expect(JSON.stringify(res2.body)).not.toContain('secret detail')
  })
})

type Call = { url: string; method: string; body: any }
function stubFetch(opts: { needed: boolean; ai?: { version: string; accepted: boolean } | null; postOk?: boolean }) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null })
      if (url === '/api/v2/policy-consent' && method === 'GET') return { ok: true, json: async () => ({ ok: true, needed: opts.needed }) }
      if (url === '/api/v2/policy-consent' && method === 'POST') return { ok: opts.postOk !== false, json: async () => ({ ok: opts.postOk !== false }) }
      if (url === '/api/consent' && method === 'GET')
        return { ok: true, json: async () => ({ consents: opts.ai ? [{ kind: AI_TRAINING_KIND, ...opts.ai }] : [] }) }
      return { ok: true, json: async () => ({ ok: true }) }
    }),
  )
  return calls
}
const aiBox = () => screen.getByTestId('pdpa-ai-training').querySelector('[role="checkbox"],input[type="checkbox"]') as HTMLElement
const isTicked = (el: HTMLElement) => el.getAttribute('aria-checked') === 'true' || (el as HTMLInputElement).checked === true
const mainButton = () => screen.getByRole('button', { name: 'ยอมรับและใช้งานต่อ' })
const mainTick = () => screen.getByLabelText('ฉันอ่านและยอมรับนโยบายความเป็นส่วนตัว')

describe('R4 /v2/policy-update', () => {
  it('main button waits for the main tick only; an untouched empty AI box records nothing; then → next', async () => {
    h.query = { next: '/v2/chat?topic=love' }
    const calls = stubFetch({ needed: true, ai: { version: '2026-10', accepted: true } })
    render(<V2PolicyUpdate />)
    await waitFor(() => expect(screen.getByText('นโยบายความเป็นส่วนตัวฉบับปรับปรุง')).toBeTruthy())
    expect(isTicked(aiBox())).toBe(false) // an OLD-version yes is not the current consent → not pre-ticked
    expect(mainButton().hasAttribute('disabled')).toBe(true)
    fireEvent.click(mainTick())
    expect(mainButton().hasAttribute('disabled')).toBe(false)
    fireEvent.click(mainButton())
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/v2/chat?topic=love'))
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['/api/v2/policy-consent'])
  })

  it('ticking the AI box records a yes at the current version', async () => {
    const calls = stubFetch({ needed: true, ai: null })
    render(<V2PolicyUpdate />)
    await waitFor(() => expect(mainButton()).toBeTruthy())
    fireEvent.click(aiBox())
    fireEvent.click(mainTick())
    fireEvent.click(mainButton())
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/v2'))
    expect(calls.find((c) => c.url === '/api/consent' && c.method === 'POST')?.body).toEqual({ kind: AI_TRAINING_KIND, version: AI_TRAINING_VERSION, accepted: true })
  })

  it('a current yes arrives ticked; un-ticking it records the withdrawal', async () => {
    const calls = stubFetch({ needed: true, ai: { version: AI_TRAINING_VERSION, accepted: true } })
    render(<V2PolicyUpdate />)
    await waitFor(() => expect(isTicked(aiBox())).toBe(true))
    fireEvent.click(aiBox())
    fireEvent.click(mainTick())
    fireEvent.click(mainButton())
    await waitFor(() => expect(h.replace).toHaveBeenCalled())
    expect(calls.find((c) => c.url === '/api/consent' && c.method === 'POST')?.body).toMatchObject({ accepted: false })
  })

  it('already on the current version → straight to next; a failed save stays and says so', async () => {
    h.query = { next: '//evil.example' }
    stubFetch({ needed: false })
    render(<V2PolicyUpdate />)
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/v2'))
    cleanup()
    h.replace.mockReset()
    stubFetch({ needed: true, postOk: false })
    render(<V2PolicyUpdate />)
    await waitFor(() => expect(mainButton()).toBeTruthy())
    fireEvent.click(mainTick())
    fireEvent.click(mainButton())
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(h.replace).not.toHaveBeenCalled()
  })
})

function GateProbe() {
  usePolicyGate()
  return null
}
describe('R5 chat gate', () => {
  it('redirects with the current path on a clear "needed", and on nothing else', async () => {
    stubFetch({ needed: true })
    render(<GateProbe />)
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/v2/policy-update?next=%2Fv2%2Fchat%3Ftopic%3Dlove'))
    cleanup()
    h.replace.mockReset()
    stubFetch({ needed: false })
    render(<GateProbe />)
    await flush()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))
    render(<GateProbe />)
    await flush()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    render(<GateProbe />)
    await flush()
    expect(h.replace).not.toHaveBeenCalled()
  })
})

describe('R6 words, policy page, stamp', () => {
  it('update screen: neutral heading, link to the full policy, no first-run pager', () => {
    render(<PdpaConsentScreen variant="update" consent={false} onConsentChange={() => {}} aiTraining={false} onAiTrainingChange={() => {}} />)
    expect(screen.getByText('นโยบายความเป็นส่วนตัวฉบับปรับปรุง')).toBeTruthy()
    expect(screen.getByTestId('policy-update-read').getAttribute('href')).toBe('/privacy/policy')
    expect(screen.queryByText(/AI/, { selector: 'h1,p.text-base' })).toBeNull() // the heading and lead never single out AI
    expect(screen.getByTestId('pdpa-ai-training').textContent).toContain('ไม่บังคับ')
  })

  it('first-run screen is unchanged', () => {
    render(<PdpaConsentScreen consent={false} onConsentChange={() => {}} />)
    expect(screen.getByText('ความเป็นส่วนตัวของคุณ')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ยอมรับและดำเนินการต่อ' })).toBeTruthy()
  })

  it('policy page shows the version, the effective date and the AI section', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByTestId('policy-version').textContent).toBe(`ฉบับ ${PRIVACY_POLICY.version} · มีผลตั้งแต่ 23 ตุลาคม 2569`)
    expect(document.getElementById('ai')?.textContent).toContain('สิทธิในการจัดการและถอนความยินยอม:')
  })

  it('stamp: matches today; warns (never throws) on changed text or an unstamped version', () => {
    expect(checkPolicyStamp()).toEqual({ ok: true })
    expect(PRIVACY_POLICY_STAMP.sha256).toBe(policyContentSha256())
    const changed = checkPolicyStamp({ version: PRIVACY_POLICY.version, sha256: 'x' })
    expect(changed).toMatchObject({ ok: false, reason: 'content-changed' })
    expect(checkPolicyStamp({ version: '2099-01', sha256: policyContentSha256() })).toMatchObject({ ok: false, reason: 'version-not-stamped' })
    const edited = { ...PRIVACY_POLICY, intro: PRIVACY_POLICY.intro + ' ' }
    expect(policyContentSha256(edited)).not.toBe(policyContentSha256())
  })
})
