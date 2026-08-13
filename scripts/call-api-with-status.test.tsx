// Teeth on utils/fetch.ts (#263): (1) the NEW callApiWithStatus preserves the HTTP status and tells
// http-error vs network apart; (2) the LEGACY callApi behavior is UNCHANGED — still resolves to bare
// response.data and swallows errors to error.response.data (undefined when there's no response). ตู๋'s
// review lens is "no existing call site behavior changed"; this pins that contract. Mocks axios so no
// network. .tsx = invisible to ci.yml's tsx lane; runs via vitest include.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({ default: vi.fn() }))

import axios from 'axios'
import { callApi, callApiWithStatus } from '@/utils/fetch'

const mockAxios = vi.mocked(axios as any)

describe('callApiWithStatus — status-aware path (#263)', () => {
  beforeEach(() => mockAxios.mockReset())

  it('2xx -> ok with status + data', async () => {
    mockAxios.mockResolvedValue({ status: 200, data: { x: 1 } })
    expect(await callApiWithStatus('/u', 'POST', '', {}, null)).toEqual({ ok: true, status: 200, data: { x: 1 } })
  })

  it('410 -> ok:false kind http, status preserved', async () => {
    mockAxios.mockImplementationOnce(() => Promise.reject({ response: { status: 410, data: { code: 404, message: 'เกิน Limit' } } }))
    expect(await callApiWithStatus('/u', 'POST', '', {}, null)).toEqual({
      ok: false,
      kind: 'http',
      status: 410,
      data: { code: 404, message: 'เกิน Limit' },
    })
  })

  it('500 -> ok:false kind http, status 500', async () => {
    mockAxios.mockImplementationOnce(() => Promise.reject({ response: { status: 500, data: {} } }))
    const r = await callApiWithStatus('/u', 'POST', '', {}, null)
    expect(r).toMatchObject({ ok: false, kind: 'http', status: 500 })
  })

  it('no response object -> ok:false kind network', async () => {
    mockAxios.mockImplementationOnce(() => Promise.reject({ message: 'Network Error' })) // axios sets no .response when offline
    const r = await callApiWithStatus('/u', 'POST', '', {}, null)
    expect(r).toMatchObject({ ok: false, kind: 'network' })
  })
})

describe('callApi — legacy contract UNCHANGED (regression guard for shared call sites)', () => {
  beforeEach(() => mockAxios.mockReset())

  it('success -> returns bare response.data (not the response envelope)', async () => {
    mockAxios.mockResolvedValue({ status: 200, data: { y: 2 } })
    expect(await callApi('/u', 'POST', '', {}, null)).toEqual({ y: 2 })
  })

  it('http error -> returns error.response.data (swallowed, not thrown)', async () => {
    mockAxios.mockImplementationOnce(() => Promise.reject({ response: { status: 410, data: { e: 1 } } }))
    expect(await callApi('/u', 'POST', '', {}, null)).toEqual({ e: 1 })
  })

  it('network error (no response) -> returns undefined (swallowed, not thrown)', async () => {
    mockAxios.mockImplementationOnce(() => Promise.reject({ message: 'Network Error' }))
    expect(await callApi('/u', 'POST', '', {}, null)).toBeUndefined()
  })
})
