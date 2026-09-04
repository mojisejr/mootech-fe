// scripts/settings-privacy-screens.test.tsx — จอก้อน 4: notifications · consent · data-export · faq/doc
//
// 🔴 MUTANT CONTRACT:
//   N1 prefs toggle → PUT ส่งค่าตรงข้ามกลับ engine          ❌ toggle แล้วไม่ยิง/ยิงผิดค่า
//   C1 consent accept → POST {kind:pdpa, version, accepted:true} + สถานะเปลี่ยนตาม GET ใหม่
//   E2 export ล้ม ❌ โชว์ "ดาวน์โหลดเรียบร้อย"
//   F1 faq 404 ของ doc → "ไม่พบเอกสารนี้" ❌ หน้าว่าง
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { CookiesProvider } from 'react-cookie'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock('next/router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, pathname: '/v2', isReady: true }),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))

// Notification ไม่มีใน jsdom
vi.stubGlobal('Notification', { permission: 'default' })

let prefs: Record<string, boolean> = { dailyFortune: true, reminders: true, updates: false }
let consentRows: Array<{ kind: string; version: string; accepted: boolean; createdAt: string }> = []
let exportOk = true
const faqArticles = {
  articles: [
    { slug: 'what-is-qi', title: 'ชี่ (Qi Token) คืออะไร', body: 'ชี่คือพลังงานสะสมภายในแอป' },
    { slug: 'payments', title: 'การชำระเงิน', body: 'ชำระผ่านบัตรหรือพร้อมเพย์' },
  ],
}
const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
  const u = String(url)
  const method = init?.method ?? 'GET'
  if (u.includes('/api/notification-prefs') && method === 'GET') return { ok: true, status: 200, json: async () => ({ anonId: 'u', ...prefs }) }
  if (u.includes('/api/notification-prefs')) {
    prefs = JSON.parse(String(init?.body))
    return { ok: true, status: 200, json: async () => ({ anonId: 'u', ...prefs }) }
  }
  if (u.includes('/api/consent') && method === 'GET') return { ok: true, status: 200, json: async () => ({ consents: consentRows }) }
  if (u.includes('/api/consent')) {
    const body = JSON.parse(String(init?.body))
    consentRows = [{ kind: body.kind, version: body.version, accepted: body.accepted, createdAt: new Date().toISOString() }, ...consentRows]
    return { ok: true, status: 200, json: async () => ({ ok: true }) }
  }
  if (u.includes('/api/account-export')) {
    // จอใช้ res.text() อ่านทั้งไฟล์ — mock ต้องมี text() ไม่ใช่แค่ json()
    return exportOk
      ? { ok: true, status: 200, text: async () => JSON.stringify({ anonId: 'u' }), json: async () => ({ anonId: 'u' }) }
      : { ok: false, status: 502, text: async () => '', json: async () => ({}) }
  }
  if (u.includes('/api/faq')) {
    // ?slug= → บทความเดี่ยว (DocReader); ไม่มี slug → ลิสต์ (FaqScreen)
    const m = /slug=([a-z-]+)/.exec(u)
    if (m) {
      const a = faqArticles.articles.find((x) => x.slug === m[1])
      return a
        ? { ok: true, status: 200, json: async () => a }
        : { ok: false, status: 404, json: async () => ({ error: 'ไม่พบบทความนี้' }) }
    }
    return { ok: true, status: 200, json: async () => faqArticles }
  }
  return { ok: true, status: 200, json: async () => ({}) }
})
vi.stubGlobal('fetch', fetchMock)

import NotificationsScreen from '@/features/v2-settings/components/NotificationsScreen'
import ConsentScreen from '@/features/v2-settings/components/ConsentScreen'
import DataExportScreen from '@/features/v2-settings/components/DataExportScreen'
import FaqScreen from '@/features/v2-settings/components/FaqScreen'
import DocReaderScreen from '@/features/v2-settings/components/DocReaderScreen'

const wrap = (ui: React.ReactElement) => <CookiesProvider>{ui}</CookiesProvider>

beforeEach(() => {
  prefs = { dailyFortune: true, reminders: true, updates: false }
  consentRows = []
  exportOk = true
  fetchMock.mockClear()
})
afterEach(() => cleanup())

describe('settings-notifications', () => {
  it('N1 toggle "ข่าวสารและโปรโมชัน" → PUT updates:true แล้วปุ่มเปลี่ยนเป็น เปิด', async () => {
    render(wrap(<NotificationsScreen />))
    const btn = await waitFor(() => screen.getByTestId('notif-updates'))
    expect(btn.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(btn)
    await waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => (c[1]?.method ?? '') === 'PUT')
      expect(put).toBeTruthy()
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ updates: true })
    })
    await waitFor(() => expect(screen.getByTestId('notif-updates').getAttribute('aria-checked')).toBe('true'))
  })

  it('โชว์สถานะ push ของเบราว์เซอร์ (default = ยังไม่ได้อนุญาต) + ทางไปจัดการยาม', async () => {
    render(wrap(<NotificationsScreen />))
    await waitFor(() => expect(screen.getByText(/ยังไม่ได้อนุญาต/)).toBeTruthy())
    expect(screen.getByTestId('notif-manage-reminders').getAttribute('href')).toBe('/v2/calendar/notifications')
  })
})

