// 🔴 TEMPORARY (#249) — deleted together with the control and the route by #248.
//
// The UI half of the team-preview reset. บอง's scripts/first-run-reset.test.tsx guards the SERVER's
// identity rule (whose row gets written); this file guards the four things the CONTROL itself decides
// — and only those. Colour/spacing/placement are design-verify's job, not a unit test's.
//
// .tsx so ci.yml's legacy `for f in scripts/*.test.ts` lane never sees it (that lane runs plain
// node:assert scripts under tsx and would throw on `import … from 'vitest'`). Registered in
// vitest.config.mts `include` — appended to บอง's line, never replacing it (that list carries its own
// "UNION, never pick a side" warning; #214 and #218 already ate each other there once).
//
// MUTANT CONTRACT — each one flips real behaviour, and each one goes RED here:
//   U1  delete the confirm step (badge onClick calls run() directly)      → "ยังไม่กด ยืนยัน" RED
//   U2  add a body/user_id to the fetch init                              → "ไม่ส่ง subject" RED
//   U3  call navigate() unconditionally instead of only on ok             → all three !ok cases RED
//   U4  drop the 'pending' setState (go straight from confirm to result)  → "กดแล้วต้องไม่เงียบ" RED
//   U5  navigate() in the same tick as setPhase('done') (no hold)         → "สำเร็จต้องอยู่บนจอ" RED
//   U6  busy = only 'pending' (buttons live during the success hold)     → "กดซ้ำไม่ได้" RED
//
// U3 is the one that matters most: navigating on a failed reset shows the team a first-run they did
// not actually get, which is exactly the kind of green-looking lie the whole gate exists to stop.
//
// The assertions read the RENDERED DOM and the ACTUAL fetch arguments — never a prop this file just
// passed in. `navigate` is injected because jsdom cannot perform a real navigation, but the DECISION
// under test (call it, or not) is the component's own; the shipped default is asserted separately.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SUCCESS_HOLD_MS, TeamPreviewResetBadge } from '@/features/v2-team-preview/TeamPreviewResetBadge'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A fetch whose resolution this test controls, so the in-flight frame can actually be looked at. */
function deferredFetch() {
  let release!: (r: { status: number; body: unknown }) => void
  const calls: Array<[unknown, unknown]> = []
  const fetchMock = vi.fn((...args: [unknown, unknown]) => {
    calls.push(args)
    return new Promise((resolve) => {
      release = ({ status, body }) =>
        resolve({ ok: status >= 200 && status < 300, status, json: async () => body })
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, release: (status: number, body: unknown) => release({ status, body }) }
}

const openBadge = () => fireEvent.click(screen.getByTestId('team-reset-open'))
const confirm = () => fireEvent.click(screen.getByTestId('team-reset-confirm'))
const statusText = () => screen.getByTestId('team-reset-status').textContent ?? ''

describe('#249 team-preview reset control', () => {
  let navigate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    navigate = vi.fn()
  })

  // U1 — one tap must never be able to write. The badge opens a question, nothing else.
  it('U1 · เปิดบัตรยืนยันแล้วยังไม่ยิงอะไร จนกว่าจะกดยืนยัน', async () => {
    const { calls } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    expect(calls.length).toBe(0) // opening the card is not a request
    expect(screen.getByTestId('team-reset-confirm')).toBeTruthy()

    confirm()
    expect(calls.length).toBe(1) // …and only the confirm button is
  })

  // U2 — the client must not name a subject. No body, no query, no id: the server derives identity
  // from the NextAuth session. Anything here that carries a user_id is mootech-be#16 from this side.
  it('U2 · POST ที่ไม่มี subject เลย — ไม่มี body ไม่มี query', async () => {
    const { calls } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()

    const [url, init] = calls[0] as [string, Record<string, unknown>]
    expect(url).toBe('/api/v2/first-run-reset') // no ?user_id= smuggled onto the path
    expect((init as { method: string }).method).toBe('POST')
    expect(Object.keys(init)).toEqual(['method']) // a `body` key at all is the mutant
  })

  // U4 — the #240 class: a control that goes quiet after a tap. The in-flight frame must exist and
  // must say so, and neither button may be armed while the write is out.
  it('U4 · กดแล้วต้องไม่เงียบ — เห็น "กำลังรีเซ็ต…" และปุ่มถูกล็อกระหว่างรอ', async () => {
    const { release } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()

    expect(statusText()).toContain('กำลังรีเซ็ต')
    expect((screen.getByTestId('team-reset-confirm') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('team-reset-cancel') as HTMLButtonElement).disabled).toBe(true)

    await act(async () => release(200, { ok: true }))
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1), { timeout: SUCCESS_HOLD_MS * 4 })
  })

  it('200 {ok:true} → ขึ้นว่าสำเร็จ แล้วพากลับ /v2 ครั้งเดียว', async () => {
    const { release } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()
    await act(async () => release(200, { ok: true }))

    expect(statusText()).toContain('สำเร็จ')
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1), { timeout: SUCCESS_HOLD_MS * 4 })
  })

  // U5 — the tooth for a gap a unit test cannot see on its own. "สำเร็จ" being in the DOM is not the
  // same as a person seeing it: navigating in the same tick tears the document down around it. So the
  // success frame must still be on screen AFTER the phase settles and BEFORE the navigation fires.
  // Mutant: replace `setTimeout(navigate, SUCCESS_HOLD_MS)` with a bare `navigate()` → RED here, and
  // still green everywhere else. The real-browser capture is what put this test here.
  it('U5 · "สำเร็จ" ต้องอยู่บนจอจริงก่อน แล้วค่อยพาไป — ไม่ใช่วาดแล้วโดนกลบทันที', async () => {
    const { release } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()
    await act(async () => release(200, { ok: true }))

    expect(statusText()).toContain('สำเร็จ')
    expect(navigate).not.toHaveBeenCalled() // ← still readable at this instant

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1), { timeout: SUCCESS_HOLD_MS * 4 })
  })

  // U6 — the flip side of the hold, and the reason a visible-state change needs its own tooth: for the
  // whole SUCCESS_HOLD_MS beat the card is still on screen. If its buttons stay armed, a second tap
  // fires a SECOND reset against prod from a card that just said it succeeded. Found in the capture,
  // not here — every spec above was green while it was true.
  it('U6 · ระหว่างค้างจอ "สำเร็จ" ปุ่มต้องกดซ้ำไม่ได้', async () => {
    const { release, calls } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()
    await act(async () => release(200, { ok: true }))

    expect((screen.getByTestId('team-reset-confirm') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('team-reset-cancel') as HTMLButtonElement).disabled).toBe(true)
    confirm() // a real click on the real DOM — a live button would fire a second reset
    expect(calls.length).toBe(1)

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1), { timeout: SUCCESS_HOLD_MS * 4 })
  })

  // U3 — every non-ok answer the route can actually give. 404 and 405 are NOT in the contract that
  // was handed over in the issue; they are in the merged route (first-run-reset.ts:27,54), and 404 is
  // the state a team member hits on a first prod tap when register-login never ran on this
  // deployment. The control shows the server's own words rather than renaming them.
  const failures = [
    { status: 401, body: { ok: false, error: 'not in team preview' } },
    { status: 401, body: { ok: false, error: 'not signed in' } },
    { status: 404, body: { ok: false, error: 'no account for this login yet' } },
    { status: 500, body: { ok: false, error: 'reset failed' } },
  ]

  it.each(failures)('U3 · HTTP $status → ไม่พาไปไหน + โชว์ข้อความของเซิร์ฟเวอร์ตรงๆ', async ({ status, body }) => {
    const { release } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()
    await act(async () => release(status, body))

    expect(navigate).not.toHaveBeenCalled() // ← the mutant: navigating anyway
    expect(statusText()).toContain(String(status))
    expect(statusText()).toContain(body.error) // server's text, not ours
    // and the person can try again without reopening
    expect((screen.getByTestId('team-reset-confirm') as HTMLButtonElement).disabled).toBe(false)
  })

  it('200 แต่ body บอก ok:false → นับเป็นล้มเหลว ไม่ใช่สำเร็จ', async () => {
    const { release } = deferredFetch()
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    confirm()
    await act(async () => release(200, { ok: false, error: 'reset failed' }))

    expect(navigate).not.toHaveBeenCalled()
    expect(statusText()).toContain('ล้มเหลว')
  })

  it('fetch throw (เน็ตหลุด) → ล้มเหลวแบบเห็นได้ ไม่ค้างที่ "กำลังรีเซ็ต…"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network'))))
    render(<TeamPreviewResetBadge navigate={navigate} />)

    openBadge()
    await act(async () => {
      confirm()
    })

    expect(navigate).not.toHaveBeenCalled()
    expect(statusText()).toContain('ล้มเหลว')
    expect(statusText()).not.toContain('กำลังรีเซ็ต')
  })

  // The injected `navigate` above is a test seam; this asserts the DEFAULT — what actually ships —
  // is a full page load of /v2 (summary-cache.ts's in-memory Map survives a client-side navigation,
  // and /v2's getServerSideProps has to re-run for the gate + a fresh user row).
  it('ค่า default ที่ ship จริงคือโหลดหน้า /v2 ใหม่ทั้งหน้า ไม่ใช่ router.push', async () => {
    const { release } = deferredFetch()
    const assign = vi.fn()
    vi.stubGlobal('location', { assign } as unknown as Location)

    render(<TeamPreviewResetBadge />)
    openBadge()
    confirm()
    await act(async () => release(200, { ok: true }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/v2'), { timeout: SUCCESS_HOLD_MS * 4 })
  })
})
