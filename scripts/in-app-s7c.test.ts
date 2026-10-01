// scripts/in-app-s7c.test.ts — mumate-login-identity slice 7c (2026-10-02).
// ทุกการล็อกอินต้องจบในเบราว์เซอร์จริง: ตรวจว่าอยู่ใน in-app ของใคร, พาออกด้วย URL ที่ถูกต่อบริบท, โค้ดเชิญติดไปด้วย,
// และ entry เก่าผ่าน LIFF URL (?liff.state=) ยังพาไปหน้าที่ตั้งใจได้แม้ไม่ boot LIFF SDK แล้ว.
import { describe, expect, it } from 'vitest'
import {
  chromeIntentUrl,
  externalNavigation,
  inAppBrowserKind,
  isSocialInAppBrowser,
  withQueryParam,
} from '@/lib/browser/in-app'
import { REFERRAL_KEY, cleanRef, escapeLabels, loginEscapeUrl } from '@/lib/browser/login-escape'
import { REFERRAL_STORAGE_KEY } from '@/pages/invite/[code]'
import { liffStateTarget } from '@/components/liff-state-route'

const UA = {
  // walk 2026-10-02 (Galaxy Z Flip, แอป Facebook) — ตัดให้สั้นแต่คงโทเค็นที่ใช้ตัดสิน
  fbAndroid:
    'Mozilla/5.0 (Linux; Android 16; SM-F766B Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.52 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
  fbIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]',
  messengerAndroid: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/440.0.0.0;]',
  igAndroid: 'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
  lineIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
}

describe('inAppBrowserKind', () => {
  it('แยก LINE / Facebook (รวม Messenger) / Instagram', () => {
    expect(inAppBrowserKind(UA.lineIos)).toBe('line')
    expect(inAppBrowserKind(UA.fbAndroid)).toBe('facebook')
    expect(inAppBrowserKind(UA.fbIos)).toBe('facebook')
    expect(inAppBrowserKind(UA.messengerAndroid)).toBe('facebook')
    expect(inAppBrowserKind(UA.igAndroid)).toBe('instagram')
  })
  it('เบราว์เซอร์จริง → null (Facebook บน Mac เปิด Chrome ปกติ — walk 2026-10-02)', () => {
    expect(inAppBrowserKind(UA.chromeAndroid)).toBeNull()
    expect(inAppBrowserKind(UA.safariIos)).toBeNull()
    expect(inAppBrowserKind(UA.macChrome)).toBeNull()
  })
  it('isSocialInAppBrowser = Facebook/Instagram เท่านั้น (LINE มีทางของตัวเอง)', () => {
    expect(isSocialInAppBrowser(UA.fbAndroid)).toBe(true)
    expect(isSocialInAppBrowser(UA.igAndroid)).toBe(true)
    expect(isSocialInAppBrowser(UA.lineIos)).toBe(false)
    expect(isSocialInAppBrowser(UA.chromeAndroid)).toBe(false)
  })
})

describe('externalNavigation — ทางออกตามบริบท', () => {
  const url = 'https://bazichart.mumate.co/v2/login?ref=MUMATE190'

  it('Android Facebook/Instagram → intent:// Chrome พร้อม fallback URL เดิม', () => {
    const nav = externalNavigation(url, UA.fbAndroid)
    expect(nav.via).toBe('href')
    if (nav.via !== 'href') return
    expect(nav.url.startsWith('intent://bazichart.mumate.co/v2/login?ref=MUMATE190#Intent;')).toBe(true)
    expect(nav.url).toContain('scheme=https;package=com.android.chrome;')
    expect(nav.url).toContain(`S.browser_fallback_url=${encodeURIComponent(url)};end`)
    expect(externalNavigation(url, UA.igAndroid).via).toBe('href')
  })
  it('iOS Facebook → x-safari-https://', () => {
    expect(externalNavigation(url, UA.fbIos)).toEqual({ via: 'href', url: `x-safari-${url}` })
  })
  it('LINE → LIFF openWindow ถ้าอยู่ใน LIFF browser, ไม่งั้น ?openExternalBrowser=1 (คง query เดิม)', () => {
    expect(externalNavigation(url, UA.lineIos)).toEqual({
      via: 'line',
      liffUrl: url,
      hrefUrl: 'https://bazichart.mumate.co/v2/login?ref=MUMATE190&openExternalBrowser=1',
    })
  })
  it('เบราว์เซอร์จริง → window.open ปกติ', () => {
    expect(externalNavigation(url, UA.chromeAndroid)).toEqual({ via: 'window', url })
  })
  it('helpers', () => {
    expect(withQueryParam('https://a.co/x', 'openExternalBrowser', '1')).toBe('https://a.co/x?openExternalBrowser=1')
    expect(chromeIntentUrl('https://a.co/x?y=1')).toBe(
      `intent://a.co/x?y=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent('https://a.co/x?y=1')};end`,
    )
  })
})

describe('login escape — โค้ดเชิญต้องตามไปเบราว์เซอร์จริง', () => {
  it('key เดียวกับหน้า /invite', () => {
    expect(REFERRAL_KEY).toBe(REFERRAL_STORAGE_KEY)
  })
  it('loginEscapeUrl ใส่ ?ref เมื่อมีโค้ด', () => {
    expect(loginEscapeUrl('https://bazichart.mumate.co', 'MUMATE190')).toBe('https://bazichart.mumate.co/v2/login?ref=MUMATE190')
    expect(loginEscapeUrl('https://bazichart.mumate.co', null)).toBe('https://bazichart.mumate.co/v2/login')
  })
  it('cleanRef รับเฉพาะโค้ดหน้าตาปกติ', () => {
    expect(cleanRef('MUMATE190')).toBe('MUMATE190')
    expect(cleanRef(['MUMATE190', 'x'])).toBe('MUMATE190')
    expect(cleanRef('<script>')).toBeNull()
    expect(cleanRef('')).toBeNull()
    expect(cleanRef(undefined)).toBeNull()
  })
  it('escapeLabels: ชื่อแอป + เบราว์เซอร์ปลายทาง; ไม่ใช่ FB/IG → null', () => {
    expect(escapeLabels(UA.fbAndroid)).toEqual({ appName: 'Facebook', browserName: 'Chrome' })
    expect(escapeLabels(UA.fbIos)).toEqual({ appName: 'Facebook', browserName: 'Safari' })
    expect(escapeLabels(UA.igAndroid)).toEqual({ appName: 'Instagram', browserName: 'Chrome' })
    expect(escapeLabels(UA.lineIos)).toBeNull()
    expect(escapeLabels(UA.macChrome)).toBeNull()
  })
})

describe('liffStateTarget — entry เก่าผ่าน LIFF URL โดยไม่ boot SDK', () => {
  it('?liff.state=/path → path ภายในเว็บ', () => {
    expect(liffStateTarget('?liff.state=%2Fv2%2Fcalendar')).toBe('/v2/calendar')
    expect(liffStateTarget('?liff.state=%2Fv2%2Fqi%3Ftab%3Dmissions&x=1')).toBe('/v2/qi?tab=missions')
  })
  it('ไม่มี / ไม่ปลอดภัย → null (กัน open redirect)', () => {
    expect(liffStateTarget('')).toBeNull()
    expect(liffStateTarget('?liff.state=https%3A%2F%2Fevil.com')).toBeNull()
    expect(liffStateTarget('?liff.state=%2F%2Fevil.com')).toBeNull()
  })
})