describe('privacy-consent', () => {
  it('C1 pdpa จำเป็น (ล็อกเปิด) + มี 5 วัตถุประสงค์ + แถวประวัติ', async () => {
    render(wrap(<ConsentScreen />))
    const pdpa = await waitFor(() => screen.getByTestId('consent-pdpa'))
    expect(pdpa.getAttribute('aria-checked')).toBe('true')
    expect(pdpa.getAttribute('aria-disabled')).toBe('true')
    // ครบ 5 สวิตช์วัตถุประสงค์
    expect(screen.getByTestId('consent-history')).toBeTruthy()
    expect(screen.getByTestId('consent-analytics')).toBeTruthy()
    expect(screen.getByTestId('consent-marketing')).toBeTruthy()
    expect(screen.getByTestId('consent-ads')).toBeTruthy()
    expect(screen.getByTestId('consent-log')).toBeTruthy()
  })

  it('C2 ปิด "เก็บประวัติการดูดวง" → POST {kind:history, accepted:false} + กล่องผลกระทบสีแดงโผล่', async () => {
    render(wrap(<ConsentScreen />))
    const sw = await waitFor(() => screen.getByTestId('consent-history'))
    expect(sw.getAttribute('aria-checked')).toBe('true') // ค่าเริ่มต้นเปิด
    fireEvent.click(sw)
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1]?.method ?? '') === 'POST')
      expect(post).toBeTruthy()
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ kind: 'history', version: '2026-09', accepted: false })
    })
    await waitFor(() => expect(screen.getByTestId('consent-msg').textContent).toContain('ปิดความยินยอม'))
    await waitFor(() => expect(screen.getByTestId('consent-impact-history')).toBeTruthy())
  })

  it('C3 marketing (ค่าเริ่มต้นปิด) → เปิดแล้วยิง POST accepted:true', async () => {
    render(wrap(<ConsentScreen />))
    const sw = await waitFor(() => screen.getByTestId('consent-marketing'))
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1]?.method ?? '') === 'POST' && String(c[1]?.body).includes('marketing'))
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ kind: 'marketing', accepted: true })
    })
  })
})

describe('privacy-data-export', () => {
  it('ส่งออกสำเร็จ → โชว์ดาวน์โหลดเรียบร้อย', async () => {
    // jsdom ไม่มี URL.createObjectURL — ต้อง stub ก่อน (จอจะเรียกตอนดาวน์โหลด)
    const created = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }))
    render(wrap(<DataExportScreen />))
    fireEvent.click(screen.getByTestId('export-run'))
    await waitFor(() => expect(screen.getByTestId('export-done')).toBeTruthy())
    expect(created).toHaveBeenCalled()
  })

  it('E2 export ล้ม → โชว์ failed ❌ "เรียบร้อย"', async () => {
    exportOk = false
    render(wrap(<DataExportScreen />))
    fireEvent.click(screen.getByTestId('export-run'))
    await waitFor(() => expect(screen.getByTestId('export-failed')).toBeTruthy())
    expect(screen.queryByTestId('export-done')).toBeNull()
  })
})

describe('help-faq + document-reader', () => {
  it('FAQ accordion: เปิดได้ + ทางเข้าอ่านเต็ม /v2/help/doc/<slug>', async () => {
    render(wrap(<FaqScreen />))
    const item = await waitFor(() => screen.getByTestId('faq-item-what-is-qi'))
    fireEvent.click(item)
    expect(screen.getByTestId('faq-body-what-is-qi').textContent).toContain('พลังงานสะสม')
    expect(screen.getByTestId('faq-read-what-is-qi').getAttribute('href')).toBe('/v2/help/doc/what-is-qi')
  })

  it('F1 doc ไม่พบ (404) → "ไม่พบเอกสารนี้" + ทางกลับ FAQ', async () => {
    // mockImplementationOnce — ไม่งั้น implementation นี้ค้างไปเคสถัดไป (mockClear ไม่ล้าง implementation)
    fetchMock.mockImplementationOnce(async (url: string) =>
      String(url).includes('/api/faq')
        ? { ok: false, status: 404, json: async () => ({ error: 'ไม่พบบทความนี้' }) }
        : { ok: true, status: 200, json: async () => ({}) },
    )
    render(wrap(<DocReaderScreen slug="nope" />))
    await waitFor(() => expect(screen.getByTestId('doc-notfound')).toBeTruthy())
    expect(screen.getByTestId('doc-back-faq').getAttribute('href')).toBe('/v2/help/faq')
  })

  it('doc เจอบทความ → title + body จาก engine', async () => {
    render(wrap(<DocReaderScreen slug="payments" />))
    await waitFor(() => expect(screen.getByTestId('doc-title').textContent).toBe('การชำระเงิน'))
    expect(screen.getByTestId('doc-body').textContent).toContain('พร้อมเพย์')
  })
})
