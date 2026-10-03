// mumate-chat-keyboard-ios-001 slice 1 — the v2 chat screen stays on the area the user can see while the
// keyboard is open. Tester (iPhone, 2026-10-03): "เวลาพิมพ์ chat เหมือนมันจะดันขึ้นบน และเกิดขอบ" — the screen
// slid up and white showed between it and the keyboard.
//
// jsdom has no keyboard, so the viewport is faked with the numbers each platform reports:
//   iOS     : visual viewport shrinks AND pans (offsetTop > 0); the page itself does not shrink.
//   Android : offsetTop stays 0 (Chrome resizes-visual / Samsung) — must equal the old #chat-vh result.
// The zoom cases mirror the text-size setting (html.style.zoom). Their numbers were measured in real
// Chromium and WebKit, recorded in features/v2-chat/visible-area.ts.
//
// Mutants this file kills:
//   M1  drop `top` (height-only, the shipped bug)                  → "iOS: top follows offsetTop" RED
//   M2  stop dividing by zoom                                      → zoom cases RED
//   M3  root back to normal flow (no position:fixed)               → "pinned" RED
//   M4  composer back to 14px (iOS focus-zoom)                     → "16px" RED
//   M5  canvas colour not restored on leave                        → "restored" RED
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { visibleArea } from '@/features/v2-chat/visible-area'

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2/chat' }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/features/v2-chat/useBaziChatStream', () => ({
  useBaziChatStream: () => ({ turns: [], busy: false, guard: null, send: vi.fn() }),
}))

import { ChatScreen } from '@/features/v2-chat/components/ChatScreen'

class FakeViewport extends EventTarget {
  constructor(public height: number, public offsetTop = 0) { super() }
  move(height: number, offsetTop: number) {
    this.height = height
    this.offsetTop = offsetTop
    this.dispatchEvent(new Event('resize'))
  }
}

const root = () => screen.getByTestId('v2-chat-screen')

describe('visibleArea — the arithmetic', () => {
  it('Android / desktop (offsetTop 0, zoom 1): same as the old height-only code', () => {
    expect(visibleArea({ height: 852, offsetTop: 0 }, 1)).toEqual({ top: 0, height: 852 })
    expect(visibleArea({ height: 520, offsetTop: 0 }, 1)).toEqual({ top: 0, height: 520 })
  })
  it('iOS keyboard (panned): top follows offsetTop', () => {
    expect(visibleArea({ height: 480, offsetTop: 336 }, 1)).toEqual({ top: 336, height: 480 })
  })
  it('text size 0.9 / 1.25: divided by the zoom (measured 767 px and 1065 px without it on an 852 px screen)', () => {
    expect(visibleArea({ height: 852, offsetTop: 0 }, 0.9)).toEqual({ top: 0, height: 947 })
    expect(visibleArea({ height: 852, offsetTop: 0 }, 1.25)).toEqual({ top: 0, height: 682 })
    expect(visibleArea({ height: 480, offsetTop: 336 }, 1.25)).toEqual({ top: 269, height: 384 })
  })
  it('a nonsense zoom is treated as 1; a negative offset as 0', () => {
    expect(visibleArea({ height: 700, offsetTop: -4 }, 0)).toEqual({ top: 0, height: 700 })
    expect(visibleArea({ height: 700, offsetTop: 0 }, Number.NaN)).toEqual({ top: 0, height: 700 })
  })
})

describe('ChatScreen — pinned to what the user sees', () => {
  let vv: FakeViewport

  beforeEach(() => {
    // jsdom has no scrollIntoView (ChatScreen scrolls to the newest turn on mount)
    Element.prototype.scrollIntoView = vi.fn()
    vv = new FakeViewport(852, 0)
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    document.documentElement.style.zoom = ''
    document.documentElement.style.backgroundColor = ''
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
    document.documentElement.style.zoom = ''
  })

  it('is position:fixed, so it can be placed on the visible area instead of the document top', () => {
    render(<ChatScreen />)
    expect(root().style.position).toBe('fixed')
    expect(root().style.top).toBe('0px')
    expect(root().style.height).toBe('852px')
  })

  it('iOS: when the keyboard opens and the viewport pans, top AND height follow it', () => {
    render(<ChatScreen />)
    act(() => vv.move(480, 336))
    expect(root().style.top).toBe('336px')
    expect(root().style.height).toBe('480px')
    act(() => vv.move(852, 0))
    expect(root().style.top).toBe('0px')
    expect(root().style.height).toBe('852px')
  })

  it('follows a pan reported as a scroll event too', () => {
    render(<ChatScreen />)
    act(() => {
      vv.offsetTop = 120
      vv.dispatchEvent(new Event('scroll'))
    })
    expect(root().style.top).toBe('120px')
  })

  it('text size 1.25: lengths are divided by the zoom', () => {
    document.documentElement.style.zoom = '1.25'
    render(<ChatScreen />)
    expect(root().style.height).toBe('682px')
  })

  it('without visualViewport it falls back to the full dynamic viewport', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
    render(<ChatScreen />)
    expect(root().style.height).toBe('100dvh')
    expect(root().style.top).toBe('0px')
  })

  it('paints the page canvas in the chat colour while mounted, and restores it on leave', () => {
    document.documentElement.style.backgroundColor = 'rgb(1, 2, 3)'
    const { unmount } = render(<ChatScreen />)
    expect(document.documentElement.style.backgroundColor).toBe('rgb(246, 236, 240)')
    unmount()
    expect(document.documentElement.style.backgroundColor).toBe('rgb(1, 2, 3)')
  })

  it('the composer input is 16px, so iOS does not zoom into it on focus', () => {
    render(<ChatScreen />)
    const input = screen.getByTestId('chat-input')
    expect(input.className).toContain('text-[16px]')
    expect(input.className).not.toContain('text-[14px]')
  })
})
